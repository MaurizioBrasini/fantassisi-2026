// Punteggi e classifiche, calcolati UNA volta sul server a partire da tabelle lette per intero
// (con ORDER BY, vedi lib/fetchAll.ts) e tenuti in cache pochi secondi.
//
// Sostituisce i calcoli che prima venivano rifatti in ogni telefono (dashboard, classifica
// individuale, classi, sedi) e nel tabellone: ogni pagina scaricava tutte le tabelle a ogni
// apertura. Ora i telefoni ricevono solo il risultato.
import { CONFIG_ISCRIZIONE } from "./config";
import { fetchTeamBoosts, fetchMaturedAllocations, addBoostsToScores, type MaturedAllocation, type TeamBoost } from "./boosts";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { fetchAllRows } from "./fetchAll";

export type TeamScores = { Matricole: number; Veterani: number };
type IndividualRow = { id: string; name: string; team: string | null; points: number; rank: number };
type ClassRow = { key: string; school: string; site: string; year: string; points: number; rank: number };
type SiteRow = { site: string; points: number; classCount: number; average: number };

export type Standings = {
  teams: TeamScores;
  individuals: IndividualRow[]; // tutti i votati, con rank a pari merito (1, 2, 2, 4)
  classes: ClassRow[]; // tutte le classi con punti, con rank a pari merito
  sites: SiteRow[]; // tutte le sedi, per media punti/classi reali
  pointsByUser: Map<string, number>;
  userInfo: Map<string, { school: string | null; site: string | null; year: string | null }>;
  updatedAt: string;
};

// Anni che contano per la classifica delle sedi (esclusi preiscrizione e specializzati).
const SITE_YEARS = ["primo", "secondo", "terzo", "quarto"];
const TTL_MS = 5_000;

type UserRow = { id: string; first_name: string | null; last_name: string | null; team: string | null; school: string | null; site: string | null; year: string | null };
type VoteRow = { recipient_id: string; points: number };
type EventVoteRow = { team_target: string | null; qr_type: string | null; class_school: string | null; class_site: string | null; class_year: string | null; points: number };

// Rank con pari merito (1, 2, 2, 4).
function withRanks<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  const out: (T & { rank: number })[] = [];
  let rank = 1;
  for (let i = 0; i < rows.length; ) {
    let j = i;
    while (j < rows.length && rows[j].points === rows[i].points) j++;
    for (let k = i; k < j; k++) out.push({ ...rows[k], rank });
    rank += j - i;
    i = j;
  }
  return out;
}

// Numero di classi realmente esistenti in una sede (media della classifica per sede).
function realClassCount(site: string): number {
  const schools = CONFIG_ISCRIZIONE.scuolePerSede[site as keyof typeof CONFIG_ISCRIZIONE.scuolePerSede] || [];
  return schools.reduce((sum, school) => {
    const n = CONFIG_ISCRIZIONE.classiPerSedeScuola.eccezioni[`${site}||${school}`] ?? CONFIG_ISCRIZIONE.classiPerSedeScuola.default;
    return sum + n;
  }, 0);
}

