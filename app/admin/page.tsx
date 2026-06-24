"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [message, setMessage] = useState("");

  const [eventForm, setEventForm] = useState({
    title: "",
    event_type: "presentation",
    team_target: "Matricole",
    location: "",
    start_time: "",
    end_time: "",
  });
  const [bonusForm, setBonusForm] = useState({
    title: "",
    amount: 5,
  });
  const [adminEmail, setAdminEmail] = useState("");
  const [resetType, setResetType] = useState("scores");
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const userId = getCookie("user_id");
      const role = getCookie("user_role");

      if (!userId || (role !== "admin" && role !== "staff")) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setIsSuper(role === "admin");
      await loadData();
      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  const loadData = async () => {
    const { data: usersList } = await supabase.from("users").select("*").limit(100);
    setUsers(usersList || []);

    const { data: eventsList } = await supabase
      .from("votable_events")
      .select("*")
      .order("created_at", { ascending: false });
    setEvents(eventsList || []);

    const { data: bonusesList } = await supabase
      .from("bonus_qr")
      .select("*")
      .order("created_at", { ascending: false });
    setBonuses(bonusesList || []);
  };

  const handleImportCSV = async () => {
    if (!importFile) {
      setMessage("Seleziona un file CSV o Excel");
      return;
    }
    setMessage("Importazione in corso...");
    const formData = new FormData();
    formData.append("file", importFile);

    const res = await fetch("/api/admin/import", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setMessage(data.message || "Importazione completata");
    if (res.ok) loadData();
  };

  const handleCreateEvent = async () => {
    const { error } = await supabase
      .from("votable_events")
      .insert({
        ...eventForm,
        qr_code: `EVENT:${crypto.randomUUID()}`,
        start_time: new Date(eventForm.start_time).toISOString(),
        end_time: new Date(eventForm.end_time).toISOString(),
      });

    if (error) {
      setMessage("Errore creazione evento: " + error.message);
    } else {
      setMessage("✅ Evento creato!");
      setShowEventModal(false);
      setEventForm({
        title: "",
        event_type: "presentation",
        team_target: "Matricole",
        location: "",
        start_time: "",
        end_time: "",
      });
      loadData();
    }
  };

  const handleCreateBonus = async () => {
    const code = `BONUS:${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("bonus_qr").insert({
      title: bonusForm.title,
      amount: bonusForm.amount,
      code,
    });

    if (error) {
      setMessage("Errore creazione bonus: " + error.message);
    } else {
      setMessage(`✅ Bonus creato! Codice: ${code}`);
      setShowBonusModal(false);
      setBonusForm({ title: "", amount: 5 });
      loadData();
    }
  };

  const handleReset = async () => {
    const res = await fetch("/api/admin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: resetType }),
    });
    const data = await res.json();
    setMessage(data.message);
    if (res.ok) {
      setShowResetModal(false);
      loadData();
    }
  };

  const handleAddAdmin = async () => {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", adminEmail)
      .single();

    if (!user) {
      setMessage("Utente non trovato");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({ role: "staff" })
      .eq("id", user.id);

    if (error) {
      setMessage("Errore nomina admin: " + error.message);
    } else {
      setMessage("✅ Admin nominato!");
      setShowAdminModal(false);
      setAdminEmail("");
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40 }}>Verifica credenziali...</div>;
  }

  if (!isAdmin) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        Accesso negato. Non hai i permessi per visualizzare questa pagina.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>🛠️ Pannello Admin</h1>
        <button
          onClick={() => router.push("/")}
          style={{ color: "#FF6B35", background: "none", border: "none", fontSize: "1rem", cursor: "pointer" }}
        >
          ← Torna alla dashboard
        </button>
      </div>

      {message && (
        <div style={{ padding: 12, background: "#f0f0f0", borderRadius: 8, marginBottom: 16 }}>
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 20 }}>
        <button
          onClick={() => setShowEventModal(true)}
          style={{ padding: 12, background: "#1E3A5F", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          🎤 Crea Evento
        </button>
        <button
          onClick={() => setShowBonusModal(true)}
          style={{ padding: 12, background: "#FF6B35", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          🎁 Crea QR Bonus
        </button>
        <button
          onClick={() => setShowResetModal(true)}
          style={{ padding: 12, background: "#dc3545", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          🔄 Reset
        </button>
        {isSuper && (
          <button
            onClick={() => setShowAdminModal(true)}
            style={{ padding: 12, background: "#28a745", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            👑 Nomina Admin
          </button>
        )}
      </div>

      <div style={{ marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8 }}>
        <h2>📁 Importa CSV / Excel</h2>
        <input
          type="file"
          accept=".csv,.xlsx"
          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={handleImportCSV}
          style={{ marginLeft: 8, padding: "8px 16px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
        >
          Importa
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h2>🎤 Eventi ({events.length})</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Titolo</th>
              <th style={{ textAlign: "left", padding: 8 }}>Target</th>
              <th style={{ textAlign: "left", padding: 8 }}>QR</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{e.title}</td>
                <td style={{ padding: 8 }}>{e.team_target}</td>
                <td style={{ padding: 8, fontSize: "0.8rem" }}>{e.qr_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <h2>🎁 QR Bonus ({bonuses.length})</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Titolo</th>
              <th style={{ textAlign: "left", padding: 8 }}>Importo</th>
              <th style={{ textAlign: "left", padding: 8 }}>Codice</th>
            </tr>
          </thead>
          <tbody>
            {bonuses.map((b) => (
              <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{b.title}</td>
                <td style={{ padding: 8 }}>+{b.amount}</td>
                <td style={{ padding: 8, fontSize: "0.8rem" }}>{b.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20 }}>
        <h2>👥 Utenti ({users.length})</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd" }}>
              <th style={{ textAlign: "left", padding: 8 }}>Nome</th>
              <th style={{ textAlign: "left", padding: 8 }}>Email</th>
              <th style={{ textAlign: "left", padding: 8 }}>Team</th>
              <th style={{ textAlign: "left", padding: 8 }}>Ruolo</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{u.first_name} {u.last_name}</td>
                <td style={{ padding: 8 }}>{u.email}</td>
                <td style={{ padding: 8 }}>{u.team || "-"}</td>
                <td style={{ padding: 8 }}>{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEventModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>🎤 Nuovo Evento</h2>
            <input type="text" placeholder="Titolo" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <select value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }}>
              <option value="presentation">Presentazione</option>
              <option value="song">Canzone</option>
            </select>
            <select value={eventForm.team_target} onChange={(e) => setEventForm({ ...eventForm, team_target: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }}>
              <option value="Matricole">Matricole</option>
              <option value="Veterani">Veterani</option>
            </select>
            <input type="text" placeholder="Luogo" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <input type="datetime-local" value={eventForm.start_time} onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <input type="datetime-local" value={eventForm.end_time} onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleCreateEvent} style={{ padding: "8px 16px", background: "#1E3A5F", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Crea</button>
              <button onClick={() => setShowEventModal(false)} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {showBonusModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>🎁 Nuovo QR Bonus</h2>
            <input type="text" placeholder="Titolo" value={bonusForm.title} onChange={(e) => setBonusForm({ ...bonusForm, title: e.target.value })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <input type="number" placeholder="Importo" value={bonusForm.amount} onChange={(e) => setBonusForm({ ...bonusForm, amount: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleCreateBonus} style={{ padding: "8px 16px", background: "#FF6B35", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Crea</button>
              <button onClick={() => setShowBonusModal(false)} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>🔄 Reset</h2>
            <select value={resetType} onChange={(e) => setResetType(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 8 }}>
              <option value="scores">Reset punteggi</option>
              <option value="full">Reset completo</option>
            </select>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleReset} style={{ padding: "8px 16px", background: "#dc3545", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Conferma</button>
              <button onClick={() => setShowResetModal(false)} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, maxWidth: 500, width: "100%" }}>
            <h2>👑 Nomina Admin</h2>
            <input type="email" placeholder="Email utente" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={{ width: "100%", padding: 8, marginTop: 8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleAddAdmin} style={{ padding: "8px 16px", background: "#28a745", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Nomina</button>
              <button onClick={() => setShowAdminModal(false)} style={{ padding: "8px 16px", background: "#ccc", border: "none", borderRadius: 8, cursor: "pointer" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
