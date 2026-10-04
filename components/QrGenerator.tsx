"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { CONFIG_ISCRIZIONE } from "@/lib/config";
import { classesOfSite, teamForYear, yearLabel } from "@/lib/publicBonus";
import { qrWithPinImage, downloadDataUrl } from "@/lib/qrImage";

type Kind = "class" | "team" | "recharge";
type Made = { src: string; heading: string; pin: string | null; filename: string; note: string };

const INPUT = { padding: 8, borderRadius: 6, border: "1px solid #ccc" } as const;
const PILL = (active: boolean) => ({
  padding: "8px 14px", borderRadius: 60, border: "2px solid #1E3A5F", cursor: "pointer", fontWeight: 700,
  background: active ? "#1E3A5F" : "white", color: active ? "white" : "#1E3A5F",
}) as const;

// Generatore di QR per la dashboard staff: classe, squadra e ricarica coins. Le stesse API del
// pannello admin (/api/admin/events e /api/admin/bonus), che accettano admin e staff.
export default function QrGenerator() {
  const [kind, setKind] = useState<Kind>("class");
  const [site, setSite] = useState("");
  const [school, setSchool] = useState("");
  const [year, setYear] = useState("");
  const [team, setTeam] = useState("Matricole");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [made, setMade] = useState<Made | null>(null);

  const options = site ? classesOfSite(site) : [];
  const schools = Array.from(new Set(options.map((c) => c.school)));
  const years = options.filter((c) => c.school === school).map((c) => c.year);

  const create = async () => {
    setMessage("");
    setMade(null);
    const uuid = crypto.randomUUID();
    let endpoint = "/api/admin/events";
    let body: Record<string, unknown>;
    let heading: string;

    if (kind === "class") {
      if (!site || !school || !year) { setMessage("❌ Scegli sede, scuola e anno"); return; }
      heading = `${school} ${site} ${yearLabel(year)}`;
      body = { title: title.trim() || heading, qr_type: "class", team_target: teamForYear(year), class_school: school, class_site: site, class_year: year, qr_code: `QR:${uuid}` };
    } else if (kind === "team") {
      heading = title.trim() || `Vota ${team}`;
      if (!confirm(`Le squadre hanno già il loro QR (PIN 1212 Matricole, 3434 Veterani). Crearne un altro per ${team}?`)) return;
      body = { title: heading, qr_type: "team", team_target: team, qr_code: `QR:${uuid}` };
    } else {
      if (!title.trim()) { setMessage("❌ Scrivi un titolo per il QR ricarica"); return; }
      const coins = Number(amount);
      if (!Number.isInteger(coins) || coins < 1) { setMessage("❌ Quanti coins? Un numero intero"); return; }
      endpoint = "/api/admin/bonus";
      heading = title.trim();
      body = { title: heading, amount: coins, code: `QR:${uuid.slice(0, 8)}` };
    }

    setBusy(true);
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMessage("❌ " + (data.message || "Errore")); return; }

    const row = data.event || data.bonus;
    const qrSrc = await QRCode.toDataURL(row.qr_code, { width: 600, margin: 2, color: { dark: "#1E3A5F", light: "#ffffff" } });
    setMade({
      src: qrSrc,
      heading: row.title || heading,
      pin: row.pin || null,
      filename: `QR_${(row.title || heading).replace(/[^A-Za-z0-9À-ɏ]+/g, "_")}.png`,
      note: data.existing ? "Questa classe aveva già il suo QR: ecco quello esistente." : "QR creato.",
    });
  };

  const download = async () => {
    if (!made) return;
    let href = made.src;
    try { href = await qrWithPinImage(made.src, made.heading, made.pin); } catch { /* si scarica il solo QR */ }
    downloadDataUrl(href, made.filename);
  };

  return (
    <div style={{ marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>🎯 Genera QR</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button style={PILL(kind === "class")} onClick={() => setKind("class")}>🏫 Classe</button>
        <button style={PILL(kind === "team")} onClick={() => setKind("team")}>🏆 Squadra</button>
        <button style={PILL(kind === "recharge")} onClick={() => setKind("recharge")}>⚡ Ricarica coins</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {kind === "class" && (
          <>
            <select value={site} onChange={(e) => { setSite(e.target.value); setSchool(""); setYear(""); }} style={INPUT}>
              <option value="">Sede…</option>
              {CONFIG_ISCRIZIONE.sedi.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {site && (
              <select value={school} onChange={(e) => { setSchool(e.target.value); setYear(""); }} style={INPUT}>
                <option value="">Scuola…</option>
                {schools.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {school && (
              <select value={year} onChange={(e) => setYear(e.target.value)} style={INPUT}>
                <option value="">Anno…</option>
                {years.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
              </select>
            )}
          </>
        )}
        {kind === "team" && (
          <select value={team} onChange={(e) => setTeam(e.target.value)} style={INPUT}>
            <option>Matricole</option><option>Veterani</option>
          </select>
        )}
        {kind === "recharge" && (
          <>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...INPUT, width: 80 }} />
            <span>coins</span>
          </>
        )}
        <input
          placeholder={kind === "recharge" ? "Titolo (obbligatorio)" : "Titolo (facoltativo)"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ ...INPUT, flex: 1, minWidth: 180 }}
        />
      </div>

      <button onClick={create} disabled={busy} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 60, border: "none", background: "#1E3A5F", color: "white", fontWeight: 700, cursor: "pointer" }}>
        {busy ? "…" : "Genera QR"}
      </button>
      {message && <p style={{ marginBottom: 0 }}>{message}</p>}

      {made && (
        <div style={{ marginTop: 16, textAlign: "center", background: "white", borderRadius: 12, padding: 16, maxWidth: 320 }}>
          <div style={{ fontSize: "0.8rem", color: "#666" }}>{made.note}</div>
          <div style={{ fontWeight: 700, color: "#1E3A5F", margin: "4px 0 8px" }}>{made.heading}</div>
          <img src={made.src} alt="QR" style={{ width: "100%", maxWidth: 260 }} />
          {made.pin && <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: 6, color: "#1E3A5F" }}>{made.pin}</div>}
          <button onClick={download} style={{ marginTop: 10, padding: "10px 20px", borderRadius: 60, border: "none", background: "#FF6B35", color: "white", fontWeight: 700, cursor: "pointer" }}>
            ⬇️ Scarica
          </button>
        </div>
      )}
    </div>
  );
}
