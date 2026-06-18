import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const voterId = cookies().get("user_id")?.value;
  if (!voterId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { recipientId, points } = await request.json();
  if (!recipientId || typeof points !== "number") {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  if (recipientId === voterId) {
    return NextResponse.json({ error: "Non puoi votare te stesso" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Controllo crediti giornalieri
  const today = new Date().toISOString().split("T")[0];
  const { count: votesToday } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("voter_id", voterId)
    .gte("voted_at", today);

  if ((votesToday || 0) >= 20) {
    return NextResponse.json({ error: "Crediti giornalieri esauriti" }, { status: 400 });
  }

  const { error } = await supabase
    .from("votes")
    .insert({ voter_id: voterId, recipient_id: recipientId, points });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Hai già votato questa persona oggi" }, { status: 409 });
    }
    return NextResponse.json({ error: "Errore nel salvataggio del voto" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
