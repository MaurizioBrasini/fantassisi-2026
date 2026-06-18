"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function MyQRPage() {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; team: string } | null>(null);

  useEffect(() => {
    const generateQR = async () => {
      const userId = getCookie("user_id");
      const userTeam = getCookie("user_team");

      if (!userId) {
        setNoAccess(true);
        setLoading(false);
        return;
      }

      // Recupera nome utente
      const { data: user } = await supabase
        .from("users")
        .select("first_name, last_name, team")
        .eq("id", userId)
        .single();

      if (user) {
        setUserInfo({
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          team: user.team || userTeam || "",
        });
      }

      try {
        // Genera QR con l'ID utente
        const qr = await QRCode.toDataURL(userId, {
          width: 300,
          margin: 2,
          color: {
            dark: "#1E3A5F",
            light: "#ffffff",
          },
        });
        setQrDataUrl(qr);
      } catch (err) {
        console.error("Errore generazione QR:", err);
      } finally {
        setLoading(false);
      }
    };

    generateQR();
  }, []);

  if (noAccess) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        Accesso non valido. Usa il link personale che ti è stato inviato.
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20, textAlign: "center" }}>
      <button
        onClick={() => router.push("/")}
        style={{
          color: "#FF6B35",
          background: "none",
          border: "none",
          fontSize: "1rem",
          marginBottom: 16,
          cursor: "pointer",
        }}
      >
        ← Torna alla dashboard
      </button>

      <h2 style={{ color: "#1E3A5F", marginBottom: 4 }}>Il mio QR</h2>

      {userInfo && (
        <p style={{ color: "#333", marginBottom: 20 }}>
          {userInfo.name} • {userInfo.team}
        </p>
      )}

      {qrDataUrl ? (
        <div style={{ marginTop: 20 }}>
          <img
            src={qrDataUrl}
            alt="QR Code"
            style={{
              width: "100%",
              maxWidth: 300,
              margin: "0 auto",
              display: "block",
              borderRadius: 12,
            }}
          />
          <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 12 }}>
            Mostra questo QR ai colleghi per ricevere voti
          </p>
        </div>
      ) : (
        <p>Errore nella generazione del QR</p>
      )}
    </div>
  );
}
