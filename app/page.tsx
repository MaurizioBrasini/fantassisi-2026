"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [myTeam, setMyTeam] = useState("");
  const [myClass, setMyClass] = useState("");
  const [remainingCoins, setRemainingCoins] = useState(20);
  const [myPoints, setMyPoints] = useState(0);
  const [teamScores, setTeamScores] = useState({ Matricole: 0, Veterani: 0 });
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const id = getCookie("user_id");
      const team = getCookie("user_team");

      if (!id) {
        setNoAccess(true);
        setLoading(false);
        return;
      }

      setUserId(id);
      setMyTeam(team || "");

      // Recupera nome e classe dell'utente
      const { data: userRow } = await supabase
        .from("users")
        .select("first_name, last_name, class, team")
        .eq("id", id)
        .single();

      if (userRow) {
        setUserName(`${userRow.first_name || ""} ${userRow.last_name || ""}`.trim());
        setMyClass(userRow.class || "");
        if (userRow.team) setMyTeam(userRow.team);
      }

      // Voti fatti oggi (crediti rimanenti)
      const today = new Date().toISOString().split("T")[0];
      const { data: todayVotes, error: votesError } = await supabase
        .from("votes")
        .select("id", { count: "exact" })
        .eq("voter_id", id)
        .gte("voted_at", today);

      if (!votesError) {
        setRemainingCoins(20 - (todayVotes?.length || 0));
      }

      // Punti ricevuti
      const { data: received, error: receivedError } = await supabase
        .from("votes")
        .select("points")
        .eq("recipient_id", id);

      if (!receivedError) {
        setMyPoints(received?.reduce((sum, v) => sum + (v.points || 0), 0) || 0);
      }

      // Punteggi squadre
      const { data: allVotes, error: allVotesError } = await supabase
        .from("votes")
        .select("points, recipient_id");

      if (!allVotesError && allVotes) {
        const teams = { Matricole: 0, Veterani: 0 };
        for (const vote of allVotes) {
          const { data: recipient } = await supabase
            .from("users")
            .select("team")
            .eq("id", vote.recipient_id)
            .single();
          if (recipient?.team === "Matricole") {
            teams.Matricole += vote.points || 0;
          } else if (recipient?.team === "Veterani") {
            teams.Veterani += vote.points || 0;
          }
        }
        setTeamScores(teams);
      }

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
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        Caricamento...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
      <h1 style={{ color: "#1E3A5F", fontSize: "1.5rem", marginBottom: 4 }}>
        Ciao {userName || "Partecipante"} 👋
      </h1>
      <p style={{ color: "#666", marginBottom: 20 }}>
        Team: <strong>{myTeam || "Non assegnato"}</strong>
        {myClass && ` • Classe: ${myClass}`}
      </p>

      {/* Punti e crediti */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "#f0f4f8",
            borderRadius: 12,
            padding: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#1E3A5F" }}>
            {myPoints}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#666" }}>Punti ricevuti</div>
        </div>
        <div
          style={{
            background: "#f0f4f8",
            borderRadius: 12,
            padding: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "2rem", fontWeight: 700, color: "#FF6B35" }}>
            {remainingCoins}
          </div>
          <div style={{ fontSize: "0.8rem", color: "#666" }}>CBTcoin oggi</div>
        </div>
      </div>

      {/* Classifica squadre */}
      <div
        style={{
          background: "#1E3A5F",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          color: "white",
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", fontSize: "1rem" }}>
          🏆 Classifica squadre
        </h3>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Matricole: <strong>{teamScores.Matricole}</strong></span>
          <span>Veterani: <strong>{teamScores.Veterani}</strong></span>
        </div>
      </div>

      {/* Pulsanti azioni */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link
          href="/scan"
          style={{
            display: "block",
            padding: 14,
            borderRadius: 60,
            textAlign: "center",
            fontWeight: 600,
            background: "#FF6B35",
            color: "white",
            textDecoration: "none",
          }}
        >
          📷 Scansiona QR
        </Link>
        <Link
          href="/myqr"
          style={{
            display: "block",
            padding: 14,
            borderRadius: 60,
            textAlign: "center",
            fontWeight: 600,
            background: "#1E3A5F",
            color: "white",
            textDecoration: "none",
          }}
        >
          📱 Il mio QR
        </Link>
        <Link
          href="/admin"
          style={{
            display: "block",
            padding: 14,
            borderRadius: 60,
            textAlign: "center",
            fontWeight: 600,
            background: "#4a5568",
            color: "white",
            textDecoration: "none",
            fontSize: "0.9rem",
          }}
        >
          ⚙️ Admin
        </Link>
      </div>

      {/* Logout */}
      <button
        onClick={() => {
          document.cookie = "user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_team=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          window.location.href = "/";
        }}
        style={{
          marginTop: 24,
          background: "none",
          border: "none",
          color: "#999",
          fontSize: "0.8rem",
          cursor: "pointer",
          textDecoration: "underline",
          width: "100%",
        }}
      >
        Esci
      </button>
    </div>
  );
}
