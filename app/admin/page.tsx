"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { CONFIG_ISCRIZIONE } from "@/lib/config";

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

// Verifica se l'anno è valido per il team
function isYearValidForTeam(team: string, year: string): boolean {
  if (!year) return true;
  const validYears = CONFIG_ISCRIZIONE.teamAnniValid[team] || CONFIG_ISCRIZIONE.teamAnniValid[''];
  return validYears.includes(year);
}

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

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userSortBy, setUserSortBy] = useState<"name" | "email" | "team" | "role">("name");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc");
  const [events, setEvents] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Filtri, ricerca e paginazione per QR Voto
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("created_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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
  const [userForm, setUserForm] = useState({ 
    email: "", 
    first_name: "", 
    last_name: "", 
    team: "", 
    role: "student",
    site: "",
    school: "",
    year: ""
  });
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

  const filteredUsers = users
    .filter((u) => {
      if (userRoleFilter !== "all") {
        if (userRoleFilter === "admin" && u.role !== "admin") return false;
        if (userRoleFilter === "staff" && u.role !== "staff") return false;
        if (userRoleFilter === "student" && u.role !== "student") return false;
        if (userRoleFilter === "Matricole" && u.team !== "Matricole") return false;
        if (userRoleFilter === "Veterani" && u.team !== "Veterani") return false;
        if (userRoleFilter === "Didatti&Docenti" && u.team !== "Didatti&Docenti") return false;
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
      }
      const cmp = valA.localeCompare(valB);
      return userSortDir === "asc" ? cmp : -cmp;
    });

  const toggleUserSort = (col: "name" | "email" | "team" | "role") => {
    if (userSortBy === col) {
      setUserSortDir(userSortDir === "asc" ? "desc" : "asc");
    } else {
      setUserSortBy(col);
      setUserSortDir("asc");
    }
  };

  const sortArrow = (col: "name" | "email" | "team" | "role") => {
    if (userSortBy !== col) return "";
    return userSortDir === "asc" ? " ▲" : " ▼";
  };

  // Filtra e ordina i QR Voto
  const filteredEvents = events
    .filter((e) => {
      if (filterType !== "all" && e.qr_type !== filterType) return false;
      if (searchTerm.trim()) {
        const search = searchTerm.toLowerCase().trim();
        const title = (e.title || "").toLowerCase();
        const school = (e.class_school || "").toLowerCase();
        const site = (e.class_site || "").toLowerCase();
        const year = (e.class_year || "").toLowerCase();
        const team = (e.team_target || "").toLowerCase();
        return title.includes(search) || school.includes(search) || site.includes(search) || year.includes(search) || team.includes(search);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "title_asc": return (a.title || "").localeCompare(b.title || "");
        case "title_desc": return (b.title || "").localeCompare(a.title || "");
        case "created_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "created_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "team_asc": return (a.team_target || "").localeCompare(b.team_target || "");
        case "team_desc": return (b.team_target || "").localeCompare(a.team_target || "");
        default: return 0;
      }
    });

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Crea QR (SOLO ADMIN) ──────────────────────────────────
  const handleCreaQR = async () => {
    if (!isSuper) { setMessage("❌ Solo admin possono creare QR"); return; }
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

    const dataUrl = await QRCode.toDataURL(qrCode, {
      width: 300, margin: 2,
      color: { dark: "#1E3A5F", light: "#ffffff" },
    });
    setPreviewQR(dataUrl);
    setPreviewLabel(label);
    setMessage(`✅ QR "${label}" creato!`);
    await loadData();
    setCurrentPage(1);
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

  // ── Elimina QR (SOLO ADMIN) ──────────────────────────────
  const handleDeleteEvent = async (id: string, title: string) => {
    if (!isSuper) { setMessage("❌ Solo admin possono eliminare QR"); return; }
    if (!confirm(`Eliminare "${title}"?`)) return;
    const { error } = await supabase.from("votable_events").delete().eq("id", id);
    if (error) setMessage("❌ " + error.message);
    else { setMessage("✅ QR eliminato"); loadData(); }
  };

  const handleDeleteBonus = async (id: string, title: string) => {
    if (!isSuper) { setMessage("❌ Solo admin possono eliminare QR"); return; }
    if (!confirm(`Eliminare "${title}"?`)) return;
    const { error } = await supabase.from("bonus_qr").delete().eq("id", id);
    if (error) setMessage("❌ " + error.message);
    else { setMessage("✅ QR eliminato"); loadData(); }
  };

  // ── Reset (SOLO ADMIN) ────────────────────────────────────
  const handleReset = async () => {
    if (!isSuper) { setMessage("❌ Solo admin possono fare reset"); return; }
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

  // ── Utenti ───────────────────────────────────────────────
  const handleAddUser = async () => {
    if (!userForm.email) { setMessage("❌ Email obbligatoria"); return; }
    
    // Validazione Team ↔ Anno
    if (userForm.team && userForm.year && !isYearValidForTeam(userForm.team, userForm.year)) {
      setMessage(`❌ L'anno "${CONFIG_ISCRIZIONE.anni.find(a => a.value === userForm.year)?.label}" non è valido per ${userForm.team}`);
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
    setShowEditUserModal(true);
  };

  const handleEditUser = async () => {
    // Validazione Team ↔ Anno
    if (userForm.team && userForm.year && !isYearValidForTeam(userForm.team, userForm.year)) {
      setMessage(`❌ L'anno "${CONFIG_ISCRIZIONE.anni.find(a => a.value === userForm.year)?.label}" non è valido per ${userForm.team}`);
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
        year: userForm.year || null
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

  // ── Esporta CSV con link ──────────────────────────────────
  const handleExportCSV = (team?: string) => {
    const url = team
      ? `/api/admin/export-links?team=${encodeURIComponent(team)}`
      : "/api/admin/export-links";
    window.open(url, "_blank");
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
    const { data: user, error: selError } = await supabase.from("users").select("*").eq("email", email).single();
    if (selError || !user) { setMessage("❌ Utente non trovato"); return; }
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        team: user.team || null,
        role: "staff",
        site: user.site || null,
        school: user.school || null,
        year: user.year || null
      }),
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

  const TeamSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }}
    >
      <option value="">Non specificato</option>
      <option value="Matricole">🐓 Matricole</option>
      <option value="Veterani">🐄 Veterani</option>
      <option value="Didatti&Docenti">Didatti &amp; Docenti</option>
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

      {/* 🔥 Bottoni principali: solo ADMIN può vedere Genera QR, Reset, Import */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 20 }}>
        {isSuper && (
          <button onClick={() => { setShowQRModal(true); setPreviewQR(null); }} style={{ padding: 12, background: "#1E3A5F", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>
            🎯 Genera QR
          </button>
        )}
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

      {/* Sezione QR Voto */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0 }}>🎯 QR Voto ({filteredEvents.length} di {events.length})</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="🔍 Cerca QR..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.85rem", minWidth: 180 }}
            />
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.85rem", background: "white" }}
            >
              <option value="all">Tutti</option>
              <option value="team">Squadra</option>
              <option value="class">Classe</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: "0.85rem", background: "white" }}
            >
              <option value="created_desc">Più recenti</option>
              <option value="created_asc">Più vecchi</option>
              <option value="title_asc">Titolo A→Z</option>
              <option value="title_desc">Titolo Z→A</option>
              <option value="team_asc">Squadra A→Z</option>
              <option value="team_desc">Squadra Z→A</option>
            </select>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <p style={{ color: "#999", textAlign: "center", padding: 20 }}>
            {searchTerm ? "Nessun QR corrisponde alla ricerca" : "Nessun QR voto generato"}
          </p>
        ) : (
          <>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ddd", position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                    <th style={{ textAlign: "left", padding: 8 }}>Titolo</th>
                    <th style={{ textAlign: "left", padding: 8 }}>Tipo</th>
                    <th style={{ textAlign: "left", padding: 8 }}>Target</th>
                    <th style={{ textAlign: "center", padding: 8 }}>Stato</th>
                    <th style={{ textAlign: "center", padding: 8 }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #eee", opacity: e.active === false ? 0.5 : 1 }}>
                      <td style={{ padding: 8 }}>{e.title}</td>
                      <td style={{ padding: 8, fontSize: "0.8rem" }}>
                        {e.qr_type === "class" 
                          ? `🏫 ${e.class_school || ""} ${e.class_site || ""} ${e.class_year || ""}`.trim() || "Classe"
                          : `🏆 ${e.team_target || "Squadra"}`}
                      </td>
                      <td style={{ padding: 8 }}>{e.team_target || "-"}</td>
                      <td style={{ padding: 8, textAlign: "center" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: e.active !== false ? "#28a745" : "#dc3545", color: "white", fontSize: "0.75rem" }}>
                          {e.active !== false ? "Attivo" : "Inattivo"}
                        </span>
                      </td>
                      <td style={{ padding: 8, textAlign: "center", whiteSpace: "nowrap" }}>
                        <button onClick={() => handleToggleEvent(e.id, e.active !== false)} style={{ padding: "4px 8px", marginRight: 4, background: e.active !== false ? "#dc3545" : "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                          {e.active !== false ? "Disattiva" : "Attiva"}
                        </button>
                        <button onClick={() => downloadQR(e.qr_code, e.title)} style={{ padding: "4px 8px", marginRight: 4, background: "#1E3A5F", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                          ⬇️ QR
                        </button>
                        {isSuper && (
                          <button onClick={() => handleDeleteEvent(e.id, e.title)} style={{ padding: "4px 8px", background: "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} style={{ padding: "4px 12px", borderRadius: 4, border: "1px solid #ccc", background: currentPage === 1 ? "#f0f0f0" : "white", cursor: currentPage === 1 ? "not-allowed" : "pointer" }}>◀</button>
                <span style={{ padding: "4px 12px", color: "#666", fontSize: "0.85rem" }}>{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} style={{ padding: "4px 12px", borderRadius: 4, border: "1px solid #ccc", background: currentPage === totalPages ? "#f0f0f0" : "white", cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}>▶</button>
              </div>
            )}
          </>
        )}
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
                    <button onClick={() => downloadQR(b.code, b.title)} style={{ padding: "4px 8px", marginRight: 4, background: "#1E3A5F", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                      ⬇️ QR
                    </button>
                    {isSuper && (
                      <button onClick={() => handleDeleteBonus(b.id, b.title)} style={{ padding: "4px 8px", background: "#dc3545", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.75rem" }}>
                        🗑️
                      </button>
                    )}
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
        <div style={{ display: "flex", gap: 8, marginTop: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => handleExportCSV()} style={{ padding: "8px 12px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>⬇️ CSV tutti</button>
          <button onClick={() => handleExportCSV("Matricole")} style={{ padding: "8px 12px", background: "#FF6B35", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>⬇️ CSV Matricole</button>
          <button onClick={() => handleExportCSV("Veterani")} style={{ padding: "8px 12px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>⬇️ CSV Veterani</button>
          <button onClick={() => handleExportCSV("Didatti&Docenti")} style={{ padding: "8px 12px", background: "#6f42c1", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.85rem" }}>⬇️ CSV Didatti</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Cerca per nome o email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ flex: "1 1 260px", padding: 10, borderRadius: 6, border: "1px solid #ccc" }} />
          <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}>
            <option value="all">Tutti i ruoli/team</option>
            <option value="admin">Solo Admin</option>
            <option value="staff">Solo Staff</option>
            <option value="student">Solo Studenti</option>
            <option value="Matricole">Solo Matricole</option>
            <option value="Veterani">Solo Veterani</option>
            <option value="Didatti&Docenti">Solo Didatti&amp;Docenti</option>
          </select>
        </div>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th onClick={() => toggleUserSort("name")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Nome{sortArrow("name")}</th>
                <th onClick={() => toggleUserSort("email")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Email{sortArrow("email")}</th>
                <th onClick={() => toggleUserSort("team")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Team{sortArrow("team")}</th>
                <th onClick={() => toggleUserSort("role")} style={{ textAlign: "left", padding: 8, cursor: "pointer", userSelect: "none" }}>Ruolo{sortArrow("role")}</th>
                <th style={{ textAlign: "left", padding: 8 }}>Sede</th>
                <th style={{ textAlign: "left", padding: 8 }}>Scuola</th>
                <th style={{ textAlign: "left", padding: 8 }}>Anno</th>
                <th style={{ textAlign: "center", padding: 8 }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isProtected = u.email === "mabras69@gmail.com";
                const yearLabel = u.year ? CONFIG_ISCRIZIONE.anni.find(a => a.value === u.year)?.label || u.year : "-";
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{u.first_name} {u.last_name}</td>
                    <td style={{ padding: 8 }}>{u.email}</td>
                    <td style={{ padding: 8 }}>{u.team || "-"}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.7rem", fontWeight: "bold", color: "white", background: u.role === "admin" ? "#dc3545" : u.role === "staff" ? "#6f42c1" : "#28a745" }}>{u.role}</span>
                    </td>
                    <td style={{ padding: 8 }}>{u.site || "-"}</td>
                    <td style={{ padding: 8 }}>{u.school || "-"}</td>
                    <td style={{ padding: 8 }}>{yearLabel}</td>
                    <td style={{ textAlign: "center", padding: 8 }}>
                      <button onClick={() => openEditModal(u)} style={{ padding: "4px 8px", marginRight: 4, background: "#ffc107", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }} title="Modifica">✏️</button>
                      <button onClick={() => { navigator.clipboard.writeText(`https://fantassisi-2026.onrender.com/api/auth?token=${u.auth_token}`); showToast(`📋 Link copiato per ${u.first_name} ${u.last_name}`); }} style={{ padding: "4px 8px", marginRight: 4, background: "#17a2b8", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }} title="Copia link">📋</button>
                      <button onClick={() => handleSendLink(u.id, `${u.first_name} ${u.last_name}`, u.email)} style={{ padding: "4px 8px", marginRight: 4, background: "#28a745", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }} title="Invia link via email">✉️</button>
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

      {/* MODAL: Genera QR (solo ADMIN) */}
      {isSuper && showQRModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ marginBottom: 16 }}>🎯 Genera QR</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {(["squadra", "classe", "ricarica"] as const).map((tab) => (
                <button key={tab} onClick={() => { setQrTab(tab); setPreviewQR(null); }}
                  style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", background: qrTab === tab ? "#1E3A5F" : "#f0f0f0", color: qrTab === tab ? "white" : "#333" }}>
                  {tab === "squadra" ? "🏆 Squadra" : tab === "classe" ? "🏫 Classe" : "⚡ Ricarica"}
                </button>
              ))}
            </div>

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
              {!previewQR ? (
                <button onClick={handleCreaQR} style={{ flex: 1, padding: 12, background: "#1E3A5F", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Genera QR</button>
              ) : (
                <button onClick={() => { setPreviewQR(null); }} style={{ flex: 1, padding: 12, background: "#6c757d", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>+ Genera un altro</button>
              )}
              <button onClick={() => { setShowQRModal(false); setPreviewQR(null); }} style={{ padding: 12, background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Chiudi</button>
            </div>

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
            
            <input type="email" placeholder="Email *" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }} />
            <input type="text" placeholder="Nome" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }} />
            <input type="text" placeholder="Cognome" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }} />
            
            <TeamSelect value={userForm.team} onChange={(v) => setUserForm({ ...userForm, team: v })} />
            
            {isSuper ? (
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }}>
                <option value="student">Studente</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <p style={{ marginTop: 8, padding: 8, background: "#f5f5f5", borderRadius: 6, fontSize: "0.85rem", color: "#666" }}>
                Ruolo: Studente (solo un admin può assegnare ruoli diversi)
              </p>
            )}

            {/* Sede */}
            <select
              value={userForm.site}
              onChange={(e) => setUserForm({ ...userForm, site: e.target.value, school: '' })}
              style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="">Non specificato</option>
              {CONFIG_ISCRIZIONE.sedi.map((sede) => (
                <option key={sede} value={sede}>{sede}</option>
              ))}
            </select>

            {/* Scuola */}
            <div style={{ marginTop: 8 }}>
              <SchoolSelect
                value={userForm.school}
                onChange={(val: string) => setUserForm({ ...userForm, school: val })}
                suggested={suggestedSchools}
                site={userForm.site}
              />
            </div>

            {/* Anno - FILTRATO per team */}
            <select
              value={userForm.year}
              onChange={(e) => setUserForm({ ...userForm, year: e.target.value })}
              style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="">Non specificato</option>
              {CONFIG_ISCRIZIONE.anni
                .filter(anno => validYears.includes(anno.value))
                .map((anno) => (
                  <option key={anno.value} value={anno.value}>
                    {anno.label}
                  </option>
                ))}
            </select>

            {/* Avviso se anno non valido per il team */}
            {userForm.team && userForm.year && !isYearValidForTeam(userForm.team, userForm.year) && (
              <p style={{ color: "#dc3545", fontSize: "0.8rem", marginTop: 4 }}>
                ⚠️ L'anno "{CONFIG_ISCRIZIONE.anni.find(a => a.value === userForm.year)?.label}" non è valido per {userForm.team}.
              </p>
            )}

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
            
            <input type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }} />
            <input type="text" placeholder="Nome" value={userForm.first_name} onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }} />
            <input type="text" placeholder="Cognome" value={userForm.last_name} onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }} />
            
            <TeamSelect value={userForm.team} onChange={(v) => setUserForm({ ...userForm, team: v })} />
            
            {isSuper ? (
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }}>
                <option value="student">Studente</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <p style={{ marginTop: 8, padding: 8, background: "#f5f5f5", borderRadius: 6, fontSize: "0.85rem", color: "#666" }}>
                Ruolo attuale: {userForm.role} (solo un admin può modificarlo)
              </p>
            )}

            {/* Sede */}
            <select
              value={userForm.site}
              onChange={(e) => setUserForm({ ...userForm, site: e.target.value, school: '' })}
              style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="">Non specificato</option>
              {CONFIG_ISCRIZIONE.sedi.map((sede) => (
                <option key={sede} value={sede}>{sede}</option>
              ))}
            </select>

            {/* Scuola */}
            <div style={{ marginTop: 8 }}>
              <SchoolSelect
                value={userForm.school}
                onChange={(val: string) => setUserForm({ ...userForm, school: val })}
                suggested={editSuggestedSchools}
                site={userForm.site}
              />
            </div>

            {/* Anno - FILTRATO per team */}
            <select
              value={userForm.year}
              onChange={(e) => setUserForm({ ...userForm, year: e.target.value })}
              style={{ width: "100%", padding: 8, marginTop: 8, borderRadius: 6, border: "1px solid #ccc" }}
            >
              <option value="">Non specificato</option>
              {CONFIG_ISCRIZIONE.anni
                .filter(anno => editValidYears.includes(anno.value))
                .map((anno) => (
                  <option key={anno.value} value={anno.value}>
                    {anno.label}
                  </option>
                ))}
            </select>

            {/* Avviso se anno non valido per il team */}
            {userForm.team && userForm.year && !isYearValidForTeam(userForm.team, userForm.year) && (
              <p style={{ color: "#dc3545", fontSize: "0.8rem", marginTop: 4 }}>
                ⚠️ L'anno "{CONFIG_ISCRIZIONE.anni.find(a => a.value === userForm.year)?.label}" non è valido per {userForm.team}.
              </p>
            )}

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