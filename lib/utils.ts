// Il DB e il server girano in UTC, ma i limiti "giornalieri" dell'evento (20 CBT coin,
// reset "di oggi") devono seguire la mezzanotte italiana, non quella UTC (scarto di 1-2h).
// Ritorna l'inizio della giornata corrente in Europe/Rome, come istante UTC (ISO string),
// utilizzabile direttamente in un filtro .gte("voted_at", ...).
const ROME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Scarto (in millisecondi) di Roma rispetto a UTC all'istante dato: +1h d'inverno, +2h d'estate.
// Si ricava leggendo l'istante come orario di Roma e rimettendolo in UTC: la differenza è l'offset.
function romeOffsetMs(at: Date): { offsetMs: number; year: number; month: number; day: number } {
  const parts = ROME_FORMAT.formatToParts(at).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
  const [year, month, day] = [Number(parts.year), Number(parts.month), Number(parts.day)];
  const romeAsUTC = Date.UTC(year, month - 1, day, Number(parts.hour), Number(parts.minute), Number(parts.second));
  // I secondi interi: il formato di Roma non ha i millisecondi, e lasciarli sporcherebbe l'offset.
  return { offsetMs: romeAsUTC - Math.floor(at.getTime() / 1000) * 1000, year, month, day };
}

export function startOfTodayInRomeISO(): string {
  // Mezzanotte di oggi, calendario di Roma, poi riportata a istante UTC sottraendo l'offset.
  const { offsetMs, year, month, day } = romeOffsetMs(new Date());
  return new Date(Date.UTC(year, month - 1, day) - offsetMs).toISOString();
}

// ─────────────────────────────────────────────
// Cache breve dei punteggi in dashboard.
//
// La dashboard (app/page.tsx) ricalcola punteggi/coin scaricando per intero
// le tabelle users/votes/event_votes (a blocchi da 1000) ogni volta che viene
// montata — quindi ogni apertura/riapertura dell'app, non solo la prima. Con
// ~1200 persone che durante l'evento riaprono l'app ripetutamente, questo
// pattern moltiplica il carico in lettura su Supabase molto più del numero
// di persone stesso. Non tocchiamo la logica di calcolo (rimane quella,
// invariata): mettiamo solo un cache-in-sessionStorage di pochi secondi
// davanti al fetch, così i rimontaggi ravvicinati (tornare da /scan o dalle
// classifiche, tab in background che si riattiva, refresh nervoso) non
// ritriggerano ogni volta la scansione completa delle tabelle.
// sessionStorage (non localStorage): si svuota da solo alla chiusura del tab,
// niente dati "vecchi di giorni" da gestire.
const DASHBOARD_CACHE_TTL_MS = 20_000;

export type DashboardScoresCache = {
  ts: number;
  remainingCoins: number;
  teamScores: { Matricole: number; Veterani: number };
  myPoints?: number;
  myRank?: number | null;
};

function dashboardCacheKey(userId: string): string {
  return `dashboardScores:${userId}`;
}

/** Ritorna i dati in cache se ancora freschi (entro DASHBOARD_CACHE_TTL_MS), altrimenti null. */
export function getCachedDashboardScores(userId: string): DashboardScoresCache | null {
  try {
    const raw = sessionStorage.getItem(dashboardCacheKey(userId));
    if (!raw) return null;
    const cached: DashboardScoresCache = JSON.parse(raw);
    if (Date.now() - cached.ts > DASHBOARD_CACHE_TTL_MS) return null;
    return cached;
  } catch {
    // sessionStorage non disponibile (es. modalità privata): niente cache, si rifà il fetch.
    return null;
  }
}

export function setCachedDashboardScores(userId: string, data: Omit<DashboardScoresCache, "ts">): void {
  try {
    sessionStorage.setItem(dashboardCacheKey(userId), JSON.stringify({ ...data, ts: Date.now() }));
  } catch {
    // Niente di grave se non si riesce a scrivere: si rifarà semplicemente il fetch la prossima volta.
  }
}

/** Da chiamare subito dopo un'azione che cambia punteggi/coin (voto, riscatto bonus/QR),
 * prima di tornare alla dashboard: evita di mostrare per alcuni secondi il valore
 * pre-azione mentre la cache è ancora "fresca". */
export function invalidateCachedDashboardScores(userId: string): void {
  try {
    sessionStorage.removeItem(dashboardCacheKey(userId));
  } catch {
    // ignorabile
  }
}

// Data e ora per esteso, ora italiana: "giovedì 8 ottobre alle ore 00:00". Unico formato per gli
// annunci di apertura del voto (dashboard, pannello admin, messaggi del server).
const ROME_DATETIME = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
export function formatRomeDateTime(iso: string): string {
  return ROME_DATETIME.format(new Date(iso));
}

// Converte una data/ora "locale" italiana (Europe/Rome) in un istante UTC ISO,
// gestendo da sé l'ora legale/solare — stesso trucco di offset usato sopra in
// startOfTodayInRomeISO, generalizzato a un orario qualsiasi. Utile per
// definire finestre orarie fisse di un evento (es. inizio/fine di una sfida)
// senza dover calcolare a mano l'offset UTC+1/UTC+2 del giorno in questione.
export function romeLocalToUTCISO(year: number, month: number, day: number, hour: number, minute: number): string {
  const approx = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return new Date(approx.getTime() - romeOffsetMs(approx).offsetMs).toISOString();
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
