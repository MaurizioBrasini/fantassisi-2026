import { NextResponse } from "next/server";

// L'app non usa l'ottimizzazione delle immagini di Next (le immagini sono servite così come sono,
// next.config.js: images.unoptimized). Il suo indirizzo /_next/image resta però raggiungibile e la
// versione 14 di Next ha avvisi di sicurezza proprio su quell'API (blocco del server, esecuzione di
// codice con immagini AVIF). La si chiude: questo middleware risponde solo a quell'indirizzo e non
// tocca nessun'altra richiesta.
export function middleware() {
  return new NextResponse("Not found", { status: 404 });
}

export const config = {
  matcher: ["/_next/image"],
};
