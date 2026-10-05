"use client";

import { useEffect, useState } from "react";
import { downloadDataUrl, qrDataUrl, qrWithPinImage } from "@/lib/qrImage";

type Qr = { title: string | null; qr_code: string; pin: string | null };
type Data = { team: Qr | null; class: Qr | null; className: string };

function QrCard({ label, heading, qr, filename }: { label: string; heading: string; qr: Qr; filename: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    qrDataUrl(qr.qr_code)
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [qr.qr_code]);

  const download = async () => {
    if (!src) return;
    let href = src;
    try { href = await qrWithPinImage(src, heading, qr.pin); } catch { /* si scarica il solo QR */ }
    downloadDataUrl(href, filename);
  };

  return (
    <div style={{ background: "#f8f9fa", borderRadius: 16, padding: 16, textAlign: "center", marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: "#1E3A5F" }}>{label}</div>
      <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 10 }}>{heading}</div>
      {src ? (
        <img src={src} alt={`QR ${label}`} style={{ width: "100%", maxWidth: 260, borderRadius: 12 }} />
      ) : (
        <div style={{ padding: 40, color: "#999" }}>…</div>
      )}
      {qr.pin && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: "0.75rem", color: "#666" }}>Codice</div>
          <div style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: 6, color: "#1E3A5F" }}>{qr.pin}</div>
        </div>
      )}
      <button
        onClick={download}
        disabled={!src}
        style={{ marginTop: 12, padding: "10px 20px", borderRadius: 60, background: "#1E3A5F", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
      >
        ⬇️ Scarica l&apos;immagine
      </button>
    </div>
  );
}

// I QR di squadra e di classe di chi guarda, da proiettare nelle slides (dashboard, a voto aperto).
export default function AnteprimaQr() {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/anteprima", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  return (
    <div style={{ marginBottom: 24 }}>
      {!data && !failed && <p style={{ textAlign: "center", color: "#999" }}>Caricamento dei QR…</p>}
      {failed && <p style={{ textAlign: "center", color: "#666" }}>Non riesco a caricare i QR. Riprova tra poco.</p>}
      {data?.team && <QrCard label="QR della tua squadra" heading={data.team.title || "Squadra"} qr={data.team} filename="QR_squadra.png" />}
      {data?.class && <QrCard label="QR della tua classe" heading={`Vota ${data.className}`} qr={data.class} filename="QR_classe.png" />}
      {data && !data.class && (
        <p style={{ textAlign: "center", color: "#666", fontSize: "0.85rem" }}>
          Il QR di classe è riservato agli studenti in corso: per te vale il QR della squadra qui sopra.
        </p>
      )}
    </div>
  );
}
