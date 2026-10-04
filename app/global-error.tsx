"use client";

// Ultima rete di sicurezza: un errore nel layout stesso (dove error.tsx non arriva).
// Deve avere i suoi <html> e <body> perché sostituisce l'intero layout.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, background: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
          <h2 style={{ color: "#1E3A5F" }}>FantAssisi non riesce ad aprirsi</h2>
          <p style={{ color: "#666" }}>Controlla la connessione e riprova.</p>
          <button
            onClick={() => reset()}
            style={{ padding: "12px 24px", background: "#FF6B35", color: "white", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 16 }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
