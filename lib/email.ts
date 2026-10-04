// Testo inserito nell'HTML della mail: i nomi arrivano dal foglio di iscrizione e non devono poter
// diventare codice HTML (es. un nome con "<" o un link).
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function buildInviteEmail(
  firstName: string | null,
  link: string,
  replyTo?: string,
  renewed = false
): { subject: string; html: string; text: string } {
  const name = (firstName || "").trim() || "Partecipante";
  const nameHtml = escapeHtml(name);
  const linkHtml = escapeHtml(link);
  // Rinnovo: stesso testo, con in testa l'avviso e il motivo (sicurezza) del link nuovo.
  const renewedText =
    "NUOVO LINK. Per motivi di sicurezza abbiamo sostituito il tuo link di accesso: quello che avevi ricevuto prima non funziona più. Usa da ora in poi solo il link qui sotto.";
  const footerText = replyTo
    ? `Ricevi questa email perché sei iscritto/a a FantAssisi 2026. Per non riceverne altre, rispondi a questo messaggio scrivendo "disiscrivimi" (${replyTo}).`
    : `Ricevi questa email perché sei iscritto/a a FantAssisi 2026. Per non riceverne altre, rispondi a questo messaggio scrivendo "disiscrivimi".`;
  return {
    subject: renewed ? "Nuovo link di accesso a FantAssisi" : "Le tue credenziali per FantAssisi",
    text: [
      `Cara/o ${name},`,
      "",
      ...(renewed ? [renewedText, ""] : []),
      `il link qui sotto contiene la tua "chiave di accesso" personale a FantAssisi, l'app del Forum di Assisi. Conservala e non condividerla.`,
      "",
      link,
      "",
      `Una volta entrato/a, clicca per scaricare l'app sul tuo telefonino e scegli se vuoi "arruolarti" e con quale delle due squadre.`,
      "",
      "A breve faremo un collaudo con il gruppo organizzatore del Forum: ti aspettiamo!",
      "Grazie mille e a presto.",
      "",
      "--",
      footerText,
    ].join("\n"),
    html: `
      <p>Cara/o ${nameHtml},</p>
      ${renewed ? `<p style="background: #fff3cd; border-left: 4px solid #FF6B35; padding: 10px 12px;"><strong>NUOVO LINK.</strong> Per motivi di sicurezza abbiamo sostituito il tuo link di accesso: quello che avevi ricevuto prima non funziona più. Usa da ora in poi solo il link qui sotto.</p>` : ""}
      <p>il link qui sotto contiene la tua "chiave di accesso" personale a <strong>FantAssisi</strong>, l'app del Forum di Assisi. Conservala e non condividerla.</p>
      <p>
        <a href="${linkHtml}" style="display: inline-block; padding: 12px 24px; background: #FF6B35; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          ACCEDI A FANTASSISI
        </a>
      </p>
      <p>Oppure copia questo link nel browser:</p>
      <p><code style="background: #f4f4f4; padding: 8px; display: block; word-break: break-all;">${linkHtml}</code></p>
      <p>Una volta entrato/a, clicca per scaricare l'app sul tuo telefonino e scegli se vuoi "arruolarti" e con quale delle due squadre.</p>
      <p>A breve faremo un collaudo con il gruppo organizzatore del Forum: ti aspettiamo!</p>
      <p>Grazie mille e a presto.</p>
      <p style="color: #777; font-size: 12px;">${escapeHtml(footerText)}</p>
    `,
  };
}

export async function sendInviteEmail(to: string, firstName: string | null, link: string, renewed = false): Promise<{ ok: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "FantAssisi <noreply@psiconet.it>";

  if (!resendApiKey) {
    return { ok: false, error: "API Key Resend non configurata" };
  }

  // Indirizzo reale che legge le risposte; abilita anche la disiscrizione via mailto.
  const replyTo = process.env.RESEND_REPLY_TO;

  const { subject, html, text } = buildInviteEmail(firstName, link, replyTo, renewed);

  const payload: Record<string, unknown> = { from, to, subject, html, text };
  if (replyTo) {
    payload.reply_to = replyTo;
    payload.headers = {
      "List-Unsubscribe": `<mailto:${replyTo}?subject=disiscrivimi>`,
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return { ok: false, error: data.message || `Errore HTTP ${response.status}` };
  }

  return { ok: true };
}
