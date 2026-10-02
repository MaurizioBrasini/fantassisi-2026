import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/session";

// Uscita vera: il cookie di sessione è httpOnly, dal browser non si può cancellare.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
