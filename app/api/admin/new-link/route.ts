import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireRole } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendInviteEmail } from "@/lib/email";
import { personalLink } from "@/lib/urls";
import { asUuid, forbidden, readJsonObject } from "@/lib/http";

export const dynamic = "force-dynamic";

// POST { userId, sendEmail? } — solo admin. "Nuovo link": sostituisce il codice segreto del link
// personale di una persona (es. link inoltrato per sbaglio o finito nelle mani sbagliate). Il vecchio
// link smette subito di funzionare; chi è già dentro l'app resta collegato (la sessione non dipende dal
// link). Con sendEmail la persona riceve subito la mail "Nuovo link di accesso" con l'avviso di sicurezza.
export async function POST(request: Request) {
  if (!(await requireRole("admin"))) return forbidden();

  const body = await readJsonObject(request);
  const userId = body ? asUuid(body.userId) : null;
  if (!userId) {
    return NextResponse.json({ message: "Utente non valido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase.from("users").select("id, first_name, last_name, email").eq("id", userId).maybeSingle();
  if (!user) {
    return NextResponse.json({ message: "Utente non trovato" }, { status: 404 });
  }

  // 24 caratteri esadecimali casuali (96 bit): impossibili da indovinare. Il database rifiuta i doppioni
  // (indice univoco su auth_token): in quel caso, praticamente impossibile, si riprova.
  let token = "";
  for (let attempt = 0; attempt < 3 && !token; attempt++) {
    const candidate = randomBytes(12).toString("hex");
    const { error } = await supabase.from("users").update({ auth_token: candidate }).eq("id", userId);
    if (!error) token = candidate;
    else if (error.code !== "23505") {
      return NextResponse.json({ message: "Impossibile creare il nuovo link: " + error.message }, { status: 500 });
    }
  }
  if (!token) {
    return NextResponse.json({ message: "Impossibile creare il nuovo link, riprova" }, { status: 500 });
  }

  const link = personalLink(token);
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  let emailNote = "";
  if (body?.sendEmail === true) {
    if (!user.email) {
      emailNote = " Mail non inviata: l'utente non ha un indirizzo.";
    } else {
      const sent = await sendInviteEmail(user.email, user.first_name, link, true);
      emailNote = sent.ok ? ` Mail "Nuovo link" inviata a ${user.email}.` : ` ATTENZIONE: mail non inviata (${sent.error}).`;
    }
  }

  return NextResponse.json({ link, token, message: `✅ Nuovo link creato per ${name}: quello vecchio non funziona più.${emailNote}` });
}
