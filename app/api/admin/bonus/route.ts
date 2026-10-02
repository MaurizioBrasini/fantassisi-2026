import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin } from "@/lib/pins";
import { patchActive, deleteById } from "@/lib/adminCrud";

// POST: crea un QR ricarica bonus — solo admin
export async function POST(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { title, amount, code } = await request.json();
  if (!title || !code) {
    return NextResponse.json({ message: "Dati mancanti" }, { status: 400 });
  }

  const pin = await generateUnusedPin();

  const { data, error } = await getSupabaseAdmin()
    .from("bonus_qr")
    .insert({ title, amount: amount || 5, code, pin, active: true })
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
