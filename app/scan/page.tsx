"use client";

import { Html5QrcodeScanner } from "html5-qrcode";

export default function ScanPage() {
  const scanner = new Html5QrcodeScanner("reader", { fps: 10 });
  scanner.render(() => {});
  return <div id="reader"></div>;
}
