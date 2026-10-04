"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCookie } from "@/lib/clientCookies";
import NoAccess from "@/components/NoAccess";
import QrGenerator from "@/components/QrGenerator";
import BonusGenerator from "@/components/BonusGenerator";
import StaffAddUser from "@/components/StaffAddUser";

// Dashboard dello staff: solo ciò che serve durante l'evento (QR, bonus, nuovi partecipanti).
// Reset, importazioni, elenco utenti e fase del gioco restano nel pannello admin. Questa pagina è
// solo comodità: i permessi veri li controllano le API (requireRole).
export default function StaffPage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => { setRole(getCookie("user_role") || ""); }, []);

  if (role === null) return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  if (role !== "staff" && role !== "admin") return <NoAccess />;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>🛠️ Staff FantAssisi</h1>
        <Link href="/" style={{ color: "#FF6B35" }}>← Dashboard</Link>
      </div>
      <QrGenerator />
      <BonusGenerator canDelete={role === "admin"} />
      <StaffAddUser />
    </div>
  );
}
