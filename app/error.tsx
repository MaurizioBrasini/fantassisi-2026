"use client";

import { useEffect } from "react";

// Se una pagina si rompe mentre gira nel telefono, al posto della pagina bianca si vede questo:
// un messaggio comprensibile e un pulsante per riprovare (o tornare alla dashboard).
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Errore di pagina:", error);
  }, [error]);

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 20px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 48 }}>😕</div>
      <h2 style={{ color: "#1E3A5F" }}>Qualcosa non ha funzionato</h2>
      <p style={{ color: "#666" }}>Può capitare con una connessione debole. Riprova: i tuoi voti e i tuoi punti non sono andati persi.</p>
      <button
        onClick={() => reset()}
        style={{ padding: "12px 24px", background: "#FF6B35", color: "white", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: "pointer" }}
      >
        Riprova
      </button>
      <p style={{ marginTop: 16 }}>
        <a href="/" style={{ color: "#1E3A5F", fontWeight: 600 }}>Torna alla dashboard</a>
      </p>
    </div>
  );
}
