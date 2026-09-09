import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { sendInviteEmail } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const requester = await requireRole("admin", "staff");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ message: "ID utente mancante" }, { status: 400 });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("first_name, last_name, email, auth_token")
    .eq("id", userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ message: "Utente non trovato" }, { status: 404 });
  }

  if (!user.email) {
    return NextResponse.json({ message: "Utente senza email" }, { status: 400 });
  }

  const link = `https://fantassisi-2026.onrender.com/api/auth?token=${user.auth_token}`;
  const result = await sendInviteEmail(user.email, user.first_name, link);

  if (!result.ok) {
    console.error("Errore Resend:", result.error);
    return NextResponse.json({ message: "Errore invio email: " + result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `✅ Email inviata a ${user.email}` });
}
