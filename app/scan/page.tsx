"use client";

import { useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const startScan = () => {
    const userId = getCookie("user_id");
    const userTeam = getCookie("user_team");
    const userSite = getCookie("user_site") || "";

    if (!userId) {
      alert("Accesso non valido. Usa il link personale.");
      router.push("/");
      return;
    }

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

        // ----- EVENTO -----
        if (decodedText.startsWith("EVENT:")) {
          const { data: event } = await supabase
            .from("votable_events")
            .select("*")
            .eq("qr_code", decodedText)
            .single();
          if (!event) {
            alert("Evento non trovato");
            router.push("/");
            return;
          }

          const now = new Date();
          const start = new Date(event.start_time);
          const end = new Date(event.end_time);
          if (now < start || now > end) {
            alert("Evento non attivo in questo momento");
            router.push("/");
            return;
          }

          // Chiamata all'endpoint server per il voto evento
          const res = await fetch("/api/event-vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event.id }),
          });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || "Errore nel voto evento");
            router.push("/");
            return;
          }

          alert(`✅ Votato! +1 punto per i ${event.team_target}`);
          router.push("/");
          return;
        }

        // ----- BONUS -----
        if (decodedText.startsWith("BONUS:")) {
          const { data: bonus } = await supabase
            .from("bonus_qr")
            .select("*")
            .eq("code", decodedText)
            .single();
          if (!bonus) {
            alert("Bonus non valido");
            router.push("/");
            return;
          }

          // Chiamata all'endpoint server per il riscatto bonus
          const res = await fetch("/api/bonus-redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bonusId: bonus.id }),
          });
          const data = await res.json();
          if (!res.ok) {
            alert(data.error || "Errore nel riscatto bonus");
            router.push("/");
            return;
          }

          alert(`⚡ +${bonus.amount} CBTcoin extra!`);
          router.push("/");
          return;
        }

        // ----- UTENTE (voto tra partecipanti) -----
        if (decodedText === userId) {
          alert("Non puoi votare te stesso");
          router.push("/");
          return;
        }

        // Calcolo punti (fatto lato client per semplicità, ma l'endpoint lo riceve)
        const { data: recipient } = await supabase
          .from("users")
          .select("team, site")
          .eq("id", decodedText)
          .single();
        if (!recipient) {
          alert("Utente non trovato");
          router.push("/");
          return;
        }

        let points = 0;
        if (userTeam === recipient.team) {
          points = userSite === recipient.site ? 1 : 2;
        } else {
          points = 3;
        }

        // Chiamata all'endpoint server per il voto
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId: decodedText, points }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Errore nel voto");
          router.push("/");
          return;
        }

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
      <button
        onClick={() => router.push("/")}
        style={{
          color: "#FF6B35",
          background: "none",
          border: "none",
          fontSize: "1rem",
          marginBottom: 16,
        }}
      >
        ← Torna alla dashboard
      </button>

      {!scanning ? (
        <button
          onClick={startScan}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 60,
            fontWeight: 600,
            background: "#FF6B35",
            color: "white",
            border: "none",
          }}
        >
          📷 Avvia Scanner
        </button>
      ) : (
        <p style={{ textAlign: "center", color: "#1E3A5F" }}>
          Scanner attivo... Inquadra un QR
        </p>
      )}

      {error && (
        <p style={{ color: "red", textAlign: "center", marginTop: 16 }}>
          {error}
        </p>
      )}

      <div id="reader" style={{ width: "100%", marginTop: 20 }}></div>
    </div>
  );
}
