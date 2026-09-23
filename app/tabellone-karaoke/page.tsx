"use client";

// Tabellone pubblico per il proiettore, sfida karaoke Matricole vs Veterani
// (sabato 17 ottobre 2026, 16:00-19:00 — vedi lib/karaoke.ts). Nessun cookie/
// login: è pensato per essere aperto così com'è sul PC collegato al
// proiettore. Interroga /api/karaoke-score ogni 2s — un solo schermo, quindi
// nessun impatto sul carico anche con un polling così frequente (il grosso
// del lavoro, cioè la scansione delle tabelle, lo fa quella route una volta
// ogni 2s per un client solo, non per 1200 telefoni).
import { useEffect, useRef, useState } from "react";
import { TEAM_COLORS } from "@/lib/teamColors";
import { RoosterIcon, CowIcon } from "@/components/TeamIcons";

type Score = { Matricole: number; Veterani: number; status: "not_started" | "live" | "ended" };

const POLL_MS = 2000;

export default function TabelloneKaraoke() {
  const [score, setScore] = useState<Score | null>(null);
  const [error, setError] = useState(false);
  const prevLeaderRef = useRef<"Matricole" | "Veterani" | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/karaoke-score", { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const data: Score = await res.json();
        if (stopped) return;
        setError(false);
        setScore((prev) => {
          if (prev && (prev.Matricole !== data.Matricole || prev.Veterani !== data.Veterani)) {
            setPulse(true);
            setTimeout(() => setPulse(false), 600);
          }
          return data;
        });
      } catch {
        if (!stopped) setError(true);
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  const leader: "Matricole" | "Veterani" | null =
    score && score.Matricole !== score.Veterani
      ? score.Matricole > score.Veterani ? "Matricole" : "Veterani"
      : null;
  prevLeaderRef.current = leader;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #1E3A5F, #0d1b2a)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "white",
        padding: "4vh 4vw",
        boxSizing: "border-box",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(1.8rem, 4vw, 3.2rem)",
          fontWeight: 800,
          margin: "0 0 4vh",
          textAlign: "center",
          letterSpacing: 1,
        }}
      >
        🎤 Sfida Karaoke
      </h1>

      {!score && !error && (
        <p style={{ fontSize: "1.5rem", opacity: 0.8 }}>Caricamento...</p>
      )}

      {error && !score && (
        <p style={{ fontSize: "1.5rem", color: "#ff8a8a" }}>
          Connessione persa, nuovo tentativo automatico...
        </p>
      )}

      {score && (
        <>
          {score.status === "not_started" && (
            <p style={{ fontSize: "clamp(1.2rem, 2.5vw, 2rem)", marginBottom: "3vh", opacity: 0.85 }}>
              La sfida inizia alle 16:00 — il tabellone si aggiorna da solo
            </p>
          )}
          {score.status === "ended" && (
            <p style={{ fontSize: "clamp(1.2rem, 2.5vw, 2rem)", marginBottom: "3vh", color: "#FFD65A", fontWeight: 700 }}>
              🏆 Sfida conclusa!
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: "4vw",
              width: "100%",
              maxWidth: 1400,
              justifyContent: "center",
              transform: pulse ? "scale(1.02)" : "scale(1)",
              transition: "transform 0.3s ease-out",
            }}
          >
            {(["Matricole", "Veterani"] as const).map((team) => {
              const isLeader = leader === team;
              return (
                <div
                  key={team}
                  style={{
                    flex: 1,
                    background: TEAM_COLORS[team],
                    borderRadius: 32,
                    padding: "5vh 2vw",
                    textAlign: "center",
                    boxShadow: isLeader
                      ? "0 0 0 6px #FFD65A, 0 20px 60px rgba(0,0,0,0.4)"
                      : "0 20px 60px rgba(0,0,0,0.4)",
                    transition: "box-shadow 0.4s ease-out",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "2vh" }}>
                    {team === "Matricole" ? (
                      <RoosterIcon size={80} color="white" />
                    ) : (
                      <CowIcon size={80} color="white" />
                    )}
                  </div>
                  <div style={{ fontSize: "clamp(1.4rem, 3vw, 2.2rem)", fontWeight: 700, marginBottom: "2vh" }}>
                    {team}
                  </div>
                  <div style={{ fontSize: "clamp(4rem, 12vw, 9rem)", fontWeight: 900, lineHeight: 1 }}>
                    {score[team]}
                  </div>
                  {isLeader && (
                    <div style={{ marginTop: "2vh", fontSize: "clamp(1rem, 2vw, 1.5rem)", color: "#FFD65A", fontWeight: 700 }}>
                      👑 in testa
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
