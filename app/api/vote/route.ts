import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { startOfTodayInRomeISO } from "@/lib/utils";

export async function POST(request: Request) {
  const voterId = getVerifiedUserId();
  if (!voterId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { recipientId: bodyRecipientId, pin } = await request.json();
  if (!bodyRecipientId && !pin) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fallback per chi non riesce a scansionare: PIN a 4 cifre stampato sotto
  // il proprio QR, risolto qui allo stesso id del destinatario.
  let recipientId = bodyRecipientId;
  if (!recipientId && pin) {
    const { data: byPin } = await supabase.from("users").select("id").eq("pin", String(pin)).maybeSingle();
    if (!byPin) {
      return NextResponse.json({ error: "PIN non valido" }, { status: 404 });
    }
    recipientId = byPin.id;
  }

  if (recipientId === voterId) {
    return NextResponse.json({ error: "Non puoi votare te stesso" }, { status: 400 });
  }

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

  // --- NUOVA LOGICA PUNTEGGI ---
  const isVoterValid = voter.team === "Matricole" || voter.team === "Veterani";
  const isRecipientValid = recipient.team === "Matricole" || recipient.team === "Veterani";

  // Didatti&Docenti possono votare ma non essere votati: ogni voto deve andare
  // a una squadra (Matricole/Veterani), altrimenti non entra in nessuna classifica.
  if (!isRecipientValid) {
    return NextResponse.json({ error: "Non puoi votare un Didatta/Docente" }, { status: 400 });
  }

  let points = 1; // default

  // Raddoppia solo se entrambi sono in squadre diverse e valide
  if (isVoterValid && voter.team !== recipient.team) {
    points = 2;
  }

  const { count: votesToday } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("voter_id", voterId)
    .gte("voted_at", startOfTodayInRomeISO());

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

  return NextResponse.json({ success: true, points });
}
