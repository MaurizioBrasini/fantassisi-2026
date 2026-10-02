"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PermissionsHelp, NativeCameraHelp, detectInAppBrowser } from "@/components/CameraHelp";

// Guida pubblica (si apre anche senza essere entrati): come entrare e come far funzionare la
// fotocamera. Pensata per essere mandata in anticipo ai partecipanti.
export default function GuidaPage() {
  const [inAppBrowser, setInAppBrowser] = useState<string | null>(null);
  useEffect(() => setInAppBrowser(detectInAppBrowser()), []);

  const heading = { color: "#1E3A5F", fontSize: "1.15rem", margin: "28px 0 4px" } as const;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif", color: "#333" }}>
      <h1 style={{ color: "#1E3A5F", fontSize: "1.5rem", marginBottom: 4 }}>📖 Guida a FantAssisi</h1>
      <p style={{ marginTop: 0, color: "#666" }}>Come entrare e come votare con la fotocamera, passo per passo.</p>

      <h2 style={heading}>1. Entrare nell&apos;app</h2>
      <p style={{ lineHeight: 1.5 }}>
        Apri <strong>fantassisi-2026.onrender.com/accedi</strong> e scrivi la mail con cui ti sei iscritto/a e le ultime 4 cifre del tuo telefono.
        Se non riesci, nella stessa pagina premi <strong>«Ricevi il link per mail»</strong>: ti arriva una mail con il pulsante arancione. Toccalo.
      </p>
      <img
        src="/help/mail-accedi.jpg"
        alt="Il pulsante arancione ACCEDI A FANTASSISI nella mail"
        style={{ display: "block", maxWidth: "100%", borderRadius: 8, margin: "6px 0 12px", border: "1px solid #eee" }}
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
      />
      <p style={{ lineHeight: 1.5 }}>
        Poi installa l&apos;app con il pulsante <strong>«Installa l&apos;app FantAssisi»</strong>. Se un giorno l&apos;app ti chiede di nuovo l&apos;accesso, rientra dalla stessa pagina.
      </p>

      <h2 style={heading}>2. Votare: la strada più semplice</h2>
      <p style={{ lineHeight: 1.5 }}>Per votare un collega o un QR basta inquadrarlo. Il modo che non chiede nessun permesso:</p>
      <NativeCameraHelp isRicarica={false} />
      <p style={{ lineHeight: 1.5 }}>
        Sotto ogni QR c&apos;è anche un <strong>PIN a 4 cifre</strong>: se non riesci a inquadrare, nella pagina «Vota» scrivi il PIN della persona che vuoi votare.
      </p>

      <h2 style={heading}>3. Se la fotocamera dell&apos;app non si accende</h2>
      <PermissionsHelp inAppBrowser={inAppBrowser} isRicarica={false} />

      <Link href="/" style={{ display: "block", marginTop: 28, padding: 14, borderRadius: 60, textAlign: "center", fontWeight: 700, background: "#FF6B35", color: "white", textDecoration: "none" }}>
        Vai all&apos;app
      </Link>
    </div>
  );
}
