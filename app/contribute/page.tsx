"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ContributePage() {
  const router = useRouter();
  const [myTeam, setMyTeam] = useState("");
  const [contributors, setContributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }
      const team = user.user_metadata?.team || "";
      setMyTeam(team);

      const { data: users } = await supabase
        .from("users")
        .select("id, first_name, last_name, school, site")
        .eq("team", team)
        .eq("role", "student");

      if (!users) { setLoading(false); return; }

      const withPoints = await Promise.all(
        users.map(async (u) => {
          const { data: votes } = await supabase
            .from("votes")
            .select("points")
            .eq("recipient_id", u.id);
          const total = votes?.reduce((sum, v) => sum + v.points, 0) || 0;
          return { ...u, points: total };
        })
      );

      setContributors(withPoints.sort((a, b) => b.points - a.points));
      setLoading(false);
    };

    fetchData();
  }, [router]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20 }}>
      <button onClick={() => router.push("/")} style={{ color: "#FF6B35", background: "none", border: "none", fontSize: "1rem", marginBottom: 16 }}>
        ← Torna alla dashboard
      </button>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>🏆 Contributi squadra {myTeam}</h2>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {contributors.map((c, idx) => (
          <li key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 8px", borderBottom: "1px solid #eee" }}>
            <span>{idx+1}. {c.first_name} {c.last_name} ({c.school})</span>
            <span style={{ fontWeight: "bold" }}>{c.points} pt</span>
          </li>
        ))}
      </ul>
    </div>
  );
}