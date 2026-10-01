// Bonus a tempo per le squadre: punti che l'admin fa "entrare" gradualmente in
// un intervallo (es. 100 punti in un'ora), per tenere viva la sfida. Contano solo
// nei punteggi di squadra (dashboard e tabellone), mai in individuali/classi/sedi.
export type TeamBoost = {
  team: string | null;
  total_points: number;
  start_at: string;
  end_at: string;
};

// Legge i bonus con un client Supabase qualunque (anon nelle dashboard, service
// role nel tabellone). Se la tabella non esiste ancora o la lettura fallisce
// restituisce [] così i punteggi restano quelli di sempre.
export async function fetchTeamBoosts(client: {
  from: (table: string) => any;
}): Promise<TeamBoost[]> {
  try {
    const { data, error } = await client.from("team_boosts").select("team, total_points, start_at, end_at");
    return error || !data ? [] : (data as TeamBoost[]);
  } catch {
    return [];
  }
}

// Punti maturati a un dato istante: lineari tra start_at e end_at, sempre interi.
export function accruedBoostPoints(b: TeamBoost, nowMs: number = Date.now()): number {
  const start = Date.parse(b.start_at);
  const end = Date.parse(b.end_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(b.total_points > 0)) return 0;
  if (nowMs <= start) return 0;
  if (nowMs >= end || end <= start) return b.total_points;
  return Math.floor((b.total_points * (nowMs - start)) / (end - start));
}

// Somma i bonus maturati ai punteggi di squadra (modifica e restituisce `pts`).
export function addBoostsToScores(
  pts: { Matricole: number; Veterani: number },
  boosts: TeamBoost[] | null | undefined,
  nowMs: number = Date.now()
) {
  for (const b of boosts || []) {
    const accrued = accruedBoostPoints(b, nowMs);
    if (b.team === "Matricole") pts.Matricole += accrued;
    if (b.team === "Veterani") pts.Veterani += accrued;
  }
  return pts;
}
