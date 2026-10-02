import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applySessionCookies } from "@/lib/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "fantassisi-2026.onrender.com";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  if (!token) {
    return NextResponse.json(
      { error: "Token mancante" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
