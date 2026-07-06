"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

const VALID_YEARS = ["1° ANNO 2026", "2° ANNO 2026", "3° ANNO 2026", "4° ANNO 2026"];

type Row = { site: string; points: number; schoolsCount: number; average: number };

export default function SiteRanking() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mySite, setMySite] = useState<string | null>(null);
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
      let allUsersRaw: { id: string; school: string; site: string; year: string }[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from("users")
          .select("id, school, site, year")
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
      if (me?.site) setMySite(me.site);

      const schoolsBySite = new Map<string, Set<string>>();
      for (const u of allUsersRaw) {
        if (!u.school || !u.site || !u.year || !VALID_YEARS.includes(u.year)) continue;
        if (!schoolsBySite.has(u.site)) schoolsBySite.set(u.site, new Set());
        schoolsBySite.get(u.site)!.add(u.school);
      }

      const pointsBySite = new Map<string, number>();
      for (const v of allVotes || []) {
        const recipient = usersById.get(v.recipient_id);
        if (!recipient?.school || !recipient?.site || !recipient?.year || !VALID_YEARS.includes(recipient.year)) continue;
        pointsBySite.set(recipient.site, (pointsBySite.get(recipient.site) || 0) + (v.points || 0));
      }

      const sites = new Set([...schoolsBySite.keys(), ...pointsBySite.keys()]);

      const ranking: Row[] = Array.from(sites).map((site) => {
        const schoolsCount = schoolsBySite.get(site)?.size || 0;
        const points = pointsBySite.get(site) || 0;
        const denominator = schoolsCount * 4;
        const average = denominator > 0 ? points / denominator : 0;
        return { site, points, schoolsCount, average };
      });

      ranking.sort((a, b) => b.average - a.average);
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

  const myIndex = rows.findIndex((r) => r.site === mySite);
  const myRow = myIndex >= 0 ? rows[myIndex] : null;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <Link href="/" style={{ color: "#FF6B35", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>
        ← Torna alla dashboard
      </Link>
      <h1 style={{ color: "#1E3A5F", fontSize: "1.4rem", marginTop: 12, marginBottom: 4 }}>
        🏛️ Classifica per Sede
      </h1>
      <p style={{ color: "#999", fontSize: "0.75rem", marginBottom: 16 }}>
        Punti totali della sede divisi per il numero di classi (1°-4° anno × scuole presenti)
      </p>

      {myRow && (
        <div style={{ background: "#1E3A5F", color: "white", borderRadius: 14, padding: 16, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>La tua sede</div>
          <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>{myIndex + 1}° posto</div>
          <div style={{ fontSize: "0.9rem" }}>
            {myRow.site} · media {myRow.average.toFixed(1)} ({myRow.points} punti / {myRow.schoolsCount * 4} classi)
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ color: "#999", textAlign: "center" }}>Nessuna sede con classi registrate.</p>
      ) : (
        <div>
          {rows.map((r, i) => {
            const isMine = r.site === mySite;
            return (
              <div
                key={r.site}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  marginBottom: 6,
                  borderRadius: 10,
                  background: "#f8f9fa",
                  border: isMine ? "2px solid #1E3A5F" : "1px solid transparent",
                }}
              >
                <span style={{ fontWeight: isMine ? 800 : 600, color: "#1E3A5F" }}>
                  {i + 1}. {r.site}
                  <span style={{ color: "#999", fontWeight: 400, fontSize: "0.75rem" }}> ({r.schoolsCount * 4} classi)</span>
                </span>
                <strong style={{ color: "#1E3A5F" }}>{r.average.toFixed(1)}</strong>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
