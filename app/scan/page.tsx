"use client"; 
import { Html5QrcodeScanner } from "html5-qrcode"; 
export default function ScanPage() { 
  new Html5QrcodeScanner("reader", { fps: 10 }).render(() =
  return <div id="reader"></div>; 
} 
