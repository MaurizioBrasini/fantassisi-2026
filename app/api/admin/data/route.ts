import { NextResponse } from "next/server";
import { forbidden } from "@/lib/http";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchAllRows } from "@/lib/fetchAll";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// L'elenco utenti del pannello admin, letto dal server. Contiene token di accesso e codici di voto di
// tutti i partecipanti: solo admin, mai lo staff. QR e bonus hanno le loro route
// (/api/admin/events, /api/admin/bonus, /api/admin/boosts).
export async function GET() {
  const requester = await requireRole("admin");
  if (!requester) {
    return forbidden();
  }

  try {
    const users = await fetchAllRows(getSupabaseAdmin(), "users", "*");
    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ message: e.message || "Errore nel leggere i dati" }, { status: 500 });
  }
}
