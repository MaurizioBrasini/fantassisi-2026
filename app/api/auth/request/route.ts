import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applySessionCookies } from "@/lib/session";
import { phoneLast4 } from "@/lib/phone";
import { isBlocked, registerFailure, clearFailures } from "@/lib/rateLimit";

// "Richiedi accesso": il partecipante dimostra chi è con la mail di iscrizione e le ultime
// 4 cifre del suo telefono, e riceve la stessa sessione del link personale.
// Solo partecipanti confermati: staff e admin entrano sempre dal loro link personale.
const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 25;

const GENERIC_ERROR = "I dati non corrispondono. Controlla la mail con cui ti sei iscritto/a e le ultime 4 cifre del tuo telefono.";

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || request.headers.get("x-real-ip") || "sconosciuto";
}

function sameDigits(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function POST(request: Request) {
  let body: { email?: unknown; last4?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const last4 = String(body.last4 ?? "").replace(/\D/g, "");
  if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || last4.length !== 4) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }

  const ipKey = `ip:${clientIp(request)}`;
  const emailKey = `email:${email}`;
  if (isBlocked(ipKey, MAX_FAILS_PER_IP) || isBlocked(emailKey, MAX_FAILS_PER_EMAIL)) {
    return NextResponse.json(
      { message: "Troppi tentativi. Riprova tra 5 minuti oppure ricevi il link per mail qui sotto." },
      { status: 429 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: user } = await supabase
    .from("users")
    .select("id, team, role, year, site, status, phone")
    .eq("email", email)
    .maybeSingle();

  const expected = phoneLast4(user?.phone) ?? "----";
  const ok =
    !!user &&
    user.role === "student" &&
    user.status === "confermato" &&
    expected !== "----" &&
    sameDigits(expected, last4);

  if (!ok || !user) {
    registerFailure(ipKey, WINDOW_MS);
    registerFailure(emailKey, WINDOW_MS);
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 401 });
  }

  clearFailures(emailKey);
  const response = NextResponse.json({ ok: true });
  applySessionCookies(response, user);
  return response;
}
