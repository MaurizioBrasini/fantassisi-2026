import crypto from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
