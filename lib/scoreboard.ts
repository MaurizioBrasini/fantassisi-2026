// Dati del tabellone pubblico /tabellone: stessi numeri dell'app perché vengono dallo stesso
// calcolo (lib/standings.ts), qui solo ridotti a quello che serve allo schermo.
import { CONFIG_ISCRIZIONE } from "./config";
import { getStandings, type TeamScores } from "./standings";

export type { TeamScores };
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

export async function computeScoreboard(): Promise<ScoreboardData> {
  const s = await getStandings();
  return {
    teams: s.teams,
    // Primi TOP_N con i pari merito (come nelle pagine dell'app).
    individuals: s.individuals
      .filter((r) => r.rank <= TOP_N)
      .map((r) => ({ rank: r.rank, name: r.name, team: r.team, points: r.points })),
    classes: s.classes
      .filter((r) => r.rank <= TOP_N)
      .map((r) => ({
        rank: r.rank,
        school: r.school,
        site: r.site,
        yearLabel: CONFIG_ISCRIZIONE.anni.find((a) => a.value === r.year)?.label || r.year,
        points: r.points,
      })),
    // Nella pagina dell'app la sede ha la posizione dell'indice (nessun pari merito).
    sites: s.sites.map((site, i) => ({ ...site, rank: i + 1 })),
    updatedAt: s.updatedAt,
  };
}
