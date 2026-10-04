// app/api/admin/reset/route.ts
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { readJsonObject } from "@/lib/http";

export async function POST(request: Request) {
  const user = await requireRole("admin");
  if (!user) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const body = await readJsonObject(request);
  const type = body?.type;

  if (type !== "scores" && type !== "full" && type !== "today") {
    return NextResponse.json(
      { message: "Tipo di reset non valido. Usa: 'scores', 'full' o 'today'" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const functionMap = {
    scores: "reset_scores",
    full: "reset_full",
    today: "reset_votes_on_date",
  };

  const rpcFunction = functionMap[type as keyof typeof functionMap];
  const { error } = await supabase.rpc(rpcFunction);

  if (error) {
    console.error("Errore reset:", error);
    return NextResponse.json(
      { message: "Errore reset: " + error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "✅ Reset completato!" });
}
