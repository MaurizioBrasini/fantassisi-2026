"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { CONFIG_ISCRIZIONE } from "@/lib/config";
import { classesOfSite, teamForYear, yearLabel } from "@/lib/publicBonus";
import { qrWithPinImage, downloadDataUrl } from "@/lib/qrImage";
import { sameClass, canonYear } from "@/lib/classKey";

type Kind = "class" | "team" | "recharge";
type Row = {
  id: string; kind: Kind; title: string; detail: string; qr_code: string; pin: string | null; active: boolean;
  team?: string | null; school?: string | null; site?: string | null; year?: string | null; created_at: string;
};
type Made = { src: string; heading: string; pin: string | null; filename: string; note: string };

const INPUT = { padding: 8, borderRadius: 6, border: "1px solid #ccc" } as const;
const PILL = (active: boolean) => ({
  padding: "8px 14px", borderRadius: 60, border: "2px solid #1E3A5F", cursor: "pointer", fontWeight: 700,
  background: active ? "#1E3A5F" : "white", color: active ? "white" : "#1E3A5F",
}) as const;
const KIND_LABEL: Record<Kind, string> = { class: "🏫 Classe", team: "🏆 Squadra", recharge: "⚡ Ricarica" };
const PAGE = 25;

const fileName = (t: string) => `QR_${t.replace(/[^A-Za-z0-9À-ɏ]+/g, "_")}.png`;

async function qrImage(row: { qr_code: string; title: string; pin: string | null }): Promise<string> {
  const src = await QRCode.toDataURL(row.qr_code, { width: 600, margin: 2, color: { dark: "#1E3A5F", light: "#ffffff" } });
  try { return await qrWithPinImage(src, row.title, row.pin); } catch { return src; } // se il disegno fallisce, il solo QR
}

