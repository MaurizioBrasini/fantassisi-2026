import type { CSSProperties } from "react";

// Stili comuni delle schede di gestione (pannello admin e pagina staff): un solo posto per
// riquadri, campi e pulsanti a pillola, così l'aspetto resta uguale ovunque.

/** Riquadro grigio di una scheda (Bonus, Genera QR, Fase, Stato del sistema, ...). */
export const PANEL: CSSProperties = { marginTop: 20, padding: 16, background: "#f8f9fa", borderRadius: 8 };

/** Campo di testo o menu a tendina. */
export const INPUT: CSSProperties = { padding: 8, borderRadius: 6, border: "1px solid #ccc" };

/** Pulsante a pillola per scegliere un'opzione (pieno quando è quello scelto). */
export const pill = (active: boolean): CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 60,
  border: "2px solid #1E3A5F",
  cursor: "pointer",
  fontWeight: 700,
  background: active ? "#1E3A5F" : "white",
  color: active ? "white" : "#1E3A5F",
});
