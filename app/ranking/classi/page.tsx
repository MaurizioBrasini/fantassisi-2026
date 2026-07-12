"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function yearLabel(year: string | null): string {
  if (!year) return "";
  if (year.startsWith("PRE-ISCRITTI")) return "Pre-iscritti";
  const match = year.match(/^(\d°)\s*ANNO/);
  return match ? `${match[1]} anno` : year;
}

type Row = { key: string; school: string; site: string; year: string; points: number };

// Funzione per calcolare i rank con pari merito (1, 2, 2, 3)
function assignRanks(rows: Row[]): { rank: number }[] {
  const result: { rank: number }[] = [];
  let currentRank = 1;
  let i = 0;
  while (i < rows.length) {
    const currentPoints = rows[i].points;
    let j = i;
    while (j < rows.length && rows[j].points === currentPoints) {
      j++;
    }
    for (let k = i; k < j; k++) {
      result.push({ rank: currentRank });
    }
    currentRank += (j - i);
    i = j;
  }
  return result;
}

export default function ClassRanking() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ranks, setRanks] = useState<{ rank: number }[]>([]);
  const [myKey, setMyKey] = useState<string | null>(null);
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

      // Scarica tutti gli utenti a blocchi da 1000
      let allUsersRaw: { id: string; school: string; site: string; year: string; team: string }[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from("users")
          .select("id, school, site, year, team")
          .range(from, from + 999);
        if (!page || page.length === 0) break;
        allUsersRaw.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }

      const { data: allVotes } = await supabase
        .from("votes")
        .select("recipient_id, points");

      const usersById = new Map(allUsersRaw.map((u) => [u.id, u]));

      const me = usersById.get(id);
      if (me?.school && me?.site && me?.year) {
        setMyKey(`${me.school}||${me.site}||${me.year}`);
      }

      const pointsByClass = new Map<string, number>();
      const classInfo = new Map<string, { school: string; site: string; year: string }>();

      // 1. Punteggi dai voti individuali (tabella votes)
      for (const v of allVotes || []) {
        const recipient = usersById.get(v.recipient_id);
        if (!recipient?.school || !recipient?.site || !recipient?.year) continue;
        const key = `${recipient.school}||${recipient.site}||${recipient.year}`;
        pointsByClass.set(key, (pointsByClass.get(key) || 0) + (v.points || 0));
        if (!classInfo.has(key)) {
          classInfo.set(key, { school: recipient.school, site: recipient.site, year: recipient.year });
        }
      }

      // 🔥 MODIFICA: 2. Punteggi dai QR voto per classe (tabella event_votes)
      const { data: eventVotes } = await supabase
        .from("event_votes")
        .select("class_school, class_site, class_year, points")
        .eq("qr_type", "class");

      for (const ev of eventVotes || []) {
        if (!ev.class_school || !ev.class_site || !ev.class_year) continue;
        const key = `${ev.class_school}||${ev.class_site}||${ev.class_year}`;
        pointsByClass.set(key, (pointsByClass.get(key) || 0) + (ev.points || 1));
        if (!classInfo.has(key)) {
          classInfo.set(key, {
            school: ev.class_school,
            site: ev.class_site,
            year: ev.class_year,
          });
        }
      }

      const ranking: Row[] = Array.from(pointsByClass.entries())
        .map(([key, points]) => {
          const info = classInfo.get(key)!;
          return { key, school: info.school, site: info.site, year: info.year, points };
        })
        .sort((a, b) => b.points - a.points);

      // Calcola i rank con pari merito
      const assignedRanks = assignRanks(ranking);

      setRows(ranking);
      setRanks(assignedRanks);
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

  const myIndex = rows.findIndex((r) => r.key === myKey);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;
  const myRank = myIndex >= 0 ? ranks[myIndex]?.rank : null;

  const teamColor = (year: string) => {
    const isVeterani = year.startsWith("3°") || year.startsWith("4°");
    return isVeterani
      ? { background: "#E3EAF2", color: "#1E3A5F", border: "#1E3A5F" }
      : { background: "#FFEDE3", color: "#FF6B35", border: "#FF6B35" };
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
          {rows.map((r, i) => {
            const style = teamColor(r.year);
            const isMine = r.key === myKey;
            const rank = ranks[i]?.rank ?? i + 1;
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