// app/api/admin/reset/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";

export async function POST(request: Request) {
  const user = await requireRole("admin", "staff");
  if (!user) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { type } = await request.json();

  if (type !== "scores" && type !== "full" && type !== "today") {
    return NextResponse.json(
      { message: "Tipo di reset non valido. Usa: 'scores', 'full' o 'today'" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
