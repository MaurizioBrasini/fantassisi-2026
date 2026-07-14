import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const role = cookies().get("user_role")?.value;
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ message: "ID utente mancante" }, { status: 400 });
  }

  // Recupera l'utente
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

  // 🔥 INVIO VIA RESEND API
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "FantAssisi <noreply@psiconet.it>";

  if (!resendApiKey) {
    return NextResponse.json({ message: "API Key Resend non configurata" }, { status: 500 });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: from,
      to: user.email,
      subject: "🔑 Il tuo link di accesso a FantAssisi 2026",
      html: `
        <h1>Ciao ${user.first_name || "Partecipante"}!</h1>
        <p>Ecco il tuo link personale per accedere a <strong>FantAssisi 2026</strong>:</p>
        <p>
          <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #FF6B35; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
            🔑 Accedi ora
          </a>
        </p>
        <p>Oppure copia questo link nel browser:</p>
        <p><code style="background: #f4f4f4; padding: 8px; display: block; word-break: break-all;">${link}</code></p>
        <p style="color: #666; font-size: 0.9rem;">Questo link è personale e non va condiviso.</p>
        <p style="color: #999; font-size: 0.8rem;">Hai ricevuto questa email perché sei registrato a FantAssisi 2026.</p>
      `,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Errore Resend:", data);
    return NextResponse.json({ message: "Errore invio email: " + (data.message || "Sconosciuto") }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `✅ Email inviata a ${user.email}` });
}