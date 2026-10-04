// Compone QR + titolo + PIN in un'unica immagine PNG, da inserire in una slide o stampare:
// chi non riesce a scansionare può comunque votare inserendo a mano il PIN. Solo lato browser.
export async function qrWithPinImage(qrDataUrl: string, heading: string, pin: string | null): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("QR non caricato"));
    img.src = qrDataUrl;
  });
  const qr = 600, pad = 40, head = 70, foot = pin ? 190 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = qr + pad * 2;
  canvas.height = head + qr + pad + foot;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas non supportato");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#1E3A5F";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText(heading, canvas.width / 2, 50, canvas.width - 40);
  ctx.drawImage(img, pad, head, qr, qr);
  if (pin) {
    ctx.fillStyle = "#666666";
    ctx.font = "26px system-ui, sans-serif";
    ctx.fillText("Oppure vota con il codice", canvas.width / 2, head + qr + 50);
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
