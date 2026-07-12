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

  // Carica evento e votante in parallelo
  const [{ data: event }, { data: voter }] = await Promise.all([
    supabase.from("votable_events").select("*").eq("id", eventId).single(),
    supabase.from("users").select("team").eq("id", userId).single(),
  ]);

  if (!event) {
    return NextResponse.json({ error: "Evento non trovato" }, { status: 404 });
  }
  if (event.active === false) {
    return NextResponse.json({ error: "Questo QR non è più attivo" }, { status: 403 });
  }

  // Verifica CBT coins rimanenti oggi
  const today = new Date().toISOString().split("T")[0];
  const { count: votesToday } = await supabase
    .from("event_votes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("voted_at", today);

  // Conta anche i voti normali di oggi per il totale CBT coins
  const { count: normalVotesToday } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("voter_id", userId)
    .gte("voted_at", today);

  const totalVotesToday = (votesToday || 0) + (normalVotesToday || 0);
  if (totalVotesToday >= 20) {
    return NextResponse.json({ error: "CBT coins esauriti per oggi" }, { status: 400 });
  }

  // Verifica se l'utente ha già votato questo evento
  const { data: existing } = await supabase
    .from("event_votes")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Hai già votato questo QR" }, { status: 409 });
  }

  // Calcolo punti: 2 se il votante è della squadra opposta, 1 altrimenti
  let points = 1;
  if (voter?.team && event.team_target) {
    if (voter.team !== event.team_target &&
        (voter.team === "Matricole" || voter.team === "Veterani") &&
        (event.team_target === "Matricole" || event.team_target === "Veterani")) {
      points = 2;
    }
  }

  // Costruisci l'oggetto da inserire con le nuove colonne
  const insertData: any = {
    user_id: userId,
    event_id: eventId,
    points: points,
  };

  if (event.team_target) insertData.team_target = event.team_target;
  if (event.qr_type) insertData.qr_type = event.qr_type;
  if (event.class_school) insertData.class_school = event.class_school;
  if (event.class_site) insertData.class_site = event.class_site;
  if (event.class_year) insertData.class_year = event.class_year;

  const { error } = await supabase
    .from("event_votes")
    .insert(insertData);

  if (error) {
    return NextResponse.json({ error: "Errore nel salvataggio del voto: " + error.message }, { status: 500 });
  }

  // 🔥 MODIFICA: Costruisci messaggio di conferma dinamico
  let confirmationMessage = `✅ +${points} punti per i ${event.team_target || 'squadra'}`;

  if (event.qr_type === 'class' && event.class_school && event.class_site && event.class_year) {
    const yearLabel = event.class_year.replace('° ANNO 2026', '°');
    confirmationMessage = `✅ +${points} punti per ${event.class_school} ${event.class_site} ${yearLabel} anno`;
  } else if (event.qr_type === 'site' && event.class_site) {
    confirmationMessage = `✅ +${points} punti per ${event.class_site}`;
  }

  return NextResponse.json({ 
    success: true, 
    points, 
    team_target: event.team_target,
    message: confirmationMessage 
  });
}