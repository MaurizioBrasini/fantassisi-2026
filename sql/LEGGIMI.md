# Script SQL di FantAssisi

Si eseguono **a mano** nello SQL Editor di Supabase, **nell'ordine dei numeri**, ognuno **una volta sola**.

Come eseguirli senza errori:
1. Apri il file, seleziona **tutto** (Ctrl+A), copia (Ctrl+C).
2. Incolla in un editor SQL **vuoto** di Supabase e premi **Run**.
3. Se Supabase avvisa di un'operazione "destructive" (per `drop index` / `drop constraint`), è normale: conferma.
4. Non ricopiare a mano e non correggere il testo: un trattino o una lettera persa rompono la query.
5. Dopo l'esecuzione, nel pannello admin premi **"Stato del sistema" → Esegui controllo**: dice se è andato tutto a buon fine.

| N. | File | Cosa fa | Stato al 4 ottobre 2026 |
|---|---|---|---|
| 01 | `01_users_status.sql` | stato iscrizione (confermato / lista d'attesa / ritirato) | eseguito |
| 02 | `02_team_boosts.sql` | tabella dei bonus (storico) | eseguito |
| 03 | `03_boost_allocations.sql` | bonus distribuiti alle persone | eseguito |
| 04 | `04_event_votes_cooldown.sql` | rivoto allo stesso QR dopo un'attesa | eseguito (verificato) |
| 05 | `05_app_settings.sql` | fase Anteprima / Voto aperto | eseguito |
| 06 | `06_team_pins.sql` | PIN fissi 1212 Matricole / 3434 Veterani | eseguito (verificato) |
| 07 | `07_public_bonuses.sql` | premi palesi con banner | eseguito (verificato) |
| 08 | `08_normalize_class_qr.sql` | QR di classe con grafie standard | eseguito (verificato) |
| **09** | **`09_aggregates.sql`** | **classifiche, karaoke e saldo coin calcolati dal database (velocità con molti voti) + controlli per "Stato del sistema"** | **DA ESEGUIRE** |

`schema.sql` non si esegue: è la descrizione del database com'è oggi.

Il prossimo script prende il numero 10.
