import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { generateUniquePins } from "@/lib/utils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Un PIN a 4 cifre (fallback voto/riscatto senza fotocamera, come per il QR
// personale) deve essere univoco su tutto lo spazio PIN, non solo nella
// propria tabella: altrimenti lo stesso PIN potrebbe risolvere in modo
// ambiguo a una persona, un evento o un bonus diversi.
async function generatePin(): Promise<string> {
  const [{ data: userPins }, { data: eventPins }, { data: bonusPins }] = await Promise.all([
    supabase.from("users").select("pin").not("pin", "is", null),
    supabase.from("votable_events").select("pin").not("pin", "is", null),
    supabase.from("bonus_qr").select("pin").not("pin", "is", null),
  ]);
  const used = new Set<string>([
    ...(userPins || []).map((u: any) => u.pin as string),
    ...(eventPins || []).map((e: any) => e.pin as string),
    ...(bonusPins || []).map((b: any) => b.pin as string),
  ]);
  return generateUniquePins(1, used)[0];
}

// POST: crea un QR voto (squadra o classe) — solo admin
export async function POST(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { title, qr_type, team_target, class_school, class_site, class_year, qr_code } = await request.json();
  if (!title || !qr_code) {
    return NextResponse.json({ message: "Dati mancanti" }, { status: 400 });
  }

  const pin = await generatePin();

  const { data, error } = await supabase
    .from("votable_events")
    .insert({
      title,
      qr_type: qr_type || "team",
      team_target: team_target || null,
      class_school: class_school || null,
      class_site: class_site || null,
      class_year: class_year || null,
      qr_code,
      pin,
      active: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ event: data });
}

// PATCH: attiva/disattiva un QR voto — admin o staff
export async function PATCH(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { id, active } = await request.json();
  if (!id || typeof active !== "boolean") {
    return NextResponse.json({ message: "Dati mancanti" }, { status: 400 });
  }

  const { error } = await supabase.from("votable_events").update({ active }).eq("id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE: elimina un QR voto — solo admin
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

  const { error } = await supabase.from("votable_events").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
