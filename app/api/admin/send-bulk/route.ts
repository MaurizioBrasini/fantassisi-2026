import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { sendInviteEmail } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DELAY_BETWEEN_SENDS_MS = 200; // margine di sicurezza sui rate limit di Resend
const MAX_RECIPIENTS_PER_CALL = 500; // oltre questa soglia va introdotta una coda asincrona

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const requester = await requireRole("admin");
  if (!requester) {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { userIds } = await request.json();
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ message: "Nessun destinatario selezionato" }, { status: 400 });
  }
  if (userIds.length > MAX_RECIPIENTS_PER_CALL) {
    return NextResponse.json(
      { message: `Troppi destinatari in un colpo solo (max ${MAX_RECIPIENTS_PER_CALL}). Filtra un gruppo più piccolo.` },
      { status: 400 }
    );
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("id, first_name, email, auth_token")
    .in("id", userIds);

  if (error || !users) {
    return NextResponse.json({ message: "Errore nel recupero degli utenti" }, { status: 500 });
  }

  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: { email: string; error: string }[] = [];

  for (const user of users) {
    if (!user.email) {
      skipped.push(`${user.first_name || user.id} (nessuna email)`);
      continue;
    }
    const link = `https://fantassisi-2026.onrender.com/api/auth?token=${user.auth_token}`;
    const result = await sendInviteEmail(user.email, user.first_name, link);
    if (result.ok) {
      sent.push(user.email);
    } else {
      failed.push({ email: user.email, error: result.error || "Errore sconosciuto" });
    }
    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  return NextResponse.json({
    success: true,
    message: `✅ Inviate ${sent.length} email su ${users.length}${skipped.length ? `, ${skipped.length} saltate (senza email)` : ""}${failed.length ? `, ${failed.length} fallite` : ""}.`,
    sent,
    skipped,
    failed,
  });
}
