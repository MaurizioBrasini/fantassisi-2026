import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { yearLabel } from "./config";
import { getCoinBalance, OUT_OF_COINS_MESSAGE } from "./coins";
import { getVotingPhase, votingClosedMessage } from "./phase";
import { withLock } from "./userLock";
import { canonYear } from "./classKey";
import { KARAOKE_START_ISO, KARAOKE_END_ISO } from "./karaoke";

// Le due azioni che si fanno con un QR/PIN di evento o di bonus. Prima esistevano due copie
// (una in /api/event-vote e /api/bonus-redeem, una in /api/qr/redeem): ora c'è un solo codice,
// così i controlli non possono più divergere.
export type ActionResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string };

const fail = (status: number, error: string): ActionResult => ({ ok: false, status, error });

/** Trasforma il risultato di un'azione nella risposta HTTP della route. */
export function actionResponse(result: ActionResult): NextResponse {
  return "error" in result
    ? NextResponse.json({ error: result.error }, { status: result.status })
    : NextResponse.json(result.body);
}
const TEAMS = ["Matricole", "Veterani"];

// Attesa tra due voti della stessa persona allo stesso QR/PIN. Persone (/api/vote): una al giorno.
/** QR/PIN di squadra (nelle slides di tutti): ogni 15 minuti. */
export const TEAM_QR_COOLDOWN_MIN = 15;
/** QR/PIN di squadra durante la sfida karaoke (4 manche: si vota la squadra a ogni manche): ogni 5 minuti. */
export const TEAM_QR_COOLDOWN_KARAOKE_MIN = 5;
/** QR/PIN di classe (e sede): ogni ora. */
export const CLASS_QR_COOLDOWN_MIN = 60;

/** Minuti di attesa per rivotare lo stesso QR, in base al tipo e al momento (fascia karaoke: lib/karaoke.ts). */
export function cooldownMinutes(qrType: string | null | undefined, nowMs: number = Date.now()): number {
  if (qrType !== "team") return CLASS_QR_COOLDOWN_MIN;
  const inKaraoke = nowMs >= Date.parse(KARAOKE_START_ISO) && nowMs < Date.parse(KARAOKE_END_ISO);
  return inKaraoke ? TEAM_QR_COOLDOWN_KARAOKE_MIN : TEAM_QR_COOLDOWN_MIN;
}

/** Riscatta un QR bonus (CBT coins extra). Una azione alla volta per persona (vedi lib/userLock.ts). */
export function redeemBonusQr(supabase: SupabaseClient, userId: string, bonus: any): Promise<ActionResult> {
  return withLock(`vote:${userId}`, () => redeemBonusQrUnlocked(supabase, userId, bonus));
}

async function redeemBonusQrUnlocked(supabase: SupabaseClient, userId: string, bonus: any): Promise<ActionResult> {
  if (bonus.active === false) return fail(403, "Questo QR bonus non è più attivo");

  const now = Date.now();
  if (bonus.valid_from && Date.parse(bonus.valid_from) > now) return fail(403, "Questo bonus non è ancora attivo");
  if (bonus.valid_to && Date.parse(bonus.valid_to) < now) return fail(403, "Questo bonus è scaduto");

  const { count } = await supabase
    .from("bonus_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("bonus_id", bonus.id);
  if ((count || 0) >= (bonus.max_uses_per_user ?? 1)) {
    return fail(409, "Hai già riscattato questo bonus il numero massimo di volte consentito");
  }

  const { error } = await supabase.from("bonus_redemptions").insert({ user_id: userId, bonus_id: bonus.id });
  if (error) return fail(500, "Errore nel riscatto del bonus");

  return { ok: true, body: { success: true, type: "bonus", amount: bonus.amount, title: bonus.title } };
}

/** Vota con un QR evento/squadra/classe. Una azione alla volta per persona (vedi lib/userLock.ts). */
export function castEventVote(supabase: SupabaseClient, userId: string, event: any): Promise<ActionResult> {
  return withLock(`vote:${userId}`, () => castEventVoteUnlocked(supabase, userId, event));
}

async function castEventVoteUnlocked(supabase: SupabaseClient, userId: string, event: any): Promise<ActionResult> {
  const phase = await getVotingPhase();
  if (!phase.open) return fail(403, votingClosedMessage(phase));
  if (event.active === false) return fail(403, "Questo QR non è più attivo");
  if (event.start_time && event.end_time) {
    const now = Date.now();
    if (now < Date.parse(event.start_time) || now > Date.parse(event.end_time)) {
      return fail(403, "Evento non attivo in questo momento");
    }
  }

  const [{ data: voter }, coins, { data: existing }] = await Promise.all([
    supabase.from("users").select("team").eq("id", userId).single(),
    getCoinBalance(supabase, userId),
    supabase
      .from("event_votes")
      .select("voted_at")
      .eq("user_id", userId)
      .eq("event_id", event.id)
      .order("voted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (coins.remaining <= 0) return fail(400, OUT_OF_COINS_MESSAGE);
  if (existing) {
    // Lo stesso QR si può rivotare dopo un'attesa che dipende dal tipo (serve aver tolto l'indice
    // univoco su event_votes: sql/04_event_votes_cooldown.sql).
    const cooldownMin = cooldownMinutes(event.qr_type);
    const waitMs = Date.parse(existing.voted_at) + cooldownMin * 60_000 - Date.now();
    if (waitMs > 0) {
      const what = event.qr_type === "team" ? "la squadra" : event.qr_type === "site" ? "questa sede" : "questa classe";
      const left = Math.ceil(waitMs / 60_000);
      return fail(429, `Hai già votato ${what} da poco: potrai rivotare tra ${left} ${left === 1 ? "minuto" : "minuti"}.`);
    }
  }

  // 2 punti se il votante è della squadra opposta a quella del QR, 1 altrimenti.
  const opposite =
    !!voter?.team && !!event.team_target && voter.team !== event.team_target && TEAMS.includes(voter.team) && TEAMS.includes(event.team_target);
  const points = opposite ? 2 : 1;

  // Il punteggio va alla squadra/sede/classe indicata dal QR scansionato, non a quella di chi vota.
  const insertData: Record<string, unknown> = { user_id: userId, event_id: event.id, points };
  for (const field of ["team_target", "qr_type", "class_school", "class_site", "class_year"]) {
    if (event[field]) insertData[field] = event[field];
  }
  const { error } = await supabase.from("event_votes").insert(insertData);
  if (error) return fail(500, "Errore nel salvataggio del voto: " + error.message);

  let message = `✅ +${points} punti per i ${event.team_target || "squadra"}`;
  if (event.qr_type === "class" && event.class_school && event.class_site && event.class_year) {
    message = `✅ +${points} punti per ${event.class_school} ${event.class_site} ${yearLabel(canonYear(event.class_year))}`;
  } else if (event.qr_type === "site" && event.class_site) {
    message = `✅ +${points} punti per ${event.class_site}`;
  }

  return {
    ok: true,
    body: {
      success: true,
      type: "vote",
      points,
      team_target: event.team_target,
      targets: event.team_target ? [event.team_target] : [],
      message,
    },
  };
}
