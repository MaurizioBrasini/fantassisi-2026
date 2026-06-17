"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [remainingCoins, setRemainingCoins] = useState(20);
  const [myPoints, setMyPoints] = useState(0);
  const [myClass, setMyClass] = useState("");
  const [myTeam, setMyTeam] = useState("");
  const [teamScores, setTeamScores] = useState({ Matricole: 0, Veterani: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUser(user);
      setMyTeam(user.user_metadata?.team || "");
      setMyClass(user.user_metadata?.class || "");

      const today = new Date().toISOString().split("T")[0];
      const { data: todayVotes } = await supabase
        .from("votes")
        .select("id", { count: "exact" })
        .eq("voter_id", user.id)
        .gte("voted_at", today);
      const dailyLimit = 20;
      setRemainingCoins(dailyLimit - (todayVotes?.length || 0));

      const { data: received } = await supabase
        .from("votes")
        .select("points")
        .eq("recipient_id", user.id);
      const total = received?.reduce((sum, v) => sum + v.points, 0) || 0;
      setMyPoints(total);

      // Calcolo punteggi squadre (semplificato)
      const { data: matricoleIds } = await supabase
        .from("users")
        .select("id")
        .eq("team", "Matricole");
      const { data: veteraniIds } = await supabase
        .from("users")
        .select("id")
        .eq("team", "Veterani");

      if (matricoleIds && matricoleIds.length > 0) {
        const { data: mPoints } = await supabase
          .from("votes")
          .select("points")
          .in("recipient_id", matricoleIds.map(u => u.id));
        setTeamScores(prev => ({
          ...prev,
          Matricole: mPoints?.reduce((sum, v) => sum + v.points, 0) || 0
        }));
      }
      if (veteraniIds && veteraniIds.length > 0) {
        const { data: vPoints } = await supabase
          .from("votes")
          .select("points")
          .in("recipient_id", veteraniIds.map(u => u.id));
        setTeamScores(prev => ({
          ...prev,
          Veterani: vPoints?.reduce((sum, v) => sum + v.points, 0) || 0
        }));
      }

      setLoading(false);
    };

    fetchData();
  }, [router]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;

  const percent = (remainingCoins / 20) * 100;

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #FF6B35", paddingBottom: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: "1.5rem", background: "linear-gradient(135deg, #FF6B35, #1E3A5F)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>FantAssisi 2026</h1>
        <span style={{ background: "#1E3A5F", color: "white", padding: "6px 12px", borderRadius: 30, fontSize: "0.75rem" }}>🔔 3</span>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, background: "#f0f0f0", borderRadius: 24, padding: 16, textAlign: "center", borderBottom: "4px solid #FF6B35" }}>
          <div>🏆 Matricole</div>
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>{teamScores.Matricole}</div>
        </div>
        <div style={{ flex: 1, background: "#f0f0f0", borderRadius: 24, padding: 16, textAlign: "center", borderBottom: "4px solid #1E3A5F" }}>
          <div>🏆 Veterani</div>
          <div style={{ fontSize: "2rem", fontWeight: 800 }}>{teamScores.Veterani}</div>
        </div>
      </div>

      <div style={{ background: "#f8f9fa", borderRadius: 24, padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>👤 I MIEI VOTI (ricevuti)</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span>★ Punti personali</span>
          <span style={{ fontWeight: 700 }}>{myPoints}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>📚 Classe ({myClass})</span>
          <span style={{ fontWeight: 700 }}>—</span>
        </div>
      </div>

      <div style={{ background: "#f8f9fa", borderRadius: 24, padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>💎 I MIEI CBTCOIN</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span>Oggi ne hai</span>
          <span style={{ fontWeight: 700 }}>{remainingCoins} / 20</span>
        </div>
        <div style={{ background: "#e0e0e0", borderRadius: 20, height: 8, overflow: "hidden" }}>
          <div style={{ background: "#FF6B35", height: "100%", width: `${percent}%`, borderRadius: 20 }}></div>
        </div>
      </div>

      <button onClick={() => router.push("/myqr")} style={{ width: "100%", padding: 14, borderRadius: 60, fontWeight: 600, background: "white", border: "1px solid #1E3A5F", color: "#1E3A5F", marginBottom: 8 }}>
        🆔 MOSTRA IL MIO QR
      </button>
      <button onClick={() => router.push("/scan")} style={{ width: "100%", padding: 14, borderRadius: 60, fontWeight: 600, background: "#1E3A5F", color: "white", border: "none", marginBottom: 8 }}>
        ⚡ RICARICA (scansiona QR bonus)
      </button>
      <button onClick={() => router.push("/scan")} style={{ width: "100%", padding: 14, borderRadius: 60, fontWeight: 600, background: "#FF6B35", color: "white", border: "none" }}>
        📷 VOTA (scansiona QR collega)
      </button>

      <div style={{ marginTop: 20, fontSize: "0.7rem", color: "#999", textAlign: "center" }}>
        FantAssisi 2026 · Forum di Assisi
      </div>
    </div>
  );
}