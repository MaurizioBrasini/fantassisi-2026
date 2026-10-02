import type { SupabaseClient } from "@supabase/supabase-js";
import { romeLocalToUTCISO, startOfTodayInRomeISO } from "./utils";

// CBT coins: ogni giorno se ne ricevono DAILY_COINS e quelli non usati si ACCUMULANO; si spendono
// liberamente (voti ai colleghi e ai QR). I QR "Ricarica" ne aggiungono altri.
//
// Saldo = 20 × giorni di gioco + bonus riscattati − voti dati (colleghi + QR), dal primo giorno
// di gioco in poi (giornate italiane). Prima di quel giorno vale la regola semplice: 20 al giorno,
// senza accumulo. Per spostare l'inizio del gioco: variabile COINS_START_DATE (AAAA-MM-GG) su Render,
// altrimenti il 16 ottobre 2026, primo giorno del congresso.
const DAILY_COINS = 20;

function gameStart(): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(process.env.COINS_START_DATE || "");
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : { year: 2026, month: 10, day: 16 };
}

const DAY_MS = 86_400_000;

/** Da quando contare entrate e uscite, e per quanti giorni sono arrivati i 20 coins giornalieri. */
function coinWindow(): { since: string; days: number } {
  const todayStart = startOfTodayInRomeISO();
  const { year, month, day } = gameStart();
  const startIso = romeLocalToUTCISO(year, month, day, 0, 0);
  if (todayStart < startIso) return { since: todayStart, days: 1 };
  // round(): nei giorni del cambio ora legale la differenza è di 23 o 25 ore.
  return { since: startIso, days: Math.round((Date.parse(todayStart) - Date.parse(startIso)) / DAY_MS) + 1 };
}

export async function getCoinBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<{ remaining: number; earned: number; spent: number }> {
  const { since, days } = coinWindow();

  const [votes, eventVotes, redemptions] = await Promise.all([
    supabase.from("votes").select("id", { count: "exact", head: true }).eq("voter_id", userId).gte("voted_at", since),
    supabase.from("event_votes").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("voted_at", since),
    supabase.from("bonus_redemptions").select("bonus_id").eq("user_id", userId).gte("redeemed_at", since),
  ]);

  // Ogni riscatto vale l'importo del suo bonus (un bonus riscattabile più volte conta più volte).
  const redeemed = (redemptions.data || []) as { bonus_id: string }[];
  let bonusTotal = 0;
  if (redeemed.length > 0) {
    const ids = Array.from(new Set(redeemed.map((r) => r.bonus_id)));
    const { data: bonuses } = await supabase.from("bonus_qr").select("id, amount").in("id", ids);
    const amountById = new Map((bonuses || []).map((b: { id: string; amount: number | null }) => [b.id, b.amount || 0]));
    bonusTotal = redeemed.reduce((sum, r) => sum + (amountById.get(r.bonus_id) || 0), 0);
  }

  const earned = DAILY_COINS * days + bonusTotal;
  const spent = (votes.count || 0) + (eventVotes.count || 0);
  return { remaining: Math.max(0, earned - spent), earned, spent };
}

export const OUT_OF_COINS_MESSAGE =
  "CBT coins esauriti: domani ne ricevi altri 20, oppure ricarica con un QR bonus.";
