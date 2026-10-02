import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllRows } from "@/lib/fetchAll";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Tutti i dati che il pannello admin mostra (utenti, QR voto, QR bonus, bonus a tempo), letti dal
// server solo per admin e staff. Il pannello non legge più le tabelle dal browser: i token di
// accesso e i dati personali non devono essere raggiungibili con la sola chiave pubblica.
export async function GET() {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const newestFirst = (table: string) => supabase.from(table).select("*").order("created_at", { ascending: false });

  try {
    const [users, events, bonuses, boosts, allocations] = await Promise.all([
      fetchAllRows(supabase, "users", "*"),
      newestFirst("votable_events"),
      newestFirst("bonus_qr"),
      newestFirst("team_boosts"),
      // Punti già maturati dei bonus a persone (la tabella può non esistere ancora)
      fetchAllRows<{ boost_id: string; points: number }>(supabase, "boost_allocations", "boost_id, points", {
        filter: (q) => q.lte("at", new Date().toISOString()),
      }).catch(() => []),
    ]);

    const accruedByBoost = new Map<string, number>();
    for (const a of allocations) accruedByBoost.set(a.boost_id, (accruedByBoost.get(a.boost_id) || 0) + a.points);
    const boostsWithAccrued = (boosts.data || []).map((b: any) => (b.distributed ? { ...b, accrued: accruedByBoost.get(b.id) || 0 } : b));

    return NextResponse.json(
      { users, events: events.data || [], bonuses: bonuses.data || [], boosts: boostsWithAccrued },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json({ message: e.message || "Errore nel leggere i dati" }, { status: 500 });
  }
}
