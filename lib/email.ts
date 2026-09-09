export function buildInviteEmail(firstName: string | null, link: string): { subject: string; html: string } {
  const name = firstName || "Partecipante";
  return {
    subject: "Le tue credenziali per FantAssisi",
    html: `
      <p>Cara/o ${name},</p>
      <p>il link qui sotto contiene la tua "chiave di accesso" personale a <strong>FantAssisi</strong>, l'app del Forum di Assisi. Conservala e non condividerla.</p>
      <p>
        <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #FF6B35; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          ACCEDI A FANTASSISI
        </a>
      </p>
      <p>Oppure copia questo link nel browser:</p>
      <p><code style="background: #f4f4f4; padding: 8px; display: block; word-break: break-all;">${link}</code></p>
      <p>Una volta entrato/a, clicca per scaricare l'app sul tuo telefonino e scegli se vuoi "arruolarti" e con quale delle due squadre.</p>
      <p>A breve faremo un collaudo con il gruppo organizzatore del Forum: ti aspettiamo!</p>
      <p>Grazie mille e a presto.</p>
    `,
  };
}

export async function sendInviteEmail(to: string, firstName: string | null, link: string): Promise<{ ok: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "FantAssisi <noreply@psiconet.it>";

  if (!resendApiKey) {
    return { ok: false, error: "API Key Resend non configurata" };
  }

  const { subject, html } = buildInviteEmail(firstName, link);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    return { ok: false, error: data.message || `Errore HTTP ${response.status}` };
  }

  return { ok: true };
}
