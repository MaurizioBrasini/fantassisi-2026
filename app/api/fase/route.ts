import { NextResponse } from "next/server";
import { getVotingPhase } from "@/lib/phase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Il voto è aperto? Informazione pubblica e leggera (nessun dato personale, nessuna lettura del
// database oltre alla cache di 5 secondi della fase): la dashboard la chiede ogni 30 secondi mentre
// il voto è chiuso, così chi ha l'app aperta allo scoccare dell'apertura vede subito "Vota".
export async function GET() {
  const phase = await getVotingPhase();
  return NextResponse.json({ open: phase.open, previewStarted: phase.previewStarted, opensAt: phase.opensAt }, { headers: { "Cache-Control": "no-store" } });
}
