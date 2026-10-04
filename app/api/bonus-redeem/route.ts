import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { actionResponse, redeemBonusQr } from "@/lib/qrActions";
import { asShortText, asUuid, badRequest, readJsonObject } from "@/lib/http";

export async function POST(request: Request) {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // Il bonus si indica con il suo id oppure con il codice ("BONUS:...") letto dalla fotocamera.
  const body = await readJsonObject(request);
  const bonusId = body ? asUuid(body.bonusId) : null;
  const code = body ? asShortText(body.code) : null;
  if (!bonusId && !code) {
    return badRequest();
  }

  const supabase = getSupabaseAdmin();
  const { data: bonus } = await (bonusId
    ? supabase.from("bonus_qr").select("*").eq("id", bonusId)
    : supabase.from("bonus_qr").select("*").eq("code", code as string)
  ).maybeSingle();
  if (!bonus) {
    return NextResponse.json({ error: "Bonus non valido" }, { status: 404 });
  }

  return actionResponse(await redeemBonusQr(supabase, userId, bonus));
}
