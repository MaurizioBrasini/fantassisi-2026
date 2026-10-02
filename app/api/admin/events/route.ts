import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin } from "@/lib/pins";
import { patchActive, deleteById } from "@/lib/adminCrud";

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

  const pin = await generateUnusedPin();

  const { data, error } = await getSupabaseAdmin()
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

// PATCH: attiva/disattiva — admin o staff. DELETE: elimina — solo admin.
export const PATCH = (request: Request) => patchActive(request, "votable_events");
export const DELETE = (request: Request) => deleteById(request, "votable_events");
