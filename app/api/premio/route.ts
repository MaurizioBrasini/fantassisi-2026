import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// L'ultimo premio palese assegnato, per il banner celebrativo di dashboard e tabellone. Il telefono
// lo chiede a intervalli e mostra il banner una volta sola per premio. Prima di
// sql/07_public_bonuses.sql la lettura fallisce e la risposta è semplicemente "nessun premio".
// Cache di processo di pochi secondi: con ~1200 telefoni che chiedono ogni 20 secondi il database
// viene letto al massimo una volta ogni TTL.
const TTL_MS = 5_000;
let cache: { at: number; prize: unknown } | null = null;

// Senza login: lo chiede anche il tabellone del proiettore, che non ha sessione. Il premio (chi, quanti
// punti, perché) è un annuncio pubblico, come i nomi della top 10 sul tabellone.
export async function GET() {
  if (!cache || Date.now() - cache.at >= TTL_MS) {
    const { data, error } = await getSupabaseAdmin()
      .from("team_boosts")
      .select("id, reason, target_type, target_label, total_points, created_at")
      .eq("kind", "public")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    cache = { at: Date.now(), prize: error ? null : data ?? null };
  }

  return NextResponse.json({ prize: cache.prize }, { headers: { "Cache-Control": "no-store" } });
}
