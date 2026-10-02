import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { accruedBoostPoints } from "@/lib/boosts";

const MAX_POINTS = 10000;
const MAX_MINUTES = 3 * 24 * 60; // tutta la durata dell'evento

// POST: crea un bonus a tempo — solo admin. Parte subito e matura linearmente.
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

  const start = new Date();
  const end = new Date(start.getTime() + Math.round(m * 60_000));

  const { data, error } = await getSupabaseAdmin()
    .from("team_boosts")
    .insert({
      team,
      total_points: p,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      created_by: requester.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ boost: data });
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
  const { data: boost, error: readErr } = await supabase
    .from("team_boosts")
    .select("*")
    .eq("id", id)
    .single();
  if (readErr || !boost) {
    return NextResponse.json({ message: "Bonus non trovato" }, { status: 404 });
  }

  const now = Date.now();
  if (now >= Date.parse(boost.end_at)) {
    return NextResponse.json({ success: true, message: "Già concluso" });
  }

  const accrued = accruedBoostPoints(boost, now);
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
export async function DELETE(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "ID mancante" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from("team_boosts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
