"use client";

import { useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const startScan = () => {
    setScanning(true);
    setError("");
    const scanner = new Html5Qrcode("reader");

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        scanner.stop();
        scanner.clear();
        setScanning(false);

        // EVENTO
        if (decodedText.startsWith("EVENT:")) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { alert("Devi essere loggato"); router.push("/"); return; }

          const { data: event } = await supabase
            .from("votable_events")
            .select("*")
            .eq("qr_code", decodedText)
            .single();
          if (!event) { alert("Evento non trovato"); router.push("/"); return; }

          const now = new Date();
          const start = new Date(event.start_time);
          const end = new Date(event.end_time);
          if (now < start || now > end) {
            alert("Evento non attivo in questo momento");
            router.push("/");
            return;
          }

          const { data: existing } = await supabase
            .from("event_votes")
            .select("id")
            .eq("user_id", user.id)
            .eq("event_id", event.id);
          if (existing && existing.length > 0) {
            alert("Hai già votato questo evento");
            router.push("/");
            return;
          }

          await supabase.from("event_votes").insert({
            user_id: user.id,
            event_id: event.id,
          });
          alert(`✅ Votato! +1 punto per i ${event.team_target}`);
          router.push("/");
          return;
        }

        // BONUS
        if (decodedText.startsWith("BONUS:")) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { alert("Devi essere loggato"); router.push("/"); return; }

          const { data: bonus } = await supabase
            .from("bonus_qr")
            .select("*")
            .eq("code", decodedText)
            .single();
          if (!bonus) { alert("Bonus non valido"); router.push("/"); return; }

          const { data: redeemed } = await supabase
            .from("bonus_redemptions")
            .select("id")
            .eq("user_id", user.id)
            .eq("bonus_id", bonus.id);
          if (redeemed && redeemed.length > 0) {
            alert("Hai già riscattato questo bonus");
            router.push("/");
            return;
          }

          await supabase.from("bonus_redemptions").insert({
            user_id: user.id,
            bonus_id: bonus.id,
          });
          alert(`⚡ +${bonus.amount} CBTcoin extra!`);
          router.push("/");
          return;
        }

        // UTENTE
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { alert("Devi essere loggato"); router.push("/"); return; }
        if (decodedText === user.id) { alert("Non puoi votare te stesso"); router.push("/"); return; }

        const today = new Date().toISOString().split("T")[0];
        const { data: todayVotes } = await supabase
          .from("votes")
          .select("id", { count: "exact" })
          .eq("voter_id", user.id)
          .gte("voted_at", today);
        if ((todayVotes?.length || 0) >= 20) {
          alert("Hai esaurito i CBTcoin per oggi");
          router.push("/");
          return;
        }

        const { data: existing } = await supabase
          .from("votes")
          .select("id")
          .eq("voter_id", user.id)
          .eq("recipient_id", decodedText)
          .gte("voted_at", today);
        if (existing && existing.length > 0) {
          alert("Hai già votato questa persona oggi");
          router.push("/");
          return;
        }

        const { data: recipient } = await supabase
          .from("users")
          .select("team, site")
          .eq("id", decodedText)
          .single();
        if (!recipient) { alert("Utente non trovato"); router.push("/"); return; }

        let points = 0;
        const voterTeam = user.user_metadata?.team;
        const voterSite = user.user_metadata?.site;
        if (voterTeam === recipient.team) {
          points = voterSite === recipient.site ? 1 : 2;
        } else {
          points = 3;
        }

        await supabase.from("votes").insert({
          voter_id: user.id,
          recipient_id: decodedText,
          points,
        });
        alert(`✅ +${points} punti!`);
        router.push("/");
      },
      (error) => {
        console.error(error);
        setError("Errore durante la scansione. Riprova.");
        setScanning(false);
      }
    );
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20 }}>
      <button onClick={() => router.push("/")} style={{ color: "#FF6B35", background: "none", border: "none", fontSize: "1rem", marginBottom: 16 }}>
        ← Torna alla dashboard
      </button>

      {!scanning ? (
        <button onClick={startScan} style={{ width: "100%", padding: 14, borderRadius: 60, fontWeight: 600, background: "#FF6B35", color: "white", border: "none" }}>
          📷 Avvia Scanner
        </button>
      ) : (
        <p style={{ textAlign: "center", color: "#1E3A5F" }}>Scanner attivo... Inquadra un QR</p>
      )}

      {error && <p style={{ color: "red", textAlign: "center", marginTop: 16 }}>{error}</p>}

      <div id="reader" style={{ width: "100%", marginTop: 20 }}></div>
    </div>
  );
}