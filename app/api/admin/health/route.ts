import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getVotingPhase } from "@/lib/phase";
import { getStandings, standingsStats } from "@/lib/standings";
import { TEAM_PINS } from "@/lib/pins";
import { canonClass } from "@/lib/classKey";

export const dynamic = "force-dynamic";

type Check = { area: string; name: string; status: "ok" | "warn" | "error"; detail: string };

// "Stato del sistema" (solo admin): un clic per sapere se tutto ciò che serve all'app è al suo posto —
// variabili d'ambiente su Render, migrazioni SQL eseguite su Supabase, PIN di squadra, QR di classe,
// fase del gioco, velocità delle classifiche. Non modifica nulla e non mostra mai i valori segreti.
export async function GET() {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const checks: Check[] = [];
  const add = (area: string, name: string, status: Check["status"], detail: string) => checks.push({ area, name, status, detail });
  const supabase = getSupabaseAdmin();

  // --- Variabili d'ambiente (solo presenza, mai il valore) ---
  const required: [string, string][] = [
    ["NEXT_PUBLIC_SUPABASE_URL", "indirizzo del database"],
    ["SUPABASE_SERVICE_ROLE_KEY", "chiave del server per il database"],
    ["SESSION_SECRET", "firma dei cookie di accesso"],
    ["RESEND_API_KEY", "invio delle email"],
    ["RESEND_FROM", "mittente delle email"],
  ];
  for (const [key, what] of required) {
    add("Render", key, process.env[key] ? "ok" : "error", process.env[key] ? `presente (${what})` : `MANCA: ${what}`);
  }
  add("Render", "RESEND_REPLY_TO", process.env.RESEND_REPLY_TO ? "ok" : "warn", process.env.RESEND_REPLY_TO ? "presente" : "manca: niente indirizzo di risposta nelle email");
  add("Render", "COINS_START_DATE", "ok", process.env.COINS_START_DATE ? `impostata: ${process.env.COINS_START_DATE}` : "non impostata: i coin si accumulano dal 16 ottobre 2026");

  // --- Stato del database (sql/09_aggregates.sql fornisce il controllo completo) ---
  const db = await supabase.rpc("fantassisi_db_check");
  if (db.error || !db.data) {
    add("Supabase", "09 somme e controlli", "warn", "funzioni di sql/09_aggregates.sql non trovate: classifiche con il metodo lento. Eseguire 09.");
  } else {
    const d = db.data as Record<string, boolean>;
    add("Supabase", "03 bonus a persone", d.boost_allocations ? "ok" : "error", d.boost_allocations ? "tabella boost_allocations presente" : "MANCA: eseguire sql/03_boost_allocations.sql");
    add("Supabase", "04 rivoto a tempo", d.old_unique_event_vote_index ? "error" : "ok", d.old_unique_event_vote_index ? "c'è ancora l'indice vecchio: il secondo voto allo stesso QR darà errore. Eseguire sql/04" : "indice vecchio rimosso");
    add("Supabase", "04 indice attese", d.event_vote_time_index ? "ok" : "warn", d.event_vote_time_index ? "presente" : "manca l'indice per le attese di rivoto (più lento)");
    add("Supabase", "05 fase del gioco", d.app_settings ? "ok" : "error", d.app_settings ? "tabella app_settings presente" : "MANCA: l'interruttore della fase non si salva. Eseguire sql/05");
    add("Supabase", "07 premi palesi", d.public_bonus_columns && d.allocation_class_columns ? "ok" : "error", d.public_bonus_columns && d.allocation_class_columns ? "colonne presenti" : "MANCANO: eseguire sql/07_public_bonuses.sql");
    add("Supabase", "09 indice karaoke", d.event_votes_voted_at_index ? "ok" : "warn", d.event_votes_voted_at_index ? "presente" : "manca (eseguire sql/09)");
  }

  // Saldo coin in una sola lettura (09): usato a ogni apertura della dashboard e a ogni voto.
  const coinStart = Date.now();
  const coin = await supabase.rpc("coin_usage", { p_user: requester.id, p_since: new Date(Date.now() - 86_400_000).toISOString() });
  const coinOk = !coin.error && coin.data && typeof (coin.data as any).votes === "number";
  add("Supabase", "09 saldo coin", coinOk ? "ok" : "warn",
    coinOk ? `funzione coin_usage attiva (${Date.now() - coinStart} ms)` : `funzione coin_usage non disponibile, si usano letture separate (più lente): ${coin.error?.message || "risposta inattesa"}. Rieseguire sql/09`);

  // --- QR di squadra (06) e QR di classe (08) ---
  const { data: events, error: evError } = await supabase
    .from("votable_events")
    .select("id, title, qr_type, team_target, class_school, class_site, class_year, pin, active");
  if (evError || !events) {
    add("QR", "lettura dei QR", "error", evError?.message || "impossibile leggere i QR");
  } else {
    for (const team of ["Matricole", "Veterani"] as const) {
      const rows = events.filter((e: any) => e.qr_type === "team" && e.team_target === team);
      const fixed = rows.find((e: any) => e.pin === TEAM_PINS[team]);
      add("QR", `squadra ${team}`, rows.length === 1 && fixed && fixed.active !== false ? "ok" : "error",
        rows.length === 0 ? "nessun QR di squadra" : rows.length > 1 ? `${rows.length} QR di squadra (ne serve uno)` : !fixed ? `codice diverso da ${TEAM_PINS[team]}: eseguire sql/06` : fixed.active === false ? "QR disattivato" : `codice ${fixed.pin}, attivo`);
    }
    const classes = events.filter((e: any) => e.qr_type === "class");
    const seen = new Map<string, number>();
    let legacy = 0;
    for (const e of classes as any[]) {
      const c = canonClass(e.class_school, e.class_site, e.class_year);
      if (c.school !== e.class_school || c.site !== e.class_site || c.year !== e.class_year) legacy++;
      const key = `${c.school}|${c.site}|${c.year}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    const dups = Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k.replace(/\|/g, " "));
    add("QR", "QR di classe", dups.length ? "warn" : "ok", `${classes.length} QR${dups.length ? `; DOPPI: ${dups.join(", ")}` : ", nessun doppione"}`);
    add("QR", "grafie standard", legacy ? "warn" : "ok", legacy ? `${legacy} QR di classe con grafie vecchie: eseguire sql/08 (funzionano comunque)` : "tutti in forma standard");
  }

  // --- Fase del gioco ---
  const phase = await getVotingPhase();
  add("Gioco", "fase", "ok", `${phase.open ? "VOTO APERTO" : "ANTEPRIMA (voto chiuso)"} · modalità ${phase.mode} · apertura automatica ${new Date(phase.opensAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}`);

  // --- Classifiche: metodo e tempo dell'ultimo ricalcolo ---
  try {
    await getStandings();
    add("Classifiche", "calcolo", standingsStats.mode === "somme dal database" ? "ok" : "warn",
      `${standingsStats.mode || "non ancora calcolate"}${standingsStats.ms ? `, ${standingsStats.ms} ms` : ""}${standingsStats.error ? ` (somme non disponibili: ${standingsStats.error})` : ""}`);
  } catch (e: any) {
    add("Classifiche", "calcolo", "error", e?.message || "errore nel calcolo");
  }

  return NextResponse.json({ checks, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
