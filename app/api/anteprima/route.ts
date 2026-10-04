import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin, TEAM_PINS } from "@/lib/pins";
import { CONFIG_ISCRIZIONE } from "@/lib/config";
import { canonClass, sameClass } from "@/lib/classKey";
import { withLock } from "@/lib/userLock";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventRow = { id: string; title: string | null; qr_code: string; pin: string | null; created_at: string };
const FIELDS = "id, title, qr_code, pin, created_at";

const CLASS_YEARS = ["primo", "secondo", "terzo", "quarto"];

// I QR di classe sono pochi (una cinquantina): si leggono tutti e si cercano con il confronto che
// ignora la grafia (anno "4° ANNO 2026" o "quarto", scuola "CCMA Marco Aurelio" o "CCMA", ...).
// Cache di pochi secondi: l'Anteprima viene aperta da tutti i partecipanti.
type ClassEvent = EventRow & { active: boolean | null; class_school: string | null; class_site: string | null; class_year: string | null };
let classCache: { at: number; rows: ClassEvent[] } | null = null;

async function findClassEvents(mine: { school: string | null; site: string | null; year: string | null }): Promise<ClassEvent[]> {
  if (!classCache || Date.now() - classCache.at > 10_000) {
    const { data } = await getSupabaseAdmin()
      .from("votable_events")
      .select(FIELDS + ", active, class_school, class_site, class_year")
      .eq("qr_type", "class")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    classCache = { at: Date.now(), rows: (data || []) as unknown as ClassEvent[] };
  }
  return classCache.rows.filter((r) => sameClass({ school: r.class_school, site: r.class_site, year: r.class_year }, mine));
}
// Fase Anteprima: a ogni partecipante servono il QR (e il PIN) della propria squadra e della propria
// classe, da mettere nelle slides delle relazioni. Sono i normali QR di voto (votable_events), che
// scansionati votano solo quando il voto è aperto. Il QR di classe, se manca, si crea qui al primo
// bisogno: così ogni classe ha il suo senza doverli generare uno per uno dal pannello.
export async function GET() {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from("users").select("team, school, site, year").eq("id", userId).maybeSingle();
  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }
  if (user.team !== "Matricole" && user.team !== "Veterani") {
    return NextResponse.json({ team: null, class: null });
  }

  // QR di squadra: quello col PIN fisso se esiste, altrimenti il più vecchio.
  const { data: teamEvents } = await supabase
    .from("votable_events")
    .select(FIELDS)
    .eq("qr_type", "team")
    .eq("team_target", user.team)
    .neq("active", false)
    .order("created_at", { ascending: true });
  const teamRows = (teamEvents || []) as EventRow[];
  const teamEvent = teamRows.find((e) => e.pin === TEAM_PINS[user.team as "Matricole" | "Veterani"]) || teamRows[0] || null;

  // QR di classe: solo per gli studenti in corso (1°-4° anno) con scuola e sede. Pre-iscritti, ex
  // allievi e docenti non hanno una classe. La classe si riconosce in qualunque grafia (classKey).
  let classEvent: EventRow | null = null;
  let classLabel = "";
  const mine = canonClass(user.school, user.site, user.year);
  if (mine.school && mine.site && mine.year && CLASS_YEARS.includes(mine.year)) {
    const yearLabel = CONFIG_ISCRIZIONE.anni.find((a) => a.value === mine.year)?.label || mine.year;
    classLabel = `${mine.school} ${mine.site} ${yearLabel}`;

    let rows = await findClassEvents(mine);
    if (rows.length === 0) {
      // Creazione una alla volta per classe: due compagni che aprono insieme non ne creano due.
      rows = await withLock(`class:${mine.school}|${mine.site}|${mine.year}`, async () => {
        classCache = null;
        const again = await findClassEvents(mine);
        if (again.length > 0) return again;
        const teamTarget = (CONFIG_ISCRIZIONE.teamAnniValid.Matricole as string[]).includes(mine.year!) ? "Matricole" : "Veterani";
        const { error } = await supabase.from("votable_events").insert({
          title: classLabel,
          qr_type: "class",
          team_target: teamTarget,
          class_school: mine.school,
          class_site: mine.site,
          class_year: mine.year,
          qr_code: `QR:${randomUUID()}`,
          pin: await generateUnusedPin(),
          active: true,
        });
        if (error) console.error("Anteprima: creazione QR classe fallita:", error.message);
        classCache = null;
        return findClassEvents(mine);
      });
    }
    // Un QR di classe spento dall'admin conta come esistente (non se ne crea un altro) ma non si mostra.
    classEvent = rows.find((r) => r.active !== false) || null;
  }
  const pick = (e: EventRow | null) => (e ? { title: e.title, qr_code: e.qr_code, pin: e.pin } : null);
  return NextResponse.json(
    { team: pick(teamEvent), class: pick(classEvent), className: classLabel },
    { headers: { "Cache-Control": "no-store" } }
  );
}
