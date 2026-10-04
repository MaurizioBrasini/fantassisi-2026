import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { romeLocalToUTCISO } from "./utils";

// Fase del gioco: ANTEPRIMA (si vedono QR e PIN, non si può votare) oppure VOTO APERTO.
// L'interruttore sta nel pannello admin (tabella app_settings, chiave "voting_phase"):
//  - "auto": il voto si apre da solo a VOTE_OPEN_AT (giovedì 8 ottobre 2026, 00:00 ora italiana)
//  - "preview": anteprima forzata, anche dopo la data
//  - "open": voto aperto subito, anche prima della data
// Se la tabella non esiste ancora (sql/05_app_settings.sql) vale "auto".
// Il blocco è applicato dal server nei punti dove si vota (castEventVote e /api/vote): i bonus
// ricarica (coins) restano riscattabili.
export type PhaseMode = "auto" | "preview" | "open";
export type VotingPhase = { open: boolean; mode: PhaseMode; opensAt: string };

export const VOTE_OPEN_AT = romeLocalToUTCISO(2026, 10, 8, 0, 0);
const SETTING_KEY = "voting_phase";
const TTL_MS = 5_000;

let cache: { at: number; mode: PhaseMode } | null = null;

async function readMode(): Promise<PhaseMode> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.mode;
  let mode: PhaseMode = "auto";
  try {
    const { data } = await getSupabaseAdmin().from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
    const stored = (data?.value as { mode?: string } | null)?.mode;
    if (stored === "preview" || stored === "open" || stored === "auto") mode = stored;
  } catch {
    // tabella assente o lettura fallita: si resta su "auto"
  }
  cache = { at: Date.now(), mode };
  return mode;
}

/** Salva la modalità e svuota la cache di questo processo. */
export async function setPhaseMode(mode: PhaseMode, userId: string): Promise<string | null> {
  const { error } = await getSupabaseAdmin()
    .from("app_settings")
    .upsert({ key: SETTING_KEY, value: { mode }, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) return error.message;
  cache = { at: Date.now(), mode };
  return null;
}

export async function getVotingPhase(): Promise<VotingPhase> {
  const mode = await readMode();
  const open = mode === "open" || (mode === "auto" && Date.now() >= Date.parse(VOTE_OPEN_AT));
  return { open, mode, opensAt: VOTE_OPEN_AT };
}

const OPENS_LABEL = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export const votingClosedMessage = (phase: VotingPhase) =>
  `Il voto non è ancora aperto: si apre ${OPENS_LABEL.format(new Date(phase.opensAt))}.`;

/** Se il voto è chiuso restituisce la risposta 403 da dare; altrimenti null. */
export async function votingClosedResponse(): Promise<NextResponse | null> {
  const phase = await getVotingPhase();
  return phase.open ? null : NextResponse.json({ error: votingClosedMessage(phase), voting_closed: true }, { status: 403 });
}
