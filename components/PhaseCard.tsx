"use client";

import { useEffect, useState } from "react";
import { formatRomeDateTime, romeLocalToUTCISO } from "@/lib/utils";
import { INPUT, PANEL } from "./ui";

type Mode = "auto" | "preview" | "open";
type Phase = { open: boolean; mode: Mode; opensAt: string };

const OPTIONS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "auto", label: "Automatico", hint: "il voto si apre da solo alla data scelta qui sotto" },
  { mode: "preview", label: "Anteprima", hint: "nessuno può votare, i partecipanti vedono QR e codici" },
  { mode: "open", label: "Voto aperto", hint: "si vota subito" },
];

// Data e ora in ora italiana per i campi del modulo ("2026-10-15" e "00:00"), qualunque sia il fuso del PC.
function romeParts(iso: string): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

// Fase del gioco nel pannello admin: modalità (Automatico / Anteprima / Voto aperto) e data di
// apertura automatica, in ora italiana. Il blocco vero del voto sta nel server (lib/phase.ts).
export default function PhaseCard() {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const apply = (p: Phase) => {
    setPhase(p);
    const parts = romeParts(p.opensAt);
    setDate(parts.date);
    setTime(parts.time);
  };

  useEffect(() => {
    fetch("/api/admin/phase", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && apply(p))
      .catch(() => {});
  }, []);

  const save = async (change: { mode?: Mode; opensAt?: string }) => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/phase", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.message || "Errore"); return; }
    apply(data);
  };

  const choose = (mode: Mode) => {
    if (busy || phase?.mode === mode) return;
    const words = mode === "open" ? "APRIRE il voto adesso" : mode === "preview" ? "mettere l'app in ANTEPRIMA (voto chiuso)" : "tornare alla modalità automatica";
    if (confirm(`Confermi di ${words}?`)) save({ mode });
  };

  const saveDate = () => {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const t = /^(\d{2}):(\d{2})$/.exec(time);
    if (!d || !t) { setError("Scegli giorno e ora"); return; }
    const opensAt = romeLocalToUTCISO(+d[1], +d[2], +d[3], +t[1], +t[2]);
    if (confirm(`Il voto si aprirà da solo ${formatRomeDateTime(opensAt)} (ora italiana). Confermi?`)) save({ opensAt });
  };

  const dateChanged = phase ? romeParts(phase.opensAt).date !== date || romeParts(phase.opensAt).time !== time : false;

  return (
    <div style={PANEL}>
      <h2 style={{ marginTop: 0 }}>🚦 Fase del gioco</h2>
      {phase ? (
        <p style={{ marginTop: 0, fontWeight: 600, color: phase.open ? "#2E7D32" : "#c0392b" }}>
          {phase.open ? "✅ Voto APERTO" : `⏳ ANTEPRIMA: il voto si apre ${formatRomeDateTime(phase.opensAt)}`}
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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <span style={{ fontWeight: 600 }}>Apertura automatica del voto:</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!phase || busy} style={INPUT} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={!phase || busy} style={INPUT} />
        <span style={{ color: "#666", fontSize: "0.8rem" }}>ora italiana</span>
        <button
          onClick={saveDate}
          disabled={!phase || busy || !dateChanged}
          style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: dateChanged ? "#FF6B35" : "#ccc", color: "white", fontWeight: 600, cursor: dateChanged ? "pointer" : "default" }}
        >
          Salva data
        </button>
      </div>

      <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: 0 }}>
        Con «Automatico» il voto si apre da solo alla data scelta; «Anteprima» e «Voto aperto» la scavalcano. La data compare anche nei messaggi ai partecipanti. Il QR ricarica (coins) funziona sempre.
      </p>
      {error && <p style={{ color: "#c0392b", marginBottom: 0 }}>❌ {error}</p>}
    </div>
  );
}
