"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

const ANNI_MATRICOLE = new Set(["PRE-ISCRITTI 2027 E 2028", "1° ANNO 2026", "2° ANNO 2026"]);

function teamFromYear(year: string): string {
  return ANNI_MATRICOLE.has(year) ? "Matricole" : "Veterani";
}

async function downloadQR(code: string, label: string) {
  const dataUrl = await QRCode.toDataURL(code, {
    width: 400, margin: 2,
    color: { dark: "#1E3A5F", light: "#ffffff" },
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `QR_${label.replace(/\s+/g, "_")}.png`;
  link.click();
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  // Modali
  const [showQRModal, setShowQRModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // QR generator
  const [qrTab, setQrTab] = useState<"squadra" | "classe" | "ricarica">("squadra");
  const [qrSquadraForm, setQrSquadraForm] = useState({ title: "", team: "Matricole" });
  const [qrClasseForm, setQrClasseForm] = useState({ title: "", school: "", site: "", year: "" });
  const [qrRicaricaForm, setQrRicaricaForm] = useState({ title: "", amount: 5 });
  const [classiDisponibili, setClassiDisponibili] = useState<{ school: string; site: string; year: string }[]>([]);
  const [previewQR, setPreviewQR] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");

  // Form utente
  const [userForm, setUserForm] = useState({ email: "", first_name: "", last_name: "", team: "", role: "student" });
  const [adminEmail, setAdminEmail] = useState("");
  const [resetType, setResetType] = useState("scores");
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const userId = getCookie("user_id");
      const role = getCookie("user_role");
      if (!userId || (role !== "admin" && role !== "staff")) {
        setIsAdmin(false); setLoading(false); return;
      }
      setIsAdmin(true);
      setIsSuper(role === "admin");
      await loadData();
      setLoading(false);
    };
    checkAdmin();
  }, [router]);

  const loadData = async () => {
    const allUsersData: any[] = [];
    let from = 0;
    while (true) {
      const { data: page } = await supabase.from("users").select("*").range(from, from + 999);
      if (!page || page.length === 0) break;
      allUsersData.push(...page);
      if (page.length < 1000) break;
      from += 1000;
    }
    setUsers(allUsersData);

    // Classi disponibili per QR classe
    const classiSet = new Map<string, { school: string; site: string; year: string }>();
    for (const u of allUsersData) {
      if (u.school && u.site && u.year) {
        const key = `${u.school}||${u.site}||${u.year}`;
        if (!classiSet.has(key)) classiSet.set(key, { school: u.school, site: u.site, year: u.year });
      }
    }
    setClassiDisponibili(Array.from(classiSet.values()).sort((a, b) =>
      `${a.school} ${a.site} ${a.year}`.localeCompare(`${b.school} ${b.site} ${b.year}`)
    ));

    const { data: ev } = await supabase.from("votable_events").select("*").order("created_at", { ascending: false });
    setEvents(ev || []);

    const { data: bn } = await supabase.from("bonus_qr").select("*").order("created_at", { ascending: false });
    setBonuses(bn || []);
  };

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase().includes(q)
      || (u.email || "").toLowerCase().includes(q);
  });

  // ── Crea QR ──────────────────────────────────────────────
  const handleCreaQR = async () => {
    let qrCode = "";
    let insertData: any = null;
    let table = "";
    let label = "";

    if (qrTab === "squadra") {
      if (!qrSquadraForm.title) { setMessage("❌ Inserisci un titolo"); return; }
      qrCode = `EVENT:${crypto.randomUUID()}`;
      label = qrSquadraForm.title;
      table = "votable_events";
      insertData = { title: qrSquadraForm.title, qr_type: "team", team_target: qrSquadraForm.team, qr_code: qrCode, active: true };
    } else if (qrTab === "classe") {
      if (!qrClasseForm.school || !qrClasseForm.site || !qrClasseForm.year) { setMessage("❌ Seleziona una classe"); return; }
      qrCode = `EVENT:${crypto.randomUUID()}`;
      label = `${qrClasseForm.school} ${qrClasseForm.site} ${qrClasseForm.year}`;
      table = "votable_events";
      insertData = {
        title: qrClasseForm.title || label,
        qr_type: "class",
        team_target: teamFromYear(qrClasseForm.year),
        class_school: qrClasseForm.school,
        class_site: qrClasseForm.site,
        class_year: qrClasseForm.year,
        qr_code: qrCode,
        active: true,
      };
    } else {
      if (!qrRicaricaForm.title) { setMessage("❌ Inserisci un titolo"); return; }
      qrCode = `BONUS:${crypto.randomUUID().slice(0, 8)}`;
      label = qrRicaricaForm.title;
      table = "bonus_qr";
      insertData = { title: qrRicaricaForm.title, amount: qrRicaricaForm.amount, code: qrCode, active: true };
    }

    const { error } = await supabase.from(table).insert(insertData);
    if (error) { setMessage("❌ Errore creazione QR: " + error.message); return; }

    // Mostra anteprima QR appena creato
    const dataUrl = await QRCode.toDataURL(qrCode, {
      width: 300, margin: 2,
      color: { dark: "#1E3A5F", light: "#ffffff" },
    });
    setPreviewQR(dataUrl);
    setPreviewLabel(label);
    setMessage(`✅ QR "${label}" creato!`);
    await loadData();
  };

  const handleToggleEvent = async (id: string, current: boolean) => {
    const { error } = await supabase.from("votable_events").update({ active: !current }).eq("id", id);
    if (error) { setMessage("❌ " + error.message); return; }
    await loadData();
  };

  const handleToggleBonus = async (id: string, current: boolean) => {
    const { error } = await supabase.from("bonus_qr").update({ active: !current }).eq("id", id);
    if (error) { setMessage("❌ " + error.message); return; }
    await loadData();
  };

  // ── Utenti ───────────────────────────────────────────────
  const handleAddUser = async () => {
    if (!userForm.email) { setMessage("❌ Email obbligatoria"); return; }
    const res = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`✅ ${data.message}\nLink: ${data.link}`);
      setShowAddUserModal(false);
      setUserForm({ email: "", first_name: "", last_name: "", team: "", role: "student" });
      loadData();
    } else { setMessage("❌ " + data.message); }
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setUserForm({ email: user.email || "", first_name: user.first_name || "", last_name: user.last_name || "", team: user.team || "", role: user.role || "student" });
    setShowEditUserModal(true);
  };

  const handleEditUser = async () => {
    const res = await fetch("/api/admin/users", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedUser.id, ...userForm }),
    });
    const data = await res.json();
    if (res.ok) { setMessage("✅ " + data.message); setShowEditUserModal(false); setSelectedUser(null); loadData(); }
    else { setMessage("❌ " + data.message); }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Sei sicuro di voler eliminare ${userName}?`)) return;
    const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) { setMessage("✅ " + data.message); loadData(); }
    else { setMessage("❌ " + data.message); }
  };

  const handleImportCSV = async () => {
    if (!importFile) { setMessage("Seleziona un file"); return; }
    setMessage("Importazione in corso...");
    const formData = new FormData();
    formData.append("file", importFile);
    const res = await fetch("/api/admin/import", { method: "POST", body: formData });
    const data = await res.json();
    setMessage(data.message || "Importazione completata");
    if (res.ok) loadData();
  };

  const handleReset = async () => {
    const msgs: Record<string, string> = {
      today: "🗑️ Cancellare SOLO i voti di oggi?",
      scores: "⚠️ Cancellare TUTTI i voti? Operazione irreversibile!",
      full: "🚨 RESET COMPLETO: cancellare tutto?",
    };
    if (!confirm(msgs[resetType])) return;
    const res = await fetch("/api/admin/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: resetType }) });
    const data = await res.json();
    setMessage(data.message);
    if (res.ok) { setShowResetModal(false); loadData(); }
  };

  const handleAddAdmin = async () => {
    const { data: user } = await supabase.from("users").select("id").eq("email", adminEmail).single();
    if (!user) { setMessage("Utente non trovato"); return; }
    const { error } = await supabase.from("users").update({ role: "staff" }).eq("id", user.id);
    if (error) { setMessage("❌ " + error.message); }
    else { setMessage("✅ Staff nominato!"); setShowAdminModal(false); setAdminEmail(""); loadData(); }
  };

  const TeamSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 8 }}>
      <option value="">Nessun team</option>
      <option value="Matricole">Matricole</option>
      <option value="Veterani">Veterani</option>
      <option value="Didatti&Docenti">Didatti&amp;Docenti</option>
    </select>
  );

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Verifica credenziali...</div>;
  if (!isAdmin) return <div style={{ textAlign: "center", padding: 40 }}>Accesso negato.</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🛠️ Pannello Admin</h1>
        <button onClick={() => router.push("/")} style={{ color: "#FF6B35", background: "none", border: "none", fontSize: "1rem", cursor: "pointer" }}>← Dashboard</button>
      </div>

      {message && (
        <div style={{ padding: 12, background: "#f0f0f0", borderRadius: 8, marginBottom: 16, whiteSpace: "pre-line" }}>
          {message}
        </div>
      )}

      {/* Bottoni principali */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 20 }}>
        <button onClick={() => { setShowQRModal(true); setPreviewQR(null); }} style={{ padding: 12, background: "#1E3A5F", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>🎯 Genera QR</button>
        <button onClick={() => setShowResetModal(true)} style={{ padding: 12, background: "#dc3545", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>🔄 Reset</button>
        <button onClick={() => setShowAddUserModal(true)} style={{ padding: 12, background: "#28a745", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>➕ Aggiungi Utente</button>
        {isSuper && <button onClick={() => setShowAdminModal(true)} style={{ padding: 12, background: "#6f42c1", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>👑 Nomina Staff</button>}
      </div>

      {/* Import */}
      <div style={{ marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
        <h2>📁 Importa CSV / Excel</h2>
        <input type="file" accept=".csv,.xlsx" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
        <button onClick={handleImportCSV} style={{ marginLeft: 8, padding: "8px 16px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>Importa</button>
      </div>

      {/* Lista QR Voto */}
      <div style={{ marginTop: 20 }}>
        <h2>🎯 QR Voto ({events.length})</h2>
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Titolo</th>
                <th style={{ textAlign: "left", padding: 8 }}>Tipo</th>
                <th style={{ textAlign: "left", padding: 8 }}>Target</th>
                <th style={{ textAlign: "center", padding: 8 }}>Stato</th>
                <th style={{ textAlign: "center", padding: 8 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #eee", opacity: e.active === false ? 0.5 : 1 }}>
                  <td style={{ padding: 8 }}>{e.title}</td>
                  <td style={{ padding: 8, fontSize: "0.8rem" }}>{e.qr_type === "class" ? `Classe: ${e.class_school} ${e.class_site} ${e.class_year}` : `Squadra: ${e.team_target}`}</td>
                  <td style={{ padding: 8 }}>{e.team_target}</td>
                  <td style={{ padding: 8, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, background: e.active !== false ? "#28a745" : "#dc3545", color: "white", fontSize: "0.75rem" }}>
                      {e.active !== false ? "Attivo" : "Inattivo"}
                    </span>
                  </td>
                  <td style={{ padding: 8, textAlign: "center", whiteSpace: "nowrap" }}>
                    <button onClick={() => handleToggleEvent(e.id, e.active !== false)} style={{ padding: "4px 8px", marginRight: 4, background: e.active !== false ? "#dc3545" : "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                      {e.active !== false ? "Disattiva" : "Attiva"}
                    </button>
                    <button onClick={() => downloadQR(e.qr_code, e.title)} style={{ padding: "4px 8px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                      ⬇️ QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista QR Ricarica */}
      <div style={{ marginTop: 20 }}>
        <h2>⚡ QR Ricarica ({bonuses.length})</h2>
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Titolo</th>
                <th style={{ textAlign: "left", padding: 8 }}>Coins</th>
                <th style={{ textAlign: "center", padding: 8 }}>Stato</th>
                <th style={{ textAlign: "center", padding: 8 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {bonuses.map((b) => (
                <tr key={b.id} style={{ borderBottom: "1px solid #eee", opacity: b.active === false ? 0.5 : 1 }}>
                  <td style={{ padding: 8 }}>{b.title}</td>
                  <td style={{ padding: 8 }}>+{b.amount}</td>
                  <td style={{ padding: 8, textAlign: "center" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, background: b.active !== false ? "#28a745" : "#dc3545", color: "white", fontSize: "0.75rem" }}>
                      {b.active !== false ? "Attivo" : "Inattivo"}
                    </span>
                  </td>
                  <td style={{ padding: 8, textAlign: "center", whiteSpace: "nowrap" }}>
                    <button onClick={() => handleToggleBonus(b.id, b.active !== false)} style={{ padding: "4px 8px", marginRight: 4, background: b.active !== false ? "#dc3545" : "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                      {b.active !== false ? "Disattiva" : "Attiva"}
                    </button>
                    <button onClick={() => downloadQR(b.code, b.title)} style={{ padding: "4px 8px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                      ⬇️ QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista Utenti */}
      <div style={{ marginTop: 20 }}>
        <h2>👥 Utenti ({filteredUsers.length} di {users.length})</h2>
        <input type="text" placeholder="Cerca per nome o email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 8, marginBottom: 8, borderRadius: 6, border: "1px solid #ccc" }} />
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th style={{ textAlign: "left", padding: 8 }}>Nome</th>
                <th style={{ textAlign: "left", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", padding: 8 }}>Team</th>
                <th style={{ textAlign: "left", padding: 8 }}>Ruolo</th>
                <th style={{ textAlign: "center", padding: 8 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isProtected = u.email === "mabras69@gmail.com";
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{u.first_name} {u.last_name}</td>
                    <td style={{ padding: 8 }}>{u.email}</td>
                    <td style={{ padding: 8 }}>{u.team || "-"}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: "bold", color: "white", background: u.role === "admin" ? "#dc3545" : u.role === "staff" ? "#6f42c1" : "#28a745" }}>{u.role}</span>
                    </td>
                    <td style={{ textAlign: "center", padding: 8 }}>
                      <button onClick={() => openEditModal(u)} style={{ padding: "4px 8px", marginRight: 4, background: "#ffc107", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }}>✏️</button>
                      <button onClick={() => handleDeleteUser(u.id, `${u.first_name} ${u.last_name}`)} disabled={isProtected} style={{ padding: "4px 8px", background: isProtected ? "#ccc" : "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: isProtected ? "not-allowed" : "pointer", fontSize: "0.8rem", opacity: isProtected ? 0.5 : 1 }}>🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Genera QR */}
      {showQRModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginBottom: 16 }}>🎯 Genera QR</h2>

            {/* Tab */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["squadra", "classe", "ricarica"] as const).map((tab) => (
                <button key={tab} onClick={() => { setQrTab(tab); setPreviewQR(null); }}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", background: qrTab === tab ? "#1E3A5F" : "#f0f0f0", color: qrTab === tab ? "white" : "#333" }}>
                  {tab === "squadra" ? "🏆 Squadra" : tab === "classe" ? "🏫 Classe" : "⚡ Ricarica"}
                </button>
              ))}
            </div>

            {/* QR Squadra */}
            {qrTab === "squadra" && (
              <div>
                <input type="text" placeholder="Titolo (es. Talk di Mario Rossi)" value={qrSquadraForm.title} onChange={(e) => setQrSquadraForm({ ...qrSquadraForm, title: e.target.value })} style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                <select value={qrSquadraForm.team} onChange={(e) => setQrSquadraForm({ ...qrSquadraForm, team: e.target.value })} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }}>
                  <option value="Matricole">🐓 Matricole</option>
                  <option value="Veterani">🐄 Veterani</option>
                </select>
                <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 8 }}>Chi scansiona questo QR assegna 1 punto alle {qrSquadraForm.team} (2 punti se è della squadra avversaria).</p>
              </div>
            )}

            {/* QR Classe */}
            {qrTab === "classe" && (
              <div>
                <input type="text" placeholder="Titolo (facoltativo)" value={qrClasseForm.title} onChange={(e) => setQrClasseForm({ ...qrClasseForm, title: e.target.value })} style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                <select
                  value={qrClasseForm.school && qrClasseForm.site && qrClasseForm.year ? `${qrClasseForm.school}||${qrClasseForm.site}||${qrClasseForm.year}` : ""}
                  onChange={(e) => {
                    if (!e.target.value) { setQrClasseForm({ ...qrClasseForm, school: "", site: "", year: "" }); return; }
                    const [school, site, year] = e.target.value.split("||");
                    setQrClasseForm({ ...qrClasseForm, school, site, year });
                  }}
                  style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
                >
                  <option value="">Seleziona una classe...</option>
                  {classiDisponibili.map((c) => (
                    <option key={`${c.school}||${c.site}||${c.year}`} value={`${c.school}||${c.site}||${c.year}`}>
                      {c.school} {c.site} – {c.year}
                    </option>
                  ))}
                </select>
                {qrClasseForm.year && (
                  <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 8 }}>
                    Team assegnato: <strong>{teamFromYear(qrClasseForm.year)}</strong>. I voti aggiornano anche la classifica per sede.
                  </p>
                )}
              </div>
            )}

            {/* QR Ricarica */}
            {qrTab === "ricarica" && (
              <div>
                <input type="text" placeholder="Titolo (es. Sessione mattutina)" value={qrRicaricaForm.title} onChange={(e) => setQrRicaricaForm({ ...qrRicaricaForm, title: e.target.value })} style={{ width: "100%", padding: 8, marginBottom: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <label style={{ fontWeight: 600, whiteSpace: "nowrap" }}>CBT coins da assegnare:</label>
                  <input type="number" min={1} max={100} value={qrRicaricaForm.amount} onChange={(e) => setQrRicaricaForm({ ...qrRicaricaForm, amount: parseInt(e.target.value) || 1 })} style={{ width: 80, padding: 8, borderRadius: 6, border: "1px solid #ccc" }} />
                </div>
                <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 8 }}>Ogni utente può riscattare questo QR una sola volta. Puoi disattivarlo in qualsiasi momento.</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleCreaQR} style={{ flex: 1, padding: 12, background: "#1E3A5F", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Genera QR</button>
              <button onClick={() => { setShowQRModal(false); setPreviewQR(null); }} style={{ padding: 12, background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Chiudi</button>
            </div>

            {/* Anteprima QR generato */}
            {previewQR && (
              <div style={{ marginTop: 20, textAlign: "center", borderTop: "1px solid #eee", paddingTop: 16 }}>
                <p style={{ fontWeight: 700, color: "#1E3A5F" }}>QR generato: {previewLabel}</p>
                <img src={previewQR} alt="QR" style={{ width: 200, height: 200, margin: "12px auto", display: "block", borderRadius: 8 }} />
                <button onClick={() => downloadQR(previewLabel, previewLabel)} style={{ padding: "10px 20px", background: "#FF6B35", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>
                  ⬇️ Scarica QR
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Reset */}
      {showResetModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>🔄 Reset</h2>
            <select value={resetType} onChange={(e) => setResetType(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 8 }}>
              <option value="today">🗑️ Reset voti di oggi</option>
              <option value="scores">🔄 Reset punteggi (tutti i voti)</option>
              <option value="full">⚠️ Reset completo</option>
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleReset} style={{ padding: "8px 16px", background: "#dc3545", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Conferma</button>
              <button onClick={() => setShowResetModal(false)} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nomina Staff */}
      {showAdminModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>👑 Nomina Staff</h2>
            <input type="email" placeholder="Email utente" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleAddAdmin} style={{ padding: "8px 16px", background: "#6f42c1", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Nomina</button>
              <button onClick={() => setShowAdminModal(false)} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Aggiungi Utente */}
      {showAddUserModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>➕ Aggiungi Utente</h2>
            <input type="email" placeholder="Email *" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <input type="text" placeholder="Nome" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <input type="text" placeholder="Cognome" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <TeamSelect value={userForm.team} onChange={(v) => setUserForm({ ...userForm, team: v })} />
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }}>
              <option value="student">Studente</option>
              <option value="staff">Staff</option>
              {isSuper && <option value="admin">Admin</option>}
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleAddUser} style={{ padding: "8px 16px", background: "#28a745", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Crea</button>
              <button onClick={() => { setShowAddUserModal(false); setUserForm({ email: "", first_name: "", last_name: "", team: "", role: "student" }); }} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Modifica Utente */}
      {showEditUserModal && selectedUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>✏️ Modifica Utente</h2>
            <p style={{ color: "#999", fontSize: "0.8rem", marginBottom: 8 }}>{selectedUser.first_name} {selectedUser.last_name}</p>
            <input type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <input type="text" placeholder="Nome" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <input type="text" placeholder="Cognome" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <TeamSelect value={userForm.team} onChange={(v) => setUserForm({ ...userForm, team: v })} />
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }}>
              <option value="student">Studente</option>
              <option value="staff">Staff</option>
              {isSuper && <option value="admin">Admin</option>}
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleEditUser} style={{ padding: "8px 16px", background: "#ffc107", color: "black", border: "none", borderRadius: 8, cursor: "pointer" }}>Salva</button>
              <button onClick={() => { setShowEditUserModal(false); setSelectedUser(null); }} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
