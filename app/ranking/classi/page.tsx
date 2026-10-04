"use client";

import { teamForYear, yearLabel } from "@/lib/config";
import { TEAM_COLORS } from "@/lib/teamColors";
import { useStandings } from "@/lib/useStandings";
import RankingScreen, { RankingRow } from "@/components/RankingScreen";

type Row = { key: string; school: string; site: string; year: string; points: number; rank: number };

// Le classi del 3°/4° anno sono dei Veterani, le altre delle Matricole.
const teamColor = (year: string) =>
  teamForYear(year) === "Veterani"
    ? { background: "#E3EAF2", color: TEAM_COLORS.Veterani, borderColor: TEAM_COLORS.Veterani }
    : { background: "#FFEDE3", color: TEAM_COLORS.Matricole, borderColor: TEAM_COLORS.Matricole };

export default function ClassRanking() {
  const { data, status } = useStandings<{ rows: Row[]; myKey: string | null }>("classi");
  const rows = data?.rows || [];
  const myRow = rows.find((r) => r.key === data?.myKey) || null;

  return (
    <RankingScreen
      status={status}
      title="🏫 Classifica per Classe"
      mine={
        myRow && {
          label: "La tua classe",
          rank: myRow.rank,
          detail: `${myRow.school} ${myRow.site} ${yearLabel(myRow.year)} · ${myRow.points} punti`,
        }
      }
      empty={rows.length === 0 ? { text: "Nessun voto ancora registrato." } : null}
    >
      {rows.map((r) => (
        <RankingRow key={r.key} mine={r.key === data?.myKey} value={r.points} {...teamColor(r.year)}>
          {r.rank}. {r.school} {r.site} {yearLabel(r.year)}
        </RankingRow>
      ))}
    </RankingScreen>
  );
}
