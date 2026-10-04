import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { sendInviteEmail } from "@/lib/email";
import { personalLink } from "@/lib/urls";
import { isBlocked, registerFailure } from "@/lib/rateLimit";

// "Ricevi il link per mail": il partecipante che non riesce a entrare chiede di rimandare il link
// personale. Il link parte SEMPRE e SOLO verso l'email registrata a sistema, mai verso un indirizzo
// scelto da chi chiede, e la risposta è identica sia che la mail esista sia che non esista.
const EMAIL_WINDOW_MS = 5 * 60 * 1000; // una richiesta ogni 5 minuti per la stessa mail
const IP_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 20;
const MAX_PER_EMAIL_PER_DAY = 3;

const OK_MESSAGE =
  "Se la mail è tra gli iscritti, tra poco riceverai il link personale. Controlla anche la cartella spam.";

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : "") || request.headers.get("x-real-ip") || "sconosciuto";
}

export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Richiesta non valida." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ message: "Scrivi la mail con cui ti sei iscritto/a." }, { status: 400 });
  }

  const ipKey = `sendlink-ip:${clientIp(request)}`;
  const emailKey = `sendlink-email:${email}`;
  // Al massimo 3 mail al giorno allo stesso indirizzo: nessuno può far arrivare a una persona una mail
  // ogni 5 minuti, né consumare la quota giornaliera di Resend con pochi indirizzi.
  const emailDayKey = `sendlink-email-day:${email}`;
  if (isBlocked(ipKey, MAX_REQUESTS_PER_IP) || isBlocked(emailKey, 1) || isBlocked(emailDayKey, MAX_PER_EMAIL_PER_DAY)) {
    // Stessa risposta di successo: non rivela se la mail esiste né se è appena stata inviata.
    return NextResponse.json({ ok: true, message: OK_MESSAGE });
  }
  registerFailure(ipKey, IP_WINDOW_MS);
  registerFailure(emailKey, EMAIL_WINDOW_MS);
  registerFailure(emailDayKey, 24 * 60 * 60 * 1000);

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("first_name, email, auth_token")
    .eq("email", email)
    .maybeSingle();

  if (user && user.email && user.auth_token) {
    const result = await sendInviteEmail(user.email, user.first_name, personalLink(user.auth_token));
    if (!result.ok) {
      console.error("Errore invio link su richiesta:", result.error);
      return NextResponse.json(
        { message: "Non riesco a inviare la mail adesso. Riprova tra qualche minuto o chiedi il link all'organizzatore." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true, message: OK_MESSAGE });
}