/** Calcolo puro dei punteggi dai dati grezzi (separato dalla lettura per poterlo verificare). */
export function buildStandings(
  users: UserRow[],
  voteRows: VoteRow[],
  eventVotes: EventVoteRow[],
  boosts: TeamBoost[],
  allocations: MaturedAllocation[] = []
): Standings {
  const usersById = new Map(users.map((u) => [u.id, u]));
  // I punti dei bonus assegnati a persone contano come voti ricevuti da quella persona; quelli
  // "solo squadra" (senza persona) vanno direttamente al punteggio della squadra.
  const personRows = allocations.filter((a) => a.user_id);
  const votes = personRows.length
    ? voteRows.concat(personRows.map((a) => ({ recipient_id: a.user_id as string, points: a.points })))
    : voteRows;

  // Squadre: voti ricevuti da Matricole/Veterani + QR di squadra/classe + bonus a tempo.
  const teams: TeamScores = { Matricole: 0, Veterani: 0 };
  const pointsByUser = new Map<string, number>();
  const pointsByClass = new Map<string, { school: string; site: string; year: string; points: number }>();
  const pointsBySite = new Map<string, number>();
  const addClass = (school: string, site: string, year: string, pts: number) => {
    const key = `${school}||${site}||${year}`;
    const cur = pointsByClass.get(key) || { school, site, year, points: 0 };
    cur.points += pts;
    pointsByClass.set(key, cur);
  };

  for (const v of votes) {
    const r = usersById.get(v.recipient_id);
    if (!r) continue; // voto a un utente non più presente
    const p = v.points || 0;
    pointsByUser.set(r.id, (pointsByUser.get(r.id) || 0) + p);
    if (r.team === "Matricole") teams.Matricole += p;
    if (r.team === "Veterani") teams.Veterani += p;
    if (r.school && r.site && r.year) {
      addClass(r.school, r.site, r.year, p);
      if (SITE_YEARS.includes(r.year)) pointsBySite.set(r.site, (pointsBySite.get(r.site) || 0) + p);
    }
  }
  for (const ev of eventVotes) {
    if (ev.team_target === "Matricole") teams.Matricole += ev.points || 1;
    if (ev.team_target === "Veterani") teams.Veterani += ev.points || 1;
    if (ev.qr_type === "class") {
      if (ev.class_school && ev.class_site && ev.class_year) addClass(ev.class_school, ev.class_site, ev.class_year, ev.points || 1);
      if (ev.class_site) pointsBySite.set(ev.class_site, (pointsBySite.get(ev.class_site) || 0) + (ev.points || 0));
    }
  }
  addBoostsToScores(teams, boosts);
  for (const a of allocations) {
    if (a.user_id) continue;
    if (a.team === "Matricole") teams.Matricole += a.points;
    if (a.team === "Veterani") teams.Veterani += a.points;
  }

  const individuals = withRanks(
    Array.from(pointsByUser.entries())
      .map(([id, points]) => {
        const u = usersById.get(id)!;
        return { id, name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || "—", team: u.team || null, points };
      })
      .sort((a, b) => b.points - a.points)
  );

  const classes = withRanks(
    Array.from(pointsByClass.entries())
      .map(([key, c]) => ({ key, school: c.school, site: c.site, year: c.year, points: c.points }))
      .sort((a, b) => b.points - a.points)
  );

  const sites = CONFIG_ISCRIZIONE.sedi
    .map((site) => {
      const classCount = realClassCount(site);
      const points = pointsBySite.get(site) || 0;
      return { site, points, classCount, average: classCount > 0 ? points / classCount : 0 };
    })
    .sort((a, b) => b.average - a.average);

  const userInfo = new Map(users.map((u) => [u.id, { school: u.school, site: u.site, year: u.year }]));
  return { teams, individuals, classes, sites, pointsByUser, userInfo, updatedAt: new Date().toISOString() };
}

async function computeStandings(): Promise<Standings> {
  const supabase = getSupabaseAdmin();
  const [users, votes, eventVotes, boosts, allocations] = await Promise.all([
    fetchAllRows<UserRow>(supabase, "users", "id, first_name, last_name, team, school, site, year"),
    fetchAllRows<VoteRow>(supabase, "votes", "recipient_id, points"),
    fetchAllRows<EventVoteRow>(supabase, "event_votes", "team_target, qr_type, class_school, class_site, class_year, points"),
    fetchTeamBoosts(supabase),
    fetchMaturedAllocations(supabase),
  ]);
  return buildStandings(users, votes, eventVotes, boosts, allocations);
}

// Cache di processo di pochi secondi, condivisa da tutti i client: il database viene letto al
// massimo una volta ogni TTL, e le richieste in arrivo mentre si ricalcola aspettano la stessa
// promessa. Se il ricalcolo fallisce si serve il dato precedente, se c'è.
let cache: { at: number; data: Standings } | null = null;
let inflight: Promise<Standings> | null = null;

export async function getStandings(): Promise<Standings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (!inflight) {
    inflight = computeStandings()
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return await inflight;
  } catch (e) {
    if (cache) return cache.data;
    throw e;
  }
}

/** Posizione "per indice" usata nella dashboard (senza pari merito): 1 = primo in classifica. */
export function dashboardRank(s: Standings, userId: string): number | null {
  if (!s.pointsByUser.has(userId)) return null;
  const idx = s.individuals.findIndex((r) => r.id === userId);
  return idx >= 0 ? idx + 1 : null;
}
