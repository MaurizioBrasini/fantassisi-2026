"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

export default function MyQRPage() {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [userName, setUserName] = useState("");
  const [userClass, setUserClass] = useState("");
  const [userTeam, setUserTeam] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      setUserName(`${user.user_metadata?.first_name || ""} ${user.user_metadata?.last_name || ""}`);
      setUserClass(user.user_metadata?.class || "");
      setUserTeam(user.user_metadata?.team || "");

      const qr = await QRCode.toDataURL(user.id, {
        width: 300,
        margin: 2,
        color: { dark: "#1E3A5F", light: "#FFFFFF" }
      });
      setQrDataUrl(qr);
    };

    fetchUser();
  }, [router]);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20, textAlign: "center" }}>
      <button onClick={() => router.push("/")} style={{ color: "#FF6B35", background: "none", border: "none", fontSize: "1rem", marginBottom: 16 }}>
        ← Torna alla dashboard
      </button>

      {qrDataUrl && (
        <img src={qrDataUrl} alt="Il tuo QR" style={{ width: 250, height: 250, margin: "20px auto", display: "block" }} />
      )}

      <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{userName}</div>
      <div>{userClass} · {userTeam}</div>
      <div style={{ fontSize: "12px", color: "#666", marginTop: 8 }}>Mostra questo QR per ricevere voti</div>

      <button onClick={() => router.push("/")} style={{ width: "100%", padding: 14, borderRadius: 60, fontWeight: 600, background: "white", border: "1px solid #1E3A5F", color: "#1E3A5F", marginTop: 20 }}>
        Chiudi
      </button>
    </div>
  );
}