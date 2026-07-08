import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const userId = cookies().get("user_id")?.value;
  const currentTeam = cookies().get("user_team")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // Solo i Didatti&Docenti possono arruolarsi
  if (currentTeam !== "Didatti&Docenti") {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const { team } = await request.json();
  if (team !== "Matricole" && team !== "Veterani") {
    return NextResponse.json({ error: "Team non valido" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verifica che l'utente sia ancora Didatti&Docenti nel database
  // (non si fida solo del cookie)
  const { data: user } = await supabase
    .from("users")
    .select("team, first_name, last_name")
    .eq("id", userId)
    .single();

  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  if (user.team !== "Didatti&Docenti") {
    return NextResponse.json({ error: "Già arruolato" }, { status: 409 });
  }

  const { error } = await supabase
    .from("users")
    .update({ team })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: "Errore durante l'arruolamento" }, { status: 500 });
  }

  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();

  return NextResponse.json({ success: true, team, name });
}
