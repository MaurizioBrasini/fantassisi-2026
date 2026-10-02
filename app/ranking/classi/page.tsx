"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CONFIG_ISCRIZIONE } from "@/lib/config";
import { TEAM_COLORS } from "@/lib/teamColors";
import { getCookie } from "@/lib/clientCookies";

function yearLabel(year: string | null): string {
  if (!year) return "";
  return CONFIG_ISCRIZIONE.anni.find((a) => a.value === year)?.label || year;
}

type Row = { key: string; school: string; site: string; year: string; points: number; rank: number };

export default function ClassRanking() {
  const [rows, setRows] = useState<Row[]>([]);
  const [myKey, setMyKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!getCookie("user_id")) {
        setNoAccess(true);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/standings?view=classi", { cache: "no-store" });
        if (res.status === 401) {
          setNoAccess(true);
        } else if (!res.ok) {
          throw new Error(String(res.status));
        } else {
          const data = await res.json();
          setRows(data.rows);
          setMyKey(data.myKey);
        }
      } catch {
        setLoadError(true);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  if (noAccess) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <h2 style={{ color: "#1E3A5F" }}>Accesso non valido</h2>
        <p style={{ color: "#666" }}>Usa il link personale che ti è stato inviato per entrare nell'app.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  }

  if (loadError) {
    return <div style={{ textAlign: "center", padding: 40, color: "#666" }}>Non riesco a caricare la classifica. Ricarica la pagina.</div>;
  }

  const myRow = rows.find((r) => r.key === myKey) || null;
  const myRank = myRow ? myRow.rank : null;

  const teamColor = (year: string) => {
    const isVeterani = CONFIG_ISCRIZIONE.teamAnniValid['Veterani'].includes(year);
    return isVeterani
      ? { background: "#E3EAF2", color: TEAM_COLORS.Veterani, border: TEAM_COLORS.Veterani }
      : { background: "#FFEDE3", color: TEAM_COLORS.Matricole, border: TEAM_COLORS.Matricole };
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <Link href="/" style={{ color: "#FF6B35", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>
        ← Torna alla dashboard
      </Link>
      <h1 style={{ color: "#1E3A5F", fontSize: "1.4rem", marginTop: 12, marginBottom: 16 }}>
        🏫 Classifica per Classe
      </h1>

      {myRow && (
        <div style={{ background: "#1E3A5F", color: "white", borderRadius: 14, padding: 16, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>La tua classe</div>
          <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>{myRank}° posto</div>
          <div style={{ fontSize: "0.9rem" }}>
            {myRow.school} {myRow.site} {yearLabel(myRow.year)} · {myRow.points} punti
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: "#999", textAlign: "center" }}>Nessun voto ancora registrato.</p>
      ) : (
        <div>
          {rows.map((r) => {
            const style = teamColor(r.year);
            const isMine = r.key === myKey;
            const rank = r.rank;
            return (
              <div
                key={r.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  marginBottom: 6,
                  borderRadius: 10,
                  background: style.background,
                  border: isMine ? `2px solid ${style.border}` : "1px solid transparent",
                }}
              >
                <span style={{ color: style.color, fontWeight: isMine ? 800 : 600 }}>
                  {rank}. {r.school} {r.site} {yearLabel(r.year)}
                </span>
                <strong style={{ color: style.color }}>{r.points}</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}