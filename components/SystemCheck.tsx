"use client";

import { useState } from "react";
import { PANEL } from "./ui";

type Check = { area: string; name: string; status: "ok" | "warn" | "error"; detail: string };
const ICON = { ok: "✅", warn: "⚠️", error: "❌" } as const;

// Scheda "Stato del sistema" del pannello admin: esegue i controlli di /api/admin/health.
// Da usare dopo ogni deploy o migrazione SQL, e prima di aprire il voto.
export default function SystemCheck() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `errore ${res.status}`);
      setChecks(data.checks);
    } catch (e: any) {
      setError(e?.message || "Controllo non riuscito");
    }
    setBusy(false);
  };

  const problems = checks ? checks.filter((c) => c.status !== "ok").length : 0;

  return (
    <div style={PANEL}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>🩺 Stato del sistema</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={run} disabled={busy} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#1E3A5F", color: "white", fontWeight: 600, cursor: "pointer" }}>
            {busy ? "Controllo…" : checks ? "Ricontrolla" : "Esegui controllo"}
          </button>
          {/* Backup completo dei dati del gioco (file JSON riservato): prima di ogni giornata e prima di reset/import */}
          <a
            href="/api/admin/backup"
            download
            style={{ padding: "8px 16px", borderRadius: 6, background: "#2E7D32", color: "white", fontWeight: 600, textDecoration: "none" }}
            title="Scarica tutti i dati del gioco in un file (contiene dati personali: conservalo in un posto sicuro)"
          >
            💾 Scarica backup
          </a>
        </div>
      </div>
      <p style={{ color: "#666", fontSize: "0.8rem", margin: "6px 0 0" }}>
        Controllo: dopo ogni aggiornamento del sito o script SQL, e prima di aprire il voto. Backup: ogni mattina dell&apos;evento e prima di ogni reset o import (il file contiene dati personali: conservalo in un posto sicuro).
      </p>
      {error && <p style={{ color: "#c0392b" }}>❌ {error}</p>}
      {checks && (
        <>
          <p style={{ fontWeight: 700, color: problems ? "#b45309" : "#2E7D32" }}>
            {problems ? `${problems} punti da guardare` : "Tutto in ordine"}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {checks.map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e5e5e5", background: c.status === "error" ? "#fdecea" : c.status === "warn" ? "#fff8e1" : "transparent" }}>
                  <td style={{ padding: 6, whiteSpace: "nowrap" }}>{ICON[c.status]}</td>
                  <td style={{ padding: 6, color: "#666", whiteSpace: "nowrap" }}>{c.area}</td>
                  <td style={{ padding: 6, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: 6 }}>{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
