// Il DB e il server girano in UTC, ma i limiti "giornalieri" dell'evento (20 CBT coin,
// reset "di oggi") devono seguire la mezzanotte italiana, non quella UTC (scarto di 1-2h).
// Ritorna l'inizio della giornata corrente in Europe/Rome, come istante UTC (ISO string),
// utilizzabile direttamente in un filtro .gte("voted_at", ...).
export function startOfTodayInRomeISO(): string {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(now).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);

  // Istante UTC che corrisponde a "adesso" quando letto come orario di Roma:
  // la differenza rispetto a `now` è esattamente l'offset di Roma in quel momento.
  const romeNowAsUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  const romeOffsetMs = romeNowAsUTC - now.getTime();

  // Mezzanotte di oggi, calendario di Roma, poi riportata a istante UTC sottraendo l'offset.
  const romeMidnightUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return new Date(romeMidnightUTC - romeOffsetMs).toISOString();
}

// Genera `count` PIN a 4 cifre univoci (mai usati prima, mai ripetuti tra loro),
// pescando da una permutazione casuale di tutti i valori 0000-9999 esclusi
// quelli già assegnati. Con ~1090 utenti votabili su 10000 combinazioni
// possibili non c'è rischio di esaurimento; se un giorno si superassero i
// 10000 utenti votabili andrebbe allungato a 5 cifre.
export function generateUniquePins(count: number, existing: Set<string>): string[] {
  const pool: string[] = [];
  for (let i = 0; i < 10000; i++) {
    const pin = String(i).padStart(4, "0");
    if (!existing.has(pin)) pool.push(pin);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
