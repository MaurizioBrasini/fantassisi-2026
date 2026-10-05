"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CONFIG_ISCRIZIONE, isYearValidForTeam, yearLabel } from "@/lib/config";
import { TEAM_COLORS } from "@/lib/teamColors";
import { personalLink } from "@/lib/urls";
import { getCookie } from "@/lib/clientCookies";
import PhaseCard from "@/components/PhaseCard";
import SystemCheck from "@/components/SystemCheck";
import BonusGenerator from "@/components/BonusGenerator";
import QrGenerator from "@/components/QrGenerator";


// Componente per la selezione della scuola con input custom
const SchoolSelect = ({ value, onChange, suggested, site }: any) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    if (value && !suggested.includes(value)) {
      setIsCustom(true);
      setCustomValue(value);
    } else {
      setIsCustom(false);
      setCustomValue('');
    }
  }, [value, suggested]);

  return (
    <div style={{ flex: 1 }}>
      {!isCustom ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={value || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '__custom__') {
                setIsCustom(true);
                setCustomValue('');
                onChange('');
              } else {
                onChange(val);
              }
            }}
            style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc", marginTop: 8 }}
          >
            <option value="">Non specificato</option>
            {suggested.map((s: string) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="__custom__">+ Altro (inserisci manualmente)</option>
          </select>
          {site && (
            <span style={{ fontSize: "0.75rem", color: "#666", marginTop: 8, whiteSpace: "nowrap" }}>
              (sede: {site})
            </span>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            type="text"
            value={customValue}
            onChange={(e) => {
              setCustomValue(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="Inserisci nome scuola"
            style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
          />
          <button
            onClick={() => {
              setIsCustom(false);
              setCustomValue('');
              onChange('');
            }}
            style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 6, background: "#f5f5f5", cursor: "pointer" }}
          >
            Annulla
          </button>
        </div>
      )}
      
      {value && site && !CONFIG_ISCRIZIONE.scuolePerSede[site]?.includes(value) && (
        <p style={{ color: "#856404", fontSize: "0.75rem", marginTop: 4 }}>
          ⚠️ "{value}" non è tra le scuole di {site}. Verifica che sia corretto.
        </p>
      )}
      
      {value && !site && CONFIG_ISCRIZIONE.sediPerScuola[value] && (
        <p style={{ color: "#0d6efd", fontSize: "0.75rem", marginTop: 4 }}>
          💡 "{value}" è presente a: {CONFIG_ISCRIZIONE.sediPerScuola[value].join(', ')}
        </p>
      )}
    </div>
  );
};

type UserForm = {
  email: string;
  first_name: string;
  last_name: string;
  team: string;
  role: string;
  site: string;
  school: string;
  year: string;
};

const FIELD_STYLE = { width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" } as const;

// Campi del form utente, identici in "Aggiungi" e "Modifica" (cambiano solo segnaposto, nota sul
// ruolo e il campo extra dopo la squadra).
function UserFormFields({ form, setForm, isSuper, validYears, suggestedSchools, emailPlaceholder, roleNote, afterTeam }: {
  form: UserForm;
  setForm: (f: UserForm) => void;
  isSuper: boolean;
  validYears: string[];
  suggestedSchools: string[];
  emailPlaceholder: string;
  roleNote: string;
  afterTeam?: React.ReactNode;
}) {
  return (
    <>
      <input type="email" placeholder={emailPlaceholder} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={FIELD_STYLE} />
      <input type="text" placeholder="Nome" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} style={FIELD_STYLE} />
      <input type="text" placeholder="Cognome" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} style={FIELD_STYLE} />

      <select value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })} style={FIELD_STYLE}>
        <option value="">Non specificato</option>
        <option value="Matricole">🐓 Matricole</option>
        <option value="Veterani">🐄 Veterani</option>
        <option value="Didatti&Docenti">Didatti &amp; Docenti</option>
      </select>

      {afterTeam}

      {isSuper ? (
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={FIELD_STYLE}>
          <option value="student">Partecipante</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      ) : (
        <p style={{ marginTop: 8, padding: 8, background: "#f5f5f5", borderRadius: 6, fontSize: "0.85rem", color: "#666" }}>{roleNote}</p>
      )}

      {/* Sede */}
      <select value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value, school: "" })} style={FIELD_STYLE}>
        <option value="">Non specificato</option>
        {CONFIG_ISCRIZIONE.sedi.map((sede) => (
          <option key={sede} value={sede}>{sede}</option>
        ))}
      </select>

      {/* Scuola */}
      <div style={{ marginTop: 8 }}>
        <SchoolSelect value={form.school} onChange={(val: string) => setForm({ ...form, school: val })} suggested={suggestedSchools} site={form.site} />
      </div>

      {/* Anno - FILTRATO per team */}
      <select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} style={FIELD_STYLE}>
        <option value="">Non specificato</option>
        {CONFIG_ISCRIZIONE.anni
          .filter((anno) => validYears.includes(anno.value))
          .map((anno) => (
            <option key={anno.value} value={anno.value}>{anno.label}</option>
          ))}
      </select>

      {/* Avviso se anno non valido per il team */}
      {form.team && form.year && !isYearValidForTeam(form.team, form.year) && (
        <p style={{ color: "#dc3545", fontSize: "0.8rem", marginTop: 4 }}>
          ⚠️ L'anno "{yearLabel(form.year)}" non è valido per {form.team}.
        </p>
      )}
    </>
  );
}

