import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin } from "@/lib/pins";
import { patchActive, deleteById } from "@/lib/adminCrud";

export const dynamic = "force-dynamic";

const LIST_FIELDS = "id, title, qr_type, team_target, class_school, class_site, class_year, qr_code, pin, active, created_at";

// GET: elenco dei QR voto esistenti (squadra e classe) — admin o staff. Serve allo staff per vedere
// cosa c'è già prima di crearne uno: il QR è comunque pensato per essere mostrato.
export async function GET() {
  if (!(await requireRole("admin", "staff"))) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }
  const { data, error } = await getSupabaseAdmin()
    .from("votable_events")
    .select(LIST_FIELDS)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ events: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

// POST: crea un QR voto (squadra o classe) — admin o staff. Mai due QR per la stessa classe o per la
// stessa squadra (l'Anteprima e le slides usano quello esistente): se c'è già, risposta 409 con il QR
// esistente, così chi ha provato a rifarlo lo vede.
export async function POST(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { title, qr_type, team_target, class_school, class_site, class_year, qr_code } = await request.json();
  if (!title || !qr_code) {
    return NextResponse.json({ message: "Dati mancanti" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const findExisting = async (filter: (q: any) => any) => {
    const { data } = await filter(supabase.from("votable_events").select(LIST_FIELDS))
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return data;
  };

  if (qr_type === "class" && class_school && class_site && class_year) {
    const already = await findExisting((q) =>
      q.eq("qr_type", "class").eq("class_school", class_school).eq("class_site", class_site).eq("class_year", class_year)
    );
    if (already) {
      return NextResponse.json({ message: `Esiste già il QR di questa classe: ${already.title}`, existing: already }, { status: 409 });
    }
  }
  if ((qr_type || "team") === "team" && team_target) {
    const already = await findExisting((q) => q.eq("qr_type", "team").eq("team_target", team_target));
    if (already) {
      return NextResponse.json({ message: `Esiste già il QR della squadra ${team_target}: ${already.title}`, existing: already }, { status: 409 });
    }
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
