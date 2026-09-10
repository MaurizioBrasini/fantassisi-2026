import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { startOfTodayInRomeISO } from "@/lib/utils";
import { CONFIG_ISCRIZIONE } from "@/lib/config";

async function redeemBonus(supabase: any, userId: string, bonus: any) {
  if (bonus.active === false) {
    return NextResponse.json({ error: "Questo QR bonus non è più attivo" }, { status: 403 });
  }

  const now = new Date();
  if (bonus.valid_from && new Date(bonus.valid_from) > now) {
    return NextResponse.json({ error: "Questo bonus non è ancora attivo" }, { status: 403 });
  }
  if (bonus.valid_to && new Date(bonus.valid_to) < now) {
    return NextResponse.json({ error: "Questo bonus è scaduto" }, { status: 403 });
  }

  const { count: redemptionCount } = await supabase
    .from("bonus_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("bonus_id", bonus.id);

  const maxUses = bonus.max_uses_per_user ?? 1;
  if ((redemptionCount || 0) >= maxUses) {
    return NextResponse.json({ error: "Hai già riscattato questo bonus il numero massimo di volte consentito" }, { status: 409 });
  }

  const { error } = await supabase
    .from("bonus_redemptions")
    .insert({ user_id: userId, bonus_id: bonus.id });

  if (error) {
    return NextResponse.json({ error: "Errore nel riscatto del bonus" }, { status: 500 });
  }

  return NextResponse.json({ type: "bonus", amount: bonus.amount, title: bonus.title });
}

async function redeemEvent(supabase: any, userId: string, event: any) {
  if (event.active === false) {
    return NextResponse.json({ error: "Questo QR non è più attivo" }, { status: 403 });
  }
  if (event.start_time && event.end_time) {
    const now = new Date();
    if (now < new Date(event.start_time) || now > new Date(event.end_time)) {
      return NextResponse.json({ error: "Evento non attivo in questo momento" }, { status: 403 });
    }
  }

  const { data: voter } = await supabase.from("users").select("team").eq("id", userId).single();

  const startOfToday = startOfTodayInRomeISO();
  const { count: eventVotesToday } = await supabase
    .from("event_votes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("voted_at", startOfToday);
  const { count: normalVotesToday } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("voter_id", userId)
    .gte("voted_at", startOfToday);

  if ((eventVotesToday || 0) + (normalVotesToday || 0) >= 20) {
    return NextResponse.json({ error: "CBT coins esauriti per oggi" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("event_votes")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Hai già votato questo QR" }, { status: 409 });
  }

  let points = 1;
  if (voter?.team && event.team_target) {
    if (
      voter.team !== event.team_target &&
      (voter.team === "Matricole" || voter.team === "Veterani") &&
      (event.team_target === "Matricole" || event.team_target === "Veterani")
    ) {
      points = 2;
    }
  }

  const insertData: any = { user_id: userId, event_id: event.id, points };
  if (event.team_target) insertData.team_target = event.team_target;
  if (event.qr_type) insertData.qr_type = event.qr_type;
  if (event.class_school) insertData.class_school = event.class_school;
  if (event.class_site) insertData.class_site = event.class_site;
  if (event.class_year) insertData.class_year = event.class_year;

  const { error } = await supabase.from("event_votes").insert(insertData);
  if (error) {
    return NextResponse.json({ error: "Errore nel salvataggio del voto: " + error.message }, { status: 500 });
  }

  let message = `✅ +${points} punti per i ${event.team_target || "squadra"}`;
  if (event.qr_type === "class" && event.class_school && event.class_site && event.class_year) {
    const yearLabel = CONFIG_ISCRIZIONE.anni.find((a) => a.value === event.class_year)?.label || event.class_year;
    message = `✅ +${points} punti per ${event.class_school} ${event.class_site} ${yearLabel}`;
  } else if (event.qr_type === "site" && event.class_site) {
    message = `✅ +${points} punti per ${event.class_site}`;
  }

  return NextResponse.json({
    type: "vote",
    points,
    targets: event.team_target ? [event.team_target] : [],
    message,
  });
}

// Sistema QR unificato: un unico endpoint per riscattare un codice (bonus_qr.code
// o votable_events.qr_code), oppure lo stesso evento/bonus tramite il PIN a 4
// cifre stampato sotto il QR (fallback voto senza fotocamera, stesso principio
// del PIN personale — quello resta gestito da /api/vote, che lo controlla per
// primo lato client; questo endpoint copre solo eventi/bonus).
export async function POST(request: Request) {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { code, pin } = await request.json();
  if (!code && !pin) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const bonusColumn = code ? "code" : "pin";
  const eventColumn = code ? "qr_code" : "pin";
  const lookupValue = code || pin;

  const { data: bonus } = await supabase.from("bonus_qr").select("*").eq(bonusColumn, lookupValue).maybeSingle();
  if (bonus) {
    return redeemBonus(supabase, userId, bonus);
  }

  const { data: event } = await supabase.from("votable_events").select("*").eq(eventColumn, lookupValue).maybeSingle();
  if (event) {
    return redeemEvent(supabase, userId, event);
  }

  return NextResponse.json(
    { error: pin ? "PIN non valido" : "QR non valido o già utilizzato" },
    { status: 404 }
  );
}
