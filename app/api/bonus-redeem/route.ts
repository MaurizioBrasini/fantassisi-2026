import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const userId = cookies().get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { bonusId } = await request.json();
  if (!bonusId) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Carica il bonus e verifica che sia attivo
  const { data: bonus } = await supabase
    .from("bonus_qr")
    .select("*")
    .eq("id", bonusId)
    .single();

  if (!bonus) {
    return NextResponse.json({ error: "Bonus non trovato" }, { status: 404 });
  }

  if (bonus.active === false) {
    return NextResponse.json({ error: "Questo QR bonus non è più attivo" }, { status: 403 });
  }

  // Verifica validità temporale se impostata
  const now = new Date();
  if (bonus.valid_from && new Date(bonus.valid_from) > now) {
    return NextResponse.json({ error: "Questo bonus non è ancora attivo" }, { status: 403 });
  }
  if (bonus.valid_to && new Date(bonus.valid_to) < now) {
    return NextResponse.json({ error: "Questo bonus è scaduto" }, { status: 403 });
  }

  // Verifica se l'utente ha già riscattato questo bonus
  const { data: existing } = await supabase
    .from("bonus_redemptions")
    .select("id")
    .eq("user_id", userId)
    .eq("bonus_id", bonusId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Hai già riscattato questo bonus" }, { status: 409 });
  }

  const { error } = await supabase
    .from("bonus_redemptions")
    .insert({ user_id: userId, bonus_id: bonusId });

  if (error) {
    return NextResponse.json({ error: "Errore nel riscatto del bonus" }, { status: 500 });
  }

  return NextResponse.json({ success: true, amount: bonus.amount, title: bonus.title });
}
