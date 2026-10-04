import QRCode from "qrcode";

// Tutto ciò che serve per disegnare i QR di FantAssisi, in un solo posto (solo lato browser):
// stessi colori ovunque, e un'unica immagine scaricabile "titolo + QR + codice" usata dal pannello
// admin, dalla pagina staff, dalle slides dell'Anteprima e da "Il mio QR".

/** Il QR come immagine (data URL), con i colori di FantAssisi. */
export function qrDataUrl(text: string, width = 600): Promise<string> {
  return QRCode.toDataURL(text, { width, margin: 2, color: { dark: "#1E3A5F", light: "#ffffff" } });
}

/**
 * Compone titolo (facoltativo) + QR + codice in un PNG da stampare o mettere in una slide: chi non
 * riesce a scansionare può votare scrivendo il codice. Senza codice restano titolo e QR.
 */
export async function qrWithPinImage(
  qrImageUrl: string,
  heading: string | null,
  pin: string | null,
  caption = "Oppure vota con il codice"
): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("QR non caricato"));
    img.src = qrImageUrl;
  });
  const qr = 600, pad = 40, head = heading ? 70 : pad, foot = pin ? 190 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = qr + pad * 2;
  canvas.height = head + qr + pad + foot;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non supportato");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  if (heading) {
    ctx.fillStyle = "#1E3A5F";
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillText(heading, canvas.width / 2, 50, canvas.width - 40);
  }
  ctx.drawImage(img, pad, head, qr, qr);
  if (pin) {
    ctx.fillStyle = "#666666";
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillText(caption, canvas.width / 2, head + qr + 50, canvas.width - 40);
    ctx.fillStyle = "#1E3A5F";
    ctx.font = "800 96px system-ui, sans-serif";
    ctx.fillText(pin.split("").join(" "), canvas.width / 2, head + qr + 150);
  }
  return canvas.toDataURL("image/png");
}

/** Scarica un'immagine (data URL) con il nome dato. */
export function downloadDataUrl(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

/** Nome di file pulito a partire da un titolo: "QR_SPC_Roma_4_Anno.png". */
export function qrFileName(title: string): string {
  return `QR_${title.replace(/[^A-Za-z0-9À-ɏ]+/g, "_")}.png`;
}

/** Genera e scarica l'immagine completa di un QR; se il disegno fallisce, scarica almeno il solo QR. */
export async function downloadQrImage(text: string, heading: string | null, pin: string | null, filename: string, caption?: string) {
  const src = await qrDataUrl(text);
  let href = src;
  try {
    href = await qrWithPinImage(src, heading, pin, caption);
  } catch {
    /* si scarica il solo QR */
  }
  downloadDataUrl(href, filename);
}
