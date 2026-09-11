"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { TeamIcon } from "@/components/TeamIcons";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export default function MyQRPage() {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAccess, setNoAccess] = useState(false);
  const [userInfo, setUserInfo] = useState<{ name: string; team: string } | null>(null);
  const [notVotable, setNotVotable] = useState(false);
  const [myLink, setMyLink] = useState<string | null>(null);
  const [myPin, setMyPin] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const generateQR = async () => {
      const userId = getCookie("user_id");
      const userTeam = getCookie("user_team");
      if (!userId) {
        setNoAccess(true);
        setLoading(false);
        return;
      }

      const { data: user } = await supabase
        .from("users")
        .select("first_name, last_name, team, pin")
        .eq("id", userId)
        .single();

      if (user) {
        setUserInfo({
          name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
          team: user.team || userTeam || "",
        });
        setMyPin(user.pin || null);
      }

      // Didatti&Docenti possono votare ma non essere votati: niente QR personale.
      const team = user?.team || userTeam || "";
      if (team !== "Matricole" && team !== "Veterani") {
        setNotVotable(true);
        setLoading(false);
        return;
      }

      // Il QR contiene un link diretto (non il solo id): così chi vota può
      // scansionarlo con la fotocamera nativa del telefono invece che con
      // quella in-pagina, molto più affidabile su dispositivi dove l'accesso
      // alla fotocamera dentro il browser è inaffidabile o bloccato.
      const link = `${window.location.origin}/v/${userId}`;
      setMyLink(link);

      try {
        const qr = await QRCode.toDataURL(link, {
          width: 300,
          margin: 2,
          color: { dark: "#1E3A5F", light: "#ffffff" },
        });
        setQrDataUrl(qr);
      } catch (err) {
        console.error("Errore generazione QR:", err);
      } finally {
        setLoading(false);
      }
    };
    generateQR();
  }, []);

  // Compone QR + PIN in un'unica immagine scaricabile: il solo QR (qrDataUrl)
  // non basta più a votare da solo se manca la fotocamera, e chi scarica/
  // stampa il file perde il PIN mostrato solo a video se non lo includiamo
  // direttamente nel PNG.
  const buildDownloadImage = (): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!qrDataUrl) return reject(new Error("QR non pronto"));
      const qrImg = new Image();
      qrImg.onload = () => {
        const qrSize = 300;
        const padding = 24;
        const pinBlockHeight = myPin ? 110 : 0;
        const width = qrSize + padding * 2;
        const height = qrSize + padding * 2 + pinBlockHeight;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas non supportato"));

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(qrImg, padding, padding, qrSize, qrSize);

        if (myPin) {
          const centerX = width / 2;
          ctx.fillStyle = "#666666";
          ctx.font = "16px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Se non riesce a scansionare, vota con il PIN:", centerX, padding + qrSize + 32);

          ctx.fillStyle = "#1E3A5F";
          ctx.font = "800 40px system-ui, sans-serif";
          // canvas non supporta letter-spacing in modo affidabile su tutti i
          // browser: spaziatura manuale per leggibilità, come sullo schermo.
          ctx.fillText(myPin.split("").join("  "), centerX, padding + qrSize + 80);
        }

        resolve(canvas.toDataURL("image/png"));
      };
      qrImg.onerror = () => reject(new Error("Impossibile caricare il QR"));
      qrImg.src = qrDataUrl;
    });

  const handleDownload = async () => {
    if (!qrDataUrl || !userInfo) return;
    const filename = `QR_${userInfo.name.replace(/\s+/g, "_")}.png`;
    let href = qrDataUrl;
    try {
      href = await buildDownloadImage();
    } catch (err) {
      console.error("Errore generazione immagine QR+PIN, scarico solo il QR:", err);
    }
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
  };

  const handleCopyCode = async () => {
    if (!myLink) return;
    try {
      await navigator.clipboard.writeText(myLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard non disponibile: l'utente può comunque selezionare il testo a mano.
    }
  };

  if (noAccess) {
    return <div style={{ textAlign: "center", padding: 40 }}>Accesso non valido. Usa il link personale che ti è stato inviato.</div>;
  }

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40 }}>Caricamento...</div>;
  }

  if (notVotable) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto", padding: 20, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <button
          onClick={() => router.push("/")}
          style={{ color: "#FF6B35", background: "none", border: "none", fontSize: "1rem", marginBottom: 16, cursor: "pointer" }}
        >
          ← Torna alla dashboard
        </button>
        <h2 style={{ color: "#1E3A5F", marginBottom: 8 }}>Nessun QR personale</h2>
        <p style={{ color: "#666" }}>Come Didatta/Docente puoi votare, ma non puoi essere votato: non hai un QR personale da mostrare.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <button
        onClick={() => router.push("/")}
        style={{ color: "#FF6B35", background: "none", border: "none", fontSize: "1rem", marginBottom: 16, cursor: "pointer" }}
      >
        ← Torna alla dashboard
      </button>

      <h2 style={{ color: "#1E3A5F", marginBottom: 4 }}>Il mio QR</h2>
      {userInfo && (
        <p style={{ color: "#333", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {userInfo.name} · <TeamIcon team={userInfo.team} size={18} /> {userInfo.team}
        </p>
      )}

      {qrDataUrl ? (
        <div style={{ marginTop: 20 }}>
          <img
            src={qrDataUrl}
            alt="QR Code"
            style={{ width: "100%", maxWidth: 300, margin: "0 auto", display: "block", borderRadius: 12 }}
          />
          <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 12 }}>
            Mostra questo QR ai colleghi per ricevere voti — chi lo scansiona con la fotocamera del telefono (non serve aprire l'app) ti vota direttamente
          </p>

          {myPin && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: "0.75rem", color: "#666" }}>Se non riesce a scansionare, può votarti con il tuo PIN:</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: 6, color: "#1E3A5F", marginTop: 4 }}>{myPin}</div>
            </div>
          )}

          <button
            onClick={handleDownload}
            style={{
              marginTop: 16, padding: "12px 24px", borderRadius: 60,
              background: "#1E3A5F", color: "white", border: "none",
              fontWeight: 700, cursor: "pointer", fontSize: "0.9rem",
            }}
          >
            ⬇️ Scarica QR
          </button>

          {myLink && (
            <div style={{ marginTop: 24, padding: 16, background: "#f8f9fa", borderRadius: 12 }}>
              <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: 8 }}>
                In alternativa puoi copiare e mandare questo link a chi ti vuole votare — basta che lo apra sul suo telefono:
              </p>
              <code style={{ display: "block", wordBreak: "break-all", fontSize: "0.85rem", color: "#1E3A5F", background: "white", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}>
                {myLink}
              </code>
              <button
                onClick={handleCopyCode}
                style={{ marginTop: 10, padding: "8px 16px", borderRadius: 60, background: "#e0e0e0", color: "#333", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "0.8rem" }}
              >
                {copied ? "✅ Copiato" : "📋 Copia link"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p>Errore nella generazione del QR</p>
      )}
    </div>
  );
}
