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

      const [{ data: allUsers }, { data: allVotes }] = await Promise.all([
        supabase.from("users").select("id, first_name, last_name, team, site, year"),
        supabase.from("votes").select("voter_id, recipient_id, points, voted_at"),
      ]);

      const usersById = new Map((allUsers || []).map((u) => [u.id, u]));
      const me = usersById.get(id);

      if (me) {
        setUserName(`${me.first_name || ""} ${me.last_name || ""}`.trim());
        setMyTeam(me.team || "");
        setMyClass(me.year || "");
      }

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

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <span style={{ fontSize: "2.2rem" }}>🐓</span>
        <h1 style={{ textAlign: "center", color: "#1E3A5F",
