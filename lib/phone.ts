// Normalizza un numero di telefono in formato internazionale ("+39333...").
// Restituisce null se la cella è vuota o il numero non è plausibile.
// Se la cella contiene più numeri ("333...; 340...") si tiene il primo.
export function normalizePhone(raw: unknown): string | null {
  const first = String(raw ?? "").trim().split(/[;\/,]|\s{2,}| - /)[0];
  if (!first) return null;
  let p = first.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("+")) {
    const digits = p.slice(1);
    return digits.length >= 8 && digits.length <= 15 ? "+" + digits : null;
  }
  if (/^3\d{8,9}$/.test(p)) return "+39" + p; // cellulare italiano senza prefisso
  if (/^393\d{8,9}$/.test(p)) return "+" + p; // cellulare italiano con 39 senza "+"
  if (/^0\d{6,10}$/.test(p)) return "+39" + p; // fisso italiano
  return null;
}

// Ultime 4 cifre, per il controllo "mail + ultime 4 cifre del telefono".
export function phoneLast4(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}
