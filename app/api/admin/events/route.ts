import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
