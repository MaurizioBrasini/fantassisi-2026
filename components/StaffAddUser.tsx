"use client";

import { useState } from "react";
import { CONFIG_ISCRIZIONE } from "@/lib/config";

const INPUT = { padding: 8, borderRadius: 6, border: "1px solid #ccc" } as const;
const EMPTY = { email: "", first_name: "", last_name: "", team: "", site: "", school: "", year: "" };

// Aggiunta di un partecipante dalla dashboard staff. Lo staff crea solo partecipanti (ruolo student):
// il ruolo e le modifiche successive restano all'admin, lo impone il server.
export default function StaffAddUser() {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const years = (CONFIG_ISCRIZIONE.teamAnniValid as Record<string, string[]>)[form.team] || CONFIG_ISCRIZIONE.teamAnniValid[""];
  const schools = form.site ? (CONFIG_ISCRIZIONE.scuolePerSede as Record<string, string[]>)[form.site] || [] : CONFIG_ISCRIZIONE.scuole;

  const submit = async () => {
    setMessage("");
    setLink("");
    if (!form.email.trim()) { setMessage("❌ L'email è obbligatoria"); return; }
    setBusy(true);
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, email: form.email.trim() }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMessage("❌ " + (data.message || "Errore")); return; }
    setMessage(`✅ ${data.message} (${data.user?.first_name || ""} ${data.user?.last_name || ""})`.trim());
    setLink(data.link || "");
    setForm(EMPTY);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* si può selezionare a mano */ }
  };

  return (
    <div style={{ marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>➕ Aggiungi partecipante</h2>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        <input placeholder="Email *" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} style={INPUT} />
        <input placeholder="Nome" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} style={INPUT} />
        <input placeholder="Cognome" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} style={INPUT} />
        <select value={form.team} onChange={(e) => setForm((f) => ({ ...f, team: e.target.value, year: "" }))} style={INPUT}>
          <option value="">Squadra…</option>
          <option>Matricole</option><option>Veterani</option><option>Didatti&Docenti</option>
        </select>
        <select value={form.site} onChange={(e) => setForm((f) => ({ ...f, site: e.target.value, school: "" }))} style={INPUT}>
          <option value="">Sede…</option>
          {CONFIG_ISCRIZIONE.sedi.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={form.school} onChange={(e) => set("school", e.target.value)} style={INPUT}>
          <option value="">Scuola…</option>
          {schools.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={form.year} onChange={(e) => set("year", e.target.value)} style={INPUT}>
          <option value="">Anno…</option>
          {CONFIG_ISCRIZIONE.anni.filter((a) => a.value && years.includes(a.value)).map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      <button onClick={submit} disabled={busy} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 60, border: "none", background: "#28a745", color: "white", fontWeight: 700, cursor: "pointer" }}>
        {busy ? "…" : "Aggiungi"}
      </button>
      {message && <p style={{ marginBottom: 0 }}>{message}</p>}
      {link && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: "0.8rem", color: "#666" }}>Link personale del nuovo partecipante (daglielo e basta):</div>
          <code style={{ display: "block", wordBreak: "break-all", background: "white", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: "0.8rem" }}>{link}</code>
          <button onClick={copy} style={{ marginTop: 6, cursor: "pointer" }}>{copied ? "✅ Copiato" : "📋 Copia link"}</button>
        </div>
      )}
    </div>
  );
}
