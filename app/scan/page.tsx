"use client";

import { Html5Qrcode } from "html5-qrcode";

export default function ScanPage() {
  const startScan = () => {
    const scanner = new Html5Qrcode("reader");
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        alert(`QR scansionato: ${decodedText}`);
        scanner.stop();
        scanner.clear();
      },
      (error) => {
        console.error(error);
      }
    );
  };

  return (
    <div>
      <button onClick={startScan}>Avvia Scanner</button>
      <div id="reader" style={{ width: "100%", maxWidth: "400px", marginTop: "16px" }}></div>
    </div>
  );
}
