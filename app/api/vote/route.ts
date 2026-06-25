import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const voterId = cookies().get("user_id")?.value;
  if (!voterId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { recipientId } = await request.json();
  if (!recipientId) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  if (recipientId === voterId) {
    return NextResponse.json({ error: "Non puoi votare te stesso" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Il team e la sede si leggono qui, freschi dal database — non ci si fida
  // di nessun valore mandato dal browser per calcolare i punti.
  const [{ data: voter }, { data: recipient }] = await Promise.all([
    supabase.from("users").select("team, site").eq("id", voterId).single(),
    supabase.from("users").select("team, site").eq("id", recipientId).single(),
  ]);

  if (!voter) {
    return NextResponse.json({ error: "Votante non trovato" }, { status: 404 });
  }
  if (!recipient) {
    return NextResponse.json({ error: "Utente da votare non trovato" }, { status: 404 });
  }

  let points = 3;
  if (voter.team && voter.team === recipient.team) {
    points = voter.site && voter.site === recipient.site ? 1 : 2;
  }

  const today = new Date().toISOString().split("T")[0];
  const { count: votesToday } = await supabase
    .from("votes")
    .select("id", { count: "exact", head:
