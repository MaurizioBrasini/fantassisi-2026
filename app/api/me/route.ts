import { NextResponse } from "next/server";
import { getVerifiedUserId } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// I dati della persona collegata (nome, squadra, classe, PIN personale), letti dal server in base
// alla sessione: la pagina non ha più bisogno di leggere la tabella utenti dal browser.
export async function GET() {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: user } = await getSupabaseAdmin()
    .from("users")
    .select("first_name, last_name, team, year, is_didatta, pin")
    .eq("id", userId)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }
  return NextResponse.json(user, { headers: { "Cache-Control": "no-store" } });
}
