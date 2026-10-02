import Link from "next/link";
import type { ReactNode } from "react";
import NoAccess from "./NoAccess";
import type { StandingsStatus } from "@/lib/useStandings";

// Cornice comune delle tre classifiche: gestisce accesso/caricamento/errore, intestazione con il
// ritorno alla dashboard e il riquadro "la tua posizione".
export default function RankingScreen({
  status,
  title,
  subtitle,
  mine,
  empty,
  children,
}: {
  status: StandingsStatus;
  title: string;
  subtitle?: string;
  mine?: { label: string; rank: number; detail: string } | null;
  empty?: { text: string } | null;
  children?: ReactNode;
}) {
  if (status === "noaccess") return <NoAccess />;
  if (status === "loading") return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  if (status === "error") {
    return <div style={{ textAlign: "center", padding: 40, color: "#666" }}>Non riesco a caricare la classifica. Ricarica la pagina.</div>;
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <Link href="/" style={{ color: "#FF6B35", textDecoration: "none", fontWeight: 600, fontSize: "0.9rem" }}>
        ← Torna alla dashboard
      </Link>
      <h1 style={{ color: "#1E3A5F", fontSize: "1.4rem", marginTop: 12, marginBottom: subtitle ? 4 : 16 }}>{title}</h1>
      {subtitle && <p style={{ color: "#999", fontSize: "0.75rem", marginBottom: 16 }}>{subtitle}</p>}

      {mine && (
        <div style={{ background: "#1E3A5F", color: "white", borderRadius: 14, padding: 16, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: "0.8rem", opacity: 0.85 }}>{mine.label}</div>
          <div style={{ fontWeight: 800, fontSize: "1.4rem" }}>{mine.rank}° posto</div>
          <div style={{ fontSize: "0.9rem" }}>{mine.detail}</div>
        </div>
      )}

      {empty ? <p style={{ color: "#999", textAlign: "center" }}>{empty.text}</p> : <div>{children}</div>}
    </div>
  );
}

// Una riga di classifica: etichetta a sinistra, valore a destra, evidenziata se è la tua.
export function RankingRow({
  mine,
  background,
  color,
  borderColor,
  value,
  children,
}: {
  mine: boolean;
  background: string;
  color: string;
  borderColor: string;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        marginBottom: 6,
        borderRadius: 10,
        background,
        border: mine ? `2px solid ${borderColor}` : "1px solid transparent",
      }}
    >
      <span style={{ color, fontWeight: mine ? 800 : 600 }}>{children}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}
