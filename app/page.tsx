"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRomeDateTime, getCachedDashboardScores, setCachedDashboardScores } from "@/lib/utils";
import { CONFIG_ISCRIZIONE, yearLabel } from "@/lib/config";
import { TEAM_COLORS } from "@/lib/teamColors";
import { RoosterIcon, CowIcon, TeamIcon } from "@/components/TeamIcons";
import GameHeader from "@/components/GameHeader";
import NoAccess from "@/components/NoAccess";
import AnteprimaQr from "@/components/AnteprimaQr";
import PrizeBanner from "@/components/PrizeBanner";
import { getCookie, setCookie, logout } from "@/lib/clientCookies";

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
      setCookie("user_team", targetTeam);
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
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setTeam("Matricole")}
              disabled={busy}
              style={{ flex: 1, padding: 14, borderRadius: 12, fontWeight: 700, background: TEAM_COLORS.Matricole, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <RoosterIcon size={22} color="white" /> Matricole
            </button>
            <button
              onClick={() => setTeam("Veterani")}
              disabled={busy}
              style={{ flex: 1, padding: 14, borderRadius: 12, fontWeight: 700, background: TEAM_COLORS.Veterani, color: "white", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <CowIcon size={22} color="white" /> Veterani
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
          <p style={{ fontWeight: 700, color: "#1E3A5F", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {team === "Matricole" ? <RoosterIcon size={20} /> : <CowIcon size={20} />} {team}
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
              style={{ flex: 1, padding: 14, borderRadius: 12, fontWeight: 700, background: team === "Matricole" ? TEAM_COLORS.Matricole : TEAM_COLORS.Veterani, color: "white", border: "none", cursor: busy ? "not-allowed" : "pointer" }}
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

// Mostrato al posto della dashboard se i punteggi non si caricano: meglio dirlo che mostrare zeri.
function LoadError() {
  return (
    <div style={{ textAlign: "center", padding: 40, maxWidth: 480, margin: "0 auto" }}>
      <p style={{ color: "#666" }}>Non riesco a caricare i punteggi. Controlla la connessione e riprova.</p>
      <button
        onClick={() => window.location.reload()}
        style={{ padding: "12px 24px", background: "#FF6B35", color: "white", border: "none", borderRadius: 8, fontWeight: "bold", fontSize: 16 }}
      >
        Riprova
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Parti condivise dalle due dashboard
// ─────────────────────────────────────────────
type DashboardData = {
  teamScores: { Matricole: number; Veterani: number };
  remainingCoins: number;
  myPoints: number;
  myRank: number | null;
};

// Punteggi, coins e posizione arrivano dal server (/api/standings), con una cache di pochi secondi
// nel telefono per i rimontaggi ravvicinati (tornare da /scan o dalle classifiche).
function useDashboardData(userId: string) {
  const [data, setData] = useState<DashboardData>({
    teamScores: { Matricole: 0, Veterani: 0 },
    remainingCoins: 20,
    myPoints: 0,
    myRank: null,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const load = async () => {
      const cached = getCachedDashboardScores(userId);
      if (cached) {
        setData({
          teamScores: cached.teamScores,
          remainingCoins: cached.remainingCoins,
          myPoints: cached.myPoints || 0,
          myRank: cached.myRank ?? null,
        });
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/standings?view=dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        setData({ teamScores: d.teams, remainingCoins: d.remainingCoins, myPoints: d.myPoints, myRank: d.myRank });
        setCachedDashboardScores(userId, {
          remainingCoins: d.remainingCoins,
          teamScores: d.teams,
          myPoints: d.myPoints,
          myRank: d.myRank,
        });
      } catch {
        setLoadError(true);
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  return { ...data, loading, loadError };
}

const PAGE_STYLE = { maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" } as const;
const ACTION_LINK_STYLE = { display: "flex", alignItems: "center", justifyContent: "center", height: 70, borderRadius: "50%", background: "#E0B8E8", border: "2px solid #7B1FA2", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", textAlign: "center", fontSize: "0.9rem" } as const;
const CONTRIBUTION_LINK_STYLE = { flex: 1, textAlign: "center", padding: "12px 6px", borderRadius: 10, background: "#FFF3B0", color: "#1E1E1E", fontWeight: 700, textDecoration: "none", fontSize: "0.85rem" } as const;

function TeamScoreboard({ teamScores, marginBottom }: { teamScores: { Matricole: number; Veterani: number }; marginBottom: number }) {
  const side = (team: "Matricole" | "Veterani") => (
    <div style={{ flex: 1, background: TEAM_COLORS[team], color: "white", borderRadius: 16, padding: "14px 8px", textAlign: "center" }}>
      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{team}</div>
      <div style={{ fontWeight: 800, fontSize: "1.6rem" }}>{teamScores[team]}</div>
    </div>
  );
  return (
    <>
      <h2 style={{ textAlign: "center", fontSize: "1.1rem", color: "#1E3A5F", marginBottom: 12 }}>Classifica squadre</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom }}>
        {side("Matricole")}
        <div style={{ width: 2, height: 50, background: "#1E3A5F" }} />
        {side("Veterani")}
      </div>
    </>
  );
}

function ContributionLinks() {
  return (
    <>
      <h2 style={{ fontSize: "1.1rem", color: "#1E3A5F", marginBottom: 10 }}>Contributi</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <Link href="/ranking/individuali" style={CONTRIBUTION_LINK_STYLE}>Individuali</Link>
        <Link href="/ranking/sedi" style={CONTRIBUTION_LINK_STYLE}>Per sede</Link>
        <Link href="/ranking/classi" style={CONTRIBUTION_LINK_STYLE}>Per classe</Link>
      </div>
    </>
  );
}

function CoinsAndRecharge({ remainingCoins }: { remainingCoins: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8 }}>I miei CBT coins</div>
        <div style={{ background: "#FF6B35", color: "white", borderRadius: 16, padding: 14, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "1.6rem" }}>{remainingCoins}</div>
          <div style={{ fontSize: "0.7rem" }}>ogni giorno ne ricevi 20, quelli non usati restano</div>
        </div>
      </div>
      <div style={{ width: 2, height: 80, background: "#1E3A5F" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>Ricarica i CBT Coins</div>
        <Link href="/scan?mode=ricarica" style={ACTION_LINK_STYLE}>⚡ Ricarica</Link>
      </div>
    </div>
  );
}

function VoteButton() {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>Vota i colleghi</div>
      <Link href="/scan" style={{ display: "block", padding: 16, borderRadius: 60, textAlign: "center", fontWeight: 700, background: "#E0B8E8", border: "2px solid #7B1FA2", color: "#1E1E1E", textDecoration: "none" }}>
        🗳️ Vota
      </Link>
    </div>
  );
}

// A voto aperto i QR di squadra e classe per le slides restano disponibili (i relatori li proiettano
// durante il congresso), ma si caricano solo quando li si apre: niente peso in più sulla dashboard.
function SlidesQrToggle() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", padding: 12, borderRadius: 60, border: "2px solid #1E3A5F", background: "white", color: "#1E3A5F", fontWeight: 700, cursor: "pointer" }}
      >
        {open ? "▲ Chiudi i QR per le slides" : "📊 QR della squadra e della classe (per le slides)"}
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          <AnteprimaQr opensAtLabel="" />
        </div>
      )}
    </div>
  );
}

function AdminAndLogout({ isAdmin, adminHref }: { isAdmin: boolean; adminHref: string }) {
  return (
    <>
      {/* Pulsante Admin (visibile solo a admin/staff) */}
      {isAdmin && (
        <Link href={adminHref} style={{ display: "block", marginTop: 16, padding: 12, borderRadius: 60, textAlign: "center", fontWeight: 600, background: "#4a5568", color: "white", textDecoration: "none", fontSize: "0.85rem" }}>
          {adminHref === "/staff" ? "🛠️ Staff" : "⚙️ Admin"}
        </Link>
      )}
      <button
        onClick={logout}
        style={{ marginTop: 24, background: "none", border: "none", color: "#999", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", width: "100%" }}
      >
        Esci
      </button>
    </>
  );
}

// ─────────────────────────────────────────────
// Dashboard Didatti&Docenti (con pulsante Admin)
// ─────────────────────────────────────────────
function DashboardDidatti({ userName, userId, userRole, votingOpen, opensAtLabel, onEnrolled }: {
  userName: string;
  userId: string;
  userRole: string;
  votingOpen: boolean;
  opensAtLabel: string;
  onEnrolled: (team: string, year?: string) => void;
}) {
  const { teamScores, remainingCoins, loading, loadError } = useDashboardData(userId);
  const isAdmin = userRole === "admin" || userRole === "staff";

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  if (loadError) return <LoadError />;

  return (
    <div style={PAGE_STYLE}>
      <GameHeader badge={votingOpen ? undefined : "Anteprima"} />
      <TeamScoreboard teamScores={teamScores} marginBottom={20} />

      <p style={{ textAlign: "center", color: "#666", marginBottom: 24 }}>
        Ciao <strong>{userName || "Partecipante"}</strong> · Didatti&amp;Docenti
      </p>

      <ContributionLinks />
      <CoinsAndRecharge remainingCoins={remainingCoins} />
      {votingOpen ? (
        <VoteButton />
      ) : (
        <p style={{ textAlign: "center", color: "#666", fontSize: "0.9rem" }}>{opensAtLabel.charAt(0).toUpperCase() + opensAtLabel.slice(1)} inizia il gioco vero e proprio: potrai votare e farti votare!</p>
      )}

      {/* Bottone arruolamento */}
      <TeamSwitchBox currentTeam="Didatti&Docenti" allowLeave={false} onDone={onEnrolled} />

      <AdminAndLogout isAdmin={isAdmin} adminHref={userRole === "staff" ? "/staff" : "/admin"} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard normale (Matricole / Veterani)
// ─────────────────────────────────────────────
function DashboardNormale({ userId, userName, myTeam, myClass, userRole, isDidatta, votingOpen, opensAtLabel, onTeamChange }: {
  userId: string;
  userName: string;
  myTeam: string;
  myClass: string;
  userRole: string;
  isDidatta: boolean;
  votingOpen: boolean;
  opensAtLabel: string;
  onTeamChange: (team: string, year?: string) => void;
}) {
  const { teamScores, remainingCoins, myPoints, myRank, loading, loadError } = useDashboardData(userId);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  if (loadError) return <LoadError />;

  const isAdmin = userRole === "admin" || userRole === "staff";

  return (
    <div style={PAGE_STYLE}>
      <GameHeader badge={votingOpen ? undefined : "Anteprima"} />
      <TeamScoreboard teamScores={teamScores} marginBottom={28} />

      <p style={{ textAlign: "center", color: "#666", marginTop: -20, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        Ciao <strong>{userName || "Partecipante"}</strong> · <TeamIcon team={myTeam} size={16} /> {myTeam || "Team non assegnato"}
        {myClass && ` · ${yearLabel(myClass)}`}
      </p>

      <ContributionLinks />

      {/* Il proprio punteggio si vede sempre (in Anteprima arrivano già i premi palesi); il QR personale
          per farsi votare solo a voto aperto. */}
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
        {votingOpen && (
          <>
            <div style={{ width: 2, height: 80, background: "#1E3A5F" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>
                Mostra il QR per ricevere voti
              </div>
              <Link href="/myqr" style={{ ...ACTION_LINK_STYLE, background: "#A8D8A8", border: "2px solid #2E7D32" }}>
                Il mio QR
              </Link>
            </div>
          </>
        )}
      </div>

      {!votingOpen && <AnteprimaQr opensAtLabel={opensAtLabel} />}

      <CoinsAndRecharge remainingCoins={remainingCoins} />
      {votingOpen && <VoteButton />}
      {votingOpen && <SlidesQrToggle />}

      {/* Solo chi è (o è stato) Didatti&Docenti può cambiare squadra o uscirne */}
      {isDidatta && (
        <TeamSwitchBox currentTeam={myTeam} allowLeave onDone={onTeamChange} />
      )}

      <AdminAndLogout isAdmin={isAdmin} adminHref={userRole === "staff" ? "/staff" : "/admin"} />
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
  const [votingOpen, setVotingOpen] = useState(true);
  const [opensAtLabel, setOpensAtLabel] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

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

      // Senza rete si mostra "riprova" (prima restava "Caricamento..." per sempre). Se il server non
      // riconosce più la sessione (cookie scaduto o utente rimosso) si chiede di rientrare, invece di
      // mostrare una dashboard vuota.
      let meRes: Response;
      try {
        meRes = await fetch("/api/me", { cache: "no-store" });
      } catch {
        setLoadFailed(true);
        setLoading(false);
        return;
      }
      if (meRes.status === 401 || meRes.status === 404) {
        setNoAccess(true);
        setLoading(false);
        return;
      }
      const me = meRes.ok ? await meRes.json().catch(() => null) : null;
      if (!me) {
        setLoadFailed(true);
        setLoading(false);
        return;
      }

      setUserName(`${me.first_name || ""} ${me.last_name || ""}`.trim());
      setMyTeam(me.team || "");
      setMyClass(me.year || "");
      setIsDidatta(!!me.is_didatta);
      setVotingOpen(me.voting_open !== false);
      if (me.voting_opens_at) {
        setOpensAtLabel(
          formatRomeDateTime(me.voting_opens_at)
        );
      }

      setLoading(false);
    };
    init();
  }, []);

  // Mentre il voto è chiuso si controlla ogni 30 secondi se si è aperto (a pagina visibile): chi ha
  // l'app aperta allo scoccare dell'apertura vede subito "Vota" senza dover ricaricare.
  useEffect(() => {
    if (votingOpen) return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/fase", { cache: "no-store" });
        if (res.ok && (await res.json()).open === true) setVotingOpen(true);
      } catch { /* niente rete: si riprova al prossimo giro */ }
    };
    const timer = setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [votingOpen]);

  if (noAccess) return <NoAccess />;
  if (loadFailed) return <LoadError />;

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
      <>
        <PrizeBanner />
        <DashboardDidatti
          userName={userName}
          userId={userId}
          userRole={userRole}
          votingOpen={votingOpen}
          opensAtLabel={opensAtLabel}
          onEnrolled={handleTeamChange}
        />
      </>
    );
  }

  return (
    <>
    <PrizeBanner />
    <DashboardNormale
      userId={userId}
      userName={userName}
      myTeam={myTeam}
      myClass={myClass}
      userRole={userRole}
      isDidatta={isDidatta}
      votingOpen={votingOpen}
      opensAtLabel={opensAtLabel}
      onTeamChange={handleTeamChange}
    />
    </>
  );
}