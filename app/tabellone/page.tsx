"use client";

// Tabellone pubblico per il proiettore, per tutti e 3 i giorni: stessi punteggi
// dell'app (squadre, classi, sedi, individuali) a rotazione. Nessun cookie/login,
// si apre così com'è dal PC collegato al proiettore. Si può fissare una sola
// schermata con ?fisso=squadre|classi|sedi|individuali (es. /tabellone?fisso=squadre).
import { useEffect, useState } from "react";
import { TEAM_COLORS } from "@/lib/teamColors";
import { RoosterIcon, CowIcon } from "@/components/TeamIcons";
import type { ScoreboardData } from "@/lib/scoreboard";

const POLL_MS = 5000;
const SLIDE_MS = 10000;
const SLIDES = ["squadre", "individuali", "sedi", "classi"] as const;
type Slide = (typeof SLIDES)[number];

const TITLES: Record<Slide, string> = {
  squadre: "🏆 Matricole vs Veterani",
  classi: "🎓 Classifica Classi",
  sedi: "🏛️ Classifica Sedi",
  individuali: "🏅 Classifica Individuale",
};

function teamColor(team: string | null) {
  if (team === "Matricole") return TEAM_COLORS.Matricole;
  if (team === "Veterani") return TEAM_COLORS.Veterani;
  return "rgba(255,255,255,0.25)";
}

export default function Tabellone() {
  const [data, setData] = useState<ScoreboardData | null>(null);
  const [error, setError] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);
  const [pinned, setPinned] = useState<Slide | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("fisso");
    if (p && (SLIDES as readonly string[]).includes(p)) setPinned(p as Slide);
  }, []);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/tabellone", { cache: "no-store" });
        if (!res.ok) throw new Error("bad status");
        const next: ScoreboardData = await res.json();
        if (stopped) return;
        setError(false);
        setData((prev) => {
          if (prev && (prev.teams.Matricole !== next.teams.Matricole || prev.teams.Veterani !== next.teams.Veterani)) {
            setPulse(true);
            setTimeout(() => setPulse(false), 600);
          }
          return next;
        });
      } catch {
        // Si tiene l'ultimo dato a schermo e si riprova al giro dopo.
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

  useEffect(() => {
    if (pinned) return;
    const id = setInterval(() => setSlideIdx((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [pinned]);

  const slide: Slide = pinned ?? SLIDES[slideIdx];
  const leader: "Matricole" | "Veterani" | null =
    data && data.teams.Matricole !== data.teams.Veterani
      ? data.teams.Matricole > data.teams.Veterani ? "Matricole" : "Veterani"
      : null;

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "1.5vw",
    padding: "1.1vh 2vw",
    marginBottom: "1vh",
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    fontSize: "clamp(1rem, 2.1vw, 1.7rem)",
  } as const;

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
        padding: "3vh 4vw",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 3.2rem)", fontWeight: 800, margin: "0 0 3vh", textAlign: "center", letterSpacing: 1 }}>
        {TITLES[slide]}
      </h1>

      {!data && !error && <p style={{ fontSize: "1.5rem", opacity: 0.8 }}>Caricamento...</p>}
      {!data && error && <p style={{ fontSize: "1.5rem", color: "#ff8a8a" }}>Connessione persa, nuovo tentativo automatico...</p>}

      {data && (
        <div style={{ width: "100%", maxWidth: 1400 }}>
          {slide === "squadre" && (
            <div
              style={{
                display: "flex",
                gap: "4vw",
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
                      boxShadow: isLeader ? "0 0 0 6px #FFD65A, 0 20px 60px rgba(0,0,0,0.4)" : "0 20px 60px rgba(0,0,0,0.4)",
                      transition: "box-shadow 0.4s ease-out",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "2vh" }}>
                      {team === "Matricole" ? <RoosterIcon size={80} color="white" /> : <CowIcon size={80} color="white" />}
                    </div>
                    <div style={{ fontSize: "clamp(1.4rem, 3vw, 2.2rem)", fontWeight: 700, marginBottom: "2vh" }}>{team}</div>
                    <div style={{ fontSize: "clamp(4rem, 12vw, 9rem)", fontWeight: 900, lineHeight: 1 }}>{data.teams[team]}</div>
                    {isLeader && (
                      <div style={{ marginTop: "2vh", fontSize: "clamp(1rem, 2vw, 1.5rem)", color: "#FFD65A", fontWeight: 700 }}>👑 in testa</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {slide === "classi" &&
            (data.classes.length === 0 ? (
              <p style={{ textAlign: "center", fontSize: "1.6rem", opacity: 0.8 }}>Nessun voto ancora registrato.</p>
            ) : (
              data.classes.map((c, i) => (
                <div key={`${c.school}-${c.site}-${c.yearLabel}-${i}`} style={rowStyle}>
                  <strong style={{ width: "3.5vw", minWidth: 40 }}>{c.rank}.</strong>
                  <span style={{ flex: 1 }}>{c.school} {c.site} · {c.yearLabel}</span>
                  <strong>{c.points}</strong>
                </div>
              ))
            ))}

          {slide === "sedi" && (
            <>
              <p style={{ textAlign: "center", opacity: 0.7, margin: "0 0 2vh", fontSize: "clamp(0.9rem, 1.4vw, 1.1rem)" }}>
                Punti della sede divisi per il numero di classi
              </p>
              {data.sites.slice(0, 10).map((s) => (
                <div key={s.site} style={rowStyle}>
                  <strong style={{ width: "3.5vw", minWidth: 40 }}>{s.rank}.</strong>
                  <span style={{ flex: 1 }}>{s.site}</span>
                  <span style={{ opacity: 0.7, fontSize: "0.7em" }}>{s.points} punti / {s.classCount} classi</span>
                  <strong>{s.average.toFixed(1)}</strong>
                </div>
              ))}
            </>
          )}

          {slide === "individuali" &&
            (data.individuals.length === 0 ? (
              <p style={{ textAlign: "center", fontSize: "1.6rem", opacity: 0.8 }}>Nessun voto ancora registrato.</p>
            ) : (
              data.individuals.map((r, i) => (
                <div key={`${r.name}-${i}`} style={{ ...rowStyle, borderLeft: `10px solid ${teamColor(r.team)}` }}>
                  <strong style={{ width: "3.5vw", minWidth: 40 }}>{r.rank}.</strong>
                  <span style={{ flex: 1 }}>{r.name}</span>
                  <strong>{r.points}</strong>
                </div>
              ))
            ))}
        </div>
      )}

      {data && error && (
        <p style={{ position: "fixed", bottom: 8, right: 16, fontSize: "0.8rem", color: "#ff8a8a", margin: 0 }}>
          connessione instabile, dati dell&apos;ultimo aggiornamento
        </p>
      )}
    </div>
  );
}
