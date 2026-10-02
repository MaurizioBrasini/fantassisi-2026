import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getStandings, dashboardRank } from "@/lib/standings";
import { startOfTodayInRomeISO } from "@/lib/utils";
import { DAILY_COINS } from "@/lib/coins";

// Punteggi e classifiche per le pagine dell'app: i telefoni ricevono solo il risultato già
// calcolato (e in cache per pochi secondi), invece di scaricare tutte le tabelle a ogni apertura.
//   ?view=dashboard  -> squadre, i miei punti, la mia posizione, i CBT coin rimasti
//   ?view=individuali | classi | sedi -> le classifiche complete
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store" };

// CBT coin rimasti oggi (giornata italiana): 20 + bonus riscattati oggi - voti dati oggi.
async function remainingCoins(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const startOfToday = startOfTodayInRomeISO();
  const [{ count: votesToday }, { data: redemptions }] = await Promise.all([
    supabase.from("votes").select("id", { count: "exact", head: true }).eq("voter_id", userId).gte("voted_at", startOfToday),
    supabase.from("bonus_redemptions").select("bonus_id").eq("user_id", userId).gte("redeemed_at", startOfToday),
  ]);

  const bonusIds = Array.from(new Set((redemptions || []).map((r: { bonus_id: string }) => r.bonus_id)));
  let totalBonus = 0;
  if (bonusIds.length > 0) {
    const { data: bonuses } = await supabase.from("bonus_qr").select("amount").in("id", bonusIds);
    totalBonus = (bonuses || []).reduce((sum: number, b: { amount: number | null }) => sum + (b.amount || 0), 0);
  }
  return Math.max(0, DAILY_COINS + totalBonus - (votesToday || 0));
}

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
            remainingCoins: await remainingCoins(userId),
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
