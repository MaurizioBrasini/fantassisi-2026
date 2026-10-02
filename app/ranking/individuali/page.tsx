"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEAM_COLORS } from "@/lib/teamColors";
import { getCookie } from "@/lib/clientCookies";

type Row = { id: string; name: string; team: string | null; points: number; rank: number };

export default function IndividualRanking() {
  const [rows, setRows] = useState<Row[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const id = getCookie("user_id");
      if (!id) {
        setNoAccess(true);
        setLoading(false);
        return;
      }
      setMyId(id);

      try {
        const res = await fetch("/api/standings?view=individuali", { cache: "no-store" });
        if (res.status === 401) {
          setNoAccess(true);
        } else if (!res.ok) {
          throw new Error(String(res.status));
        } else {
          setRows((await res.json()).rows);
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

  const myRow = rows.find((r) => r.id === myId) || null;

  const teamStyle = (team: string | null) => {
    if (team === "Matricole") return { background: "#FFEDE3", color: TEAM_COLORS.Matricole, borderColor: TEAM_COLORS.Matricole };
    if (team === "Veterani") return { background: "#E3EAF2", color: TEAM_COLORS.Veterani, borderColor: TEAM_COLORS.Veterani };
    return { background: "#f0f0f0", color: "#666", borderColor: "#ccc" };
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <Link href="/" style={{ color: "#FF6B35", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>
        ← Torna alla dashboard
      </Link>
      <h1 style={{ color: "#1E3A5F", fontSize: "1.4rem", marginTop: 12, marginBottom: 16 }}>
        🏅 Classifica Individuale
      </h1>

      {myRow && (
        <div style={{ background: "#1E3A5F", color: "white", borderRadius: 14, padding: 16, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>La tua posizione</div>
          <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>{myRow.rank}° posto</div>
          <div style={{ fontSize: "0.9rem" }}>{myRow.name} · {myRow.points} punti</div>
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: "#999", textAlign: "center" }}>Nessun voto ancora registrato.</p>
      ) : (
        <div>
          {rows.map((r) => {
            const style = teamStyle(r.team);
            const isMe = r.id === myId;
            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  marginBottom: 6,
                  borderRadius: 10,
                  background: style.background,
                  border: isMe ? `2px solid ${style.borderColor}` : "1px solid transparent",
                }}
              >
                <span style={{ color: style.color, fontWeight: isMe ? 800 : 600 }}>
                  {r.rank}. {r.name}
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
