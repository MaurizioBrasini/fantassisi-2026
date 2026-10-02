import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllRows } from "@/lib/fetchAll";
import { generateUniquePins } from "@/lib/utils";

// Un PIN a 4 cifre (fallback voto/riscatto senza fotocamera) deve essere univoco su tutto lo
// spazio PIN, non solo nella propria tabella: altrimenti lo stesso PIN potrebbe risolvere in
// modo ambiguo a una persona, un evento o un bonus diversi.
export async function fetchUsedPins(): Promise<Set<string>> {
  const supabase = getSupabaseAdmin();
  const notNull = (q: any) => q.not("pin", "is", null);
  const [users, events, bonuses] = await Promise.all([
    fetchAllRows<{ pin: string }>(supabase, "users", "pin", { filter: notNull }),
    fetchAllRows<{ pin: string }>(supabase, "votable_events", "pin", { filter: notNull }),
    fetchAllRows<{ pin: string }>(supabase, "bonus_qr", "pin", { filter: notNull }),
  ]);
  return new Set([...users, ...events, ...bonuses].map((r) => r.pin));
}

export async function generateUnusedPin(): Promise<string> {
  return generateUniquePins(1, await fetchUsedPins())[0];
}
