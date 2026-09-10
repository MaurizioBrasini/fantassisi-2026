"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import InstallButton from "@/components/InstallButton"; // 🔥 MODIFICA 1: Aggiunto import
import { startOfTodayInRomeISO } from "@/lib/utils";
import { CONFIG_ISCRIZIONE } from "@/lib/config";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookieClient(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 14;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

// ─────────────────────────────────────────────
// Box scelta/cambio squadra, con sede+classe facoltative.
// Usato sia per il primo arruolamento (Didatti&Docenti → squadra)
// sia, per chi ha is_didatta=true, per cambiare squadra o uscirne.
// ─────────────────────────────────────────────
function TeamSwitchBox({ currentTeam, allowLeave, onDone }: {
  currentTeam: string;
  allowLeave: boolean;
  onDone: (team: string, year?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState<"" | "Matricole" | "Veterani">("");
  const [site, setSite] = useState("");
  const [classe, setClasse] = useState(""); // "scuola||anno"

  const schoolsAtSite = site ? (CONFIG_ISCRIZIONE.scuolePerSede[site] || []) : [];
  const validYears = team ? (CONFIG_ISCRIZIONE.teamAnniValid[team] || []) : [];
  const classeOptions = schoolsAtSite.flatMap((school) =>
    CONFIG_ISCRIZIONE.anni
      .filter((a) => a.value && validYears.includes(a.value))
      .map((a) => ({
        value: `${school}||${a.value}`,
        label: schoolsAtSite.length > 1 ? `${school} · ${a.label}` : a.label,
      }))
  );

  const reset = () => {
    setOpen(false);
    setTeam("");
    setSite("");
    setClasse("");
  };

  const submit = async (targetTeam: string, targetSite: string | null, targetClasse: string) => {
    setBusy(true);
    const [school, year] = targetClasse ? targetClasse.split("||") : [null, null];
    const res = await fetch("/api/admin/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team: targetTeam, site: targetSite, school, year }),
    });
    const data = await res.json();
    if (res.ok) {
      setCookieClient("user_team", targetTeam);
      reset();
      onDone(targetTeam, data.year || "");
    } else {
      alert(data.error || "Errore durante il cambio squadra");
    }
    setBusy(false);
  };

  const handleLeaveTeam = () => {
    if (!window.confirm("Tornare a Didatti&Docenti (nessuna squadra)? Potrai riarruolarti quando vuoi.")) return;
    submit("Didatti&Docenti", null, "");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ marginTop: 20, width: "100%", padding: 16, borderRadius: 60, fontWeight: 700, background: "linear-gradient(135deg, #FF6B35, #1E3A5F)", color: "white", border: "none", cursor: "pointer", fontSize: "1rem" }}
      >
        {currentTeam === "Didatti&Docenti" ? "⚔️ Arruolati!" : "🔄 Cambia squadra"}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 20, background: "#f8f9fa", borderRadius: 16, padding: 20, textAlign: "center" }}>
      {!team ? (
        <>
          <p style={{ fontWeight: 700, color: "#1E3A5F", marginBottom: 6 }}>Scegli la tua squadra</p>
          {!allowLeave && (
            <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: 16 }}>
              Attenzione: la scelta è irreversibile!
            </p>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setTeam("Matricole")}
              disabled={busy}
              style={{ flex: 1, padding: 14, borderRadius: 12, fontWeight: 700, background: "#FF6B35", color: "white", border: "none", cursor: "pointer" }}
            >
              🐓 Matricole
            </button>
            <button
              onClick={() => setTeam("Veterani")}
              disabled={busy}
              style={{ flex: 1, padding: 14, borderRadius: 12, fontWeight: 700, background: "#1E3A5F", color: "white", border: "none", cursor: "pointer" }}
            >
              🐄 Veterani
            </button>
          </div>
          {allowLeave && (
            <button
              onClick={handleLeaveTeam}
              disabled={busy}
              style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 12, fontWeight: 700, background: "#6c757d", color: "white", border: "none", cursor: busy ? "not-allowed" : "pointer" }}
            >
              ↩️ Torna a Didatti&amp;Docenti (nessuna squadra)
            </button>
          )}
          <button
            onClick={reset}
            disabled={busy}
            style={{ marginTop: 12, background: "none", border: "none", color: "#999", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
          >
            Annulla
          </button>
        </>
      ) : (
        <>
          <p style={{ fontWeight: 700, color: "#1E3A5F", marginBottom: 6 }}>
            {team === "Matricole" ? "🐓 Matricole" : "🐄 Veterani"}
          </p>
          <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: 14 }}>
            Se vuoi, indica anche la tua sede e la tua classe (facoltativo)
          </p>

          <div style={{ textAlign: "left", marginBottom: 12 }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1E3A5F" }}>Sede</label>
            <select
              value={site}
              onChange={(e) => { setSite(e.target.value); setClasse(""); }}
              style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">Nessuna sede</option>
              {CONFIG_ISCRIZIONE.sedi.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {site && (
            <div style={{ textAlign: "left", marginBottom: 12 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1E3A5F" }}>Classe</label>
              <select
                value={classe}
                onChange={(e) => setClasse(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 4, borderRadius: 8, border: "1px solid #ccc" }}
              >
                <option value="">Nessuna classe specifica</option>
                {classeOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => { setTeam(""); setSite(""); setClasse(""); }}
              disabled={busy}
              style={{ flex: 1, padding: 14, borderRadius: 12, fontWeight: 700, background: "#e0e0e0", color: "#333", border: "none", cursor: busy ? "not-allowed" : "pointer" }}
            >
              Indietro
            </button>
            <button
              onClick={() => submit(team, site || null, classe)}
              disabled={busy}
              style={{ flex: 1, padding: 14, borderRadius: 12, fontWeight: 700, background: team === "Matricole" ? "#FF6B35" : "#1E3A5F", color: "white", border: "none", cursor: busy ? "not-allowed" : "pointer" }}
            >
              {busy ? "..." : "Conferma"}
            </button>
          </div>
          <button
            onClick={reset}
            disabled={busy}
            style={{ marginTop: 12, background: "none", border: "none", color: "#999", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
          >
            Annulla
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard Didatti&Docenti (con pulsante Admin)
// ─────────────────────────────────────────────
function DashboardDidatti({ userName, userId, userRole, onEnrolled }: {
  userName: string;
  userId: string;
  userRole: string;
  onEnrolled: (team: string, year?: string) => void;
}) {
  const [teamScores, setTeamScores] = useState({ Matricole: 0, Veterani: 0 });
  const [remainingCoins, setRemainingCoins] = useState(20);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      let allUsersRaw: { id: string; team: string | null }[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from("users").select("id, team").range(from, from + 999);
        if (!page || page.length === 0) break;
        allUsersRaw.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }

      // Scarica tutti i voti a blocchi da 1000 (Supabase tronca oltre)
      let allVotes: { voter_id: string; recipient_id: string; points: number; voted_at: string }[] = [];
      {
        let voteFrom = 0;
        while (true) {
          const { data: page } = await supabase
            .from("votes")
            .select("voter_id, recipient_id, points, voted_at")
            .range(voteFrom, voteFrom + 999);
          if (!page || page.length === 0) break;
          allVotes.push(...page);
          if (page.length < 1000) break;
          voteFrom += 1000;
        }
      }

      const usersById = new Map(allUsersRaw.map((u) => [u.id, u]));
      const votes = allVotes || [];

      const startOfToday = startOfTodayInRomeISO();
      const votesToday = votes.filter(
        (v) => v.voter_id === userId && v.voted_at && v.voted_at >= startOfToday
      ).length;

      // Recupera i bonus riscattati oggi
      const { data: bonusRedemptions } = await supabase
        .from("bonus_redemptions")
        .select("bonus_id")
        .eq("user_id", userId)
        .gte("redeemed_at", startOfToday);

      const bonusIds = bonusRedemptions?.map(b => b.bonus_id) || [];
      let totalBonus = 0;
      if (bonusIds.length > 0) {
        const { data: bonusData } = await supabase
          .from("bonus_qr")
          .select("amount")
          .in("id", bonusIds);
        totalBonus = bonusData?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
      }

      const remaining = 20 + totalBonus - votesToday;
      setRemainingCoins(Math.max(0, remaining));

      // 🔥 MODIFICA: Punteggi squadra da votes + event_votes
      const pts = { Matricole: 0, Veterani: 0 };
      for (const v of votes) {
        const r = usersById.get(v.recipient_id);
        if (r?.team === "Matricole") pts.Matricole += v.points || 0;
        if (r?.team === "Veterani") pts.Veterani += v.points || 0;
      }

      // Aggiungi i voti da event_votes (QR voto), a blocchi da 1000
      let eventVotes: { team_target: string | null; points: number }[] = [];
      {
        let evFrom = 0;
        while (true) {
          const { data: page } = await supabase
            .from("event_votes")
            .select("team_target, points")
            .range(evFrom, evFrom + 999);
          if (!page || page.length === 0) break;
          eventVotes.push(...page);
          if (page.length < 1000) break;
          evFrom += 1000;
        }
      }

      for (const ev of eventVotes || []) {
        if (ev.team_target === "Matricole") pts.Matricole += ev.points || 1;
        if (ev.team_target === "Veterani") pts.Veterani += ev.points || 1;
      }

      setTeamScores(pts);
      setLoading(false);
    };
    fetchData();
  }, [userId]);

  const isAdmin = userRole === "admin" || userRole === "staff";

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <span style={{ fontSize: "2.2rem" }}>🐓</span>
        <h1 style={{ textAlign: "center", color: "#1E3A5F", fontSize: "1.6rem", margin: 0, lineHeight: 1.2 }}>
          FantAssisi<br />2026
        </h1>
        <span style={{ fontSize: "2.2rem" }}>🐄</span>
      </div>

      {/* 🔥 MODIFICA 2: Pulsante Installa app - visibile su mobile e desktop */}
      <InstallButton />

      <h2 style={{ textAlign: "center", fontSize: "1.1rem", color: "#1E3A5F", marginBottom: 12 }}>Classifica squadre</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, background: "#FF6B35", color: "white", borderRadius: 16, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Matricole</div>
          <div style={{ fontWeight: 800, fontSize: "1.6rem" }}>{teamScores.Matricole}</div>
        </div>
        <div style={{ width: 2, height: 50, background: "#1E3A5F" }} />
        <div style={{ flex: 1, background: "#1E3A5F", color: "white", borderRadius: 16, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Veterani</div>
          <div style={{ fontWeight: 800, fontSize: "1.6rem" }}>{teamScores.Veterani}</div>
        </div>
      </div>

      <p style={{ textAlign: "center", color: "#666", marginBottom: 24 }}>
        Ciao <strong>{userName || "Partecipante"}</strong> · Didatti&amp;Docenti
      </p>

      <h2 style={{ fontSize: "1.1rem", color: "#1E3A5F", marginBottom: 10 }}>Contributi</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <Link href="/ranking/individuali" style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 10, background: "#FFF3B0", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", fontSize: "0.85rem" }}>
          Individuali
        </Link>
        <Link href="/ranking/sedi" style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 10, background: "#FFF3B0", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", fontSize: "0.85rem" }}>
          Per sede
        </Link>
        <Link href="/ranking/classi" style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 10, background: "#FFF3B0", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", fontSize: "0.85rem" }}>
          Per classe
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8 }}>I miei CBT coins</div>
          <div style={{ background: "#FF6B35", color: "white", borderRadius: 16, padding: 14, textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: "1.6rem" }}>{remainingCoins}</div>
            <div style={{ fontSize: "0.7rem" }}>si ricaricano ogni giorno a mezzanotte</div>
          </div>
        </div>
        <div style={{ width: 2, height: 80, background: "#1E3A5F" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>
            Ricarica i CBT Coins
          </div>
          <Link href="/scan" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 70, borderRadius: "50%", background: "#E0B8E8", border: "2px solid #7B1FA2", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", textAlign: "center", fontSize: "0.9rem" }}>
            ⚡ Ricarica
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>
          Vota i colleghi
        </div>
        <Link href="/scan" style={{ display: "block", padding: 16, borderRadius: 60, textAlign: "center", fontWeight: 700, background: "#E0B8E8", border: "2px solid #7B1FA2", color: "#1E1E1E", textDecoration: "none" }}>
          🗳️ Vota
        </Link>
      </div>

      {/* Bottone arruolamento */}
      <TeamSwitchBox currentTeam="Didatti&Docenti" allowLeave={false} onDone={onEnrolled} />

      {/* Pulsante Admin (visibile solo a admin/staff) */}
      {isAdmin && (
        <Link href="/admin" style={{ display: "block", marginTop: 16, padding: 12, borderRadius: 60, textAlign: "center", fontWeight: 600, background: "#4a5568", color: "white", textDecoration: "none", fontSize: "0.85rem" }}>
          ⚙️ Admin
        </Link>
      )}

      <button
        onClick={() => {
          document.cookie = "user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_team=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_class=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_site=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          window.location.href = "/";
        }}
        style={{ marginTop: 24, background: "none", border: "none", color: "#999", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", width: "100%" }}
      >
        Esci
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard normale (Matricole / Veterani)
// ─────────────────────────────────────────────
function DashboardNormale({ userId, userName, myTeam, myClass, userRole, isDidatta, onTeamChange }: {
  userId: string;
  userName: string;
  myTeam: string;
  myClass: string;
  userRole: string;
  isDidatta: boolean;
  onTeamChange: (team: string, year?: string) => void;
}) {
  const [remainingCoins, setRemainingCoins] = useState(20);
  const [myPoints, setMyPoints] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [teamScores, setTeamScores] = useState({ Matricole: 0, Veterani: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      let allUsersRaw: { id: string; team: string | null }[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from("users").select("id, team").range(from, from + 999);
        if (!page || page.length === 0) break;
        allUsersRaw.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }

      // Scarica tutti i voti a blocchi da 1000 (Supabase tronca oltre)
      let allVotes: { voter_id: string; recipient_id: string; points: number; voted_at: string }[] = [];
      {
        let voteFrom = 0;
        while (true) {
          const { data: page } = await supabase
            .from("votes")
            .select("voter_id, recipient_id, points, voted_at")
            .range(voteFrom, voteFrom + 999);
          if (!page || page.length === 0) break;
          allVotes.push(...page);
          if (page.length < 1000) break;
          voteFrom += 1000;
        }
      }

      const usersById = new Map(allUsersRaw.map((u) => [u.id, u]));
      const votes = allVotes || [];

      const startOfToday = startOfTodayInRomeISO();
      const votesToday = votes.filter(
        (v) => v.voter_id === userId && v.voted_at && v.voted_at >= startOfToday
      ).length;

      // Recupera i bonus riscattati oggi
      const { data: bonusRedemptions } = await supabase
        .from("bonus_redemptions")
        .select("bonus_id")
        .eq("user_id", userId)
        .gte("redeemed_at", startOfToday);

      const bonusIds = bonusRedemptions?.map(b => b.bonus_id) || [];
      let totalBonus = 0;
      if (bonusIds.length > 0) {
        const { data: bonusData } = await supabase
          .from("bonus_qr")
          .select("amount")
          .in("id", bonusIds);
        totalBonus = bonusData?.reduce((sum, b) => sum + (b.amount || 0), 0) || 0;
      }

      const remaining = 20 + totalBonus - votesToday;
      setRemainingCoins(Math.max(0, remaining));

      const pointsByUser = new Map<string, number>();
      // 🔥 MODIFICA: Punteggi squadra da votes + event_votes
      const pts = { Matricole: 0, Veterani: 0 };

      for (const v of votes) {
        const r = usersById.get(v.recipient_id);
        const p = v.points || 0;
        if (!r) continue;
        pointsByUser.set(v.recipient_id, (pointsByUser.get(v.recipient_id) || 0) + p);
        if (r.team === "Matricole") pts.Matricole += p;
        if (r.team === "Veterani") pts.Veterani += p;
      }

      // Aggiungi i voti da event_votes (QR voto), a blocchi da 1000
      let eventVotes: { team_target: string | null; points: number }[] = [];
      {
        let evFrom = 0;
        while (true) {
          const { data: page } = await supabase
            .from("event_votes")
            .select("team_target, points")
            .range(evFrom, evFrom + 999);
          if (!page || page.length === 0) break;
          eventVotes.push(...page);
          if (page.length < 1000) break;
          evFrom += 1000;
        }
      }

      for (const ev of eventVotes || []) {
        if (ev.team_target === "Matricole") pts.Matricole += ev.points || 1;
        if (ev.team_target === "Veterani") pts.Veterani += ev.points || 1;
      }

      setTeamScores(pts);
      setMyPoints(pointsByUser.get(userId) || 0);

      const ranking = Array.from(pointsByUser.entries()).sort((a, b) => b[1] - a[1]);
      const myIndex = ranking.findIndex(([uid]) => uid === userId);
      setMyRank(myIndex >= 0 ? myIndex + 1 : null);

      setLoading(false);
    };
    fetchData();
  }, [userId]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;

  const isAdmin = userRole === "admin" || userRole === "staff";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <span style={{ fontSize: "2.2rem" }}>🐓</span>
        <h1 style={{ textAlign: "center", color: "#1E3A5F", fontSize: "1.6rem", margin: 0, lineHeight: 1.2 }}>
          FantAssisi<br />2026
        </h1>
        <span style={{ fontSize: "2.2rem" }}>🐄</span>
      </div>

      {/* 🔥 MODIFICA 3: Pulsante Installa app - visibile su mobile e desktop */}
      <InstallButton />

      <h2 style={{ textAlign: "center", fontSize: "1.1rem", color: "#1E3A5F", marginBottom: 12 }}>Classifica squadre</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ flex: 1, background: "#FF6B35", color: "white", borderRadius: 16, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Matricole</div>
          <div style={{ fontWeight: 800, fontSize: "1.6rem" }}>{teamScores.Matricole}</div>
        </div>
        <div style={{ width: 2, height: 50, background: "#1E3A5F" }} />
        <div style={{ flex: 1, background: "#1E3A5F", color: "white", borderRadius: 16, padding: "14px 8px", textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Veterani</div>
          <div style={{ fontWeight: 800, fontSize: "1.6rem" }}>{teamScores.Veterani}</div>
        </div>
      </div>

      <p style={{ textAlign: "center", color: "#666", marginTop: -20, marginBottom: 24 }}>
        Ciao <strong>{userName || "Partecipante"}</strong> · {myTeam || "Team non assegnato"}
        {myClass && ` · ${CONFIG_ISCRIZIONE.anni.find((a) => a.value === myClass)?.label || myClass}`}
      </p>

      <h2 style={{ fontSize: "1.1rem", color: "#1E3A5F", marginBottom: 10 }}>Contributi</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <Link href="/ranking/individuali" style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 10, background: "#FFF3B0", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", fontSize: "0.85rem" }}>Individuali</Link>
        <Link href="/ranking/sedi" style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 10, background: "#FFF3B0", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", fontSize: "0.85rem" }}>Per sede</Link>
        <Link href="/ranking/classi" style={{ flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 10, background: "#FFF3B0", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", fontSize: "0.85rem" }}>Per classe</Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8 }}>Il mio punteggio</div>
          <div style={{ background: "#FF6B35", color: "white", borderRadius: 16, padding: 14, textAlign: "center" }}>
            <div style={{ fontWeight: 700 }}>{userName || "—"}</div>
            <div style={{ fontSize: "0.85rem" }}>{myPoints} punti</div>
            <div style={{ fontSize: "0.85rem" }}>
              {myRank ? `${myRank}° posto in classifica` : "Nessun voto ancora"}
            </div>
          </div>
        </div>
        <div style={{ width: 2, height: 80, background: "#1E3A5F" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>
            Mostra il QR per ricevere voti
          </div>
          <Link href="/myqr" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 70, borderRadius: "50%", background: "#A8D8A8", border: "2px solid #2E7D32", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", textAlign: "center", fontSize: "0.9rem" }}>
            Il mio QR
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8 }}>I miei CBT coins</div>
          <div style={{ background: "#FF6B35", color: "white", borderRadius: 16, padding: 14, textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: "1.6rem" }}>{remainingCoins}</div>
            <div style={{ fontSize: "0.7rem" }}>si ricaricano ogni giorno a mezzanotte</div>
          </div>
        </div>
        <div style={{ width: 2, height: 80, background: "#1E3A5F" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>
            Ricarica i CBT Coins
          </div>
          <Link href="/scan" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 70, borderRadius: "50%", background: "#E0B8E8", border: "2px solid #7B1FA2", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", textAlign: "center", fontSize: "0.9rem" }}>
            ⚡ Ricarica
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>
          Vota i colleghi
        </div>
        <Link href="/scan" style={{ display: "block", padding: 16, borderRadius: 60, textAlign: "center", fontWeight: 700, background: "#E0B8E8", border: "2px solid #7B1FA2", color: "#1E1E1E", textDecoration: "none" }}>
          🗳️ Vota
        </Link>
      </div>

      {/* Solo chi è (o è stato) Didatti&Docenti può cambiare squadra o uscirne */}
      {isDidatta && (
        <TeamSwitchBox currentTeam={myTeam} allowLeave onDone={onTeamChange} />
      )}

      {isAdmin && (
        <Link href="/admin" style={{ display: "block", marginTop: 16, padding: 12, borderRadius: 60, textAlign: "center", fontWeight: 600, background: "#4a5568", color: "white", textDecoration: "none", fontSize: "0.85rem" }}>
          ⚙️ Admin
        </Link>
      )}

      <button
        onClick={() => {
          document.cookie = "user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_team=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_class=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_site=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          window.location.href = "/";
        }}
        style={{ marginTop: 24, background: "none", border: "none", color: "#999", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", width: "100%" }}
      >
        Esci
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Entry point — sceglie quale dashboard mostrare
// ─────────────────────────────────────────────
export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [myTeam, setMyTeam] = useState("");
  const [myClass, setMyClass] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isDidatta, setIsDidatta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    const init = async () => {
      const id = getCookie("user_id");
      const role = getCookie("user_role");

      if (!id) {
        setNoAccess(true);
        setLoading(false);
        return;
      }

      setUserId(id);
      setUserRole(role || "");

      const { data: me } = await supabase
        .from("users")
        .select("first_name, last_name, team, year, is_didatta")
        .eq("id", id)
        .single();

      if (me) {
        setUserName(`${me.first_name || ""} ${me.last_name || ""}`.trim());
        setMyTeam(me.team || "");
        setMyClass(me.year || "");
        setIsDidatta(!!me.is_didatta);
      }

      setLoading(false);
    };
    init();
  }, []);

  if (noAccess) {
    return (
      <div style={{ textAlign: "center", padding: 40, maxWidth: 500, margin: "0 auto" }}>
        <h2 style={{ color: "#1E3A5F" }}>Accesso non valido</h2>
        <p style={{ color: "#666" }}>Usa il link personale che ti è stato inviato per entrare nell'app.</p>
      </div>
    );
  }

  if (loading || !userId) {
    return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  }

  const handleTeamChange = (team: string, year?: string) => {
    setMyTeam(team);
    setMyClass(year || "");
    setIsDidatta(true); // una volta ottenuta la possibilità di scegliere, resta per sempre
  };

  // Mostra DashboardDidatti per chiunque NON sia in una squadra
  // (Didatti&Docenti, null, "", o qualsiasi altro valore)
  if (myTeam !== "Matricole" && myTeam !== "Veterani") {
    return (
      <DashboardDidatti
        userName={userName}
        userId={userId}
        userRole={userRole}
        onEnrolled={handleTeamChange}
      />
    );
  }

  return (
    <DashboardNormale
      userId={userId}
      userName={userName}
      myTeam={myTeam}
      myClass={myClass}
      userRole={userRole}
      isDidatta={isDidatta}
      onTeamChange={handleTeamChange}
    />
  );
}