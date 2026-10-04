import { fetchAllRows } from "./fetchAll";

// Bonus squadra decisi dall'admin per riequilibrare la sfida. Due modi, scelti alla creazione:
//  - "distribuito" (predefinito): imita i voti veri. Circa il 20-25% dei punti va solo alla squadra
//    (come i voti ai QR di squadra), il resto a partecipanti scelti a caso della squadra, da 1 a
//    MAX_POINTS_PER_PERSON ciascuno, in momenti casuali dell'intervallo. I punti alle persone
//    contano come voti: squadra, individuali, classi e sedi (tabella boost_allocations).
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

/**
 * Punti di un bonus già scattati. Tre forme:
 *  - a una persona (user_id): conta come voto ricevuto da lei (squadra, individuale, classe, sede);
 *  - a una classe (class_school/site/year): conta per la classe e la sede, e per la squadra solo se
 *    `team` è valorizzato (premio a una classe sì, metà "classi" del premio a una sede no);
 *  - solo alla squadra (nessuno dei due): conta per la squadra.
 */
export type MaturedAllocation = {
  user_id: string | null;
  team: string | null;
  points: number;
  class_school?: string | null;
  class_site?: string | null;
  class_year?: string | null;
};

// Punti dei bonus distribuiti che sono già "maturati" (il loro momento è passato). Come sopra: se
// la tabella manca, nessun punto. Se mancano solo le colonne della classe (sql/07_public_bonuses.sql
// non ancora eseguito) si leggono le vecchie, così i bonus già dati non spariscono dai punteggi.
export async function fetchMaturedAllocations(
  client: { from: (table: string) => any },
  nowMs: number = Date.now()
): Promise<MaturedAllocation[]> {
  const filter = (q: any) => q.lte("at", new Date(nowMs).toISOString());
  try {
    return await fetchAllRows<MaturedAllocation>(client, "boost_allocations", "user_id, team, points, class_school, class_site, class_year", { filter });
  } catch {
    try {
      return await fetchAllRows<MaturedAllocation>(client, "boost_allocations", "user_id, team, points", { filter });
    } catch {
      return [];
    }
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

/** Una riga del piano: a una persona, oppure solo alla squadra (user_id nullo). */
export type PlannedAllocation = { user_id: string | null; points: number; at: string };

/** Quota dei punti che va solo alla squadra: tra il 20% e il 25%, come i voti ai QR di squadra. */
const TEAM_ONLY_SHARE = { min: 0.2, max: 0.25 };

/**
 * Pianifica un bonus che imita i voti veri.
 *  - Circa il 20-25% dei punti va solo alla squadra, a pezzi da 1-2 punti.
 *  - Il resto va a persone scelte a caso tra quelle date, da 1 a MAX_POINTS_PER_PERSON punti
 *    ciascuna in totale per questo intervento (l'ultima prende il resto), nessuna persona due volte.
 *  - Se le persone non bastano a prendersi tutto (per il tetto a persona), l'avanzo va alla squadra.
 * Ogni riga ha un momento casuale tra `startMs` e `endMs`.
 */
export function planBoost(
  userIds: string[],
  totalPoints: number,
  startMs: number,
  endMs: number,
  random: () => number = Math.random
): { allocations: PlannedAllocation[]; peoplePoints: number; teamPoints: number } {
  const randomTime = () => new Date(startMs + Math.floor(random() * Math.max(1, endMs - startMs))).toISOString();

  // Quota solo-squadra (con totali minuscoli non ha senso spezzare: tutto alle persone)
  const share = TEAM_ONLY_SHARE.min + random() * (TEAM_ONLY_SHARE.max - TEAM_ONLY_SHARE.min);
  const wantedTeamOnly = totalPoints >= 8 ? Math.round(totalPoints * share) : 0;
  let peopleBudget = totalPoints - wantedTeamOnly;

  const pool = [...userIds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const allocations: PlannedAllocation[] = [];
  let peoplePoints = 0;
  for (let i = 0; i < pool.length && peopleBudget > 0; i++) {
    // Casuale tra `lo` e `hi`, ma mai meno di quanto serve perché le persone che restano riescano
    // ancora a coprire il budget (così, finché sta nella capienza, viene sempre raggiunto).
    const peopleAfter = pool.length - i - 1;
    const hi = Math.min(MAX_POINTS_PER_PERSON, peopleBudget);
    const lo = Math.min(hi, Math.max(1, peopleBudget - peopleAfter * MAX_POINTS_PER_PERSON));
    const points = lo + Math.floor(random() * (hi - lo + 1));
    allocations.push({ user_id: pool[i], points, at: randomTime() });
    peopleBudget -= points;
    peoplePoints += points;
  }

  // Solo squadra: la quota voluta più l'eventuale avanzo che le persone non hanno potuto prendere.
  let teamRemaining = wantedTeamOnly + peopleBudget;
  const teamPoints = teamRemaining;
  while (teamRemaining > 0) {
    const points = Math.min(teamRemaining, 1 + Math.floor(random() * 2)); // 1 o 2, come i voti ai QR
    allocations.push({ user_id: null, points, at: randomTime() });
    teamRemaining -= points;
  }

  return { allocations, peoplePoints, teamPoints };
}
