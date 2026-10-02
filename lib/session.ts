import crypto from "crypto";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { NextResponse } from "next/server";

const SESSION_COOKIE = "session_sig";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET non configurato: impostalo nelle variabili d'ambiente prima del deploy.");
  }
  return secret;
}

export function signUserId(userId: string): string {
  const sig = crypto.createHmac("sha256", getSecret()).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

function verifySignedToken(token: string | undefined): string | null {
  if (!token) return null;
  const sepIndex = token.lastIndexOf(".");
  if (sepIndex < 0) return null;
  const userId = token.slice(0, sepIndex);
  const providedSig = token.slice(sepIndex + 1);
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(userId).digest("hex");
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

type SessionUser = {
  id: string;
  team: string | null;
  role: string | null;
  year: string | null;
  site: string | null;
};

const SESSION_COOKIE_NAMES = [SESSION_COOKIE, "user_id", "user_team", "user_role", "user_class", "user_site"];

/** Cancella tutti i cookie di sessione, compreso quello firmato httpOnly (solo il server può farlo). */
export function clearSessionCookies(response: NextResponse): void {
  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}

/** Imposta i cookie di sessione (identici per ogni modo di accesso: link personale, richiesta accesso). */
export function applySessionCookies(response: NextResponse, user: SessionUser): void {
  const cookieOptions = {
    // 40 giorni: chi entra dai primi di ottobre resta collegato fino a dopo la fine del congresso (~20 ottobre).
    maxAge: 60 * 60 * 24 * 40,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  };

  // Cookie di sola visualizzazione (usati dal client per la UI, MAI per autorizzare azioni server-side)
  response.cookies.set("user_id", user.id, cookieOptions);
  response.cookies.set("user_team", user.team || "", cookieOptions);
  response.cookies.set("user_role", user.role || "student", cookieOptions);

  // Cookie firmato httpOnly: unica fonte attendibile di identità/autorizzazione lato server
  response.cookies.set(SESSION_COOKIE_NAME, signUserId(user.id), { ...cookieOptions, httpOnly: true });

  if (user.year) {
    response.cookies.set("user_class", user.year, cookieOptions);
  }
  if (user.site) {
    response.cookies.set("user_site", user.site, cookieOptions);
  }
}

/** Ritorna l'user_id verificato dal cookie firmato, oppure null. Non fidarsi mai di cookie non firmati per autorizzazione. */
export function getVerifiedUserId(): string | null {
  return verifySignedToken(cookies().get(SESSION_COOKIE)?.value);
}

type VerifiedUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  team: string | null;
  role: string | null;
  site: string | null;
  school: string | null;
  year: string | null;
};

/** Rilegge sempre ruolo/team correnti dal DB: mai fidarsi di valori letti dai cookie. */
export async function getVerifiedUser(): Promise<VerifiedUser | null> {
  const userId = getVerifiedUserId();
  if (!userId) return null;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, team, role, site, school, year")
    .eq("id", userId)
    .single();

  return data ?? null;
}

export async function requireRole(...allowed: string[]): Promise<VerifiedUser | null> {
  const user = await getVerifiedUser();
  if (!user || !user.role || !allowed.includes(user.role)) return null;
  return user;
}
