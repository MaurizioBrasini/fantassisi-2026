import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getStandings, dashboardRank } from "@/lib/standings";
import { getCoinBalance } from "@/lib/coins";

// Punteggi e classifiche per le pagine dell'app: i telefoni ricevono solo il risultato già
// calcolato (e in cache per pochi secondi), invece di scaricare tutte le tabelle a ogni apertura.
//   ?view=dashboard  -> squadre, i miei punti, la mia posizione, i CBT coin rimasti
//   ?view=individuali | classi | sedi -> le classifiche complete
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401, headers: NO_STORE });
  }

  const view = new URL(request.url).searchParams.get("view");
  try {
    const standings = await getStandings();
    const me = standings.userInfo.get(userId);

    switch (view) {
      case "dashboard":
        return NextResponse.json(
          {
            teams: standings.teams,
            myPoints: standings.pointsByUser.get(userId) || 0,
            myRank: dashboardRank(standings, userId),
            remainingCoins: (await getCoinBalance(getSupabaseAdmin(), userId)).remaining,
          },
          { headers: NO_STORE }
        );
      case "individuali":
        return NextResponse.json({ rows: standings.individuals }, { headers: NO_STORE });
      case "classi":
        return NextResponse.json(
          { rows: standings.classes, myKey: me?.school && me?.site && me?.year ? `${me.school}||${me.site}||${me.year}` : null },
          { headers: NO_STORE }
        );
      case "sedi":
        return NextResponse.json({ rows: standings.sites, mySite: me?.site || null }, { headers: NO_STORE });
      default:
        return NextResponse.json({ error: "Vista non valida" }, { status: 400, headers: NO_STORE });
    }
  } catch {
    return NextResponse.json({ error: "Errore nel calcolo dei punteggi" }, { status: 500, headers: NO_STORE });
  }
}