// Generatore di QR per la dashboard staff: classe, squadra e ricarica coins, con l'elenco di quelli
// che esistono già. Non si può creare un QR che c'è già (lo impone anche il server, con una risposta
// 409 che restituisce quello esistente). Usa /api/admin/events e /api/admin/bonus.
export default function QrGenerator({ canCreateVote }: { canCreateVote: boolean }) {
  // Lo staff crea solo QR ricarica; i QR di voto (classe, squadra) li crea l'admin. Lo staff li vede e li scarica.
  const [kind, setKind] = useState<Kind>(canCreateVote ? "class" : "recharge");
  const [site, setSite] = useState("");
  const [school, setSchool] = useState("");
  const [year, setYear] = useState("");
  const [team, setTeam] = useState("Matricole");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [made, setMade] = useState<Made | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);

  const loadRows = useCallback(async () => {
    const [ev, bn] = await Promise.all([
      fetch("/api/admin/events", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { events: [] })),
      fetch("/api/admin/bonus", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { bonuses: [] })),
    ]);
    const events: Row[] = (ev.events || []).map((e: any) => ({
      id: e.id, kind: e.qr_type === "class" ? "class" : "team", title: e.title || "", qr_code: e.qr_code, pin: e.pin, active: e.active !== false,
      detail: e.qr_type === "class" ? `${e.class_school} ${e.class_site} ${yearLabel(canonYear(e.class_year) || "")}` : `Squadra ${e.team_target || ""}`,
      team: e.team_target, school: e.class_school, site: e.class_site, year: e.class_year, created_at: e.created_at,
    }));
    const bonuses: Row[] = (bn.bonuses || []).map((b: any) => ({
      id: b.id, kind: "recharge" as Kind, title: b.title || "", qr_code: b.code, pin: b.pin, active: b.active !== false,
      detail: `+${b.amount} coins`, created_at: b.created_at,
    }));
    setRows([...events, ...bonuses].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }, []);
  useEffect(() => { loadRows(); }, [loadRows]);

  const options = site ? classesOfSite(site) : [];
  const schools = Array.from(new Set(options.map((c) => c.school)));
  const years = options.filter((c) => c.school === school).map((c) => c.year);

  // Il QR che si sta per creare esiste già? Lo si dice subito e il pulsante resta spento.
  const duplicate = useMemo<Row | null>(() => {
    if (kind === "class" && site && school && year) {
      return rows.find((r) => r.kind === "class" && sameClass({ school: r.school ?? null, site: r.site ?? null, year: r.year ?? null }, { school, site, year })) || null;
    }
    if (kind === "team") return rows.find((r) => r.kind === "team" && r.team === team) || null;
    if (kind === "recharge" && title.trim()) {
      return rows.find((r) => r.kind === "recharge" && r.title.trim().toLowerCase() === title.trim().toLowerCase()) || null;
    }
    return null;
  }, [rows, kind, site, school, year, team, title]);

  const show = async (row: Row, note: string) => {
    const src = await QRCode.toDataURL(row.qr_code, { width: 600, margin: 2, color: { dark: "#1E3A5F", light: "#ffffff" } });
    setMade({ src, heading: row.title || row.detail, pin: row.pin, filename: fileName(row.title || row.detail), note });
  };

  const create = async () => {
    setMessage("");
    setMade(null);
    if (duplicate) { setMessage("❌ Questo QR esiste già: non si crea due volte."); await show(duplicate, "È già stato creato: ecco quello esistente."); return; }

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

    if (res.status === 409 && data.existing) {
      // creato nel frattempo da qualcun altro: lo si mostra come esistente
      setMessage("❌ " + data.message);
      await loadRows();
      const e = data.existing;
      await show({ id: e.id, kind, title: e.title || heading, detail: "", qr_code: e.qr_code || e.code, pin: e.pin, active: true, created_at: "" }, "È già stato creato: ecco quello esistente.");
      return;
    }
    if (!res.ok) { setMessage("❌ " + (data.message || "Errore")); return; }

    const row = data.event || data.bonus;
    await show({ id: row.id, kind, title: row.title || heading, detail: "", qr_code: row.qr_code || row.code, pin: row.pin, active: true, created_at: "" }, "✅ QR creato.");
    await loadRows();
  };

  const downloadRow = async (r: Row) => downloadDataUrl(await qrImage({ qr_code: r.qr_code, title: r.title || r.detail, pin: r.pin }), fileName(r.title || r.detail));

  const toggle = async (r: Row) => {
    const endpoint = r.kind === "recharge" ? "/api/admin/bonus" : "/api/admin/events";
    const res = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, active: !r.active }) });
    if (!res.ok) setMessage("❌ " + ((await res.json()).message || "Errore"));
    await loadRows();
  };

  const download = async () => {
    if (!made) return;
    let href = made.src;
    try { href = await qrWithPinImage(made.src, made.heading, made.pin); } catch { /* si scarica il solo QR */ }
    downloadDataUrl(href, made.filename);
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => (filter === "all" || r.kind === filter) && (!q || `${r.title} ${r.detail} ${r.pin || ""}`.toLowerCase().includes(q)));

  return (
    <div style={{ marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
      <h2 style={{ marginTop: 0 }}>🎯 Genera QR</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {canCreateVote && <button style={PILL(kind === "class")} onClick={() => setKind("class")}>🏫 Classe</button>}
        {canCreateVote && <button style={PILL(kind === "team")} onClick={() => setKind("team")}>🏆 Squadra</button>}
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
        {kind !== "team" && (
          <input
            placeholder={kind === "recharge" ? "Titolo (obbligatorio)" : "Titolo (facoltativo)"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...INPUT, flex: 1, minWidth: 180 }}
          />
        )}
      </div>

      {duplicate && (
        <p style={{ marginBottom: 0, color: "#b45309", fontWeight: 600 }}>
          ⚠️ Esiste già: «{duplicate.title || duplicate.detail}» (PIN {duplicate.pin}). Non si crea due volte.{" "}
          <button onClick={() => show(duplicate, "È già stato creato: ecco quello esistente.")} style={{ cursor: "pointer" }}>Mostra</button>
        </p>
      )}

      <button
        onClick={create}
        disabled={busy || !!duplicate}
        style={{ marginTop: 12, padding: "10px 20px", borderRadius: 60, border: "none", background: duplicate ? "#9ca3af" : "#1E3A5F", color: "white", fontWeight: 700, cursor: duplicate ? "not-allowed" : "pointer" }}
      >
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

      <h3 style={{ marginBottom: 8, marginTop: 24 }}>QR esistenti ({filtered.length} di {rows.length})</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {(["all", "class", "team", "recharge"] as const).map((f) => (
          <button key={f} style={{ ...PILL(filter === f), padding: "4px 10px", fontSize: "0.8rem" }} onClick={() => { setFilter(f); setShown(PAGE); }}>
            {f === "all" ? "Tutti" : KIND_LABEL[f]}
          </button>
        ))}
        <input placeholder="🔍 Cerca…" value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} style={{ ...INPUT, flex: 1, minWidth: 140 }} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
              <th style={{ padding: 6 }}>Tipo</th><th style={{ padding: 6 }}>QR</th><th style={{ padding: 6 }}>PIN</th><th style={{ padding: 6 }}>Stato</th><th style={{ padding: 6 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, shown).map((r) => (
              <tr key={r.kind + r.id} style={{ borderBottom: "1px solid #eee", opacity: r.active ? 1 : 0.55 }}>
                <td style={{ padding: 6, whiteSpace: "nowrap" }}>{KIND_LABEL[r.kind]}</td>
                <td style={{ padding: 6 }}>{r.title || r.detail}{r.title && r.detail && r.title !== r.detail && <div style={{ color: "#666" }}>{r.detail}</div>}</td>
                <td style={{ padding: 6, fontWeight: 700 }}>{r.pin}</td>
                <td style={{ padding: 6 }}>{r.active ? "Attivo" : "Disattivo"}</td>
                <td style={{ padding: 6, whiteSpace: "nowrap" }}>
                  <button onClick={() => downloadRow(r)} style={{ marginRight: 4, cursor: "pointer" }}>⬇️ QR</button>
                  {(canCreateVote || r.kind === "recharge") && (
                    <button onClick={() => toggle(r)} style={{ cursor: "pointer" }}>{r.active ? "Disattiva" : "Attiva"}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > shown && (
        <button onClick={() => setShown((n) => n + PAGE)} style={{ marginTop: 8, cursor: "pointer" }}>Mostra altri ({filtered.length - shown})</button>
      )}
      {filtered.length === 0 && <p style={{ color: "#666" }}>Nessun QR trovato.</p>}
    </div>
  );
}
