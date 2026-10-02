// Schermata mostrata a chi non ha una sessione valida: un solo testo per tutte le pagine.
export default function NoAccess() {
  return (
    <div style={{ textAlign: "center", padding: 40, maxWidth: 500, margin: "0 auto" }}>
      <h2 style={{ color: "#1E3A5F" }}>Accesso non valido</h2>
      <p style={{ color: "#666" }}>Usa il link personale che ti è stato inviato per entrare nell&apos;app.</p>
      <p style={{ color: "#666" }}>
        Non lo trovi?{" "}
        <a href="/accedi" style={{ color: "#FF6B35", fontWeight: "bold" }}>
          Richiedi l&apos;accesso
        </a>
      </p>
    </div>
  );
}
