import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { actionResponse, castEventVote, redeemBonusQr } from "@/lib/qrActions";

// Sistema QR unificato: un unico endpoint per riscattare un codice (bonus_qr.code
// o votable_events.qr_code), oppure lo stesso evento/bonus tramite il PIN a 4
// cifre stampato sotto il QR (fallback voto senza fotocamera, stesso principio
// del PIN personale — quello resta gestito da /api/vote, che lo controlla per
// primo lato client; questo endpoint copre solo eventi/bonus).
export async function POST(request: Request) {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { code, pin } = await request.json();
  if (!code && !pin) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const bonusColumn = code ? "code" : "pin";
  const eventColumn = code ? "qr_code" : "pin";
  const lookupValue = code || pin;

  const { data: bonus } = await supabase.from("bonus_qr").select("*").eq(bonusColumn, lookupValue).maybeSingle();
  const { data: event } = bonus
    ? { data: null }
    : await supabase.from("votable_events").select("*").eq(eventColumn, lookupValue).maybeSingle();

  const result = bonus
    ? await redeemBonusQr(supabase, userId, bonus)
    : event
      ? await castEventVote(supabase, userId, event)
      : null;

  if (!result) {
    return NextResponse.json(
      { error: pin ? "PIN non valido" : "QR non valido o già utilizzato" },
      { status: 404 }
    );
  }
  return actionResponse(result);
}
