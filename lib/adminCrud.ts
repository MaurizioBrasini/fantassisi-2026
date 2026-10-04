import { NextResponse } from "next/server";
import { forbidden } from "./http";
import { requireRole } from "./session";
import { getSupabaseAdmin } from "./supabaseAdmin";

// Le due operazioni identiche di tutte le liste del pannello admin (QR voto, QR ricarica, bonus
// squadra): attivare/disattivare e eliminare una riga. Cambia solo la tabella.
const failure = (message: string) => NextResponse.json({ message }, { status: 500 });

/** PATCH { id, active } — admin o staff. */
export async function patchActive(request: Request, table: string): Promise<NextResponse> {
  if (!(await requireRole("admin", "staff"))) return forbidden();

  const { id, active } = await request.json();
  if (!id || typeof active !== "boolean") {
    return NextResponse.json({ message: "Dati mancanti" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from(table).update({ active }).eq("id", id);
  return error ? failure(error.message) : NextResponse.json({ success: true });
}

/** DELETE ?id=… — solo admin. */
export async function deleteById(request: Request, table: string): Promise<NextResponse> {
  if (!(await requireRole("admin"))) return forbidden();

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ message: "ID mancante" }, { status: 400 });

  const { error } = await getSupabaseAdmin().from(table).delete().eq("id", id);
  return error ? failure(error.message) : NextResponse.json({ success: true });
}
