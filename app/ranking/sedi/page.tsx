"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCookie } from "@/lib/clientCookies";

type Row = { site: string; points: number; classCount: number; average: number };

export default function SiteRanking() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mySite, setMySite] = useState<string | null>(null);
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
        const res = await fetch("/api/standings?view=sedi", { cache: "no-store" });
        if (res.status === 401) {
          setNoAccess(true);
        } else if (!res.ok) {
          throw new Error(String(res.status));
        } else {
          const data = await res.json();
          setRows(data.rows);
          setMySite(data.mySite);
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
        Punti totali della sede divisi per il numero di classi realmente esistenti in quella sede
      </p>

      {myRow && (
        <div style={{ background: "#1E3A5F", color: "white", borderRadius: 14, padding: 16, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>La tua sede</div>
          <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>{myIndex + 1}° posto</div>
          <div style={{ fontSize: "0.9rem" }}>
            {myRow.site} · media {myRow.average.toFixed(1)} ({myRow.points} punti / {myRow.classCount} classi)
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
                  <span style={{ color: "#999", fontWeight: 400, fontSize: "0.75rem" }}> ({r.classCount} classi)</span>
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
