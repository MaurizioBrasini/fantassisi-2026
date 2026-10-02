// Cookie letti dalle pagine nel browser (solo per mostrare l'interfaccia: l'identità vera è
// nel cookie firmato httpOnly che legge il server, vedi lib/session.ts).
export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}
