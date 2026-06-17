import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_token", token)
    .single();

  if (error || !user) {
    console.error("Token error:", error?.message);
    return NextResponse.redirect(new URL("/?error=invalid_token", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set("user_id", user.id);
  response.cookies.set("user_team", user.team || "");
  response.cookies.set("user_role", user.role);

  return response;
}
