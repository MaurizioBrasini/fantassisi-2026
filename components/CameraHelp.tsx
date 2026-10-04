"use client";

import type { ReactNode } from "react";

// Guida per far funzionare la fotocamera. Usata dalla pagina di scansione ("Non funziona?") e dalla
// pagina pubblica /guida (da condividere in anticipo, senza bisogno di essere già entrati).

/** Browser "interni" ad altre app, che spesso bloccano la fotocamera. */
export function detectInAppBrowser(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV/i.test(ua)) return "Facebook";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/\bLine\//i.test(ua)) return "LINE";
  return null;
}

// Screenshot del passaggio, in public/help/. Se il file manca l'immagine si nasconde da sola
// (onError) e resta il testo.
function StepImg({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      style={{ display: "block", maxWidth: "100%", borderRadius: 8, margin: "6px 0 12px", border: "1px solid #eee" }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

const step = (text: string): ReactNode => <p style={{ fontWeight: 700 }}>{text}</p>;

/** Come sbloccare il permesso della fotocamera (iPhone e Android). */
export function PermissionsHelp({ inAppBrowser, isRicarica }: { inAppBrowser: string | null; isRicarica: boolean }) {
  return (
    <div style={{ marginTop: 12, background: "#fff8e1", borderRadius: 12, padding: 16, fontSize: "0.82rem", color: "#333", lineHeight: 1.5, textAlign: "left" }}>
      {inAppBrowser && (
        <p style={{ fontWeight: 700, color: "#dc3545", marginTop: 0 }}>
          Sembra che tu abbia aperto questo link da {inAppBrowser}: il suo browser interno spesso blocca la fotocamera. Tocca i tre puntini o l&apos;icona di condivisione in alto e scegli &quot;Apri nel browser&quot; (Chrome/Safari), poi riprova.
        </p>
      )}
      <p style={{ fontWeight: 700, marginTop: 0 }}>Hai aperto questo link da WhatsApp, Gmail o un&apos;altra app?</p>
      <p>È la causa più comune: quei browser &quot;interni&quot; spesso non possono accedere alla fotocamera. Tocca i tre puntini (⋮) o l&apos;icona di condivisione in alto e scegli &quot;Apri nel browser&quot;, poi riprova da lì.</p>

      {step("🤖 Android (Chrome / Edge) — passo 1")}
      <p>In alto, a sinistra dell&apos;indirizzo del sito, tocca l&apos;icona cerchiata (a seconda della versione di Chrome è un lucchetto oppure due piccoli cursori):</p>
      <StepImg src="/help/android-1-icona.jpg" alt="Icona a sinistra dell'indirizzo nella barra di Chrome" />

      {step("Passo 2")}
      <p>Nel menu che si apre tocca &quot;Autorizzazioni&quot; (o &quot;Impostazioni sito&quot;):</p>
      <StepImg src="/help/android-2-autorizzazioni.jpg" alt="Voce Autorizzazioni nel menu del sito" />

      {step("Passo 3")}
      <p>Controlla che &quot;Videocamera&quot; (a volte &quot;Fotocamera&quot;) sia <strong>acceso</strong> e dica &quot;Autorizzazione concessa&quot;. Se è spento, toccalo per accenderlo, poi torna all&apos;app e ricarica la pagina:</p>
      <StepImg src="/help/android-3-videocamera.jpg" alt="Interruttore Videocamera acceso" />
      <p style={{ color: "#666" }}>Se dice che l&apos;autorizzazione è bloccata o non vedi l&apos;interruttore, tocca in fondo &quot;Reimposta le autorizzazioni&quot; e riprova.</p>

      {step("Samsung Internet")}
      <p>Menu (⋮) → Impostazioni → Siti web e download → Autorizzazioni sito → Fotocamera → cerca questo sito → Consenti.</p>

      {step("📱 iPhone (Safari) — passo 1")}
      <p>In alto, a sinistra dell&apos;indirizzo del sito, tocca &quot;AA&quot; (a volte è uno scudo).</p>
      {step("Passo 2")}
      <p>Nel menu che si apre, tocca &quot;Impostazioni sito web&quot;.</p>
      {step("Passo 3")}
      <p>Tocca &quot;Fotocamera&quot; e scegli &quot;Consenti&quot;, poi ricarica la pagina.</p>

      <p style={{ fontWeight: 700, color: "#dc3545" }}>Non vedi &quot;Fotocamera&quot; nel menu, o hai già provato senza risultato?</p>
      <p>Il blocco allora è un livello più su, nell&apos;app Impostazioni del telefono (non dentro Safari):</p>
      <p>
        1. Impostazioni → Safari → Fotocamera → Consenti.
        <br />
        2. Se non basta: Impostazioni → Privacy e sicurezza → Fotocamera → controlla che l&apos;interruttore accanto a &quot;Safari&quot; sia acceso (verde).
      </p>
      <p style={{ color: "#666", fontSize: "0.78rem" }}>(Su iPhone, usando Chrome invece di Safari, il permesso si trova come su Android: tocca l&apos;icona accanto all&apos;indirizzo.)</p>

      <p style={{ margin: 0, color: "#666" }}>Se proprio nessuna di queste funziona, usa il codice: {isRicarica ? "ricarica" : "vota"} comunque, senza bisogno della fotocamera.</p>
    </div>
  );
}

/** L'alternativa che non richiede nessun permesso: la fotocamera normale del telefono. */
export function NativeCameraHelp({ isRicarica }: { isRicarica: boolean }) {
  return (
    <div style={{ marginTop: 12, background: "#e8f5e9", border: "2px solid #2E7D32", borderRadius: 12, padding: 16, fontSize: "0.85rem", color: "#333", lineHeight: 1.5, textAlign: "left" }}>
      <p style={{ margin: 0 }}>
        Apri la <strong>fotocamera normale del telefono</strong> (quella di sempre, per le foto — non serve questa app) e inquadra {isRicarica ? "il QR della ricarica" : "il QR della persona che vuoi votare"}. Si apre da sola una pagina che {isRicarica ? "accredita i CBTcoin" : "registra il voto"}, senza chiedere nessun permesso.
      </p>
    </div>
  );
}
