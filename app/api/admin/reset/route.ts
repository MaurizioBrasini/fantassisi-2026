import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const role = cookies().get("user_role")?.value;
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { type } = await request.json();
  if (type !== "scores" && type !== "full") {
    return NextResponse.json({ message: "Tipo di reset non valido" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.rpc(type === "full" ? "reset_full" : "reset_scores");

  if (error) {
    return NextResponse.json({ message: "Errore reset: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "✅ Reset completato!" });
}
