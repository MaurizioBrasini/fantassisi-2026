import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin } from "@/lib/pins";

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

// PATCH: attiva/disattiva un bonus — admin o staff
export async function PATCH(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { id, active } = await request.json();
  if (!id || typeof active !== "boolean") {
    return NextResponse.json({ message: "Dati mancanti" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from("bonus_qr").update({ active }).eq("id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE: elimina un bonus — solo admin
export async function DELETE(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "ID mancante" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from("bonus_qr").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
