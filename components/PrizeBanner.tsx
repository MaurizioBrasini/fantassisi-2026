"use client";

import { useEffect, useMemo, useState } from "react";

type Prize = { id: string; reason: string | null; target_type: string | null; target_label: string | null; total_points: number; created_at: string };

const SEEN_KEY = "fantassisi_prize_seen";
const POLL_MS = 20_000;
// Chi apre l'app per la prima volta non deve vedere un premio vecchio: solo quelli appena dati.
const FRESH_MS = 30 * 60_000;
const EMOJI = ["🎉", "⭐", "🏆", "✨", "🎊", "🥇"];

const readSeen = (): string | null => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };
const writeSeen = (id: string) => { try { localStorage.setItem(SEEN_KEY, id); } catch { /* senza storage il banner può ripetersi: pazienza */ } };

const WHO: Record<string, string> = { person: "Premio a", class: "Premio alla classe", site: "Premio alla sede" };

// Banner trionfale per i premi palesi. Chiede l'ultimo premio ogni 20 secondi (a pagina visibile) e
// lo mostra una volta sola per dispositivo; si chiude toccando.
export default function PrizeBanner() {
  const [prize, setPrize] = useState<Prize | null>(null);
  const confetti = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({
      left: Math.round((i * 37) % 100), delay: ((i * 13) % 20) / 10, dur: 2.6 + ((i * 7) % 15) / 10, emoji: EMOJI[i % EMOJI.length], size: 18 + ((i * 5) % 18),
    })),
    []
  );

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/premio", { cache: "no-store" });
        if (!res.ok) return;
        const { prize: p } = (await res.json()) as { prize: Prize | null };
        if (stopped || !p) return;
        const seen = readSeen();
        if (seen === p.id) return;
        if (seen === null && Date.now() - Date.parse(p.created_at) > FRESH_MS) { writeSeen(p.id); return; }
        setPrize((cur) => cur ?? p);
      } catch { /* niente rete: si riprova al prossimo giro */ }
    };
    check();
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);

  if (!prize) return null;
  const close = () => { writeSeen(prize.id); setPrize(null); };

  return (
    <div
      onClick={close}
      role="dialog"
      aria-label="Premio assegnato"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,20,40,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflow: "hidden", fontFamily: "system-ui, sans-serif", animation: "prizeFade .3s ease-out" }}
    >
      <style>{`
        @keyframes prizeFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes prizePop { 0% { transform: scale(.4) rotate(-6deg); opacity: 0 } 60% { transform: scale(1.08) rotate(2deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
        @keyframes prizeFall { from { transform: translateY(-12vh) rotate(0) } to { transform: translateY(112vh) rotate(540deg) } }
        @keyframes prizeShine { 0%,100% { transform: scale(1) } 50% { transform: scale(1.12) } }
      `}</style>

      {confetti.map((c, i) => (
        <span key={i} aria-hidden style={{ position: "absolute", top: 0, left: `${c.left}%`, fontSize: c.size, animation: `prizeFall ${c.dur}s linear ${c.delay}s infinite`, pointerEvents: "none" }}>
          {c.emoji}
        </span>
      ))}

      <div style={{ position: "relative", maxWidth: 420, width: "100%", textAlign: "center", padding: "28px 22px", borderRadius: 24, color: "white", background: "linear-gradient(135deg, #FF6B35, #1E3A5F)", boxShadow: "0 20px 60px rgba(0,0,0,.5)", animation: "prizePop .7s cubic-bezier(.2,.9,.3,1.2)" }}>
        <div style={{ fontSize: 64, animation: "prizeShine 1.2s ease-in-out infinite" }}>🏆</div>
        <div style={{ fontSize: "0.95rem", letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>{WHO[prize.target_type || ""] || "Premio"}</div>
        <div style={{ fontSize: "1.7rem", fontWeight: 800, margin: "6px 0 10px" }}>{prize.target_label}</div>
        <div style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1, animation: "prizeShine 1.2s ease-in-out infinite" }}>+{prize.total_points}</div>
        <div style={{ fontSize: "1rem", marginBottom: 14 }}>punti</div>
        {prize.reason && <div style={{ fontSize: "1.05rem", fontStyle: "italic", marginBottom: 14 }}>«{prize.reason}»</div>}
        <div style={{ fontSize: "0.75rem", opacity: 0.75 }}>Tocca per chiudere</div>
      </div>
    </div>
  );
}
