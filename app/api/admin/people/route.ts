import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// Ricerca di una persona per nome (generatore di bonus) — admin o staff. Restituisce solo ciò che
// serve a riconoscerla: niente token, PIN, email o telefono, così lo staff non può usarla per
// entrare come un'altra persona.
export async function GET(request: Request) {
  if (!(await requireRole("admin", "staff"))) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  // Si tolgono i caratteri che nel filtro di Supabase hanno un significato (virgole, punti, parentesi, %).
  const q = (new URL(request.url).searchParams.get("q") || "").replace(/[^A-Za-z0-9À-ɏ '’-]/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ people: [] });

  const words = q.split(/\s+/).slice(0, 3);
  let query = getSupabaseAdmin()
    .from("users")
    .select("id, first_name, last_name, team, site, school, year")
    .in("team", ["Matricole", "Veterani"]); // il voto non guarda il ruolo: anche un admin o un docente in squadra può ricevere punti
  for (const w of words) query = query.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%`);

  const { data, error } = await query.order("last_name").limit(15);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ people: data || [] });
}
