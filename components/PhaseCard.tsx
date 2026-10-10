"use client";

import { useEffect, useState } from "react";
import { formatRomeDateTime, romeLocalToUTCISO } from "@/lib/utils";
import { INPUT, PANEL } from "./ui";

type Mode = "auto" | "preview" | "open";
type DateKey = "previewAt" | "opensAt" | "closesAt";
type Phase = { open: boolean; previewStarted: boolean; mode: Mode; previewAt: string | null; opensAt: string | null; closesAt: string | null };

const OPTIONS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "auto", label: "Automatico", hint: "le fasi seguono le date scelte qui sotto" },
  { mode: "preview", label: "Anteprima", hint: "nessuno può votare, i partecipanti vedono il benvenuto e le classifiche" },
  { mode: "open", label: "Voto aperto", hint: "si vota subito" },
];

// Le tre date, in ordine di tempo. "empty" = cosa significa lasciarla vuota.
const DATES: { key: DateKey; label: string; empty: string; clear: string; verb: string }[] = [
  { key: "previewAt", label: "Inizio Anteprima:", empty: "subito", clear: "Subito", verb: "L'Anteprima inizierà" },
  { key: "opensAt", label: "Fine Anteprima / inizio evento (apertura voto):", empty: "da definire", clear: "Da definire", verb: "Il voto si aprirà da solo" },
  { key: "closesAt", label: "Fine evento (il voto si chiude):", empty: "nessuna", clear: "Togli", verb: "Il voto si chiuderà" },
];

// Data e ora in ora italiana per i campi del modulo ("2026-10-15" e "00:00"), qualunque sia il fuso del PC.
function romeParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
}

// Fase del gioco nel pannello admin: modalità (Automatico / Anteprima / Voto aperto) e le tre date
// (inizio Anteprima, apertura del voto, fine evento), in ora italiana. Il blocco vero sta nel server (lib/phase.ts).
export default function PhaseCard() {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<DateKey, { date: string; time: string }>>({
    previewAt: { date: "", time: "" }, opensAt: { date: "", time: "" }, closesAt: { date: "", time: "" },
  });

  const apply = (p: Phase) => {
    setPhase(p);
    setFields({ previewAt: romeParts(p.previewAt), opensAt: romeParts(p.opensAt), closesAt: romeParts(p.closesAt) });
  };

  useEffect(() => {
    fetch("/api/admin/phase", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && apply(p))
      .catch(() => {});
  }, []);

  const save = async (change: { mode?: Mode } & Partial<Record<DateKey, string | null>>) => {
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

  const saveDate = (d: (typeof DATES)[number]) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fields[d.key].date);
    const t = /^(\d{2}):(\d{2})$/.exec(fields[d.key].time);
    if (!m || !t) { setError("Scegli giorno e ora"); return; }
    const iso = romeLocalToUTCISO(+m[1], +m[2], +m[3], +t[1], +t[2]);
    if (confirm(`${d.verb} ${formatRomeDateTime(iso)} (ora italiana). Confermi?`)) save({ [d.key]: iso });
  };

  const clearDate = (d: (typeof DATES)[number]) => {
    if (confirm(`Mettere «${d.empty}» per: ${d.label.replace(/:$/, "")}?`)) save({ [d.key]: null });
  };

  return (
    <div style={PANEL}>
      <h2 style={{ marginTop: 0 }}>🚦 Fase del gioco</h2>
      {phase ? (
        <p style={{ marginTop: 0, fontWeight: 600, color: phase.open ? "#2E7D32" : "#c0392b" }}>
          {phase.open
            ? "✅ Voto APERTO"
            : !phase.previewStarted
              ? `🔒 In attesa: i partecipanti vedono solo "l'anteprima parte il ${phase.previewAt ? formatRomeDateTime(phase.previewAt) : "..."}"`
              : `⏳ ANTEPRIMA: il voto si apre ${phase.opensAt ? formatRomeDateTime(phase.opensAt) : "(data da definire)"}`}
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

      {DATES.map((d) => {
        const saved = romeParts(phase?.[d.key] ?? null);
        const changed = !!phase && (saved.date !== fields[d.key].date || saved.time !== fields[d.key].time);
        const set = (part: "date" | "time", v: string) => setFields((f) => ({ ...f, [d.key]: { ...f[d.key], [part]: v } }));
        return (
          <div key={d.key} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
            <span style={{ fontWeight: 600 }}>{d.label}</span>
            <input type="date" value={fields[d.key].date} onChange={(e) => set("date", e.target.value)} disabled={!phase || busy} style={INPUT} />
            <input type="time" value={fields[d.key].time} onChange={(e) => set("time", e.target.value)} disabled={!phase || busy} style={INPUT} />
            <span style={{ color: "#666", fontSize: "0.8rem" }}>ora italiana</span>
            <button
              onClick={() => saveDate(d)}
              disabled={!phase || busy || !changed}
              style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: changed ? "#FF6B35" : "#ccc", color: "white", fontWeight: 600, cursor: changed ? "pointer" : "default" }}
            >
              Salva
            </button>
            {phase?.[d.key] && (
              <button onClick={() => clearDate(d)} disabled={busy} style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #ccc", background: "white", cursor: "pointer" }}>
                {d.clear}
              </button>
            )}
          </div>
        );
      })}

      <p style={{ color: "#666", fontSize: "0.8rem", marginBottom: 0 }}>
        Con «Automatico» le fasi seguono le date: prima dell&apos;inizio Anteprima i partecipanti (non admin e staff) vedono solo l&apos;attesa, poi l&apos;Anteprima, poi dall&apos;apertura si vota, dopo la fine il voto è chiuso. Senza data di inizio l&apos;Anteprima è già iniziata; senza data di apertura il voto non si apre da solo. «Anteprima» e «Voto aperto» scavalcano le date. Il QR ricarica (coins) funziona sempre.
      </p>
      {error && <p style={{ color: "#c0392b", marginBottom: 0 }}>❌ {error}</p>}
    </div>
  );
}
