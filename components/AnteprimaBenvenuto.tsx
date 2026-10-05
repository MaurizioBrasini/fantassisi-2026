// Fase Anteprima: al posto dei QR e dei comandi di voto, il benvenuto con le regole del gioco.
const STEP = { display: "flex", gap: 12, alignItems: "flex-start", marginTop: 12 } as const;
const EMOJI = { fontSize: "1.6rem", lineHeight: 1.1 } as const;

export default function AnteprimaBenvenuto({ opensAtLabel }: { opensAtLabel: string }) {
  const when = opensAtLabel ? opensAtLabel.charAt(0).toUpperCase() + opensAtLabel.slice(1) : "";
  return (
    <div style={{ background: "linear-gradient(135deg, #FF6B35, #1E3A5F)", color: "white", borderRadius: 20, padding: "20px 18px", marginBottom: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.2rem" }}>🎉</div>
        <div style={{ fontWeight: 800, fontSize: "1.25rem", marginTop: 2 }}>Benvenuti all&apos;anteprima del FantAssisi!</div>
        <div style={{ fontSize: "0.9rem", marginTop: 6, opacity: 0.95 }}>Il social game del Forum di Assisi 2026</div>
      </div>

      <div style={STEP}>
        <span style={EMOJI}>🔑</span>
        <span>A breve riceverete il <strong>QR</strong> e il <strong>codice</strong> personali.</span>
      </div>
      <div style={STEP}>
        <span style={EMOJI}>🗳️</span>
        <span>Potrete <strong>votare i vostri colleghi</strong> e <strong>raccogliere voti</strong> per far salire la vostra squadra.</span>
      </div>
      <div style={STEP}>
        <span style={EMOJI}>🎬</span>
        <span>Intanto <strong>postate i vostri video</strong> nella community di WhatsApp: gli organizzatori premieranno i contributi più originali e divertenti!</span>
      </div>
      <a
        href="https://chat.whatsapp.com/JWlqvAVOTxF2qVRQX1tLKb"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "block", marginTop: 14, padding: 14, borderRadius: 60, background: "#25D366", color: "white", textAlign: "center", fontWeight: 800, textDecoration: "none" }}
      >
        💬 Apri la community WhatsApp
      </a>
      {when && (
        <div style={STEP}>
          <span style={EMOJI}>📅</span>
          <span>{when} il gioco entra nel vivo.</span>
        </div>
      )}

      <div style={{ textAlign: "center", fontWeight: 800, fontSize: "1.1rem", marginTop: 18 }}>Che il gioco abbia inizio! 🚀</div>
    </div>
  );
}
