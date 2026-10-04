"use client";

import { useEffect, useState } from "react";

type Mode = "auto" | "preview" | "open";
type Phase = { open: boolean; mode: Mode; opensAt: string };

const OPTIONS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "auto", label: "Automatico", hint: "il voto si apre da solo alla data prevista" },
  { mode: "preview", label: "Anteprima", hint: "nessuno può votare, i partecipanti vedono QR e PIN" },
  { mode: "open", label: "Voto aperto", hint: "si vota subito" },
];

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

// Interruttore Anteprima / Voto aperto del pannello admin. Il blocco vero del voto sta nel server
// (lib/phase.ts): qui si cambia soltanto la modalità.
export default function PhaseCard() {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/phase", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setPhase(p))
      .catch(() => {});
  }, []);

  const choose = async (mode: Mode) => {
    if (busy || phase?.mode === mode) return;
    const words = mode === "open" ? "APRIRE il voto adesso" : mode === "preview" ? "mettere l'app in ANTEPRIMA (voto chiuso)" : "tornare alla modalità automatica";
    if (!confirm(`Confermi di ${words}?`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/phase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.message || "Errore"); return; }
    setPhase(data);
  };

  return (
    <div style={{ marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>🚦 Fase del gioco</h2>
      {phase ? (
        <p style={{ marginTop: 0, fontWeight: 600, color: phase.open ? "#2E7D32" : "#c0392b" }}>
          {phase.open ? "✅ Voto APERTO" : `⏳ ANTEPRIMA: il voto si apre ${dateLabel(phase.opensAt)}`}
        </p>
      ) : (
        <p style={{ marginTop: 0, color: "#666" }}>Caricamento…</p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {OPTIONS.map((o) => {
          const active = phase?.mode === o.mode;
          return (
            <button
              key={o.mode}
              disabled={!phase || busy}
              onClick={() => choose(o.mode)}
              title={o.hint}
              style={{ padding: "8px 14px", borderRadius: 6, border: "2px solid #1E3A5F", cursor: "pointer", fontWeight: 600, background: active ? "#1E3A5F" : "white", color: active ? "white" : "#1E3A5F" }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: 0 }}>
        Con «Automatico» il voto si apre da solo a quella data; «Anteprima» e «Voto aperto» la scavalcano. Il QR ricarica (coins) funziona sempre.
      </p>
      {error && <p style={{ color: "#c0392b", marginBottom: 0 }}>❌ {error}</p>}
    </div>
  );
}
