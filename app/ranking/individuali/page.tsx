"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

type Row = { id: string; name: string; team: string | null; points: number };

export default function IndividualRanking() {
  const [rows, setRows] = useState<Row[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const id = getCookie("user_id");
      if (!id) {
        setNoAccess(true);
        setLoading(false);
        return;
      }
      setMyId(id);

      const [{ data: allUsers }, { data: allVotes }] = await Promise.all([
        supabase.from("users").select("id, first_name, last_name, team"),
        supabase.from("votes").select("recipient_id, points"),
      ]);

      const usersById = new Map((allUsers || []).map((u) => [u.id, u]));
      const pointsByUser = new Map<string, number>();
      for (const v of allVotes || []) {
        pointsByUser.set(v.recipient_id, (pointsByUser.get(v.recipient_id) || 0) + (v.points || 0));
      }

      const ranking: Row[] = [...pointsByUser.entries()]
        .map(([uid, points]) => {
          const u = usersById.get(uid);
          return {
            id: uid,
            name: u ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "—",
            team: u?.team || null,
            points,
          };
        })
        .sort((a, b) => b.points - a.points);

      setRows(ranking);
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

  const myIndex = rows.findIndex((r) => r.id === myId);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;

  const teamStyle = (team: string | null) => {
    if (team === "Matricole") return { background: "#FFEDE3", color: "#FF6B35", borderColor: "#FF6B35" };
    if (team === "Veterani") return { background: "#E3EAF2", color: "#1E3A5F", borderColor: "#1E3A5F" };
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
          <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>{myIndex + 1}° posto</div>
          <div style={{ fontSize: "0.9rem" }}>{myRow.name} · {myRow.points} punti</div>
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: "#999", textAlign: "center" }}>Nessun voto ancora registrato.</p>
      ) : (
        <div>
          {rows.map((r, i) => {
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
                  {i + 1}. {r.name}
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
