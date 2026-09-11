"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

// Pagina aperta scansionando il QR personale di qualcuno con la fotocamera
// NATIVA del telefono (non quella in-pagina) — il QR ora contiene questo
// link diretto invece del solo id, cosi' funziona anche su dispositivi dove
// l'accesso alla fotocamera dentro il browser e' inaffidabile o bloccato.
export default function VotePage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState<"loading" | "done" | "error" | "noaccess" | "self">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const vote = async () => {
      const userId = getCookie("user_id");
      if (!userId) {
        setStatus("noaccess");
        return;
      }
      if (params.id === userId) {
        setStatus("self");
        return;
      }
      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId: params.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Errore nel voto");
          return;
        }
        setStatus("done");
        setMessage(`+${data.points} punti!`);
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message || "Errore di rete");
      }
    };
    vote();
  }, [params.id]);

  const box = (title: string, text: string, color: string) => (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ color }}>{title}</h2>
      <p style={{ color: "#666" }}>{text}</p>
      <Link href="/" style={{ display: "inline-block", marginTop: 16, color: "#FF6B35", fontWeight: 600, textDecoration: "none" }}>
        ← Torna alla dashboard
      </Link>
    </div>
  );

  if (status === "loading") {
    return <div style={{ textAlign: "center", padding: 40 }}>Registrazione voto...</div>;
  }
  if (status === "noaccess") {
    return box("Accesso non valido", "Usa il link personale che ti è stato inviato per entrare nell'app, poi riprova a scansionare.", "#1E3A5F");
  }
  if (status === "self") {
    return box("Non puoi votare te stesso", "Questo è il tuo QR personale.", "#1E3A5F");
  }
  if (status === "error") {
    return box("Voto non registrato", message, "#dc3545");
  }

  const confetti = ["🎉", "⭐", "✨", "🎊", "⭐", "✨"];
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 20, textAlign: "center", fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      {confetti.map((emoji, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${15 + i * 14}%`,
            top: "40%",
            fontSize: "1.4rem",
            animation: `confettiFloat 1.1s ease-out ${i * 0.06}s both`,
          }}
        >
          {emoji}
        </span>
      ))}
      <h2 style={{ color: "#2E7D32", animation: "pointsPop 0.4s cubic-bezier(.34,1.56,.64,1) both" }}>
        ✅ Voto registrato!
      </h2>
      <p style={{ color: "#2E7D32", fontSize: "1.6rem", fontWeight: 800, animation: "pointsPop 0.4s cubic-bezier(.34,1.56,.64,1) 0.08s both" }}>
        {message}
      </p>
      <Link href="/" style={{ display: "inline-block", marginTop: 16, color: "#FF6B35", fontWeight: 600, textDecoration: "none" }}>
        ← Torna alla dashboard
      </Link>
    </div>
  );
}
