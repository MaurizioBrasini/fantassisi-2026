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
