"use client";

import { useState, useRef } from "react";
import jsQR from "jsqr";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

// Il QR personale ora contiene un link (/v/<id>) invece del solo id: se lo
// scansioniamo o incolliamo qui dentro, estraiamo l'id per riusare la stessa
// logica di sempre. I vecchi formati (id nudo, EVENT:/BONUS:/QR:) restano
// invariati.
function extractCode(raw: string): string {
  const match = raw.trim().match(/\/v\/([^/?#\s]+)/);
  return match ? match[1] : raw.trim();
}

// Decodifica un QR da una foto scattata con la fotocamera nativa del
// telefono. Usiamo l'acquisizione foto (input file con capture) invece dello
// streaming video in-pagina: la schermata di scatto è quella vera del
// sistema operativo, molto più affidabile su dispositivi/browser dove
// l'accesso "live" alla fotocamera dentro il browser è inconsistente
// (fotocamera sbagliata, permesso negato, ecc. — soprattutto su iPhone
// datati e alcuni Android).
function decodeQRFromFile(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      resolve(code ? code.data : null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossibile leggere la foto"));
    };
    img.src = url;
  });
}

export default function ScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  const handleScanResult = async (decodedText: string, userId: string) => {
    // ----- EVENTO (legacy) -----
    if (decodedText.startsWith("EVENT:")) {
      const { data: event } = await supabase
        .from("votable_events")
        .select("*")
        .eq("qr_code", decodedText)
        .single();
      if (!event) {
        alert("Evento non trovato");
        router.push("/");
        return;
      }

      // 🔥 NUOVA LOGICA: distingue QR voto puro vs evento con orario
      const isVoteQR = event.qr_type && ['team', 'site', 'class'].includes(event.qr_type);

      if (isVoteQR) {
        // QR voto puro: controlla solo active
        if (event.active !== true) {
          alert("Evento non attivo");
          router.push("/");
          return;
        }
      } else {
        // Evento normale con orario: controlla active E orari
        if (event.active === false) {
          alert("Evento non attivo");
          router.push("/");
          return;
        }
        if (event.start_time && event.end_time) {
          const now = new Date();
          const start = new Date(event.start_time);
          const end = new Date(event.end_time);
          if (now < start || now > end) {
            alert("Evento non attivo in questo momento");
            router.push("/");
            return;
          }
        }
      }

      const res = await fetch("/api/event-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Errore nel voto evento");
        router.push("/");
        return;
      }

      // 🔥 MODIFICA: usa il messaggio personalizzato dall'API
      alert(data.message || `✅ Votato! +1 punto per i ${event.team_target}`);
      router.push("/");
      return;
    }

    // ----- BONUS (legacy) -----
    if (decodedText.startsWith("BONUS:")) {
      const { data: bonus } = await supabase
        .from("bonus_qr")
        .select("*")
        .eq("code", decodedText)
        .single();
      if (!bonus) {
        alert("Bonus non valido");
        router.push("/");
        return;
      }

      const res = await fetch("/api/bonus-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonusId: bonus.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Errore nel riscatto bonus");
        router.push("/");
        return;
      }

      alert(`⚡ +${bonus.amount} CBTcoin extra!`);
      router.push("/");
      return;
    }

    // ----- NUOVO SISTEMA QR UNIFICATO (QR: ...) -----
    if (decodedText.startsWith("QR:")) {
      const res = await fetch("/api/qr/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: decodedText }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "QR non valido o già utilizzato");
        router.push("/");
        return;
      }

      if (data.type === "bonus") {
        alert(`⚡ +${data.amount} CBTcoin extra!`);
      } else if (data.type === "vote") {
        alert(`✅ Voto registrato per: ${data.targets?.join(", ") || "squadra"}`);
      } else {
        alert(data.message || "QR riscattato con successo!");
      }
      router.push("/");
      return;
    }

    // ----- UTENTE (voto tra partecipanti) -----
    if (decodedText === userId) {
      alert("Non puoi votare te stesso");
      router.push("/");
      return;
    }

    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: decodedText }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Errore nel voto");
      router.push("/");
      return;
    }

    alert(`✅ +${data.points} punti!`);
    router.push("/");
  };

  const handleAvviaScanner = () => {
    const userId = getCookie("user_id");
    if (!userId) {
      alert("Accesso non valido. Usa il link personale.");
      router.push("/");
      return;
    }
    setError("");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permette di riselezionare la stessa foto in un secondo tentativo
    if (!file) return;

    const userId = getCookie("user_id");
    if (!userId) {
      alert("Accesso non valido. Usa il link personale.");
      router.push("/");
      return;
    }

    setError("");
    setProcessing(true);
    try {
      const decoded = await decodeQRFromFile(file);
      if (!decoded) {
        setError("Nessun QR trovato nella foto. Riprova inquadrando meglio il codice.");
        return;
      }
      await handleScanResult(extractCode(decoded), userId);
    } catch (err: any) {
      console.error("Errore dopo la scansione:", err);
      setError("Errore: " + (err?.message || String(err)));
    } finally {
      setProcessing(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setManualCode(text.trim());
    } catch {
      // Permesso negato o non supportato: l'utente incolla a mano nel campo.
    }
  };

  const handleManualSubmit = async () => {
    const userId = getCookie("user_id");
    if (!userId) {
      alert("Accesso non valido. Usa il link personale.");
      router.push("/");
      return;
    }
    const code = manualCode.trim();
    if (!code) return;
    setManualBusy(true);
    try {
      await handleScanResult(extractCode(code), userId);
    } catch (err: any) {
      console.error("Errore dopo l'inserimento manuale:", err);
      setError("Errore: " + (err?.message || String(err)));
    } finally {
      setManualBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20 }}>
      <button
        onClick={() => router.push("/")}
        style={{
          color: "#FF6B35",
          background: "none",
          border: "none",
          fontSize: "1rem",
          marginBottom: 16,
        }}
      >
        ← Torna alla dashboard
      </button>

      {/* Input nascosto: "capture" apre direttamente la fotocamera nativa
          del telefono (non uno streaming dentro la pagina) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <button
        onClick={handleAvviaScanner}
        disabled={processing}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 60,
          fontWeight: 600,
          background: "#FF6B35",
          color: "white",
          border: "none",
          cursor: processing ? "not-allowed" : "pointer",
        }}
      >
        {processing ? "Elaborazione..." : "📷 Avvia Scanner"}
      </button>

      {error && (
        <p style={{ color: "red", textAlign: "center", marginTop: 16 }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: 28, textAlign: "center" }}>
        {!showManual ? (
          <button
            onClick={() => setShowManual(true)}
            style={{ background: "none", border: "none", color: "#999", fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline" }}
          >
            Non riesci a scansionare? Incolla il link/codice
          </button>
        ) : (
          <div style={{ background: "#f8f9fa", borderRadius: 12, padding: 16, textAlign: "left" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1E3A5F" }}>Link o codice ricevuto</label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Incolla qui"
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
              />
              <button
                onClick={handlePasteFromClipboard}
                style={{ padding: "0 14px", borderRadius: 8, background: "#e0e0e0", color: "#333", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "0.8rem" }}
              >
                📋 Incolla
              </button>
            </div>
            <button
              onClick={handleManualSubmit}
              disabled={manualBusy || !manualCode.trim()}
              style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, fontWeight: 700, background: "#FF6B35", color: "white", border: "none", cursor: manualBusy ? "not-allowed" : "pointer" }}
            >
              {manualBusy ? "..." : "Conferma"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