type UserSortCol = "name" | "email" | "team" | "status" | "role" | "site" | "school" | "year";

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userSortBy, setUserSortBy] = useState<UserSortCol>("name");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Filtri, ricerca e paginazione per QR Voto

  // Modali
  const [showResetModal, setShowResetModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form utente
  const [userForm, setUserForm] = useState<UserForm>({ 
    email: "", 
    first_name: "", 
    last_name: "", 
    team: "", 
    role: "student",
    site: "",
    school: "",
    year: ""
  });
  const [editIsDidatta, setEditIsDidatta] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [resetType, setResetType] = useState("scores");
  const [importFile, setImportFile] = useState<File | null>(null);

  // Scuole suggerite per il form
  const [suggestedSchools, setSuggestedSchools] = useState<string[]>(CONFIG_ISCRIZIONE.scuole);
  const [editSuggestedSchools, setEditSuggestedSchools] = useState<string[]>(CONFIG_ISCRIZIONE.scuole);
  
  // Anni validi per il team corrente
  const [validYears, setValidYears] = useState<string[]>(CONFIG_ISCRIZIONE.teamAnniValid['']);
  const [editValidYears, setEditValidYears] = useState<string[]>(CONFIG_ISCRIZIONE.teamAnniValid['']);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    const checkAdmin = async () => {
      const userId = getCookie("user_id");
      const role = getCookie("user_role");
      if (!userId || (role !== "admin" && role !== "staff")) {
        setIsAdmin(false); setLoading(false); return;
      }
      if (role === "staff") { router.replace("/staff"); return; } // lo staff ha la sua dashboard
      setIsAdmin(true);
      setIsSuper(role === "admin");
      await loadData();
      setLoading(false);
    };
    checkAdmin();
  }, [router]);

  // Aggiorna le scuole suggerite quando cambia la sede nel form
  useEffect(() => {
    if (userForm.site && CONFIG_ISCRIZIONE.scuolePerSede[userForm.site]) {
      setSuggestedSchools(CONFIG_ISCRIZIONE.scuolePerSede[userForm.site]);
    } else {
      setSuggestedSchools(CONFIG_ISCRIZIONE.scuole);
    }
  }, [userForm.site]);

  // Aggiorna gli anni validi quando cambia il team nel form
  useEffect(() => {
    const years = CONFIG_ISCRIZIONE.teamAnniValid[userForm.team] || CONFIG_ISCRIZIONE.teamAnniValid[''];
    setValidYears(years);
    // Se l'anno corrente non è valido, resettalo
    if (userForm.year && !years.includes(userForm.year)) {
      setUserForm(prev => ({ ...prev, year: '' }));
    }
  }, [userForm.team]);

  // Aggiorna le scuole suggerite in modifica
  useEffect(() => {
    if (selectedUser?.site && CONFIG_ISCRIZIONE.scuolePerSede[selectedUser.site]) {
      setEditSuggestedSchools(CONFIG_ISCRIZIONE.scuolePerSede[selectedUser.site]);
    } else {
      setEditSuggestedSchools(CONFIG_ISCRIZIONE.scuole);
    }
  }, [selectedUser?.site]);

  // Aggiorna gli anni validi in modifica
  useEffect(() => {
    const team = selectedUser?.team || '';
    const years = CONFIG_ISCRIZIONE.teamAnniValid[team] || CONFIG_ISCRIZIONE.teamAnniValid[''];
    setEditValidYears(years);
  }, [selectedUser?.team]);

  const loadData = async () => {
    // Tutti i dati del pannello arrivano dal server, solo per admin e staff (/api/admin/data).
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    if (!res.ok) {
      setMessage("❌ Non riesco a caricare i dati del pannello. Ricarica la pagina.");
      return;
    }
    const { users: allUsersData } = await res.json();
    setUsers(allUsersData);
  };

  const filteredUsers = users
    .filter((u) => {
      if (userRoleFilter !== "all") {
        if (userRoleFilter === "admin" && u.role !== "admin") return false;
        if (userRoleFilter === "staff" && u.role !== "staff") return false;
        if (userRoleFilter === "student" && u.role !== "student") return false;
        if (userRoleFilter === "Matricole" && u.team !== "Matricole") return false;
        if (userRoleFilter === "Veterani" && u.team !== "Veterani") return false;
        if (userRoleFilter === "Didatti&Docenti" && u.team !== "Didatti&Docenti") return false;
        if (userRoleFilter === "confermato" && (u.status || "confermato") !== "confermato") return false;
        if (userRoleFilter === "lista_attesa" && u.status !== "lista_attesa") return false;
        if (userRoleFilter === "ritirato" && u.status !== "ritirato") return false;
      }
      if (!userSearch.trim()) return true;
      const q = userSearch.trim().toLowerCase();
      return `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase().includes(q)
        || (u.email || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let valA = "";
      let valB = "";
      if (userSortBy === "name") {
        valA = `${a.first_name || ""} ${a.last_name || ""}`.toLowerCase().trim();
        valB = `${b.first_name || ""} ${b.last_name || ""}`.toLowerCase().trim();
      } else if (userSortBy === "email") {
        valA = (a.email || "").toLowerCase();
        valB = (b.email || "").toLowerCase();
      } else if (userSortBy === "team") {
        valA = (a.team || "").toLowerCase();
        valB = (b.team || "").toLowerCase();
      } else if (userSortBy === "role") {
        valA = (a.role || "").toLowerCase();
        valB = (b.role || "").toLowerCase();
      } else if (userSortBy === "status") {
        // confermato < lista_attesa < ritirato (anche alfabetico)
        valA = a.status || "confermato";
        valB = b.status || "confermato";
      } else if (userSortBy === "site") {
        valA = (a.site || "").toLowerCase();
        valB = (b.site || "").toLowerCase();
      } else if (userSortBy === "school") {
        valA = (a.school || "").toLowerCase();
        valB = (b.school || "").toLowerCase();
      } else if (userSortBy === "year") {
        // ordine dei corsi (preiscrizione, primo, ...); chi non ha l'anno va in fondo
        const rank = (y?: string) => {
          const i = CONFIG_ISCRIZIONE.anni.findIndex((x) => x.value === y);
          return String(i < 0 ? 99 : i).padStart(2, "0");
        };
        valA = rank(a.year);
        valB = rank(b.year);
      }
      const cmp = valA.localeCompare(valB);
      return userSortDir === "asc" ? cmp : -cmp;
    });

  const toggleUserSort = (col: UserSortCol) => {
    if (userSortBy === col) {
      setUserSortDir(userSortDir === "asc" ? "desc" : "asc");
    } else {
      setUserSortBy(col);
      setUserSortDir("asc");
    }
  };

  const sortArrow = (col: UserSortCol) => {
    if (userSortBy !== col) return "";
    return userSortDir === "asc" ? " ▲" : " ▼";
  };

  // ── Reset (SOLO ADMIN) ────────────────────────────────────
  const handleReset = async () => {
    if (!isSuper) { setMessage("❌ Solo admin possono fare reset"); return; }
    const msgs: Record<string, string> = {
      today: "🗑️ Cancellare SOLO i voti di oggi?",
      scores: "⚠️ Cancellare TUTTI i voti? Operazione irreversibile!",
      full: "🚨 RESET COMPLETO: cancellare tutti i voti (persone e QR) e tutte le ricariche di coins riscattate? Bonus e premi NON vengono toccati: vanno eliminati a mano dalla scheda Bonus.",
    };
    if (!confirm(msgs[resetType])) return;
    const res = await fetch("/api/admin/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: resetType }) });
    const data = await res.json();
    setMessage(data.message);
    if (res.ok) { setShowResetModal(false); loadData(); }
  };

  // ── Utenti ───────────────────────────────────────────────
  const handleAddUser = async () => {
    if (!userForm.email) { setMessage("❌ Email obbligatoria"); return; }
    
    // Validazione Team ↔ Anno
    if (userForm.team && userForm.year && !isYearValidForTeam(userForm.team, userForm.year)) {
      setMessage(`❌ L'anno "${yearLabel(userForm.year)}" non è valido per ${userForm.team}`);
      return;
    }
    
    const res = await fetch("/api/admin/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userForm.email,
        first_name: userForm.first_name,
        last_name: userForm.last_name,
        team: userForm.team || null,
        role: userForm.role,
        site: userForm.site || null,
        school: userForm.school || null,
        year: userForm.year || null
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`✅ ${data.message}\nLink: ${data.link}`);
      setShowAddUserModal(false);
      setUserForm({ email: "", first_name: "", last_name: "", team: "", role: "student", site: "", school: "", year: "" });
      loadData();
    } else { setMessage("❌ " + data.message); }
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setUserForm({
      email: user.email || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      team: user.team || "",
      role: user.role || "student",
      site: user.site || "",
      school: user.school || "",
      year: user.year || ""
    });
    if (user.site) {
      setEditSuggestedSchools(CONFIG_ISCRIZIONE.scuolePerSede[user.site] || CONFIG_ISCRIZIONE.scuole);
    }
    const years = CONFIG_ISCRIZIONE.teamAnniValid[user.team || ''] || CONFIG_ISCRIZIONE.teamAnniValid[''];
    setEditValidYears(years);
    setEditIsDidatta(!!user.is_didatta);
    setShowEditUserModal(true);
  };

  const handleEditUser = async () => {
    // Validazione Team ↔ Anno
    if (userForm.team && userForm.year && !isYearValidForTeam(userForm.team, userForm.year)) {
      setMessage(`❌ L'anno "${yearLabel(userForm.year)}" non è valido per ${userForm.team}`);
      return;
    }
    
    const res = await fetch("/api/admin/users", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedUser.id,
        email: userForm.email,
        first_name: userForm.first_name,
        last_name: userForm.last_name,
        team: userForm.team || null,
        role: userForm.role,
        site: userForm.site || null,
        school: userForm.school || null,
        year: userForm.year || null,
        is_didatta: editIsDidatta
      }),
    });
    const data = await res.json();
    if (res.ok) { setMessage("✅ " + data.message); setShowEditUserModal(false); setSelectedUser(null); loadData(); }
    else { setMessage("❌ " + data.message); }
  };

  // ── Elimina utente (SOLO ADMIN) ──────────────────────────
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!isSuper) { setMessage("❌ Solo admin possono eliminare utenti"); return; }
    if (!confirm(`Sei sicuro di voler eliminare ${userName}?`)) return;
    const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) { setMessage("✅ " + data.message); loadData(); }
    else { setMessage("❌ " + data.message); }
  };

  // ── Invia link via email ─────────────────────────────────
  const handleSendLink = async (userId: string, userName: string, email: string) => {
    if (!confirm(`Inviare il link personale a ${userName} (${email})?`)) return;
    const res = await fetch("/api/admin/send-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    setMessage(data.message);
  };

  // ── Nuovo link: sostituisce il link personale (il vecchio smette di funzionare) ──
  const handleNewLink = async (userId: string, userName: string, email: string | null) => {
    if (!confirm(`Creare un NUOVO link per ${userName}?\n\nIl link attuale smetterà subito di funzionare (chi è già dentro l'app resta collegato).`)) return;
    const sendEmail = !!email && confirm(`Inviare subito a ${userName} il nuovo link per mail (${email})?\n\nOK = invia la mail «Nuovo link di accesso»\nAnnulla = non inviare, lo copio io`);
    const res = await fetch("/api/admin/new-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, sendEmail }),
    });
    const data = await res.json();
    if (!res.ok) { setMessage("❌ " + (data.message || "Errore")); return; }
    // Il link nuovo sostituisce il vecchio anche nell'elenco, così 📋 copia quello giusto.
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, auth_token: data.token } : u)));
    try { await navigator.clipboard.writeText(data.link); } catch { /* copia a mano con 📋 */ }
    setMessage(data.message + (sendEmail ? "" : " Il nuovo link è stato copiato: incollalo dove ti serve (o usa 📋)."));
  };

  // ── Esporta CSV con link ──────────────────────────────────
  const handleExportCSV = (team?: string) => {
    const url = team
      ? `/api/admin/export-links?team=${encodeURIComponent(team)}`
      : "/api/admin/export-links";
    window.open(url, "_blank");
  };

  // ── Selezione utenti (checkbox in tabella) ────────────────
  const toggleUserSelection = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.has(u.id));

  const toggleSelectAllFiltered = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredUsers.forEach((u) => next.delete(u.id));
      } else {
        filteredUsers.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  // ── Invia link via email agli utenti selezionati (SOLO ADMIN) ──
  const handleSendBulk = async () => {
    if (!isSuper) { setMessage("❌ Solo admin possono inviare email di gruppo"); return; }
    const targets = users.filter((u) => selectedUserIds.has(u.id) && u.email);
    if (targets.length === 0) { setMessage("❌ Nessun utente selezionato con email"); return; }
    if (!confirm(`Inviare il link personale a queste ${targets.length} persone selezionate?\n\n${targets.map((u) => `${u.first_name} ${u.last_name}`).join(", ")}`)) return;

    setSendingBulk(true);
    setMessage(`Invio in corso a ${targets.length} persone... può richiedere qualche secondo.`);
    try {
      const res = await fetch("/api/admin/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: targets.map((u) => u.id) }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage("❌ " + data.message); return; }
      let msg = data.message;
      if (data.failed?.length) {
        msg += "\nFallite: " + data.failed.map((f: any) => f.email).join(", ");
      }
      setMessage(msg);
      setSelectedUserIds(new Set());
    } finally {
      setSendingBulk(false);
    }
  };

  // ── Importa CSV (SOLO ADMIN) ─────────────────────────────
  const handleImportCSV = async () => {
    if (!isSuper) { setMessage("❌ Solo admin possono importare CSV"); return; }
    if (!importFile) { setMessage("Seleziona un file"); return; }
    setMessage("Importazione in corso...");
    const formData = new FormData();
    formData.append("file", importFile);
    const res = await fetch("/api/admin/import", { method: "POST", body: formData });
    const data = await res.json();
    setMessage(data.message || "Importazione completata");
    if (res.ok) loadData();
  };

  const handleAddAdmin = async () => {
    if (!isSuper) { setMessage("❌ Solo admin possono nominare staff"); return; }
    const email = adminEmail.trim();
    if (!email) { setMessage("❌ Inserisci un'email"); return; }
    const user = users.find((u) => (u.email || "").trim().toLowerCase() === email.toLowerCase());
    if (!user) { setMessage("❌ Utente non trovato"); return; }
    // Si cambia solo il ruolo: gli altri dati del profilo non si rimandano (alcuni hanno grafie vecchie
    // che il controllo di coerenza squadra/anno rifiuterebbe).
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, role: "staff" }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`✅ Staff nominato! (ruolo confermato dal server: ${data.user?.role ?? "sconosciuto"})`);
      setShowAdminModal(false);
      setAdminEmail("");
      loadData();
    } else {
      setMessage("❌ " + (data.message || "Errore durante la nomina"));
    }
  };

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

      {/* 🔥 Bottoni principali: solo ADMIN può vedere Genera QR, Reset, Import */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 20 }}>
        {isSuper && (
          <button onClick={() => setShowResetModal(true)} style={{ padding: 12, background: "#dc3545", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
            🔄 Reset
          </button>
        )}
        <button onClick={() => setShowAddUserModal(true)} style={{ padding: 12, background: "#28a745", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
          ➕ Aggiungi Utente
        </button>
        {isSuper && (
          <button onClick={() => setShowAdminModal(true)} style={{ padding: 12, background: "#6f42c1", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
            👑 Nomina Staff
          </button>
        )}
      </div>

      {/* 🔥 Import CSV: solo ADMIN */}
      {isSuper && (
        <div style={{ marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
          <h2>📁 Importa CSV / Excel</h2>
          <input type="file" accept=".csv,.xlsx" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <button onClick={handleImportCSV} style={{ marginLeft: 8, padding: "8px 16px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
            Importa
          </button>
        </div>
      )}

      {/* 🩺 Controlli di salute (variabili, migrazioni SQL, QR, fase, classifiche): solo ADMIN */}
      {isSuper && <SystemCheck />}

      {/* 🚦 Fase Anteprima / Voto aperto: solo ADMIN */}
      {isSuper && <PhaseCard />}

      {/* 🎁 Generatore unico di bonus (nascosti e palesi) */}
      {isSuper && <BonusGenerator canDelete />}

      {/* 🎯 QR (squadra, classe, sede, ricarica): lo stesso generatore e lo stesso elenco della dashboard staff */}
      {isSuper && <QrGenerator isAdmin />}
      {/* Lista Utenti */}
      <div style={{ marginTop: 20 }}>
        <h2>👥 Utenti ({filteredUsers.length} di {users.length})</h2>
        <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => handleExportCSV()} style={{ padding: "8px 12px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>⬇️ CSV tutti</button>
          <button onClick={() => handleExportCSV("Matricole")} style={{ padding: "8px 12px", background: TEAM_COLORS.Matricole, color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>⬇️ CSV Matricole</button>
          <button onClick={() => handleExportCSV("Veterani")} style={{ padding: "8px 12px", background: TEAM_COLORS.Veterani, color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>⬇️ CSV Veterani</button>
          <button onClick={() => handleExportCSV("Didatti&Docenti")} style={{ padding: "8px 12px", background: "#6f42c1", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>⬇️ CSV Didatti</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Cerca per nome o email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ flex: "1 1 260px", padding: 10, borderRadius: 6, border: "1px solid #ccc" }} />
          <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}>
            <option value="all">Tutti i ruoli/team</option>
            <option value="admin">Solo Admin</option>
            <option value="staff">Solo Staff</option>
            <option value="student">Solo Partecipanti</option>
            <option value="Matricole">Solo Matricole</option>
            <option value="Veterani">Solo Veterani</option>
            <option value="Didatti&Docenti">Solo Didatti&amp;Docenti</option>
            <option value="confermato">Solo Confermati</option>
            <option value="lista_attesa">Solo Lista d'attesa</option>
            <option value="ritirato">Solo Ritirati</option>
          </select>
          {isSuper && (
            <button
              onClick={handleSendBulk}
              disabled={sendingBulk || selectedUserIds.size === 0}
              style={{ padding: "8px 12px", background: sendingBulk || selectedUserIds.size === 0 ? "#999" : "#28a745", color: "white", border: "none", borderRadius: 6, cursor: sendingBulk || selectedUserIds.size === 0 ? "not-allowed" : "pointer", fontSize: "0.85rem" }}
              title="Invia il link personale via email agli utenti selezionati con la checkbox"
            >
              {sendingBulk ? "Invio in corso..." : `✉️ Invia link ai selezionati (${selectedUserIds.size})`}
            </button>
          )}
        </div>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                {isSuper && (
                  <th style={{ padding: 8, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      title="Seleziona/deseleziona tutti quelli mostrati dal filtro corrente"
                    />
                  </th>
                )}
                <th onClick={() => toggleUserSort("name")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Nome{sortArrow("name")}</th>
                <th onClick={() => toggleUserSort("email")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Email{sortArrow("email")}</th>
                <th onClick={() => toggleUserSort("team")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Team{sortArrow("team")}</th>
                <th onClick={() => toggleUserSort("status")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Stato{sortArrow("status")}</th>
                <th onClick={() => toggleUserSort("role")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Ruolo{sortArrow("role")}</th>
                <th onClick={() => toggleUserSort("site")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Sede{sortArrow("site")}</th>
                <th onClick={() => toggleUserSort("school")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Scuola{sortArrow("school")}</th>
                <th onClick={() => toggleUserSort("year")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Anno{sortArrow("year")}</th>
                <th style={{ textAlign: "center", padding: 8 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isProtected = u.email === "mabras69@gmail.com";
                const yearText = u.year ? yearLabel(u.year) : "-";
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                    {isSuper && (
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          onChange={() => toggleUserSelection(u.id)}
                          disabled={!u.email}
                          title={!u.email ? "Nessuna email" : undefined}
                        />
                      </td>
                    )}
                    <td style={{ padding: 8 }}>{u.first_name} {u.last_name}</td>
                    <td style={{ padding: 8 }}>{u.email}</td>
                    <td style={{ padding: 8 }}>
                      {u.team || "-"}
                    </td>
                    <td style={{ padding: 8 }}>
                      {u.status === "lista_attesa" ? (
                        <span style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 4, fontSize: "0.65rem", fontWeight: "bold", background: "#ffc107", color: "#333" }}>ATTESA</span>
                      ) : u.status === "ritirato" ? (
                        <span style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 4, fontSize: "0.65rem", fontWeight: "bold", background: "#dc3545", color: "white" }}>RITIRATO</span>
                      ) : (
                        <span style={{ marginLeft: 6, padding: "2px 6px", borderRadius: 4, fontSize: "0.65rem", fontWeight: "bold", background: "#28a745", color: "white" }}>ISCRITTO</span>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: "bold", color: "white", background: u.role === "admin" ? "#dc3545" : u.role === "staff" ? "#6f42c1" : "#28a745" }}>{u.role === "student" ? "partecipante" : u.role}</span>
                    </td>
                    <td style={{ padding: 8 }}>{u.site || "-"}</td>
                    <td style={{ padding: 8 }}>{u.school || "-"}</td>
                    <td style={{ padding: 8 }}>{yearText}</td>
                    <td style={{ textAlign: "center", padding: 8 }}>
                      <button onClick={() => openEditModal(u)} style={{ padding: "4px 8px", marginRight: 4, background: "#ffc107", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }} title="Modifica">✏️</button>
                      <button onClick={() => { navigator.clipboard.writeText(personalLink(u.auth_token)); showToast(`📋 Link copiato per ${u.first_name} ${u.last_name}`); }} style={{ padding: "4px 8px", marginRight: 4, background: "#17a2b8", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }} title="Copia link">📋</button>
                      <button onClick={() => handleSendLink(u.id, `${u.first_name} ${u.last_name}`, u.email)} style={{ padding: "4px 8px", marginRight: 4, background: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }} title="Invia link via email">✉️</button>
                      {isSuper && (
                        <button onClick={() => handleNewLink(u.id, `${u.first_name} ${u.last_name}`, u.email)} style={{ padding: "4px 8px", marginRight: 4, background: "#6f42c1", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }} title="Nuovo link (il vecchio smette di funzionare)">🔄</button>
                      )}
                      {isSuper && (
                        <button onClick={() => handleDeleteUser(u.id, `${u.first_name} ${u.last_name}`)} disabled={isProtected} style={{ padding: "4px 8px", background: isProtected ? "#ccc" : "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: isProtected ? "not-allowed" : "pointer", fontSize: "0.8rem", opacity: isProtected ? 0.5 : 1 }}>
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Reset (solo ADMIN) */}
      {isSuper && showResetModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>🔄 Reset</h2>
            <select value={resetType} onChange={(e) => setResetType(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 8 }}>
              <option value="today">🗑️ Reset voti di oggi</option>
              <option value="scores">🔄 Reset punteggi (tutti i voti)</option>
              <option value="full">⚠️ Reset completo</option>
            </select>
            <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 10, marginBottom: 0 }}>
              <strong>Oggi</strong>: voti di oggi (persone e QR). <strong>Punteggi</strong>: tutti i voti. <strong>Completo</strong>: tutti i voti e le ricariche di coins riscattate.
              Nessun reset tocca utenti, QR, <strong>bonus nascosti e premi palesi</strong>: per azzerare davvero la classifica eliminali dalla scheda 🎁 Bonus.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleReset} style={{ padding: "8px 16px", background: "#dc3545", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Conferma</button>
              <button onClick={() => setShowResetModal(false)} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Nomina Staff (solo ADMIN) */}
      {isSuper && showAdminModal && (
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
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2>➕ Aggiungi Utente</h2>
            
            <UserFormFields
              form={userForm}
              setForm={setUserForm}
              isSuper={isSuper}
              validYears={validYears}
              suggestedSchools={suggestedSchools}
              emailPlaceholder="Email *"
              roleNote="Ruolo: Partecipante (solo un admin può assegnare ruoli diversi)"
            />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleAddUser} style={{ padding: "8px 16px", background: "#28a745", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Crea</button>
              <button onClick={() => { setShowAddUserModal(false); setUserForm({ email: "", first_name: "", last_name: "", team: "", role: "student", site: "", school: "", year: "" }); }} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Modifica Utente */}
      {showEditUserModal && selectedUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2>✏️ Modifica Utente</h2>
            <p style={{ color: "#999", fontSize: "0.8rem", marginBottom: 8 }}>{selectedUser.first_name} {selectedUser.last_name}</p>
            
            <UserFormFields
              form={userForm}
              setForm={setUserForm}
              isSuper={isSuper}
              validYears={editValidYears}
              suggestedSchools={editSuggestedSchools}
              emailPlaceholder="Email"
              roleNote={`Ruolo attuale: ${userForm.role === "student" ? "partecipante" : userForm.role} (solo un admin può modificarlo)`}
              afterTeam={
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: "0.85rem", color: "#444" }}>
                  <input type="checkbox" checked={editIsDidatta} onChange={(e) => setEditIsDidatta(e.target.checked)} />
                  Può scegliere/cambiare/lasciare la squadra (docente/staff registrato come Matricola/Veterano)
                </label>
              }
            />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleEditUser} style={{ padding: "8px 16px", background: "#ffc107", color: "black", border: "none", borderRadius: 8, cursor: "pointer" }}>Salva</button>
              <button onClick={() => { setShowEditUserModal(false); setSelectedUser(null); }} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: "#1E3A5F", color: "white", padding: "12px 24px",
          borderRadius: 30, fontWeight: 600, fontSize: "0.9rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)", zIndex: 9999,
          animation: "fadeIn 0.2s ease",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}