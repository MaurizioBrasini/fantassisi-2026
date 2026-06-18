import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const userId = cookies().get("user_id")?.value;
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { eventId } = await request.json();
  if (!eventId) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verifica se l'utente ha già votato questo evento
  const { data: existing } = await supabase
    .from("event_votes")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Hai già votato questo evento" }, { status: 409 });
  }

  const { error } = await supabase
    .from("event_votes")
    .insert({ user_id: userId, event_id: eventId });

  if (error) {
    return NextResponse.json({ error: "Errore nel salvataggio del voto evento" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
