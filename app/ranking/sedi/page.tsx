"use client";

import { useStandings } from "@/lib/useStandings";
import RankingScreen, { RankingRow } from "@/components/RankingScreen";

type Row = { site: string; points: number; classCount: number; average: number };

export default function SiteRanking() {
  const { data, status } = useStandings<{ rows: Row[]; mySite: string | null }>("sedi");
  const rows = data?.rows || [];
  const myIndex = rows.findIndex((r) => r.site === data?.mySite);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;

  return (
    <RankingScreen
      status={status}
      title="🏛️ Classifica per Sede"
      subtitle="Punti totali della sede divisi per il numero di classi realmente esistenti in quella sede"
      mine={
        myRow && {
          label: "La tua sede",
          rank: myIndex + 1,
          detail: `${myRow.site} · media ${myRow.average.toFixed(1)} (${myRow.points} punti / ${myRow.classCount} ${myRow.classCount === 1 ? "classe" : "classi"})`,
        }
      }
      empty={rows.length === 0 ? { text: "Nessuna sede con classi registrate." } : null}
    >
      {rows.map((r, i) => (
        <RankingRow
          key={r.site}
          mine={r.site === data?.mySite}
          background="#f8f9fa"
          color="#1E3A5F"
          borderColor="#1E3A5F"
          value={r.average.toFixed(1)}
        >
          {i + 1}. {r.site}
          <span style={{ color: "#999", fontWeight: 400, fontSize: "0.75rem" }}> ({r.classCount} {r.classCount === 1 ? "classe" : "classi"})</span>
        </RankingRow>
      ))}
    </RankingScreen>
  );
}
