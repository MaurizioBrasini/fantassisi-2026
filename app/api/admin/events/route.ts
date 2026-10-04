import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { generateUnusedPin } from "@/lib/pins";
import { patchActive, deleteById } from "@/lib/adminCrud";
import { sameClass, canonClass } from "@/lib/classKey";
import { validateClass, teamForYear } from "@/lib/publicBonus";
import { asShortText, readJsonObject } from "@/lib/http";

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

// POST: crea un QR voto (squadra o classe) — solo admin. Mai due QR per la stessa classe o per la
// stessa squadra (l'Anteprima e le slides usano quello esistente): se c'è già, risposta 409 con il QR
// esistente, così chi ha provato a rifarlo lo vede.
export async function POST(request: Request) {
  // I QR di voto muovono i punteggi di squadre e classi: li crea solo l'admin (lo staff li vede e li scarica).
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Solo l'admin può creare QR di voto" }, { status: 403 });
  }

  const body = await readJsonObject(request);
  if (!body) {
    return NextResponse.json({ message: "Richiesta non valida" }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const qr_code = asShortText(body.qr_code, 100);
  if (!title || title.length > 120 || !qr_code) {
    return NextResponse.json({ message: "Dati mancanti o troppo lunghi" }, { status: 400 });
  }

  // Solo i due tipi che esistono, e solo valori veri: squadra Matricole/Veterani, classe che esiste davvero.
  // Per la classe si salvano sempre i valori standard e la squadra si ricava dall'anno (non da chi chiama).
  const qr_type = body.qr_type ?? "team";
  let team_target: string | null = null;
  let class_school: string | null = null;
  let class_site: string | null = null;
  let class_year: string | null = null;
  if (qr_type === "team") {
    if (body.team_target !== "Matricole" && body.team_target !== "Veterani") {
      return NextResponse.json({ message: "Squadra non valida" }, { status: 400 });
    }
    team_target = body.team_target;
  } else if (qr_type === "class") {
    const c = canonClass(String(body.class_school ?? ""), String(body.class_site ?? ""), String(body.class_year ?? ""));
    const problem = validateClass(c.school ?? "", c.site ?? "", c.year ?? "");
    if (problem) {
      return NextResponse.json({ message: problem }, { status: 400 });
    }
    class_school = c.school;
    class_site = c.site;
    class_year = c.year;
    team_target = teamForYear(c.year as string);
  } else {
    return NextResponse.json({ message: "Tipo di QR non valido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const findExisting = async (filter: (q: any) => any) => {
    const { data } = await filter(supabase.from("votable_events").select(LIST_FIELDS))
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return data;
  };

  if (qr_type === "class") {
    // Confronto che ignora la grafia: i primi QR hanno l'anno come "4° ANNO 2026", i nuovi come "quarto".
    const { data: classQrs } = await supabase
      .from("votable_events")
      .select(LIST_FIELDS)
      .eq("qr_type", "class")
      .order("created_at", { ascending: true });
    const wanted = { school: class_school, site: class_site, year: class_year };
    const already = (classQrs || []).find((e: any) => sameClass({ school: e.class_school, site: e.class_site, year: e.class_year }, wanted));
    if (already) {
      return NextResponse.json({ message: `Esiste già il QR di questa classe: ${already.title}`, existing: already }, { status: 409 });
    }
  } else {
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
      qr_type,
      team_target,
      class_school,
      class_site,
      class_year,
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

// PATCH (attiva/disattiva) e DELETE (elimina): solo admin. Spegnere un QR di voto toglie ai partecipanti
// la possibilità di votare quella squadra o classe, quindi non è un'operazione dello staff.
export async function PATCH(request: Request) {
  if (!(await requireRole("admin"))) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }
  return patchActive(request, "votable_events");
}
export const DELETE = (request: Request) => deleteById(request, "votable_events");
