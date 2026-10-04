import { NextResponse } from "next/server";
import { KARAOKE_START_ISO, KARAOKE_END_ISO } from "@/lib/karaoke";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllRows } from "@/lib/fetchAll";

// Pagina pubblica /tabellone-karaoke la interroga ogni 2s per tutta la
// finestra della sfida: mai cache Next su questa route, deve leggere
// sempre lo stato corrente.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Mappa utente -> squadra: serve solo per attribuire i voti individuali (la
// tabella `votes` ha solo recipient_id, non il team). Non cambia quasi mai
// durante le 3 ore della sfida, quindi la teniamo in cache in memoria di
// processo invece di riscaricare ~1200 righe a ogni singolo poll del
// tabellone (che interroga questa route ogni 2 secondi per 3 ore).
let usersCache: { at: number; map: Map<string, string | null> } | null = null;
const USERS_CACHE_TTL_MS = 5 * 60_000;

async function getUsersTeamMap(): Promise<Map<string, string | null>> {
  if (usersCache && Date.now() - usersCache.at < USERS_CACHE_TTL_MS) {
    return usersCache.map;
  }
  const users = await fetchAllRows<{ id: string; team: string | null }>(getSupabaseAdmin(), "users", "id, team");
  const map = new Map(users.map((u) => [u.id, u.team] as const));
  usersCache = { at: Date.now(), map };
  return map;
}

const inKaraokeWindow = (query: any) => query.gte("voted_at", KARAOKE_START_ISO).lt("voted_at", KARAOKE_END_ISO);

// Cache di 2 secondi con richieste simultanee unite: il tabellone interroga ogni 2 s per 3 ore e il numero
// di voti cresce (ora lo stesso QR si può rivotare), quindi ogni calcolo rilegge migliaia di righe.
let scoreCache: { at: number; body: { Matricole: number; Veterani: number; status: string } } | null = null;
let scoreInflight: Promise<{ Matricole: number; Veterani: number; status: string }> | null = null;

export async function GET() {
  if (scoreCache && Date.now() - scoreCache.at < 2000) {
    return NextResponse.json(scoreCache.body, { headers: { "Cache-Control": "no-store" } });
  }
  if (!scoreInflight) {
    scoreInflight = computeScore()
      .then((body) => { scoreCache = { at: Date.now(), body }; return body; })
      .finally(() => { scoreInflight = null; });
  }
  try {
    return NextResponse.json(await scoreInflight, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Se il calcolo fallisce si serve l'ultimo dato buono: meglio quello che uno schermo vuoto.
    if (scoreCache) return NextResponse.json(scoreCache.body, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ message: "Errore nel calcolo dei punteggi" }, { status: 500 });
  }
}

async function computeScore() {
  const supabase = getSupabaseAdmin();
  const [usersById, votes, eventVotes] = await Promise.all([
    getUsersTeamMap(),
    // Voti individuali (QR/PIN personale) caduti nella finestra della sfida.
    fetchAllRows<{ recipient_id: string; points: number }>(supabase, "votes", "recipient_id, points", { filter: inKaraokeWindow }),
    // Voti da QR evento/squadra/classe, stessa finestra (già hanno team_target).
    fetchAllRows<{ team_target: string | null; points: number }>(supabase, "event_votes", "team_target, points", { filter: inKaraokeWindow }),
  ]);

  const pts = { Matricole: 0, Veterani: 0 };
  for (const v of votes) {
    const team = usersById.get(v.recipient_id);
    if (team === "Matricole") pts.Matricole += v.points || 0;
    if (team === "Veterani") pts.Veterani += v.points || 0;
  }
  for (const ev of eventVotes) {
    if (ev.team_target === "Matricole") pts.Matricole += ev.points || 1;
    if (ev.team_target === "Veterani") pts.Veterani += ev.points || 1;
  }

  const now = Date.now();
  const status =
    now < Date.parse(KARAOKE_START_ISO) ? "not_started" :
    now < Date.parse(KARAOKE_END_ISO) ? "live" :
    "ended";

  return { ...pts, status };
}
