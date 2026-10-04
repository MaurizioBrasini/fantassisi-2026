"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG_ISCRIZIONE, yearLabel } from "@/lib/config";
import { classesOfSite } from "@/lib/publicBonus";
import { INPUT, PANEL, pill } from "./ui";

type Person = { id: string; first_name: string | null; last_name: string | null; team: string; site: string | null; school: string | null; year: string | null };
type Boost = {
  id: string; team: string | null; total_points: number; start_at: string; end_at: string; created_at: string;
  distributed?: boolean; accrued?: number; kind?: string; reason?: string | null; target_label?: string | null;
};
type TargetType = "person" | "class" | "site";

const time = (iso: string) => new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Generatore unico di bonus: NASCOSTO (a tempo, imita i voti veri) o PALESE (premio immediato a una
// persona, classe o sede, con banner celebrativo). Usato dal pannello admin e dalla dashboard staff.
export default function BonusGenerator({ canDelete }: { canDelete: boolean }) {
  const [mode, setMode] = useState<"hidden" | "public">("public");
  const [points, setPoints] = useState("50");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [boosts, setBoosts] = useState<Boost[]>([]);

  // nascosto
  const [team, setTeam] = useState("Veterani");
  const [minutes, setMinutes] = useState("60");

  // palese
  const [targetType, setTargetType] = useState<TargetType>("person");
  const [reason, setReason] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [site, setSite] = useState("");
  const [school, setSchool] = useState("");
  const [year, setYear] = useState("");
  const searchSeq = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/boosts", { cache: "no-store" });
    if (res.ok) setBoosts((await res.json()).boosts || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ricerca persona con piccola attesa tra un tasto e l'altro
  useEffect(() => {
    if (person || query.trim().length < 2) { setResults([]); return; }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/admin/people?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      if (res.ok && seq === searchSeq.current) setResults((await res.json()).people || []);
    }, 250);
    return () => clearTimeout(t);
  }, [query, person]);

  const classOptions = site ? classesOfSite(site) : [];
  const schools = Array.from(new Set(classOptions.map((c) => c.school)));
  const years = classOptions.filter((c) => c.school === school).map((c) => c.year);

  const nameOf = (p: Person) => `${p.first_name || ""} ${p.last_name || ""}`.trim();

  const targetReady =
    targetType === "person" ? !!person : targetType === "class" ? !!(site && school && year) : !!site;

  const describeTarget = () =>
    targetType === "person" ? nameOf(person!) : targetType === "class" ? `${school} ${site} ${yearLabel(year)}` : `la sede di ${site}`;

  const submit = async () => {
    const p = Number(points);
    if (!Number.isInteger(p) || p < 1) { setMessage("❌ Inserisci un numero intero di punti"); return; }

    let body: Record<string, unknown>;
    if (mode === "hidden") {
      if (!confirm(`Assegnare ${p} punti a ${team} come farebbero i voti veri (circa il 20-25% solo alla squadra, il resto a partecipanti scelti a caso, da 1 a 4 ciascuno), distribuiti nell'arco di ${minutes} minuti a partire da ora?`)) return;
      body = { mode: "hidden", team, points: p, minutes: Number(minutes) };
    } else {
      if (!targetReady) { setMessage("❌ Scegli a chi dare il premio"); return; }
      if (!reason.trim()) { setMessage("❌ Scrivi il motivo: compare nel banner"); return; }
      const how =
        targetType === "person" ? "Salgono anche la sua squadra, classe e sede."
        : targetType === "class" ? "Salgono anche la sede e la squadra della classe."
        : "Metà alle squadre (50/50) e metà alle classi della sede.";
      if (!confirm(`Assegnare SUBITO ${p} punti a ${describeTarget()} per «${reason.trim()}»? ${how} Tutti i partecipanti vedranno il banner del premio.`)) return;
      const target =
        targetType === "person" ? { type: "person", userId: person!.id }
        : targetType === "class" ? { type: "class", school, site, year }
        : { type: "site", site };
      body = { mode: "public", target, points: p, reason: reason.trim() };
    }

    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/boosts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMessage("❌ " + (data.message || "Errore")); return; }
    setMessage("✅ " + data.message);
    if (mode === "public") { setReason(""); setPerson(null); setQuery(""); }
    await load();
  };

  const stop = async (id: string) => {
    if (!confirm("Fermare questo bonus? Restano i punti già maturati.")) return;
    const res = await fetch("/api/admin/boosts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (!res.ok) setMessage("❌ " + ((await res.json()).message || "Errore"));
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo bonus? Spariscono anche i punti già assegnati.")) return;
    const res = await fetch(`/api/admin/boosts?id=${id}`, { method: "DELETE" });
    if (!res.ok) setMessage("❌ " + ((await res.json()).message || "Errore"));
    await load();
  };

  const now = Date.now();
  return (
    <div style={PANEL}>
      <h2 style={{ marginTop: 0 }}>🎁 Bonus</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button style={pill(mode === "public")} onClick={() => setMode("public")}>🏆 Palese (premio con banner)</button>
        <button style={pill(mode === "hidden")} onClick={() => setMode("hidden")}>🕶️ Nascosto (a tempo)</button>
      </div>

      {mode === "hidden" ? (
        <>
          <p style={{ color: "#666", fontSize: "0.85rem", marginTop: 0 }}>
            Imita i voti veri (es. 100 punti in 60 minuti): circa il 20-25% va solo alla squadra, il resto a partecipanti scelti a caso, da 1 a 4 ciascuno, in momenti casuali. Salgono squadra, individuali, classi e sedi, senza che si veda da dove arrivano.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={team} onChange={(e) => setTeam(e.target.value)} style={INPUT}>
              <option>Matricole</option><option>Veterani</option>
            </select>
            <input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} style={{ ...INPUT, width: 90 }} />
            <span>punti in</span>
            <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} style={{ ...INPUT, width: 90 }} />
            <span>minuti</span>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: "#666", fontSize: "0.85rem", marginTop: 0 }}>
            Premio visibile a tutti, assegnato subito, con un banner celebrativo. A una persona sale anche la sua squadra, classe e sede; a una classe salgono sede e squadra; a una sede metà va alle squadre e metà alle classi.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {([["person", "👤 Persona"], ["class", "🏫 Classe"], ["site", "📍 Sede"]] as [TargetType, string][]).map(([t, label]) => (
              <button key={t} style={pill(targetType === t)} onClick={() => setTargetType(t)}>{label}</button>
            ))}
          </div>

          {targetType === "person" && (
            <div style={{ marginBottom: 10 }}>
              {person ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{nameOf(person)}</strong>
                  <span style={{ color: "#666", fontSize: "0.85rem" }}>{person.team} · {person.site || "—"} · {person.school || ""} {person.year ? yearLabel(person.year) : ""}</span>
                  <button onClick={() => { setPerson(null); setQuery(""); }} style={{ ...INPUT, cursor: "pointer" }}>Cambia</button>
                </div>
              ) : (
                <>
                  <input placeholder="Cerca per nome o cognome…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...INPUT, width: "100%", maxWidth: 360 }} />
                  {results.length > 0 && (
                    <div style={{ marginTop: 6, background: "white", border: "1px solid #ddd", borderRadius: 6, maxWidth: 360 }}>
                      {results.map((p) => (
                        <div key={p.id} onClick={() => { setPerson(p); setResults([]); }} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #eee" }}>
                          <strong>{nameOf(p)}</strong>
                          <div style={{ color: "#666", fontSize: "0.75rem" }}>{p.team} · {p.site || "—"} · {p.school || ""} {p.year ? yearLabel(p.year) : ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {targetType !== "person" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <select value={site} onChange={(e) => { setSite(e.target.value); setSchool(""); setYear(""); }} style={INPUT}>
                <option value="">Sede…</option>
                {CONFIG_ISCRIZIONE.sedi.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {targetType === "class" && site && (
                <select value={school} onChange={(e) => { setSchool(e.target.value); setYear(""); }} style={INPUT}>
                  <option value="">Scuola…</option>
                  {schools.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {targetType === "class" && school && (
                <select value={year} onChange={(e) => setYear(e.target.value)} style={INPUT}>
                  <option value="">Anno…</option>
                  {years.map((y) => <option key={y} value={y}>{yearLabel(y)}</option>)}
                </select>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} style={{ ...INPUT, width: 90 }} />
            <span>punti, subito, per</span>
            <input placeholder="il motivo (compare nel banner)" maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} style={{ ...INPUT, flex: 1, minWidth: 220 }} />
          </div>
        </>
      )}

      <button
        onClick={submit}
        disabled={busy}
        style={{ marginTop: 12, padding: "10px 20px", borderRadius: 60, border: "none", background: "#FF6B35", color: "white", fontWeight: 700, cursor: "pointer" }}
      >
        {busy ? "…" : mode === "public" ? "🏆 Assegna il premio" : "Avvia il bonus"}
      </button>
      {message && <p style={{ marginBottom: 0 }}>{message}</p>}

      {boosts.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: 6 }}>Tipo</th><th style={{ padding: 6 }}>A chi</th><th style={{ padding: 6 }}>Punti</th>
                <th style={{ padding: 6 }}>Quando</th><th style={{ padding: 6 }}>Stato</th><th style={{ padding: 6 }}></th>
              </tr>
            </thead>
            <tbody>
              {boosts.map((b) => {
                const isPublic = b.kind === "public";
                const running = !isPublic && now < Date.parse(b.end_at);
                const matured = b.distributed ? b.accrued ?? 0 : Math.floor(b.total_points * Math.min(1, Math.max(0, (now - Date.parse(b.start_at)) / Math.max(1, Date.parse(b.end_at) - Date.parse(b.start_at)))));
                return (
                  <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 6 }}>{isPublic ? "🏆 Palese" : "🕶️ Nascosto"}</td>
                    <td style={{ padding: 6 }}>{isPublic ? <>{b.target_label}<div style={{ color: "#666" }}>«{b.reason}»</div></> : b.team}</td>
                    <td style={{ padding: 6 }}>{isPublic ? b.total_points : `${matured} / ${b.total_points}`}</td>
                    <td style={{ padding: 6 }}>{isPublic ? time(b.created_at) : `${time(b.start_at)} → ${time(b.end_at)}`}</td>
                    <td style={{ padding: 6 }}>{running ? "In corso" : "Concluso"}</td>
                    <td style={{ padding: 6, whiteSpace: "nowrap" }}>
                      {running && <button onClick={() => stop(b.id)} style={{ marginRight: 4, cursor: "pointer" }}>Ferma</button>}
                      {canDelete && <button onClick={() => remove(b.id)} title="Elimina" style={{ cursor: "pointer" }}>🗑️</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
