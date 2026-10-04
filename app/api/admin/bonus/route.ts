import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin } from "@/lib/pins";
import { patchActive, deleteById } from "@/lib/adminCrud";
import { asShortText, readJsonObject } from "@/lib/http";

export const dynamic = "force-dynamic";

const LIST_FIELDS = "id, title, amount, code, pin, active, created_at";
const MAX_RECHARGE_COINS = 100;

// GET: elenco dei QR ricarica esistenti — admin o staff.
export async function GET() {
  if (!(await requireRole("admin", "staff"))) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }
  const { data, error } = await getSupabaseAdmin().from("bonus_qr").select(LIST_FIELDS).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ bonuses: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

// POST: crea un QR ricarica bonus — admin o staff. Non si crea un secondo QR con lo stesso titolo
// (maiuscole a parte): risposta 409 con quello esistente.
export async function POST(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ message: "Richiesta non valida" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const code = asShortText(body.code, 60);
  if (!title || title.length > 80 || !code) {
    return NextResponse.json({ message: "Dati mancanti o troppo lunghi" }, { status: 400 });
  }
  // Coin della ricarica: numero intero da 1 a 100 (mai negativo, mai enorme, anche se chiamata da fuori dalla pagina).
  const amount = body.amount === undefined || body.amount === null || body.amount === "" ? 5 : Number(body.amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_RECHARGE_COINS) {
    return NextResponse.json({ message: `I coin della ricarica devono essere un numero intero da 1 a ${MAX_RECHARGE_COINS}` }, { status: 400 });
  }
  const wanted = String(title).trim().toLowerCase();
  const { data: all } = await getSupabaseAdmin().from("bonus_qr").select(LIST_FIELDS).order("created_at", { ascending: true });
  const already = (all || []).find((b: any) => String(b.title || "").trim().toLowerCase() === wanted);
  if (already) {
    return NextResponse.json({ message: `Esiste già un QR ricarica con questo titolo (${already.amount} coins)`, existing: already }, { status: 409 });
  }

  const pin = await generateUnusedPin();

  const { data, error } = await getSupabaseAdmin()
    .from("bonus_qr")
    .insert({ title, amount, code, pin, active: true })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ bonus: data });
}

// PATCH: attiva/disattiva — admin o staff. DELETE: elimina — solo admin.
export const PATCH = (request: Request) => patchActive(request, "bonus_qr");
export const DELETE = (request: Request) => deleteById(request, "bonus_qr");
