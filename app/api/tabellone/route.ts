import { NextResponse } from "next/server";
import { computeScoreboard } from "@/lib/scoreboard";

// Mai cache Next: la cache vera (pochi secondi, condivisa da tutti i client e da tutte le
// pagine dell'app) è in lib/standings.ts, che se il ricalcolo fallisce serve l'ultimo dato
// buono: meglio quello che uno schermo vuoto sul proiettore.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    return NextResponse.json(await computeScoreboard(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Errore nel calcolo dei punteggi" }, { status: 500 });
  }
}
