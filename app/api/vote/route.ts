import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getCoinBalance, OUT_OF_COINS_MESSAGE } from "@/lib/coins";
import { votingClosedResponse } from "@/lib/phase";
import { withLock } from "@/lib/userLock";

export async function POST(request: Request) {
  const voterId = getVerifiedUserId();
  if (!voterId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: { recipientId?: string; pin?: string | number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
  if (!body.recipientId && !body.pin) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  // Una azione di voto alla volta per persona: vedi lib/userLock.ts.
  return withLock(`vote:${voterId}`, () => voteForPerson(voterId, body));
}

async function voteForPerson(voterId: string, { recipientId: bodyRecipientId, pin }: { recipientId?: string; pin?: string | number }) {
  const supabase = getSupabaseAdmin();

  // Fallback per chi non riesce a scansionare: PIN a 4 cifre stampato sotto
  // il proprio QR, risolto qui allo stesso id del destinatario.
  const votingViaPin = !bodyRecipientId && !!pin;
  let recipientId = bodyRecipientId;
  if (!recipientId && pin) {
    const { data: byPin } = await supabase.from("users").select("id").eq("pin", String(pin)).maybeSingle();
    if (!byPin) {
      return NextResponse.json({ error: "PIN non valido" }, { status: 404 });
    }
    recipientId = byPin.id;
  }

  // Dopo la ricerca del PIN: un PIN che non è di una persona (404 sopra) passa ancora a /api/qr/redeem,
  // dove i bonus ricarica restano riscattabili anche in anteprima.
  const closed = await votingClosedResponse();
  if (closed) return closed;

  if (recipientId === voterId) {
    // Errore frequente in collaudo: la gente inserisce il PROPRIO PIN invece
    // di quello della persona che vuole votare. Messaggio mirato per questo caso.
    const message = votingViaPin
      ? "Hai inserito il TUO PIN. Devi inserire il PIN della persona che vuoi votare, non il tuo."
      : "Non puoi votare te stesso";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const [{ data: voter }, { data: recipient }] = await Promise.all([
    supabase.from("users").select("team, site").eq("id", voterId).single(),
    supabase.from("users").select("team, site").eq("id", String(recipientId)).single(),
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

  if ((await getCoinBalance(supabase, voterId)).remaining <= 0) {
    return NextResponse.json({ error: OUT_OF_COINS_MESSAGE }, { status: 400 });
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
