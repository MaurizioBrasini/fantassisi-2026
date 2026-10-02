import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { actionResponse, castEventVote } from "@/lib/qrActions";

export async function POST(request: Request) {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // Il QR si indica con l'id dell'evento oppure con il suo codice ("EVENT:...") letto dalla fotocamera.
  const { eventId, qrCode } = await request.json();
  if (!eventId && !qrCode) {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: event } = await (eventId
    ? supabase.from("votable_events").select("*").eq("id", eventId)
    : supabase.from("votable_events").select("*").eq("qr_code", String(qrCode))
  ).maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Evento non trovato" }, { status: 404 });
  }

  return actionResponse(await castEventVote(supabase, userId, event));
}
