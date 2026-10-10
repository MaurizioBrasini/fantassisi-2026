import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { formatRomeDateTime } from "./utils";

// Fase del gioco: ANTEPRIMA (si vedono QR e codici, non si può votare) oppure VOTO APERTO.
// Si regola dal pannello admin (tabella app_settings, chiave "voting_phase", valore {mode, opensAt}):
//  - mode "auto": il voto si apre da solo alla data opensAt (se opensAt è "da definire" non si apre mai da solo)
//  - mode "preview": anteprima forzata, anche dopo la data
//  - mode "open": voto aperto subito, anche prima della data
//  - opensAt: data e ora di apertura automatica, scelta dall'admin; null = "da definire" (predefinito)
//  - closesAt: fine dell'evento, facoltativa: da quel momento il voto è chiuso, anche in modalità "open"
//  - previewAt: inizio dell'Anteprima, facoltativo: prima di quel momento i partecipanti (non admin/staff) vedono
//    solo "l'anteprima parte il ...", anche se hanno già il link; null = l'Anteprima è già iniziata
// Se la tabella non esiste ancora (sql/05_app_settings.sql) vale "auto" con data "da definire": voto chiuso.
// Il blocco è applicato dal server nei punti dove si vota (castEventVote e /api/vote): i bonus
// ricarica (coins) restano riscattabili.
export type PhaseMode = "auto" | "preview" | "open";
export type VotingPhase = {
  open: boolean;
  /** L'Anteprima è iniziata (false = i partecipanti vedono solo "l'anteprima parte il ..."). */
  previewStarted: boolean;
  mode: PhaseMode;
  previewAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
};
type PhaseSettings = { mode: PhaseMode; previewAt: string | null; opensAt: string | null; closesAt: string | null };

const SETTING_KEY = "voting_phase";
const TTL_MS = 5_000;

let cache: { at: number; settings: PhaseSettings } | null = null;

/** Una data di apertura accettabile: valida e dentro il 2026-2027 (evita errori di battitura come il 2062). */
export function isValidOpensAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = Date.parse(value);
  return Number.isFinite(t) && t >= Date.parse("2026-09-01T00:00:00Z") && t <= Date.parse("2027-12-31T23:59:59Z");
}

async function readSettings(useCache = true): Promise<PhaseSettings> {
  if (useCache && cache && Date.now() - cache.at < TTL_MS) return cache.settings;
  const settings: PhaseSettings = { mode: "auto", previewAt: null, opensAt: null, closesAt: null };
  try {
    const { data } = await getSupabaseAdmin().from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
    const stored = (data?.value || {}) as { mode?: string; previewAt?: string; opensAt?: string; closesAt?: string };
    if (isValidOpensAt(stored.previewAt)) settings.previewAt = stored.previewAt;
    if (stored.mode === "preview" || stored.mode === "open" || stored.mode === "auto") settings.mode = stored.mode;
    if (isValidOpensAt(stored.opensAt)) settings.opensAt = stored.opensAt;
    if (isValidOpensAt(stored.closesAt)) settings.closesAt = stored.closesAt;
  } catch {
    // tabella assente o lettura fallita: valori predefiniti
  }
  cache = { at: Date.now(), settings };
  return settings;
}

/** Cambia modalità e/o data di apertura (quello che non si passa resta com'è) e svuota la cache. */
export async function updatePhase(change: { mode?: PhaseMode; previewAt?: string | null; opensAt?: string | null; closesAt?: string | null }, userId: string): Promise<string | null> {
  const current = await readSettings(false);
  const next: PhaseSettings = {
    mode: change.mode ?? current.mode,
    previewAt: change.previewAt === undefined ? current.previewAt : change.previewAt,
    opensAt: change.opensAt === undefined ? current.opensAt : change.opensAt,
    closesAt: change.closesAt === undefined ? current.closesAt : change.closesAt,
  };
  const { error } = await getSupabaseAdmin()
    .from("app_settings")
    .upsert({ key: SETTING_KEY, value: next, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) return error.message;
  cache = { at: Date.now(), settings: next };
  return null;
}

export async function getVotingPhase(): Promise<VotingPhase> {
  const { mode, previewAt, opensAt, closesAt } = await readSettings();
  const ended = closesAt !== null && Date.now() >= Date.parse(closesAt);
  const open = !ended && (mode === "open" || (mode === "auto" && opensAt !== null && Date.now() >= Date.parse(opensAt)));
  const previewStarted = open || mode !== "auto" || previewAt === null || Date.now() >= Date.parse(previewAt);
  return { open, previewStarted, mode, previewAt, opensAt, closesAt };
}

export const votingClosedMessage = (phase: VotingPhase) =>
  phase.closesAt && Date.now() >= Date.parse(phase.closesAt) ? "Il voto è chiuso: l'evento è terminato." :
  phase.opensAt ? `Il voto non è ancora aperto: si apre ${formatRomeDateTime(phase.opensAt)}.` : "Il voto non è ancora aperto: data da definire.";

/** Se il voto è chiuso restituisce la risposta 403 da dare; altrimenti null. */
export async function votingClosedResponse(): Promise<NextResponse | null> {
  const phase = await getVotingPhase();
  return phase.open ? null : NextResponse.json({ error: votingClosedMessage(phase), voting_closed: true }, { status: 403 });
}
