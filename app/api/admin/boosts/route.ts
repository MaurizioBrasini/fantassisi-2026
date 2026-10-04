import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllRows } from "@/lib/fetchAll";
import { CONFIG_ISCRIZIONE } from "@/lib/config";
import { accruedBoostPoints, planBoost, MAX_POINTS_PER_PERSON } from "@/lib/boosts";
import { planPublicBonus, validateClass, yearLabel, teamForYear, type PublicTarget } from "@/lib/publicBonus";
import { deleteById } from "@/lib/adminCrud";

export const dynamic = "force-dynamic";

const MAX_POINTS = 10000;
const MAX_MINUTES = 3 * 24 * 60; // tutta la durata dell'evento
const MAX_REASON = 120;
const INSERT_BATCH = 500;
const denied = () => NextResponse.json({ message: "Accesso negato" }, { status: 403 });
const bad = (message: string) => NextResponse.json({ message }, { status: 400 });

// GET: elenco dei bonus (nascosti e palesi) con i punti già maturati — admin o staff.
export async function GET() {
  if (!(await requireRole("admin", "staff"))) return denied();

  const supabase = getSupabaseAdmin();
  const [boosts, allocations] = await Promise.all([
    supabase.from("team_boosts").select("*").order("created_at", { ascending: false }).limit(200),
    fetchAllRows<{ boost_id: string; points: number }>(supabase, "boost_allocations", "boost_id, points", {
      filter: (q) => q.lte("at", new Date().toISOString()),
    }).catch(() => []),
  ]);
  if (boosts.error) return NextResponse.json({ message: boosts.error.message }, { status: 500 });

  const accrued = new Map<string, number>();
  for (const a of allocations) accrued.set(a.boost_id, (accrued.get(a.boost_id) || 0) + a.points);
  const list = (boosts.data || []).map((b: any) => (b.distributed ? { ...b, accrued: accrued.get(b.id) || 0 } : b));
  return NextResponse.json({ boosts: list }, { headers: { "Cache-Control": "no-store" } });
}

// POST: crea un bonus — admin o staff. Due modi, scelti da `mode`:
//
//  "hidden" (predefinito) — NASCOSTO, a tempo: imita i voti veri. Circa il 20-25% dei punti va solo alla
//  squadra, il resto a partecipanti confermati della squadra scelti a caso, da 1 a 4 ciascuno in totale
//  per questo intervento, in momenti casuali dell'intervallo; contano come voti (squadra, individuali,
//  classi, sedi). Se il database non ha ancora la tabella per questo modo (vedi
//  sql/03_boost_allocations.sql) si ricade sul vecchio bonus "solo squadra". Body: { team, points, minutes }.
//
//  "public" — PALESE e immediato: un premio a una persona, una classe o una sede, con un motivo che
//  compare nel banner celebrativo. Si ramifica come in lib/publicBonus.ts. Richiede
//  sql/07_public_bonuses.sql. Body: { target: {type, ...}, points, reason }.
export async function POST(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) return denied();

  const body = await request.json();
  const p = Number(body.points);
  if (!Number.isInteger(p) || p < 1 || p > MAX_POINTS) {
    return bad(`Punti: un numero intero tra 1 e ${MAX_POINTS}`);
  }

  return body.mode === "public" ? createPublicBonus(body, p, requester.id) : createHiddenBoost(body, p, requester.id);
}

async function createHiddenBoost(body: any, p: number, requesterId: string) {
  const { team, minutes } = body;
  const m = Number(minutes);
  if (team !== "Matricole" && team !== "Veterani") return bad("Squadra non valida");
  if (!Number.isFinite(m) || m < 1 || m > MAX_MINUTES) return bad(`Durata: tra 1 e ${MAX_MINUTES} minuti`);

  const supabase = getSupabaseAdmin();
  const start = new Date();
  const end = new Date(start.getTime() + Math.round(m * 60_000));
  const row = { team, total_points: p, start_at: start.toISOString(), end_at: end.toISOString(), created_by: requesterId };

  const distributed = await supabase.from("team_boosts").insert({ ...row, distributed: true }).select().single();
  if (!distributed.error) {
    const boost = distributed.data;
    const undo = () => supabase.from("team_boosts").delete().eq("id", boost.id); // le assegnazioni seguono (cascade)

    const people = await fetchAllRows<{ id: string }>(supabase, "users", "id", {
      filter: (q) => q.eq("team", team).eq("role", "student").eq("status", "confermato"),
    });
    const { allocations, peoplePoints, teamPoints } = planBoost(people.map((u) => u.id), p, start.getTime(), end.getTime());

    for (let i = 0; i < allocations.length; i += INSERT_BATCH) {
      const { error } = await supabase
        .from("boost_allocations")
        .insert(allocations.slice(i, i + INSERT_BATCH).map((a) => ({ ...a, boost_id: boost.id, team })));
      if (error) {
        await undo();
        return NextResponse.json({ message: "Errore nell'assegnare i punti alle persone: " + error.message }, { status: 500 });
      }
    }
    return NextResponse.json({
      boost,
      message: `Bonus avviato: ${peoplePoints} punti a ${allocations.filter((a) => a.user_id).length} partecipanti ${team} (da 1 a ${MAX_POINTS_PER_PERSON} ciascuno) e ${teamPoints} solo alla squadra`,
    });
  }

  // Modo distribuito non ancora disponibile nel database: come prima, solo punteggio di squadra.
  const { data, error } = await supabase.from("team_boosts").insert(row).select().single();
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ boost: data, message: "Bonus avviato (solo punteggio di squadra: il modo a persone non è ancora attivo nel database)" });
}

