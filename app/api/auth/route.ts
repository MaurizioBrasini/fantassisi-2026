import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { applySessionCookies } from "@/lib/session";
import { requestOrigin } from "@/lib/urls";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const baseUrl = requestOrigin(request);

  if (!token) {
    return NextResponse.json(
      { error: "Token mancante" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, team, role, year, school, site")
    .eq("auth_token", token)
    .single();

  if (error || !user) {
    console.error("Token error:", error?.message);
    return NextResponse.json(
      { error: "Token non valido" },
      { status: 401 }
    );
  }

  const response = NextResponse.redirect(new URL("/", baseUrl));
  applySessionCookies(response, user);
  return response;
}
