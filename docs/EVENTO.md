# FantAssisi — Procedure per l'evento

Promemoria operativo per l'organizzazione: cosa fare, quando e come. Tutto quello che c'è qui si fa dal
pannello admin o dai siti dei servizi, senza toccare il codice.

---

## Prima di inviare i link ai partecipanti

- [ ] **Render**: servizio `fantassisi-2026` → Settings → Instance Type → almeno **Starter** (il piano gratuito si spegne e fa aspettare 50 secondi al primo accesso).
- [ ] **Resend**: Settings → Billing → piano **Pro** (il gratuito si ferma a 100 mail al giorno).
- [ ] Mail di prova a se stessi: pannello admin → elenco utenti → ✉️ accanto al proprio nome. Controllare che arrivi in "Posta in arrivo" (non nello spam) e che il pulsante apra l'app.
- [ ] **Prova su iPhone** (R2, sotto).
- [ ] Pannello admin → 🩺 Stato del sistema → "Esegui controllo": tutto verde.

---

## R1 — Prova di carico

**A cosa serve.** Sapere prima dell'evento se il sito regge centinaia di persone che lo usano insieme (all'apertura del voto, a fine sessione, durante il karaoke).

**Quando.** Va fatta con Render sul piano che si userà all'evento (Standard), non sul gratuito. Si può fare anche subito: Render fa pagare a tempo, quindi si passa a Standard per un'ora, si fa la prova e si torna indietro (costo: pochi centesimi).

**Cosa fa.** Simula partecipanti che aprono l'app, guardano le classifiche, il telefono che controlla premi e apertura del voto, il tabellone. **Fa solo letture**: non vota, non modifica nulla, non manda mail. Si ferma da sola se il sito comincia a dare troppi errori.

**Come (dal PC, nella cartella del progetto, in PowerShell):**
1. Render → Instance Type → **Standard**. Aspettare che il servizio sia "Live" (circa un minuto).
2. Prova pubblica, crescente:
   ```
   node scripts/load-test.mjs --users 100 --minutes 2
   node scripts/load-test.mjs --users 300 --minutes 3
   node scripts/load-test.mjs --users 600 --minutes 3
   ```
3. Prova con una sessione (pagine con accesso: dashboard, coin, classifiche). Serve il cookie di sessione di un account:
   Chrome sul sito → F12 → scheda **Application** → Cookies → `https://fantassisi-2026.onrender.com` → copiare il **valore** di `session_sig`.
   ```
   node scripts/load-test.mjs --users 300 --minutes 3 --cookie "session_sig=VALORE"
   ```
4. Leggere il **Verdetto** in fondo: "OK", "ACCETTABILE", "AL LIMITE" o "NON OK", con i tempi per ogni funzione.
5. Render → Instance Type → tornare al piano di prima (se la prova è anticipata).

**Come leggere i risultati.**
- *mediana*: tempo tipico; *p95*: il 5% delle richieste è più lento di così.
- Obiettivo: errori sotto il 2% e p95 sotto 1 secondo a 300 utenti. Con il server in Virginia ogni richiesta dall'Italia parte da circa 130 ms.
- Se il verdetto è "AL LIMITE" o "NON OK" a 300-600 utenti: mandare i risultati allo sviluppatore prima dell'evento.

**Nota.** Mentre gira la prova il sito resta usabile; meglio farla in un orario con pochi utenti reali.

---

## R2 — Prova su iPhone

Da fare con un iPhone qualsiasi (meglio due: uno recente e uno di qualche anno fa), **con Safari**.
Usare il link personale di un account di prova o di un membro dello staff.

