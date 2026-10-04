import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { actionResponse, castEventVote } from "@/lib/qrActions";
import { asShortText, asUuid, badRequest, readJsonObject } from "@/lib/http";

export async function POST(request: Request) {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // Il QR si indica con l'id dell'evento oppure con il suo codice ("EVENT:...") letto dalla fotocamera.
  const body = await readJsonObject(request);
  const eventId = body ? asUuid(body.eventId) : null;
  const qrCode = body ? asShortText(body.qrCode) : null;
  if (!eventId && !qrCode) {
    return badRequest();
  }

  const supabase = getSupabaseAdmin();
  const { data: event } = await (eventId
    ? supabase.from("votable_events").select("*").eq("id", eventId)
    : supabase.from("votable_events").select("*").eq("qr_code", qrCode as string)
  ).maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Evento non trovato" }, { status: 404 });
  }

  return actionResponse(await castEventVote(supabase, userId, event));
}
