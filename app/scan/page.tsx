"use client";

import { useState, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

type CameraInfo = { id: string; label: string };

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<CameraInfo[] | null>(null);
  const [loadingCameras, setLoadingCameras] = useState(false);

  // --- SOLO TEMPORANEO PER DEBUG: console visibile sul telefono, da
  // togliere una volta risolto il problema dello scanner su Android ---
  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).eruda) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/eruda";
      script.onload = () => {
        (window as any).eruda.init();
      };
      document.body.appendChild(script);
    }
  }, []);
  // --- FINE BLOCCO TEMPORANEO ---

  const handleScanResult = async (decodedText: string, userId: string) => {
    // ----- EVENTO -----
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

      const now = new Date();
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      if (now < start || now > end) {
        alert("Evento non attivo in questo momento");
        router.push("/");
        return;
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

      alert(`✅ Votato! +1 punto per i ${event.team_target}`);
      router.push("/");
      return;
    }

    // ----- BONUS -----
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

  // Prova ad avviare una specifica fotocamera. Ritorna true se ci riesce,
  // false se quella fotocamera non è utilizzabile (es. NotReadableError su
  // alcuni obiettivi secondari di telefoni con più fotocamere posteriori).
  const tryStartCamera = async (cameraId: string): Promise<boolean> => {
    const userId = getCookie("user_id");
    if (!userId) return false;

    const scanner = new Html5Qrcode("reader");
    try {
      await scanner.start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          try {
            await scanner.stop();
            scanner.clear();
          } catch (stopErr) {
            console.error("Errore fermando lo scanner:", stopErr);
          }
          setScanning(false);
          try {
            await handleScanResult(decodedText, userId);
          } catch (err: any) {
            console.error("Errore dopo la scansione:", err);
            setError("Errore dopo la scansione: " + (err?.message || String(err)));
          }
        },
        () => {
          // Chiamato a ogni fotogramma senza QR rilevato: normale, si ignora.
        }
      );
      return true;
    } catch (err) {
      console.error(`Fotocamera ${cameraId} non disponibile:`, err);
      return false;
    }
  };

  const startScanWithCamera = async (cameraId: string) => {
    setCameras(null);
    setScanning(true);
    setError("");
    const ok = await tryStartCamera(cameraId);
    if (!ok) {
      setScanning(false);
      setError("Impossibile avviare questa fotocamera. Riprova o scegline un'altra.");
    }
  };

  const handleAvviaScanner = async () => {
    const userId = getCookie("user_id");
    if (!userId) {
      alert("Accesso non valido. Usa il link personale.");
      router.push("/");
      return;
    }

    setError("");
    setLoadingCameras(true);
    let found: CameraInfo[] = [];
    try {
      found = await Html5Qrcode.getCameras();
    } catch (err: any) {
      setLoadingCameras(false);
      setError("Impossibile accedere alla fotocamera: " + (err?.message || String(err)));
      return;
    }
    setLoadingCameras(false);

    if (!found || found.length === 0) {
      setError("Nessuna fotocamera trovata sul dispositivo");
      return;
    }

    // Prova in automatico tutte le fotocamere posteriori, una dopo l'altra,
    // saltando in silenzio quelle che danno errore (es. obiettivi secondari
    // non accessibili). L'utente non deve mai vedere questo tentativo.
    const backCameras = found.filter((c) => /back|rear|environment/i.test(c.label));
    const candidates = backCameras.length > 0 ? backCameras : found;

    setScanning(true);
    for (const cam of candidates) {
      const ok = await tryStartCamera(cam.id);
      if (ok) return;
    }

    // Nessuna fotocamera automatica ha funzionato: lascia scegliere a mano.
    setScanning(false);
    if (found.length > 1) {
      setCameras(found);
    } else {
      setError("Impossibile avviare la fotocamera disponibile sul dispositivo.");
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

      {!scanning && !cameras && (
        <button
          onClick={handleAvviaScanner}
          disabled={loadingCameras}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 60,
            fontWeight: 600,
            background: "#FF6B35",
            color: "white",
            border: "none",
          }}
        >
          {loadingCameras ? "Ricerca fotocamere..." : "📷 Avvia Scanner"}
        </button>
      )}

      {cameras && !scanning && (
        <div>
          <p style={{ textAlign: "center", color: "#1E3A5F", fontWeight: 600 }}>
            Scegli la fotocamera da usare:
          </p>
          {cameras.map((cam) => (
            <button
              key={cam.id}
              onClick={() => startScanWithCamera(cam.id)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 8,
                borderRadius: 10,
                fontWeight: 600,
                background: "#f0f0f0",
                color: "#1E3A5F",
                border: "1px solid #ccc",
              }}
            >
              {cam.label || "Fotocamera senza nome"}
            </button>
          ))}
          <button
            onClick={() => setCameras(null)}
            style={{
              width: "100%",
              padding: 10,
              marginTop: 4,
              background: "none",
              color: "#999",
              border: "none",
              textDecoration: "underline",
            }}
          >
            Annulla
          </button>
        </div>
      )}

      {scanning && (
        <p style={{ textAlign: "center", color: "#1E3A5F" }}>
          Scanner attivo... Inquadra un QR
        </p>
      )}

      {error && (
        <p style={{ color: "red", textAlign: "center", marginTop: 16 }}>
          {error}
        </p>
      )}

      <div id="reader" style={{ width: "100%", marginTop: 20 }}></div>
    </div>
  );
}
