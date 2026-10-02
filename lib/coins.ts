import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfTodayInRomeISO } from "./utils";

// CBT coins: monete giornaliere (giornata italiana) per votare.
export const DAILY_COINS = 20;

/** Voti dati oggi dalla persona: ai colleghi (votes) e ai QR evento/squadra/classe (event_votes). */
export async function countVotesToday(
  supabase: SupabaseClient,
  userId: string
): Promise<{ normal: number; event: number }> {
  const since = startOfTodayInRomeISO();
  const [normal, event] = await Promise.all([
    supabase.from("votes").select("id", { count: "exact", head: true }).eq("voter_id", userId).gte("voted_at", since),
    supabase.from("event_votes").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("voted_at", since),
  ]);
  return { normal: normal.count || 0, event: event.count || 0 };
}
