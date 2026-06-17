import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Simula un login di successo (senza database)
  return NextResponse.redirect(new URL("/?test=success", request.url));
}
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Cerca l'utente con il token
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_token", token)
    .single();

  if (error || !user) {
    console.error("Token error:", error?.message);
    return NextResponse.redirect(new URL("/?error=invalid_token", request.url));
  }

  // Reindirizza alla dashboard
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set("user_id", user.id);
  response.cookies.set("user_team", user.team || "");
  response.cookies.set("user_role", user.role);

  return response;
}
