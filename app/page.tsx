"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function Dashboard() {
  const [userName, setUserName] = useState("");
  const [myTeam, setMyTeam] = useState("");
  const [myClass, setMyClass] = useState("");
  const [userRole, setUserRole] = useState("");
  const [remainingCoins, setRemainingCoins] = useState(20);
  const [myPoints, setMyPoints] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [teamScores, setTeamScores] = useState({ Matricole: 0, Veterani: 0 });
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const id = getCookie("user_id");
      const role = getCookie("user_role");

      if (!id) {
        setNoAccess(true);
        setLoading(false);
        return;
      }
      setUserRole(role || "");

      // Query diretta per l'utente corrente
      const { data: me } = await supabase
        .from("users")
        .select("first_name, last_name, team, year")
        .eq("id", id)
        .single();

      if (me) {
        setUserName(`${me.first_name || ""} ${me.last_name || ""}`.trim());
        setMyTeam(me.team || "");
        setMyClass(me.year || "");
      }

      // Supabase limita ogni risposta a 1000 righe — scarica tutti gli utenti
      // a blocchi per non perdere nessuno nel calcolo dei punteggi.
      let allUsersRaw: { id: string; team: string | null }[] = [];
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from("users")
          .select("id, team")
          .range(from, from + 999);
        if (!page || page.length === 0) break;
        allUsersRaw.push(...page);
        if (page.length < 1000) break;
        from += 1000;
      }

      const { data: allVotes } = await supabase
        .from("votes")
        .select("voter_id, recipient_id, points, voted_at");

      const usersById = new Map(allUsersRaw.map((u) => [u.id, u]));
      const votes = allVotes || [];

      const today = new Date().toISOString().split("T")[0];
      const votesToday = votes.filter(
        (v) => v.voter_id === id && v.voted_at?.startsWith(today)
      ).length;
      setRemainingCoins(Math.max(0, 20 - votesToday));

      const pointsByUser = new Map<string, number>();
      const pointsByTeam = { Matricole: 0, Veterani: 0 };

      for (const v of votes) {
        const recipient = usersById.get(v.recipient_id);
        const pts = v.points || 0;
        if (!recipient) continue;

        pointsByUser.set(v.recipient_id, (pointsByUser.get(v.recipient_id) || 0) + pts);

        if (recipient.team === "Matricole" || recipient.team === "Veterani") {
          pointsByTeam[recipient.team] += pts;
        }
      }

      setTeamScores(pointsByTeam);
      setMyPoints(pointsByUser.get(id) || 0);

      const individualRanking = Array.from(pointsByUser.entries()).sort((a, b) => b[1] - a[1]);
      const myIndex = individualRanking.findIndex(([uid]) => uid === id);
      setMyRank(myIndex >= 0 ? myIndex + 1 : null);

      setLoading(false);
    };

    fetchData();
  }, []);

  if (noAccess) {
    return (
      <div style={{ textAlign: "center", padding: 40, maxWidth: 500, margin: "0 auto" }}>
        <h2 style={{ color: "#1E3A5F" }}>Accesso non valido</h2>
        <p style={{ color: "#666" }}>
          Usa il link personale che ti è stato inviato per entrare nell'app.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  }

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
        {myClass && ` · ${myClass}`}
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
            Scan QR
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 8, textAlign: "center" }}>
          Vota i colleghi
        </div>
        <Link href="/scan" style={{ display: "block", padding: 16, borderRadius: 60, textAlign: "center", fontWeight: 700, background: "#E0B8E8", border: "2px solid #7B1FA2", color: "#1E1E1E", textDecoration: "none" }}>
          📷 Scan QR
        </Link>
      </div>

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
