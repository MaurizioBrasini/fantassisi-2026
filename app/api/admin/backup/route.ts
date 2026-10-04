import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllRows } from "@/lib/fetchAll";
import { forbidden } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Tabelle del gioco, nell'ordine in cui andrebbero ricaricate (prima quelle a cui le altre rimandano).
const TABLES: { name: string; orderBy?: string }[] = [
  { name: "users" },
  { name: "app_settings", orderBy: "key" },
  { name: "votable_events" },
  { name: "bonus_qr" },
  { name: "team_boosts" },
  { name: "boost_allocations" },
  { name: "votes" },
  { name: "event_votes" },
  { name: "bonus_redemptions" },
];

// GET — solo admin. "Scarica backup": tutte le tabelle del gioco in un unico file JSON, da salvare prima
// di ogni giornata e prima di operazioni rischiose (reset, import). Contiene dati personali, token di
// accesso e codici: va conservato come un documento riservato. Vedi docs/EVENTO.md per come usarlo.
export async function GET() {
  if (!(await requireRole("admin"))) return forbidden();

  const supabase = getSupabaseAdmin();
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  const missing: string[] = [];
  for (const t of TABLES) {
    try {
      const rows = await fetchAllRows(supabase, t.name, "*", { orderBy: t.orderBy || "id" });
      tables[t.name] = rows;
      counts[t.name] = rows.length;
    } catch (e: any) {
      // Una tabella che non esiste ancora (migrazione non eseguita) non blocca il resto del backup.
      missing.push(`${t.name}: ${e?.message || e}`);
    }
  }

  const now = new Date();
  const stamp = now.toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
  const body = JSON.stringify({ app: "FantAssisi 2026", created_at: now.toISOString(), counts, missing, tables });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fantassisi-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
