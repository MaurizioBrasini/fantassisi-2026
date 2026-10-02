"use client";

import { useState } from "react";

// Dopo l'accesso si torna dove si era (es. a un voto da QR): solo percorsi interni al sito.
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export default function AccediPage() {
  const [email, setEmail] = useState("");
  const [last4, setLast4] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);

  const sendLink = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Scrivi prima la mail con cui ti sei iscritto/a.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/send-link-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setInfo(data.message || "Controlla la tua mail.");
      else setError(data.message || "Qualcosa è andato storto. Riprova.");
    } catch {
      setError("Connessione assente. Riprova.");
    }
    setSending(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, last4 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.href = safeNext();
        return;
      }
      setError(data.message || "Qualcosa è andato storto. Riprova.");
    } catch {
      setError("Connessione assente. Riprova.");
    }
    setLoading(false);
  };

  const input: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    fontSize: 16,
    border: "1px solid #ccc",
    borderRadius: 8,
    marginTop: 6,
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ color: "#1E3A5F", marginBottom: 6 }}>FantAssisi 2026</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Richiedi il tuo accesso personale. Inserisci i dati con cui ti sei iscritto/a al Forum.
      </p>

      <form onSubmit={submit} style={{ background: "white", padding: 20, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
        <label style={{ display: "block", marginBottom: 16, color: "#1E3A5F", fontWeight: 600 }}>
          La mail di iscrizione
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            placeholder="nome@esempio.it"
            style={input}
          />
        </label>

        <label style={{ display: "block", marginBottom: 16, color: "#1E3A5F", fontWeight: 600 }}>
          Ultime 4 cifre del tuo telefono
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            value={last4}
            onChange={(ev) => setLast4(ev.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1234"
            style={input}
          />
        </label>

        {error && (
          <p role="alert" style={{ color: "#B00020", fontSize: 14, margin: "0 0 12px" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 24px",
            background: "#FF6B35",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 16,
            fontWeight: "bold",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Controllo..." : "ENTRA IN FANTASSISI"}
        </button>
      </form>

      <div style={{ background: "white", padding: 20, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", marginTop: 16 }}>
        <p style={{ color: "#1E3A5F", fontWeight: 600, margin: "0 0 6px" }}>Non riesci a entrare?</p>
        <p style={{ color: "#555", fontSize: 14, margin: "0 0 12px" }}>
          Chiedi la mail all&apos;organizzatore: scrivi sopra la tua mail di iscrizione e premi il pulsante. Ti mandiamo
          noi il link personale a quell&apos;indirizzo.
        </p>
        {info && (
          <p role="status" style={{ color: "#1B7F3B", fontSize: 14, margin: "0 0 12px" }}>
            {info}
          </p>
        )}
        <button
          type="button"
          onClick={sendLink}
          disabled={sending}
          style={{
            width: "100%",
            padding: "12px 24px",
            background: "white",
            color: "#1E3A5F",
            border: "2px solid #1E3A5F",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: "bold",
            opacity: sending ? 0.6 : 1,
          }}
        >
          {sending ? "Invio..." : "RICEVI IL LINK PER MAIL"}
        </button>
      </div>

      <p style={{ color: "#777", fontSize: 13, marginTop: 16 }}>
        Il telefono è quello che hai indicato nella scheda di iscrizione.
      </p>
    </div>
  );
}
