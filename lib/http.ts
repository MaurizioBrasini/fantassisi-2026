import { NextResponse } from "next/server";

// Lettura sicura del corpo delle richieste e controlli sui valori che arrivano da fuori.
// Una richiesta con corpo vuoto, "null" o JSON rotto non deve mai finire in un errore 500.

/** Il corpo JSON come oggetto, oppure null se manca, è rotto o non è un oggetto. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const badRequest = (error = "Richiesta non valida") => NextResponse.json({ error }, { status: 400 });

/** IP di chi chiama (dietro il proxy di Render è il primo di x-forwarded-for), per i limiti di tentativi. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || request.headers.get("x-real-ip") || "sconosciuto";
}

/** Un PIN è di 4 cifre. Tutto il resto (lettere, spazi, stringhe lunghissime) non può esistere: si scarta subito. */
export function asPin(value: unknown): string | null {
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return /^\d{4}$/.test(s) ? s : null;
}

/** Un testo breve (codici QR, identificativi): stringa non vuota entro la lunghezza massima. */
export function asShortText(value: unknown, max = 120): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

/** Identificativo di una persona (uuid). */
export function asUuid(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