| # | Cosa fare | Cosa deve succedere |
|---|---|---|
| 1 | Aprire il link personale ricevuto per mail | Si entra nella dashboard; sotto il titolo c'è l'etichetta ANTEPRIMA |
| 2 | Tasto Condividi → "Aggiungi a schermata Home" | Compare l'icona FantAssisi; aprendola, l'app si apre a schermo intero e si è già dentro |
| 3 | Chiudere e riaprire l'app dall'icona | Si resta collegati (non chiede di nuovo il link) |
| 4 | In Anteprima: leggere il box di benvenuto e aprire "Individuali" / "Per sede" / "Per classe" | Il testo è leggibile senza zoom e le classifiche si aprono (in Anteprima non ci sono QR, coins né pulsante Vota) |
| 5 | Con voto aperto: Vota → "Scan QR Code" | Chiede il permesso della fotocamera; si apre la fotocamera **posteriore** |
| 6 | Con voto aperto: inquadrare un QR (es. quello di squadra sul PC) | Il voto viene registrato |
| 7 | Con voto aperto: Vota → scrivere il codice 1212 → Conferma | Il voto viene registrato |
| 8 | Tornare alla dashboard mentre la fotocamera è accesa | La fotocamera si spegne (sparisce l'indicatore verde in alto) |
| 9 | Aprire lo stesso link da **Chrome** su iPhone | Funziona; il banner di installazione consiglia di usare Safari |
| 10 | "Il mio QR" (a voto aperto) → "Scarica QR" | Immagine con nome, QR e codice |

Se un punto non va: annotare modello di iPhone, versione di iOS (Impostazioni → Generali → Info) e uno screenshot.

---

## R3 — Backup dei dati

**Perché.** Un reset sbagliato, un import sbagliato o un errore durante l'evento non si possono annullare. Il backup permette di ricostruire i dati.

**Due livelli.**
1. **Supabase Pro** dall'8 al 18 ottobre: backup automatici giornalieri del database fatti da Supabase (Project Settings → Billing). Nel piano gratuito non ci sono backup ripristinabili.
2. **Backup manuale dal pannello** (sempre disponibile, anche col piano gratuito): pannello admin → 🩺 Stato del sistema → **💾 Scarica backup**. Scarica un file `fantassisi-backup-AAAAMMGG-HHMM.json` con tutte le tabelle del gioco (utenti, QR, ricariche, bonus, voti, impostazioni).

**Quando scaricarlo.**
- Ogni mattina dell'evento (16, 17, 18 ottobre) prima che inizi il gioco, e ogni sera.
- Sempre **prima** di un reset, di un import Excel o di cambi di fase.

**Dove conservarlo.** Il file contiene dati personali, i link di accesso e i codici di tutti: salvarlo in una cartella riservata (non su chat, non su cartelle condivise aperte), e cancellare le copie dopo l'evento.

**Se serve ripristinare.** Non si fa dal pannello: contattare lo sviluppatore con il file di backup più recente. Con Supabase Pro si può anche ripristinare il database a un giorno precedente da Project Settings → Database → Backups (sostituisce tutti i dati: decidere con lo sviluppatore).

---

## Mattina del 16 ottobre (inizio del Forum)

Il voto è già aperto dal 15 ottobre: i voti dei giorni di prova vanno azzerati prima che inizi il Forum.

1. Pannello admin → 🩺 Stato del sistema → **💾 Scarica backup** (copia dei dati di prova, per sicurezza).
2. Scheda 🎁 Bonus: **eliminare tutti i bonus e i premi di prova** (🗑️). Nessun reset li tocca.
3. Pulsante 🔄 Reset → **Reset completo** → Conferma (cancella tutti i voti e le ricariche di coins riscattate).
4. Controllare: classifica squadre 0 – 0, classifiche vuote.
5. 🩺 Stato del sistema → "Esegui controllo": tutto verde.
6. Ogni sera: 💾 Scarica backup.

## Durante l'evento

- Se qualcuno inoltra o perde il suo link: elenco utenti → 🔄 accanto al nome (crea un link nuovo e invalida il vecchio) → OK per mandargli la mail.
- Se una persona non riesce a entrare: `/accedi` con mail di iscrizione + ultime 4 cifre del telefono, oppure "Ricevi il link per mail".
- Tabellone sul proiettore: `/tabellone` (oppure `/tabellone?fisso=squadre`), sfida karaoke: `/tabellone-karaoke` (sabato 17, 16-19; il QR di squadra si rivota ogni 5 minuti).
- Qualcosa non va: 🩺 Stato del sistema → "Esegui controllo" e mandare lo screenshot allo sviluppatore.

## Dopo il 18 ottobre

- Render e Supabase: tornare al piano gratuito. Resend: valutare se tornare al gratuito.
- Cancellare i file di backup.
- Facoltativo: rendere privato il repository GitHub, DMARC più severo per psiconet.it.
