"use client";

import { TEAM_COLORS } from "@/lib/teamColors";
import { useStandings } from "@/lib/useStandings";
import RankingScreen, { RankingRow } from "@/components/RankingScreen";

type Row = { id: string; name: string; team: string | null; points: number; rank: number };

const teamStyle = (team: string | null) => {
  if (team === "Matricole") return { background: "#FFEDE3", color: TEAM_COLORS.Matricole, borderColor: TEAM_COLORS.Matricole };
  if (team === "Veterani") return { background: "#E3EAF2", color: TEAM_COLORS.Veterani, borderColor: TEAM_COLORS.Veterani };
  return { background: "#f0f0f0", color: "#666", borderColor: "#ccc" };
};

export default function IndividualRanking() {
  const { data, status, userId } = useStandings<{ rows: Row[] }>("individuali");
  const rows = data?.rows || [];
  const myRow = rows.find((r) => r.id === userId) || null;

  return (
    <RankingScreen
      status={status}
      title="🏅 Classifica Individuale"
      mine={myRow && { label: "La tua posizione", rank: myRow.rank, detail: `${myRow.name} · ${myRow.points} punti` }}
      empty={rows.length === 0 ? { text: "Nessun voto ancora registrato." } : null}
    >
      {rows.map((r) => (
        <RankingRow key={r.id} mine={r.id === userId} value={r.points} {...teamStyle(r.team)}>
          {r.rank}. {r.name}
        </RankingRow>
      ))}
    </RankingScreen>
  );
}
