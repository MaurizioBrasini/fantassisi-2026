// Indirizzo pubblico dell'app e link personale di accesso: un solo posto per entrambi.
// NEXT_PUBLIC_APP_URL (facoltativa) permette di cambiare dominio senza toccare il codice.
const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://fantassisi-2026.onrender.com").replace(/\/+$/, "");

export function personalLink(authToken: string): string {
  return `${APP_BASE_URL}/api/auth?token=${authToken}`;
}

/** Origine da cui è arrivata la richiesta (dietro proxy usa gli header inoltrati). */
export function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return APP_BASE_URL;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}
