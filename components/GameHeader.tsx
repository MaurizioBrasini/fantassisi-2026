// Intestazione con richiamo alla grafica "lavagna" usata nelle slide del
// gioco (Cognitrivial): solo qui, non su tutta l'app, per restare
// leggibili su schermo del telefono mantenendo il resto dell'interfaccia
// chiara.
import { RoosterIcon, CowIcon } from "@/components/TeamIcons";

export default function GameHeader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 24,
        padding: "14px 20px",
        borderRadius: 20,
        backgroundImage:
          "repeating-linear-gradient(120deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 12px), linear-gradient(135deg, #34343a, #202024)",
      }}
    >
      <RoosterIcon size={40} stroke="#FFFFFF" />
      <h1
        style={{
          textAlign: "center",
          color: "#fff",
          fontSize: "1.6rem",
          margin: 0,
          lineHeight: 1.2,
          letterSpacing: 0.5,
          textShadow: "0 0 8px rgba(255,255,255,0.25)",
        }}
      >
        FantAssisi<br />2026
      </h1>
      <CowIcon size={40} stroke="#FFFFFF" />
    </div>
  );
}
