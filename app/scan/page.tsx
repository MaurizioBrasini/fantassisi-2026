"use client";

import { Html5QrcodeScanner } from "html5-qrcode";

export default function ScanPage() {
  const scanner = new Html5QrcodeScanner(
    "reader",
    { fps: 10 },
    { 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    }
  );
  scanner.render(
    (decodedText) => {
      alert(`QR scansionato: ${decodedText}`);
      scanner.clear();
    },
    (error) => {
      console.error(error);
    }
  );
  return <div id="reader"></div>;
}
