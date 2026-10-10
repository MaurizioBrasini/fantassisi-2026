# FantAssisi 2026 - Ripartenza da zero

Stato al 10 ottobre 2026: il Forum di Assisi è stato annullato (sede inagibile) e sarà riprogrammato in
primavera. L'app non è mai stata condivisa con i partecipanti. Il progetto è in pausa.

## Cosa c'è nella cartella di archivio (fuori da GitHub, contiene segreti: non pubblicarla)
| File | Cosa è |
|---|---|
| `fantassisi-2026-repo.bundle` | tutto il repository con la storia (`git clone fantassisi-2026-repo.bundle cartella`) |
| `fantassisi-2026-codice-HEAD.zip` | solo i file del codice all'ultimo commit |
| `00_INSTALLAZIONE_COMPLETA.sql` | crea il database da zero (tabelle, indici, funzioni, protezioni) |
| `fantassisi-backup-AAAAMMGG-HHMM.json` | i dati: utenti, QR, voti, bonus, impostazioni (dal pulsante "Scarica backup") |
| `render.env` | le 7 variabili d'ambiente di Render (SEGRETO) |
| `env.agent.local` | accesso al database del ruolo `claude_agent` (SEGRETO, facoltativo) |

Copiare la cartella anche su un secondo supporto o nel gestore di password. Il repository GitHub
(`MaurizioBrasini/fantassisi-2026`) contiene il codice ma non i segreti né i dati dei partecipanti.

## Riprendere con i servizi esistenti (caso più semplice)
1. **Supabase** (progetto `wtmnfzzyiyjemdjoisgy`): se è in pausa per inattività, riattivarlo dalla dashboard. Se è
   ancora lì con i dati, non serve ripristinare niente.
2. **Render** (servizio `fantassisi-2026`): ripassare a un piano che resti sempre acceso; una sola istanza.
3. **Resend**: controllare che il dominio `eventi.psiconet.it` risulti ancora verificato e che la chiave funzioni.
4. In admin: **Fase del gioco** -> impostare data di apertura e di fine evento, poi "Stato del sistema".

## Reinstallare tutto da zero
1. **Codice**: clonare da GitHub, oppure dal bundle/zip dell'archivio. `npm install`, poi `npm test` e `npx tsc --noEmit`.
2. **Database**: creare un progetto Supabase vuoto. SQL Editor -> incollare tutto
   `00_INSTALLAZIONE_COMPLETA.sql` -> Run (una volta sola). Il file non è ancora stato provato su un progetto vuoto:
   se dà errori, correggere l'ordine delle istruzioni, non cambiare i nomi.
3. **Dati**: `node scripts/restore-backup.mjs <backup.json> --env <file.env>` ripristina il JSON nel nuovo
   database (il file env deve avere URL e service role del progetto NUOVO). Senza `--yes` fa solo la prova e
   mostra i conteggi; con `--yes` scrive; si rifiuta se la tabella users di destinazione non è vuota. Scritto
   il 10 ottobre 2026, sintassi controllata ma MAI eseguito: provarlo prima su un progetto Supabase di prova.
   In alternativa reimportare l'Excel degli iscritti dal pannello admin: i QR e i codici personali però cambiano.
4. **Render**: nuovo Web Service collegato al repository GitHub, ramo `main`, ambiente Node. Comandi
   (verificare in Settings del servizio esistente): build `npm install && npm run build`, start `npm start`.
   Variabili: quelle di `render.env`, con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY` del nuovo progetto Supabase. Attenzione ai nomi: `SESSION_SECRET` con il trattino
   basso, non il trattino (è già successo). Se si cambia `SESSION_SECRET` tutti devono rientrare dal proprio link.
5. **Resend**: dominio `eventi.psiconet.it` con le voci DNS (SPF, DKIM, DMARC) verificate; `RESEND_FROM` deve
   usare quel dominio.
6. **Primo accesso admin**: il link personale dell'admin usa il token salvato nella tabella `users`
   (nel backup). Su un database nuovo va creato un utente admin a mano nello SQL Editor.
7. **Verifica**: admin -> "Stato del sistema" -> Esegui controllo: deve essere tutto verde.

## Resend (stato letto il 10 ottobre 2026, account "mabras")
- Dominio `eventi.psiconet.it`: **Verified**, regione Irlanda (eu-west-1), creato il 2 ottobre 2026. Esiste anche
  `psiconet.it` (verificato da 3 mesi, usato da un altro progetto: non toccarlo).
- Voci DNS del dominio (già nel DNS di psiconet.it; se si ricrea il dominio vanno rifatte dalla pagina Records):
  - TXT `resend._domainkey.eventi` (DKIM, contenuto `p=MIGfMA0G...` copiarlo da Resend)
  - CNAME `rsend.eventi` -> `rsend-euw1.forge.rmta.net`
  - CNAME `send.eventi` -> `send.forge.rmta.net`
- Piano: **gratuito**, 3.000 email al mese (Transactional) e 1.000 contatti marketing; nessun metodo di pagamento
  registrato. Prima di inviare i link ai partecipanti passare a Pro (Settings -> Billing -> Upgrade).
- Chiavi API: `fantassisi-2026` (Sending access, è quella su Render, usata l'ultima volta il 2 ottobre),
  `FantAssisi access` (Full access, vecchia e non in uso: si può revocare) e `app gestione pazienti` (Full access,
  di un altro progetto: NON toccare). I valori non si rivedono dopo la creazione: se la chiave su Render andasse
  persa, crearne una nuova con Sending access e metterla in `RESEND_API_KEY`.
- Mittente impostato nell'app: variabile `RESEND_FROM` (deve usare `eventi.psiconet.it`), risposte a `RESEND_REPLY_TO`.

## Impostazioni da ricordare
- Fase del gioco (admin, tre date in ora italiana): **inizio Anteprima** (prima i partecipanti, con link o no,
  vedono solo "l'anteprima parte il ..."; admin e staff vedono tutto; "da definire" = resta in attesa, per far
  partire l'Anteprima senza data premere "Anteprima"), **apertura voto** ("da definire" = non si apre da
  solo) e **fine evento**. Predefinito: inizio e apertura "da definire", cioè tutto chiuso. Si può quindi inviare i link e tenere chiusa l'Anteprima.
  Esempio per un evento il 1 aprile: inizio Anteprima 25 marzo, apertura 30 marzo 00:00, fine 2 aprile 00:00. Il karaoke ha una finestra fissa in `lib/karaoke.ts` (17 ottobre 16-19):
  aggiornarla alla nuova data.
- Prima di inviare i link: rigenerare i token incollati in chat, controllare il testo della mail
  d'invito, passare Render e Resend ai piani a pagamento. Procedure in `docs/EVENTO.md`.
- Next.js è alla 14.2.35. `npm audit` (10 ottobre 2026) segnala next (critico, via postcss) con correzione solo alla
  16.4.0, salto con modifiche incompatibili: passare alla 15 non la risolverebbe. Aggiornare, se lo si vuole, alla
  ripartenza di primavera, con almeno una settimana di prove (npm test, build, un giro completo) e non a ridosso dell'evento. `xlsx` ha una vulnerabilità nota senza
  correzione, usato solo per l'import in admin.
