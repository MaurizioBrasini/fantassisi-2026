// Finestra oraria della sfida karaoke Matricole vs Veterani.
// Sabato 17 ottobre 2026, 16:00–19:00 (orario italiano) — se la fascia
// cambia, basta aggiornare questi 5 numeri, il resto (tabellone + API)
// si adatta da solo.
import { romeLocalToUTCISO } from "./utils";

export const KARAOKE_START_ISO = romeLocalToUTCISO(2026, 10, 17, 16, 0);
export const KARAOKE_END_ISO = romeLocalToUTCISO(2026, 10, 17, 19, 0);
