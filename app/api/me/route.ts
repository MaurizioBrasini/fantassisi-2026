import { NextResponse } from "next/server";
import { getVerifiedUserId, applySessionCookies } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getVotingPhase } from "@/lib/phase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// I dati della persona collegata (nome, squadra, classe, PIN personale), letti dal server in base
// alla sessione: le pagine non leggono più la tabella utenti dal browser.
//
// A ogni apertura dell'app questa chiamata rinnova anche i cookie di sessione (altri 40 giorni):
// chi usa l'app non scade mai e non deve rifare l'accesso.
export async function GET() {
  const userId = getVerifiedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { data: user } = await getSupabaseAdmin()
    .from("users")
    .select("first_name, last_name, team, year, site, role, is_didatta, pin")
    .eq("id", userId)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  const phase = await getVotingPhase();
  const response = NextResponse.json(
    { ...user, voting_open: phase.open, voting_opens_at: phase.opensAt },
    { headers: { "Cache-Control": "no-store" } }
  );
  applySessionCookies(response, { id: userId, team: user.team, role: user.role, year: user.year, site: user.site });
  return response;
}
