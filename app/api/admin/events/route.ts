import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin } from "@/lib/pins";
import { patchActive, deleteById } from "@/lib/adminCrud";

// POST: crea un QR voto (squadra o classe) — admin o staff. Per una classe che ha già il suo QR
// non se ne crea un secondo (l'Anteprima e le slides usano quello): si restituisce l'esistente.
export async function POST(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { title, qr_type, team_target, class_school, class_site, class_year, qr_code } = await request.json();
  if (!title || !qr_code) {
    return NextResponse.json({ message: "Dati mancanti" }, { status: 400 });
  }

  if (qr_type === "class" && class_school && class_site && class_year) {
    const { data: already } = await getSupabaseAdmin()
      .from("votable_events")
      .select("*")
      .eq("qr_type", "class")
      .eq("class_school", class_school)
      .eq("class_site", class_site)
      .eq("class_year", class_year)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (already) return NextResponse.json({ event: already, existing: true });
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
