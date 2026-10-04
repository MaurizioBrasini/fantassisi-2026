// Indirizzo inesistente (es. link scritto a mano male): si rimanda alla dashboard.
export default function NotFound() {
  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "60px 20px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ color: "#1E3A5F" }}>Pagina non trovata</h2>
      <p style={{ color: "#666" }}>L&apos;indirizzo che hai aperto non esiste.</p>
      <a href="/" style={{ display: "inline-block", marginTop: 8, padding: "12px 24px", background: "#FF6B35", color: "white", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>
        Vai a FantAssisi
      </a>
    </div>
  );
}
