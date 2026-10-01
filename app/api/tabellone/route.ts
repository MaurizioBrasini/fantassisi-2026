import { NextResponse } from "next/server";
import { computeScoreboard, type ScoreboardData } from "@/lib/scoreboard";

// Mai cache Next: la cache vera è quella in memoria qui sotto.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cache di processo di pochi secondi, condivisa da tutti i client: anche con più
// schermi aperti (o con un reload frenetico) il database viene letto al massimo
// una volta ogni TTL. Le richieste in arrivo mentre si ricalcola aspettano la
// stessa promessa invece di lanciare letture parallele.
const TTL_MS = 5_000;
let cache: { at: number; data: ScoreboardData } | null = null;
let inflight: Promise<ScoreboardData> | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return NextResponse.json(cache.data, { headers: { "Cache-Control": "no-store" } });
    }
    if (!inflight) {
      inflight = computeScoreboard()
        .then((data) => {
          cache = { at: Date.now(), data };
          return data;
        })
        .finally(() => {
          inflight = null;
        });
    }
    const data = await inflight;
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Se il ricalcolo fallisce ma c'è un dato precedente, meglio mostrare quello
    // che uno schermo vuoto sul proiettore.
    if (cache) return NextResponse.json(cache.data, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ message: "Errore nel calcolo dei punteggi" }, { status: 500 });
  }
}
