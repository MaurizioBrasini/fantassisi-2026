import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { KARAOKE_START_ISO, KARAOKE_END_ISO } from "@/lib/karaoke";

// Pagina pubblica /tabellone-karaoke la interroga ogni 2s per tutta la
// finestra della sfida: mai cache Next su questa route, deve leggere
// sempre lo stato corrente.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const map = new Map<string, string | null>();
  let from = 0;
  while (true) {
    const { data: page } = await supabase.from("users").select("id, team").range(from, from + 999);
    if (!page || page.length === 0) break;
    for (const u of page) map.set(u.id, u.team);
    if (page.length < 1000) break;
    from += 1000;
  }
  usersCache = { at: Date.now(), map };
  return map;
}

export async function GET() {
  const usersById = await getUsersTeamMap();
  const pts = { Matricole: 0, Veterani: 0 };

  // Voti individuali (QR/PIN personale) caduti nella finestra della sfida.
  {
    let from = 0;
    while (true) {
      const { data: page } = await supabase
        .from("votes")
        .select("recipient_id, points")
        .gte("voted_at", KARAOKE_START_ISO)
        .lt("voted_at", KARAOKE_END_ISO)
        .range(from, from + 999);
      if (!page || page.length === 0) break;
      for (const v of page) {
        const team = usersById.get(v.recipient_id);
        if (team === "Matricole") pts.Matricole += v.points || 0;
        if (team === "Veterani") pts.Veterani += v.points || 0;
      }
      if (page.length < 1000) break;
      from += 1000;
    }
  }

  // Voti da QR evento/squadra/classe, stessa finestra (già hanno team_target).
  {
    let from = 0;
    while (true) {
      const { data: page } = await supabase
        .from("event_votes")
        .select("team_target, points")
        .gte("voted_at", KARAOKE_START_ISO)
        .lt("voted_at", KARAOKE_END_ISO)
        .range(from, from + 999);
      if (!page || page.length === 0) break;
      for (const ev of page) {
        if (ev.team_target === "Matricole") pts.Matricole += ev.points || 1;
        if (ev.team_target === "Veterani") pts.Veterani += ev.points || 1;
      }
      if (page.length < 1000) break;
      from += 1000;
    }
  }

  const now = Date.now();
  const status =
    now < Date.parse(KARAOKE_START_ISO) ? "not_started" :
    now < Date.parse(KARAOKE_END_ISO) ? "live" :
    "ended";

  return NextResponse.json({ ...pts, status }, { headers: { "Cache-Control": "no-store" } });
}
