import { fetchAllRows } from "./fetchAll";

// Bonus squadra decisi dall'admin per riequilibrare la sfida. Due modi, scelti alla creazione:
//  - "distribuito" (predefinito): i punti vanno a partecipanti scelti a caso della squadra, da 1 a
//    MAX_POINTS_PER_PERSON ciascuno, in momenti casuali dell'intervallo. Contano come se fossero
//    voti: squadra, individuali, classi e sedi (tabella boost_allocations).
//  - solo squadra (il vecchio modo): i punti maturano linearmente e contano solo nel punteggio di
//    squadra. Resta per i bonus già creati e se la tabella boost_allocations non esiste ancora.
export type TeamBoost = {
  id?: string;
  team: string | null;
  total_points: number;
  start_at: string;
  end_at: string;
  distributed?: boolean;
};

/** Massimo di punti che una persona può ricevere da un singolo intervento. */
export const MAX_POINTS_PER_PERSON = 4;

// Legge i bonus con un client Supabase qualunque. Se la tabella non esiste ancora o la lettura
// fallisce restituisce [] così i punteggi restano quelli di sempre.
export async function fetchTeamBoosts(client: { from: (table: string) => any }): Promise<TeamBoost[]> {
  try {
    const { data, error } = await client.from("team_boosts").select("*");
    return error || !data ? [] : (data as TeamBoost[]);
  } catch {
    return [];
  }
}

// Punti assegnati a persone che sono già "maturati" (il loro momento è passato). Come sopra: se la
// tabella manca, nessun punto.
export async function fetchMaturedAllocations(
  client: { from: (table: string) => any },
  nowMs: number = Date.now()
): Promise<{ user_id: string; points: number }[]> {
  try {
    return await fetchAllRows<{ user_id: string; points: number }>(client, "boost_allocations", "user_id, points", {
      filter: (q) => q.lte("at", new Date(nowMs).toISOString()),
    });
  } catch {
    return [];
  }
}

// Punti maturati a un dato istante nel vecchio modo "solo squadra": lineari tra start_at e end_at.
export function accruedBoostPoints(b: TeamBoost, nowMs: number = Date.now()): number {
  const start = Date.parse(b.start_at);
  const end = Date.parse(b.end_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(b.total_points > 0)) return 0;
  if (nowMs <= start) return 0;
  if (nowMs >= end || end <= start) return b.total_points;
  return Math.floor((b.total_points * (nowMs - start)) / (end - start));
}

// Somma ai punteggi di squadra i bonus "solo squadra" maturati (modifica e restituisce `pts`).
// Quelli distribuiti non si contano qui: i loro punti arrivano dalle persone.
export function addBoostsToScores(
  pts: { Matricole: number; Veterani: number },
  boosts: TeamBoost[] | null | undefined,
  nowMs: number = Date.now()
) {
  for (const b of boosts || []) {
    if (b.distributed) continue;
    const accrued = accruedBoostPoints(b, nowMs);
    if (b.team === "Matricole") pts.Matricole += accrued;
    if (b.team === "Veterani") pts.Veterani += accrued;
  }
  return pts;
}

/**
 * Sceglie a chi dare i punti di un intervento: persone a caso tra quelle date, da 1 a
 * MAX_POINTS_PER_PERSON punti ciascuna (l'ultima prende il resto), ognuna in un momento casuale tra
 * `startMs` e `endMs`. Se i punti non bastano a coprire il totale con quelle persone,
 * `leftover` dice quanti ne restano fuori.
 */
export function planAllocations(
  userIds: string[],
  totalPoints: number,
  startMs: number,
  endMs: number,
  random: () => number = Math.random
): { allocations: { user_id: string; points: number; at: string }[]; leftover: number } {
  const pool = [...userIds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const allocations: { user_id: string; points: number; at: string }[] = [];
  let remaining = totalPoints;
  for (let i = 0; i < pool.length; i++) {
    if (remaining <= 0) break;
    const userId = pool[i];
    // Casuale tra `lo` e `hi`, ma mai meno di quanto serve perché le persone che restano riescano
    // ancora a coprire il totale (così, finché il totale sta nella capienza, viene sempre raggiunto).
    const peopleAfter = pool.length - i - 1;
    const hi = Math.min(MAX_POINTS_PER_PERSON, remaining);
    const lo = Math.min(hi, Math.max(1, remaining - peopleAfter * MAX_POINTS_PER_PERSON));
    const points = lo + Math.floor(random() * (hi - lo + 1));
    const at = new Date(startMs + Math.floor(random() * Math.max(1, endMs - startMs))).toISOString();
    allocations.push({ user_id: userId, points, at });
    remaining -= points;
  }
  return { allocations, leftover: Math.max(0, remaining) };
}
