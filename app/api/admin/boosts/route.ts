import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllRows } from "@/lib/fetchAll";
import { accruedBoostPoints, planAllocations, MAX_POINTS_PER_PERSON } from "@/lib/boosts";
import { deleteById } from "@/lib/adminCrud";

const MAX_POINTS = 10000;
const MAX_MINUTES = 3 * 24 * 60; // tutta la durata dell'evento
const INSERT_BATCH = 500;

// POST: crea un bonus a tempo — solo admin. Parte subito.
//
// Modo normale: i punti vanno a partecipanti confermati della squadra scelti a caso, da 1 a 4
// ciascuno in totale per questo intervento, in momenti casuali dell'intervallo; contano come voti
// (squadra, individuali, classi, sedi). Se il database non ha ancora la tabella per questo modo
// (vedi sql/2026-10-02_boost_allocations.sql) si ricade sul vecchio bonus "solo squadra".
export async function POST(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { team, points, minutes } = await request.json();
  const p = Number(points);
  const m = Number(minutes);
  if (team !== "Matricole" && team !== "Veterani") {
    return NextResponse.json({ message: "Squadra non valida" }, { status: 400 });
  }
  if (!Number.isInteger(p) || p < 1 || p > MAX_POINTS) {
    return NextResponse.json({ message: `Punti: un numero intero tra 1 e ${MAX_POINTS}` }, { status: 400 });
  }
  if (!Number.isFinite(m) || m < 1 || m > MAX_MINUTES) {
    return NextResponse.json({ message: `Durata: tra 1 e ${MAX_MINUTES} minuti` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const start = new Date();
  const end = new Date(start.getTime() + Math.round(m * 60_000));
  const row = { team, total_points: p, start_at: start.toISOString(), end_at: end.toISOString(), created_by: requester.id };

  const distributed = await supabase.from("team_boosts").insert({ ...row, distributed: true }).select().single();
  if (!distributed.error) {
    const boost = distributed.data;
    const undo = () => supabase.from("team_boosts").delete().eq("id", boost.id); // le assegnazioni seguono (cascade)

    const people = await fetchAllRows<{ id: string }>(supabase, "users", "id", {
      filter: (q) => q.eq("team", team).eq("role", "student").eq("status", "confermato"),
    });
    const { allocations, leftover } = planAllocations(people.map((u) => u.id), p, start.getTime(), end.getTime());
    if (leftover > 0) {
      await undo();
      const max = people.length * MAX_POINTS_PER_PERSON;
      return NextResponse.json(
        { message: `Troppi punti: con ${people.length} partecipanti ${team} se ne possono dare al massimo ${max} (${MAX_POINTS_PER_PERSON} a persona).` },
        { status: 400 }
      );
    }

    for (let i = 0; i < allocations.length; i += INSERT_BATCH) {
      const { error } = await supabase
        .from("boost_allocations")
        .insert(allocations.slice(i, i + INSERT_BATCH).map((a) => ({ ...a, boost_id: boost.id })));
      if (error) {
        await undo();
        return NextResponse.json({ message: "Errore nell'assegnare i punti alle persone: " + error.message }, { status: 500 });
      }
    }
    return NextResponse.json({
      boost,
      message: `Bonus avviato: ${p} punti a ${allocations.length} partecipanti ${team}, da 1 a ${MAX_POINTS_PER_PERSON} ciascuno`,
    });
  }

  // Modo distribuito non ancora disponibile nel database: come prima, solo punteggio di squadra.
  const { data, error } = await supabase.from("team_boosts").insert(row).select().single();
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ boost: data, message: "Bonus avviato (solo punteggio di squadra: il modo a persone non è ancora attivo nel database)" });
}

// PATCH: ferma un bonus in corso — solo admin. Restano i punti già maturati,
// quelli non ancora maturati non entrano più.
export async function PATCH(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

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
