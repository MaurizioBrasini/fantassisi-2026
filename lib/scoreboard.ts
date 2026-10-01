// Calcolo dei punteggi per il tabellone pubblico /tabellone. Replica fedelmente
// i calcoli delle pagine dell'app (dashboard + /ranking/individuali, /classi,
// /sedi) in un'unica lettura lato server, così lo schermo vede gli stessi numeri
// dei telefoni. Se cambia una regola in quelle pagine, va allineata qui.
import { createClient } from "@supabase/supabase-js";
import { CONFIG_ISCRIZIONE } from "./config";
import { fetchTeamBoosts, addBoostsToScores } from "./boosts";

export type TeamScores = { Matricole: number; Veterani: number };
export type IndividualRow = { rank: number; name: string; team: string | null; points: number };
export type ClassRow = { rank: number; school: string; site: string; yearLabel: string; points: number };
export type SiteRow = { rank: number; site: string; points: number; classCount: number; average: number };
export type ScoreboardData = {
  teams: TeamScores;
  individuals: IndividualRow[];
  classes: ClassRow[];
  sites: SiteRow[];
  updatedAt: string;
};

const TOP_N = 10;
const VALID_YEARS = ["primo", "secondo", "terzo", "quarto"];

function getClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Legge una tabella intera a blocchi da 1000 (Supabase tronca oltre), ordinando
// per id così le pagine non si sovrappongono né saltano righe.
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (true) {
    const { data: page } = await build(from, from + 999);
    if (!page || page.length === 0) break;
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}

// Rank con pari merito (1, 2, 2, 4), come nelle pagine dell'app.
function withRanks<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  const result: (T & { rank: number })[] = [];
  let currentRank = 1;
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && rows[j].points === rows[i].points) j++;
    for (let k = i; k < j; k++) result.push({ ...rows[k], rank: currentRank });
    currentRank += j - i;
    i = j;
  }
  return result;
}

// Numero di classi realmente esistenti in una sede (come in /ranking/sedi).
function realClassCount(site: string): number {
  const schools = CONFIG_ISCRIZIONE.scuolePerSede[site as keyof typeof CONFIG_ISCRIZIONE.scuolePerSede] || [];
  return schools.reduce((sum, school) => {
    const n = CONFIG_ISCRIZIONE.classiPerSedeScuola.eccezioni[`${site}||${school}`]
      ?? CONFIG_ISCRIZIONE.classiPerSedeScuola.default;
    return sum + n;
  }, 0);
}

export async function computeScoreboard(): Promise<ScoreboardData> {
  const supabase = getClient();

  const [users, votes, eventVotes] = await Promise.all([
    fetchAll<{ id: string; first_name: string | null; last_name: string | null; team: string | null; school: string | null; site: string | null; year: string | null }>(
      (from, to) => supabase.from("users").select("id, first_name, last_name, team, school, site, year").order("id").range(from, to)
    ),
    fetchAll<{ recipient_id: string; points: number }>(
      (from, to) => supabase.from("votes").select("recipient_id, points").order("id").range(from, to)
    ),
    fetchAll<{ team_target: string | null; qr_type: string | null; class_school: string | null; class_site: string | null; class_year: string | null; points: number }>(
      (from, to) => supabase.from("event_votes").select("team_target, qr_type, class_school, class_site, class_year, points").order("id").range(from, to)
    ),
  ]);

  const usersById = new Map(users.map((u) => [u.id, u]));

  // --- Squadre (dashboard): voti ricevuti da Matricole/Veterani + QR di squadra/classe ---
  const teams: TeamScores = { Matricole: 0, Veterani: 0 };
  for (const v of votes) {
    const team = usersById.get(v.recipient_id)?.team;
    if (team === "Matricole") teams.Matricole += v.points || 0;
    if (team === "Veterani") teams.Veterani += v.points || 0;
  }
  for (const ev of eventVotes) {
    if (ev.team_target === "Matricole") teams.Matricole += ev.points || 1;
    if (ev.team_target === "Veterani") teams.Veterani += ev.points || 1;
  }

  // Bonus a tempo decisi dall'admin: contano solo nei punteggi di squadra.
  addBoostsToScores(teams, await fetchTeamBoosts(supabase));

  // --- Individuali ---
  const pointsByUser = new Map<string, number>();
  for (const v of votes) {
    pointsByUser.set(v.recipient_id, (pointsByUser.get(v.recipient_id) || 0) + (v.points || 0));
  }
  const individualsAll = Array.from(pointsByUser.entries())
    .map(([uid, points]) => {
      const u = usersById.get(uid);
      return { name: u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() || "—" : "—", team: u?.team || null, points };
    })
    .sort((a, b) => b.points - a.points);
  const individuals = withRanks(individualsAll).filter((r) => r.rank <= TOP_N);

  // --- Classi (scuola + sede + anno) ---
  const pointsByClass = new Map<string, { school: string; site: string; year: string; points: number }>();
  const addClass = (school: string, site: string, year: string, pts: number) => {
    const key = `${school}||${site}||${year}`;
    const cur = pointsByClass.get(key) || { school, site, year, points: 0 };
    cur.points += pts;
    pointsByClass.set(key, cur);
  };
  for (const v of votes) {
    const r = usersById.get(v.recipient_id);
    if (!r?.school || !r?.site || !r?.year) continue;
    addClass(r.school, r.site, r.year, v.points || 0);
  }
  for (const ev of eventVotes) {
    if (ev.qr_type !== "class" || !ev.class_school || !ev.class_site || !ev.class_year) continue;
    addClass(ev.class_school, ev.class_site, ev.class_year, ev.points || 1);
  }
  const classesAll = Array.from(pointsByClass.values())
    .map((c) => ({
      school: c.school,
      site: c.site,
      yearLabel: CONFIG_ISCRIZIONE.anni.find((a) => a.value === c.year)?.label || c.year,
      points: c.points,
    }))
    .sort((a, b) => b.points - a.points);
  const classes = withRanks(classesAll).filter((r) => r.rank <= TOP_N);

  // --- Sedi: punti / numero di classi reali (primo..quarto anno + QR di classe) ---
  const pointsBySite = new Map<string, number>();
  for (const v of votes) {
    const r = usersById.get(v.recipient_id);
    if (!r?.school || !r?.site || !r?.year || !VALID_YEARS.includes(r.year)) continue;
    pointsBySite.set(r.site, (pointsBySite.get(r.site) || 0) + (v.points || 0));
  }
  for (const ev of eventVotes) {
    if (ev.qr_type !== "class" || !ev.class_site) continue;
    pointsBySite.set(ev.class_site, (pointsBySite.get(ev.class_site) || 0) + (ev.points || 0));
  }
  const sitesAll = CONFIG_ISCRIZIONE.sedi
    .map((site) => {
      const classCount = realClassCount(site);
      const points = pointsBySite.get(site) || 0;
      return { site, points, classCount, average: classCount > 0 ? points / classCount : 0 };
    })
    .sort((a, b) => b.average - a.average);
  // Nella pagina dell'app la sede ha la posizione dell'indice (nessun pari merito).
  const sites: SiteRow[] = sitesAll.map((s, i) => ({ ...s, rank: i + 1 }));

  return { teams, individuals, classes, sites, updatedAt: new Date().toISOString() };
}
