"use client";

import { useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
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

// Rilevamento (parziale: molte app tipo WhatsApp non si distinguono in modo
// affidabile) del browser "in-app" di alcuni social, che spesso non può
// proprio accedere alla fotocamera — in quel caso mostriamo un avviso mirato.
function detectInAppBrowser(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV/i.test(ua)) return "Facebook";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/\bLine\//i.test(ua)) return "LINE";
  return null;
}

type CameraInfo = { id: string; label: string };

export default function ScanPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [cameras, setCameras] = useState<CameraInfo[] | null>(null);
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [helpChoice, setHelpChoice] = useState<"permessi" | "fotocamera" | null>(null);
  const inAppBrowser = detectInAppBrowser();

  const handleScanResult = async (decodedText: string, userId: string) => {
    // ----- PIN a 4 cifre (fallback manuale per chi non riesce a scansionare) -----
    // Prova prima come PIN personale (vota una persona). Se non corrisponde a
    // nessuno, potrebbe essere il PIN stampato sotto un QR di squadra/classe/
    // bonus: in quel caso /api/qr/redeem lo risolve allo stesso modo del QR.
    if (/^\d{4}$/.test(decodedText)) {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: decodedText }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ +${data.points} punti!`);
        router.push("/");
        return;
      }
      if (data.error !== "PIN non valido") {
        alert(data.error || "Errore nel voto");
        router.push("/");
        return;
      }

      const res2 = await fetch("/api/qr/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: decodedText }),
      });
      const data2 = await res2.json();
      if (!res2.ok) {
        alert(data2.error || "PIN non valido");
        router.push("/");
        return;
      }
      if (data2.type === "bonus") {
        alert(`⚡ +${data2.amount} CBTcoin extra!`);
      } else {
        alert(data2.message || "QR riscattato con successo!");
      }
      router.push("/");
      return;
    }

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

  // Prova ad avviare la fotocamera (per id specifico, o per vincolo
  // facingMode). Ritorna true se ci riesce, false se non è utilizzabile
  // (es. NotReadableError su alcuni obiettivi secondari, o vincolo non
  // supportato dal dispositivo). Torcia esplicitamente disattivata: è
  // uno streaming video continuo, non uno scatto — non deve mai lampeggiare
  // né restare accesa, a differenza dello scatto foto nativo (che decide da
  // solo il flash e spesso "brucia" un QR mostrato su schermo).
  const tryStartCamera = async (cameraIdOrConfig: string | MediaTrackConstraints): Promise<boolean> => {
    const userId = getCookie("user_id");
    if (!userId) return false;

    const config: any =
      typeof cameraIdOrConfig === "string"
        ? cameraIdOrConfig
        : { ...cameraIdOrConfig, advanced: [{ torch: false }] };

    const scanner = new Html5Qrcode("reader");
    try {
      await scanner.start(
        config,
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
            await handleScanResult(extractCode(decodedText), userId);
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
      console.error("Fotocamera non disponibile:", cameraIdOrConfig, err);
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
    setScanning(true);

    // 1. Prova diretta con vincolo facingMode "environment": è il browser/
    //    l'hardware a scegliere la fotocamera posteriore corretta, molto più
    //    affidabile che leggere l'etichetta testuale della fotocamera (che
    //    varia per marca/lingua del dispositivo e su molti Android non
    //    contiene affatto "back"/"rear", facendo scegliere per sbaglio la
    //    fotocamera anteriore/selfie).
    if (await tryStartCamera({ facingMode: { exact: "environment" } })) {
      setLoadingCameras(false);
      return;
    }
    if (await tryStartCamera({ facingMode: "environment" })) {
      setLoadingCameras(false);
      return;
    }

    // 2. Fallback: enumera le fotocamere disponibili e prova quelle il cui
    //    nome sembra indicare la posteriore, poi tutte le altre.
    let found: CameraInfo[] = [];
    try {
      found = await Html5Qrcode.getCameras();
    } catch (err: any) {
      setLoadingCameras(false);
      setScanning(false);
      setError("Impossibile accedere alla fotocamera: " + (err?.message || String(err)));
      return;
    }
    setLoadingCameras(false);

    if (!found || found.length === 0) {
      setScanning(false);
      setError("Nessuna fotocamera trovata sul dispositivo");
      return;
    }

    const backCameras = found.filter((c) => /back|rear|environment/i.test(c.label));
    const candidates = backCameras.length > 0 ? backCameras : found;

    for (const cam of candidates) {
      const ok = await tryStartCamera(cam.id);
      if (ok) return;
    }

    // Nessun tentativo automatico ha funzionato: lascia scegliere a mano.
    setScanning(false);
    if (found.length > 1) {
      setCameras(found);
    } else {
      setError("Impossibile avviare la fotocamera disponibile sul dispositivo.");
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

      {!scanning && !cameras && (
        <button
          onClick={handleAvviaScanner}
          disabled={loadingCameras}
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 60,
            fontWeight: 700,
            background: "#FF6B35",
            color: "white",
            border: "none",
            fontSize: "1rem",
          }}
        >
          {loadingCameras ? "Ricerca fotocamere..." : "📷 Scan QR Code"}
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

      {/* ── Non funziona? ─────────────────────────────────────── */}
      {!scanning && (
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <button
            onClick={() => { setShowHelp(!showHelp); if (showHelp) setHelpChoice(null); }}
            style={{ background: "none", border: "none", color: "#FF6B35", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", padding: 0 }}
          >
            {showHelp ? "▲" : "▼"} Non funziona?
          </button>

          {showHelp && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setHelpChoice(helpChoice === "permessi" ? null : "permessi")}
                  style={{ flex: 1, padding: 10, borderRadius: 10, fontWeight: 600, fontSize: "0.8rem", background: helpChoice === "permessi" ? "#1E3A5F" : "#f0f0f0", color: helpChoice === "permessi" ? "white" : "#1E3A5F", border: "1px solid #ccc", cursor: "pointer" }}
                >
                  🔓 Sblocca permessi fotocamera
                </button>
                <button
                  onClick={() => setHelpChoice(helpChoice === "fotocamera" ? null : "fotocamera")}
                  style={{ flex: 1, padding: 10, borderRadius: 10, fontWeight: 600, fontSize: "0.8rem", background: helpChoice === "fotocamera" ? "#1E3A5F" : "#f0f0f0", color: helpChoice === "fotocamera" ? "white" : "#1E3A5F", border: "1px solid #ccc", cursor: "pointer" }}
                >
                  📸 Usa la fotocamera del telefono
                </button>
              </div>

              {helpChoice === "permessi" && (
                <div style={{ marginTop: 12, background: "#fff8e1", borderRadius: 12, padding: 16, fontSize: "0.82rem", color: "#333", lineHeight: 1.5, textAlign: "left" }}>
                  {inAppBrowser && (
                    <p style={{ fontWeight: 700, color: "#dc3545", marginTop: 0 }}>
                      Sembra che tu abbia aperto questo link da {inAppBrowser}: il suo browser interno spesso blocca la fotocamera. Tocca i tre puntini o l'icona di condivisione in alto e scegli "Apri nel browser" (Chrome/Safari), poi riprova.
                    </p>
                  )}
                  <p style={{ fontWeight: 700, marginTop: 0 }}>Hai aperto questo link da WhatsApp, Gmail o un'altra app?</p>
                  <p>È la causa più comune: quei browser "interni" spesso non possono accedere alla fotocamera. Tocca i tre puntini (⋮) o l'icona di condivisione in alto e scegli "Apri nel browser", poi riprova da lì.</p>

                  <p style={{ fontWeight: 700 }}>iPhone (Safari)</p>
                  <p>Tocca "AA" nella barra dell'indirizzo in alto → Impostazioni sito web → Fotocamera → Consenti. Oppure: Impostazioni del telefono → Safari → Fotocamera → Consenti.</p>

                  <p style={{ fontWeight: 700 }}>Android (Chrome)</p>
                  <p>Tocca il lucchetto (o la "i") accanto all'indirizzo → Autorizzazioni → Fotocamera → Consenti. Poi ricarica la pagina.</p>

                  <p style={{ fontWeight: 700 }}>Samsung Internet</p>
                  <p>Menu (⋮) → Impostazioni → Siti web e download → Autorizzazioni sito → Fotocamera → cerca questo sito → Consenti.</p>

                  <p style={{ margin: 0, color: "#666" }}>Se proprio nessuna di queste funziona, usa il PIN qui sotto: vota comunque, senza bisogno della fotocamera.</p>
                </div>
              )}

              {helpChoice === "fotocamera" && (
                <div style={{ marginTop: 12, background: "#e8f5e9", border: "2px solid #2E7D32", borderRadius: 12, padding: 16, fontSize: "0.85rem", color: "#333", lineHeight: 1.5, textAlign: "left" }}>
                  <p style={{ margin: 0 }}>
                    Apri la <strong>fotocamera normale del telefono</strong> (quella di sempre, per le foto — non serve questa app) e inquadra il QR della persona che vuoi votare. Si apre da sola una pagina che registra il voto, senza chiedere nessun permesso.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Vota col PIN ──────────────────────────────────────── */}
      {!scanning && (
        <div style={{ marginTop: 20, background: "#f8f9fa", borderRadius: 12, padding: 16, textAlign: "left" }}>
          <p style={{ margin: "0 0 8px", fontSize: "0.9rem", fontWeight: 700, color: "#1E3A5F" }}>
            🔢 Vota col PIN
          </p>
          <p style={{ margin: "0 0 4px", fontSize: "0.8rem", color: "#333" }}>
            Inserisci il PIN della persona che vuoi votare (ce l'ha scritto sotto il suo QR):
          </p>
          <p style={{ margin: "0 0 10px", fontSize: "0.76rem", fontWeight: 700, color: "#dc3545" }}>
            ⚠️ È il PIN di chi vuoi votare, non il tuo!
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              inputMode="numeric"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="PIN di chi vuoi votare"
              style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: "1.1rem", letterSpacing: 2 }}
            />
            <button
              onClick={handlePasteFromClipboard}
              style={{ padding: "0 14px", borderRadius: 8, background: "#e0e0e0", color: "#333", border: "none", fontWeight: 600, cursor: "pointer", fontSize: "0.8rem" }}
            >
              📋 Incolla
            </button>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#999" }}>
            (oppure il codice del bonus, se devi riscattarne uno)
          </p>
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
  );
}
