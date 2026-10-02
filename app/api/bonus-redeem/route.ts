import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { actionResponse, redeemBonusQr } from "@/lib/qrActions";

export async function POST(request: Request) {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // Il bonus si indica con il suo id oppure con il codice ("BONUS:...") letto dalla fotocamera.
  const { bonusId, code } = await request.json();
  if (!bonusId && !code) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: bonus } = await (bonusId
    ? supabase.from("bonus_qr").select("*").eq("id", bonusId)
    : supabase.from("bonus_qr").select("*").eq("code", String(code))
  ).maybeSingle();
  if (!bonus) {
    return NextResponse.json({ error: "Bonus non valido" }, { status: 404 });
  }

  return actionResponse(await redeemBonusQr(supabase, userId, bonus));
}