async function createPublicBonus(body: any, p: number, requesterId: string) {
  const reason = String(body.reason || "").trim();
  if (!reason) return bad("Scrivi il motivo del premio: compare nel banner");
  if (reason.length > MAX_REASON) return bad(`Motivo troppo lungo (massimo ${MAX_REASON} caratteri)`);

  const t = body.target || {};
  const supabase = getSupabaseAdmin();
  let target: PublicTarget;
  let label: string;
  let team: string | null = null;

  if (t.type === "person") {
    const { data: user } = await supabase
      .from("users")
      .select("id, first_name, last_name, team, role")
      .eq("id", String(t.userId || ""))
      .maybeSingle();
    if (!user) return bad("Persona non trovata");
    if (user.team !== "Matricole" && user.team !== "Veterani") {
      return bad("Questa persona non è in una squadra (Didatti&Docenti non ricevono punti)");
    }
    target = { type: "person", userId: user.id };
    label = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Partecipante";
    team = user.team;
  } else if (t.type === "class") {
    const school = String(t.school || ""), site = String(t.site || ""), year = String(t.year || "");
    const err = validateClass(school, site, year);
    if (err) return bad(err);
    target = { type: "class", school, site, year };
    label = `${school} ${site} ${yearLabel(year)}`;
    team = teamForYear(year);
  } else if (t.type === "site") {
    const site = String(t.site || "");
    if (!CONFIG_ISCRIZIONE.sedi.includes(site)) return bad("Sede non valida");
    target = { type: "site", site };
    label = site;
  } else {
    return bad("Destinatario non valido");
  }

  const { allocations, summary } = planPublicBonus(target, p, team);
  if (allocations.length === 0) return bad("Con questi punti non resta nulla da assegnare");

  const now = new Date().toISOString();
  const created = await supabase
    .from("team_boosts")
    .insert({
      team, total_points: p, start_at: now, end_at: now, created_by: requesterId, distributed: true,
      kind: "public", reason, target_type: target.type, target_label: label,
    })
    .select()
    .single();
  if (created.error) {
    return NextResponse.json(
      { message: "Impossibile salvare il premio (hai eseguito sql/07_public_bonuses.sql?): " + created.error.message },
      { status: 500 }
    );
  }
  const boost = created.data;

  const { error } = await supabase.from("boost_allocations").insert(allocations.map((a) => ({ ...a, boost_id: boost.id, at: now })));
  if (error) {
    await supabase.from("team_boosts").delete().eq("id", boost.id);
    return NextResponse.json({ message: "Errore nell'assegnare i punti: " + error.message }, { status: 500 });
  }
  return NextResponse.json({ boost, message: `Premio assegnato a ${label}: ${summary}` });
}

// PATCH: ferma un bonus in corso — admin o staff. Restano i punti già maturati,
// quelli non ancora maturati non entrano più.
export async function PATCH(request: Request) {
  if (!(await requireRole("admin", "staff"))) return denied();

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ message: "ID mancante" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: boost, error: readErr } = await supabase.from("team_boosts").select("*").eq("id", id).single();
  if (readErr || !boost) {
    return NextResponse.json({ message: "Bonus non trovato" }, { status: 404 });
  }

  const now = Date.now();
  if (now >= Date.parse(boost.end_at)) {
    return NextResponse.json({ success: true, message: "Già concluso" });
  }

  // Bonus a persone: si tolgono le assegnazioni non ancora scattate e si tengono le altre.
  // Bonus solo squadra: maturazione lineare fino a ora.
  let accrued: number;
  if (boost.distributed) {
    const del = await supabase.from("boost_allocations").delete().eq("boost_id", id).gt("at", new Date(now).toISOString());
    if (del.error) return NextResponse.json({ message: del.error.message }, { status: 500 });
    const kept = await fetchAllRows<{ points: number }>(supabase, "boost_allocations", "points", {
      filter: (q) => q.eq("boost_id", id),
    });
    accrued = kept.reduce((sum, a) => sum + a.points, 0);
  } else {
    accrued = accruedBoostPoints(boost, now);
  }

  if (accrued <= 0) {
    // Nulla maturato finora: tanto vale eliminarlo (total_points deve essere > 0).
    const { error } = await supabase.from("team_boosts").delete().eq("id", id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, accrued: 0 });
  }

  const { error } = await supabase
    .from("team_boosts")
    .update({ total_points: accrued, end_at: new Date(now).toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, accrued });
}

// DELETE: elimina un bonus, togliendo anche i punti già maturati — solo admin
export const DELETE = (request: Request) => deleteById(request, "team_boosts");
