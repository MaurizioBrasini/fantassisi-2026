// Cookie letti/scritti dalle pagine nel browser (solo per mostrare l'interfaccia: l'identità vera è
// nel cookie firmato httpOnly che legge il server, vedi lib/session.ts).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 40; // come i cookie di sessione del server

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/** Esce davvero: il server cancella anche il cookie di sessione protetto. */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* anche senza rete si cancellano almeno i cookie visibili */
  }
  for (const name of ["user_id", "user_team", "user_role", "user_class", "user_site"]) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
  window.location.href = "/";
}
