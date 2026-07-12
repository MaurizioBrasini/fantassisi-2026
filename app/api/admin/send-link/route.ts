import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as nodemailer from "nodemailer";

export async function POST(request: Request) {
  const role = cookies().get("user_role")?.value;
  if (role !== "admin" && role !== "staff") {
    return NextResponse.json({ message: "Accesso negato" }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ message: "ID utente obbligatorio" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: user } = await supabase
    .from("users")
    .select("first_name, last_name, email, auth_token, team")
    .eq("id", userId)
    .single();

  if (!user || !user.email || !user.auth_token) {
    return NextResponse.json({ message: "Utente non trovato o dati mancanti" }, { status: 404 });
  }

  const link = `https://fantassisi-2026.onrender.com/api/auth?token=${user.auth_token}`;
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_FROM,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `FantAssisi 2026 <${process.env.GMAIL_FROM}>`,
      to: user.email,
      subject: "Il tuo link personale per FantAssisi 2026",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1E3A5F;">Ciao ${name}!</h2>
          <p>Ecco il tuo link personale per accedere a <strong>FantAssisi 2026</strong>:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}"
               style="background: #FF6B35; color: white; padding: 14px 28px; border-radius: 30px;
                      text-decoration: none; font-weight: bold; font-size: 1rem;">
              Accedi a FantAssisi 2026
            </a>
          </div>
          <p style="color: #666; font-size: 0.85rem;">
            Oppure copia e incolla questo indirizzo nel browser:<br/>
            <a href="${link}" style="color: #1E3A5F;">${link}</a>
          </p>
          <p style="color: #666; font-size: 0.85rem;">
            Il link è personale e non va condiviso con altri.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="color: #999; font-size: 0.75rem; text-align: center;">
            Forum FantAssisi 2026 · APC/SPC
          </p>
        </div>
      `,
    });
  } catch (err: any) {
    console.error("Errore invio email:", err);
    return NextResponse.json({ message: "Errore invio email: " + err.message }, { status: 500 });
  }

  return NextResponse.json({ message: `✅ Email inviata a ${user.email}` });
}
