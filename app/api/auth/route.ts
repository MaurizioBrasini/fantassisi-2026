import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = createRouteHandlerClient({ cookies });

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_token", token)
    .single();

  if (error || !user) {
    return NextResponse.redirect(new URL("/?error=invalid_token", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set("user_id", user.id);
  response.cookies.set("user_team", user.team || "");
  response.cookies.set("user_role", user.role);

  return response;
}
