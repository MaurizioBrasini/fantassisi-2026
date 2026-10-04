# FantAssisi 2026 — Documento di handoff tecnico
### Aggiornato al 4 ottobre 2026 (prima versione: 16 luglio 2026)

Questo documento descrive l'intero progetto da zero, non solo le ultime modifiche. È pensato per chi prende in carico lo sviluppo/collaudo senza contesto pregresso. **Le sezioni 0 e 11 sono le più aggiornate**; dove una sezione più vecchia le contraddice, valgono la 0 e la 11.

---

## 0. In breve (stato al 4 ottobre 2026)

**Calendario.** Forum di Assisi 16-18 ottobre 2026. Fase **Anteprima** fino a giovedì 8 ottobre ore 00:00 (si vedono QR e PIN di squadra e classe per le slides, non si vota); poi **voto aperto** in automatico. Il 16 ottobre reset "full" dei voti di prova. Sfida karaoke sabato 17 ottobre 16-19 (`lib/karaoke.ts`).

**Architettura.** Next.js 14 (App Router) su Render, Postgres su Supabase. Il browser **non** legge mai il database: ogni dato passa da una route in `app/api` che usa la chiave service role (`lib/supabaseAdmin.ts`). Identità = cookie httpOnly firmato (`lib/session.ts`); autorizzazione = `requireRole()` che rilegge sempre il ruolo dal database.

**Regole di gioco** (una sola fonte nel codice per ciascuna):
| Regola | Dove |
|---|---|
| Voto a una persona: 2 punti tra Matricole e Veterani, 1 altrimenti; una volta al giorno per persona; i docenti non si votano | `app/api/vote/route.ts` + indice `idx_one_vote_per_day` |
| Voto a un QR di squadra/classe: stessi punti; rivoto dopo 15 min (squadra) o 1 ora (classe) | `lib/qrActions.ts` |
| PIN fissi dei QR di squadra: 1212 Matricole, 3434 Veterani | `TEAM_PINS` in `lib/pins.ts` |
| CBT coins: 20 al giorno, dal 16 ottobre si accumulano; ricariche con QR | `lib/coins.ts` |
| Fase Anteprima / Voto aperto | `lib/phase.ts` (tabella `app_settings`) |
| Classe = (scuola, sede, anno); solo studenti in corso 1°-4° anno; grafie vecchie riconosciute | `lib/classKey.ts`, `lib/standings.ts` |
| Bonus nascosti (a tempo) e premi palesi (persona/classe/sede, con banner) | `lib/boosts.ts`, `lib/publicBonus.ts`, `components/BonusGenerator.tsx` |
| Punteggi e classifiche (squadre, individuali, classi, sedi), anche per i tabelloni | `lib/standings.ts` (somme dal database, `sql/09_aggregates.sql`) |

**Ruoli.** `admin`: tutto (pannello `/admin`). `staff`: pagina `/staff` con QR ricarica, bonus, nuovi partecipanti, elenco e download dei QR esistenti; niente token/PIN altrui, niente QR di voto, niente reset/import. `student` (mostrato come "partecipante"): app.

**Protezioni da non togliere.** Voti serializzati per persona (`lib/userLock.ts`: niente doppi voti simultanei); input validati (`lib/http.ts`); intestazioni di sicurezza (`next.config.js`); classifiche con cache e ricalcolo in sottofondo; pagine di errore (`app/error.tsx`, `app/global-error.tsx`).

**Messa in produzione senza sorprese.** Gli script SQL sono in `sql/`, numerati nell'ordine di esecuzione (vedi `sql/LEGGIMI.md`). Dopo ogni deploy o script: pannello admin → **🩺 Stato del sistema** → "Esegui controllo" (variabili su Render, migrazioni eseguite, PIN di squadra, QR di classe doppi, fase, velocità delle classifiche). Controllo dei tipi: `npx tsc --noEmit`. Attenzione: `next build` e `next lint` riscrivono `tsconfig.json`, da ripristinare con git.

---

## 1. Cos'è il progetto

Web app gamificata per il **Forum di Assisi**, conferenza di formazione in psicologia con circa **1.200-1.300 partecipanti**. L'app trasforma la partecipazione alla conferenza in una competizione a squadre tra due gruppi di iscritti, con voto tra pari, classifiche in tempo reale e un pannello di gestione per lo staff.

### Gruppi di utenti (3)

1. **Matricole** — una delle due squadre in gara, simbolo: gallo arancio
2. **Veterani** — l'altra squadra in gara, simbolo: mucca blu
3. **Didatti & Docenti** — chi non appartiene a nessuna delle due squadre (formatori, docenti, staff didattico)

Esiste inoltre un **ruolo admin/staff** separato, con accesso a un pannello di gestione dedicato, non visibile agli utenti normali.

---

## 2. Stack tecnico e vincoli operativi

| Componente | Dettaglio |
|---|---|
| Framework | Next.js 14, App Router |
| Database/Auth | Supabase (Postgres), **letto e scritto solo dal server** con la chiave service role (`lib/supabaseAdmin.ts`). Nessuna Supabase Auth: l'identità è un cookie di sessione firmato (vedi sezione 11) |
| Funzioni server-side sensibili | RPC Postgres `SECURITY DEFINER` |
| Repository | GitHub |
| Deploy | Render |

**Vincolo importante sul workflow**: chi gestisce il codice (Maurizio, committente/proprietario del progetto) **non è uno sviluppatore di professione** e non usa il terminale/git CLI. Da settembre 2026: i commit li prepara lo sviluppatore (o l'assistente) in locale, Maurizio fa il push con GitHub Desktop; gli script SQL li esegue lui nello SQL Editor di Supabase. I file di grandi dimensioni vengono caricati con il metodo "upload file" dell'interfaccia web, non incollati manualmente. Chiunque prenda in carico il progetto deve tenerne conto se prevede modifiche che il committente dovrà poi eseguire o verificare autonomamente: le istruzioni vanno sempre date in termini di "che file scaricare/caricare da GitHub", non di comandi git.

**Le funzioni Postgres `SECURITY DEFINER` (`reset_scores`, `reset_full`, `reset_votes_on_date`) vivono in Supabase (SQL Editor), NON nel repository GitHub.** Non cercarle nel codice: se serve modificarle, si interviene direttamente su Supabase.

**Service role key**: per le chiamate RPC va usata la versione **legacy in formato JWT** della service role key, non la versione più recente — la nuova non funziona con le RPC in uso.

---

## 3. Dashboard utente

File principale: `app/page.tsx`, componente `Dashboard()`.

Si ramifica in due componenti in base al ruolo:
- **`DashboardNormale`** — per Matricole e Veterani
- **`DashboardDidatti`** — per Didatti & Docenti

### Funzionalità della dashboard

- Classifica squadre in tempo reale
- Ranking individuale
- Ranking per sede
- Ranking per classe
- Sistema **CBT coins**: 20 monete al giorno che, dal primo giorno di gioco, **si accumulano** (quelle non usate restano) e si spendono liberamente per votare colleghi e QR; i QR "Ricarica" ne aggiungono altri (vedi sezione 11)
- Scanner QR (fotocamera posteriore) per votare un collega tramite il suo QR personale
- QR personale mostrabile per farsi votare
- Riscatto di bonus coins tramite QR generati dall'admin

---

## 4. Sistema di voto — due meccanismi paralleli

Questo è uno dei punti più delicati del sistema: **esistono due percorsi di voto distinti**, che scrivono su due tabelle diverse ma condividono la stessa logica di punteggio.

### 4.1 Voto individuale peer-to-peer

- Endpoint: `app/api/vote/route.ts`
- Tabella: `votes`
- Un utente scansiona il QR personale di un altro utente
- Punteggio: **1 punto** standard, **2 punti** se le due squadre sono diverse e valide (Matricola vs Veterano)

### 4.2 Voto da QR generato dall'admin

- Endpoint: `app/api/event-vote/route.ts`
- Tabella: `event_votes`
- L'admin genera QR per squadra/classe/ricarica bonus; l'utente scansiona questi QR (non il QR personale di un'altra persona)
- La riga registrata include `class_school`, `class_site`, `class_year`, `team_target` — cioè i metadati letti dal QR stesso
- Stessa logica di punteggio della sezione 4.1 (1 o 2 punti)
- **Punto critico già verificato e corretto**: il punteggio va applicato alla sede/classe **indicata dal QR scansionato**, non alla sede dell'utente che vota. Esempio verificato: un Veterano che scansiona un QR "Bari, 1° anno" assegna 2 punti a Bari/1°anno, non alla propria sede di appartenenza.

Qualsiasi modifica alla logica di punteggio va applicata **in entrambi** gli endpoint, altrimenti i due meccanismi si disallineano. (Aggiornamento ottobre: i voti ai QR passano tutti da `castEventVote` in `lib/qrActions.ts`, usato da `/api/event-vote` e `/api/qr/redeem`; lo stesso QR si può rivotare dopo 15 minuti se di squadra, dopo 1 ora se di classe.)

---

## 5. Classifiche

Directory: `app/ranking/`

Tre viste:
- Per individuo
- Per sede (pesata sul numero reale di classi per sede — non è una semplice somma, tiene conto del numero di classi per normalizzare sedi di dimensioni diverse)
- Per classe

**Il calcolo dei punteggi è unico**, in `lib/standings.ts` (cache di processo di 5 secondi), ed è usato da `/api/standings` (dashboard e le tre classifiche dell'app) e dal tabellone pubblico `/tabellone` (`lib/scoreboard.ts`). I telefoni non scaricano più le tabelle: ricevono il risultato. Una regola di punteggio si cambia solo lì.

**Le classifiche sommano correttamente sia `votes` che `event_votes`.** In una sessione precedente esisteva un bug per cui una delle due tabelle non veniva conteggiata in una vista specifica: è stato risolto e va tenuto d'occhio in fase di beta, perché è il tipo di errore che si nota solo quando i numeri non tornano rispetto ai voti effettivamente dati.

---

## 6. Pannello admin

File: `app/admin/page.tsx`, solo per il ruolo `admin` (lo staff viene mandato alla sua pagina `/staff`). Schede aggiunte a ottobre: 🩺 Stato del sistema, 🚦 Fase del gioco, 🎁 Bonus (generatore unico nascosti/palesi).

### Funzionalità

- **CRUD utenti** con:
  - ricerca live (per nome/email)
  - filtro per ruolo/team
  - ordinamento cliccabile sulle colonne
- **Generazione QR**: squadra, classe, ricarica bonus
- **Import bulk** da CSV/Excel (tipicamente export da Google Forms), con regole di business per l'assegnazione automatica alla squadra
- **Export CSV**
- **Invio email** con link di login personale a ciascun utente
- **Funzioni di reset** (tramite le RPC Postgres descritte al punto 2):
  - reset voti di oggi
  - reset di tutti i voti
  - reset completo
- **Nomina staff**: tramite endpoint sicuro dedicato (non tramite modifica diretta di riga)

---

## 7. PWA — installazione app (lavoro più recente)

L'app è una PWA installabile su Android e iOS. Questa parte è stata rivista e testata in questa sessione ed è **verificata funzionante su Android (Samsung S24, Chrome)**.

### File coinvolti

- `components/InstallButton.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `public/manifest.json` (non modificato, già corretto: `display: standalone`, icone 192/512 con `purpose: any maskable`)

### Comportamento del componente `InstallButton`

- Bottone flottante fisso in basso, centrato, larghezza max 360px, visibile su tutte le pagine (renderizzato in `layout.tsx`, dentro `<body>`, dopo `{children}`)
- **Si nasconde automaticamente** se l'app è già in modalità standalone (cioè già installata) — verificato: dopo l'installazione, il bottone sparisce alla riapertura
- **Su Android/Desktop**: appare solo se il browser espone l'evento nativo `beforeinstallprompt` (dipende dai criteri PWA e dal browser — non è controllabile via codice se il browser decide di non esporlo, ad es. dopo rifiuti recenti dell'utente)
- **Su iOS**: appare sempre (perché `beforeinstallprompt` non esiste su iOS/Safari), e al tap mostra un box con le istruzioni manuali ("Condividi → Aggiungi a schermata Home")
- **Rilevamento Chrome su iPhone (`CriOS`)**: se l'utente è su iPhone ma sta usando Chrome invece di Safari, viene mostrato un avviso aggiuntivo che consiglia di aprire il link in Safari, perché solo da Safari l'installazione PWA completa funziona in modo affidabile su iOS
- **Dismiss**: la ✕ nella pillola blu nasconde il bottone per 24 ore (persistito in `localStorage`, chiave `fantassisi_install_dismissed_until`), poi ricompare automaticamente. La ✕ è poco visibile (bianco trasparente su sfondo blu) — è una scelta accettata, non un difetto da correggere in questa fase.

### Percorso alternativo, sempre disponibile

Indipendentemente dal bottone custom, l'utente può sempre installare l'app tramite il **menu nativo del browser** (in Chrome: ⋮ → "Installa app"): questo funziona anche se il bottone custom è temporaneamente nascosto per il dismiss delle 24 ore. È utile saperlo per rispondere a eventuali segnalazioni di utenti beta che non trovano il bottone.

### Non ancora testato

- Il flusso completo su un dispositivo iOS reale (Safari e Chrome-iOS) — nessuno dei due sviluppatori attuali possiede un iPhone. **Va fatto verificare a qualcuno con iPhone prima dell'evento**, dato che una parte dei 1.200 partecipanti userà sicuramente iOS.

---

## 8. Pattern tecnici critici — da non violare

Questi pattern sono stati stabiliti per risolvere problemi specifici già incontrati. Chi tocca il codice deve conoscerli prima di modificare le parti relative:

1. **Fetch paginato da Supabase**: le query che potrebbero superare 1.000 righe vanno paginate esplicitamente a blocchi da 1.000, perché Supabase applica quel limite di default e tronca silenziosamente i risultati oltre — non lo segnala come errore.
2. **`Array.from()` al posto dello spread operator** su Map/Set (es. `Array.from(myMap.values())` invece di `[...myMap.values()]`), per compatibilità con la configurazione TypeScript del progetto.
3. **`WHERE true`** nelle istruzioni `DELETE` senza altre condizioni: richiesto da `pg_safeupdate`, altrimenti la query viene rifiutata.
4. **Service role key in formato JWT legacy** per le chiamate RPC (vedi punto 2).

---

## 9. Stato attuale del progetto

> Sezione storica (16 luglio 2026). Lo stato aggiornato è nella sezione 0.

- **App in produzione** su Render, nessun bug noto aperto al 16 luglio 2026
- Testata attivamente da Maurizio (proprietario/responsabile del progetto) prima dell'evento
- PWA installabile confermata funzionante su Android; da confermare su iOS
- Prossima fase: **collaudo con un gruppo di utenti beta**, presumibilmente per validare in condizioni reali: carico con più utenti simultanei, correttezza dei due meccanismi di voto in parallelo, corretto funzionamento del pannello admin sotto stress, e installazione PWA su iOS reale

## 10. Cosa osservare con particolare attenzione durante il collaudo beta

- Che i due meccanismi di voto (§4) non si disallineino mai in classifica
- Che il ranking per sede resti coerente quando si aggiungono/rimuovono classi
- Che il reset (giornaliero/totale/completo) non lasci stati intermedi inconsistenti se lanciato mentre ci sono voti in corso
- Comportamento del bottone di installazione su iOS reale (Safari e Chrome-iOS)
- Comportamento sotto carico concorrente (1.200+ utenti potenziali, anche se il beta test sarà su un sottoinsieme ridotto)


---

## 11. Accessi, dati e sicurezza (aggiornato 2 ottobre 2026)

**Come entra una persona**
- **Link personale** `/api/auth?token=<auth_token>`: imposta la sessione. I token sono casuali (16 caratteri esadecimali). Staff e admin entrano solo da qui.
- **`/accedi`** (partecipanti): mail di iscrizione + ultime 4 cifre del telefono (`users.phone`, formato `+39…`, caricato dal file Excel dal campo TELEFONO). Errori: messaggio generico; blocco di 5 minuti dopo 5 tentativi sbagliati per mail (25 per IP), in memoria (`lib/rateLimit.ts`).
- **"Ricevi il link per mail"** (stessa pagina, `/api/auth/send-link-request`): manda il link personale solo alla mail registrata, risposta identica se la mail esiste o no.
- **Sessione**: cookie firmato httpOnly `session_sig` (HMAC con `SESSION_SECRET`, non cambiarlo: disconnette tutti), 40 giorni, rinnovato a ogni apertura da `/api/me`. I cookie `user_id`/`user_team`/… servono solo a mostrare l'interfaccia. **Esci** = `/api/auth/logout`.

**Il browser non legge il database.** Nessuna pagina importa un client Supabase. Le pagine chiamano API sotto `app/api` (`/api/me`, `/api/standings`, `/api/admin/data`, …) che usano `getSupabaseAdmin()` (chiave service role). Il 2 ottobre 2026 sono stati revocati i permessi `anon`/`authenticated` su tutte le tabelle e tolte le policy aperte; resta solo la sola lettura del ruolo di controllo `claude_agent`. **Non reintrodurre letture dal browser** e non riaprire le policy.

**Helper condivisi (`lib/`)**: `supabaseAdmin` (client unico), `fetchAll` (lettura a pagine da 1000 *sempre ordinata*, con errore esplicito), `pins` (PIN unici su utenti, eventi e bonus), `urls` (indirizzo dell'app e link personale), `config` (squadre, anni, `isYearValidForTeam`), `phone` (normalizzazione telefoni), `standings` (punteggi), `clientCookies` (cookie lato browser, logout).

**Email**: Resend, mittente `info@eventi.psiconet.it` (dominio dedicato, DKIM/SPF su Aruba), `RESEND_REPLY_TO` per reply-to e intestazione di disiscrizione. Variabili su Render: `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO`, `SESSION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`. La chiave pubblica di Supabase non serve più.

**Banner di installazione**: `components/InstallButton.tsx`, montato una sola volta in `app/layout.tsx`; uno script in `<head>` salva l'evento `beforeinstallprompt` in `window.__fantInstallPrompt`. Nascosto sulle pagine del tabellone e sull'admin.

**Reimport Excel**: legge tutti gli utenti esistenti a pagine e non rigenera mai token/PIN; si ferma senza scrivere se PIN o token risultano duplicati. Azzera comunque squadra/arruolamento dal roster: usarlo solo con un file nuovo.

**CBT coins** (`lib/coins.ts`): saldo = 20 × giorni di gioco + bonus riscattati − voti dati (colleghi + QR). Dal primo giorno di gioco (16 ottobre 2026, modificabile con la variabile `COINS_START_DATE` su Render, formato AAAA-MM-GG) i coins non usati si accumulano; prima di quella data valgono 20 al giorno senza accumulo. Lo stesso saldo si usa per mostrare il numero in dashboard e per bloccare il voto quando è a zero. Un voto vale 2 punti se tra Matricole e Veterani, 1 altrimenti. Restano: un solo voto alla stessa persona al giorno (indice `idx_one_vote_per_day`) Lo stesso QR/PIN si può rivotare dopo un'attesa che dipende dal tipo: squadra 15 minuti, classe/sede 1 ora (`lib/qrActions.ts`; l'indice univoco su `event_votes` è stato tolto con `sql/04_event_votes_cooldown.sql`). Il voto a una persona resta uno al giorno.

**Fase Anteprima / Voto aperto** (`lib/phase.ts`, interruttore nel pannello admin, tabella `app_settings`): finché il voto è chiuso `/api/vote` e i QR di evento rispondono 403 (i QR ricarica no) e la dashboard mostra i QR/PIN di squadra e classe per le slides (`/api/anteprima`). In modalità automatica il voto si apre giovedì 8 ottobre 2026 alle 00:00. I PIN dei QR di squadra sono fissi: 1212 Matricole, 3434 Veterani (`TEAM_PINS` in `lib/pins.ts`, riservati nei generatori).

**Permessi staff e admin.** Lo staff ha la sua pagina `/staff` (genera QR ricarica, vede e scarica i QR di voto esistenti, aggiunge partecipanti, assegna bonus); `/admin` rimanda lo staff lì. Le API lo impongono: staff può `POST` su `/api/admin/bonus` (QR ricarica), `/api/admin/boosts` (bonus), `/api/admin/users` (solo creare partecipanti, ruolo sempre student), `PATCH` per disattivare QR ricarica o fermare un bonus, `GET` di `/api/admin/events` e `/api/admin/bonus` (elenchi) e `/api/admin/people` (ricerca per nome, senza token). I QR di voto (classe, squadra) li crea, attiva e disattiva solo l'admin; mai due QR per la stessa classe o squadra (409), né due ricariche con lo stesso titolo. Solo admin: elenco utenti (`/api/admin/users` GET e `/api/admin/data`, contengono token e PIN di tutti), modifica/eliminazione utenti, invio link, import, reset, eliminazioni, fase del gioco.

**Generatore unico di bonus** (`components/BonusGenerator.tsx`, API `/api/admin/boosts`): modo NASCOSTO (a tempo, `lib/boosts.ts`, descritto sopra) oppure PALESE (`lib/publicBonus.ts`): premio immediato a una persona, classe o sede con un motivo. Persona: conta come voto ricevuto (sale anche squadra/classe/sede). Classe: classe + sede + squadra della classe. Sede: metà alle squadre (50/50, il punto dispari a sorte) e metà alle classi della sede (resti a sorte); le classi salgono anche nella sede ma non nelle squadre. Righe in `boost_allocations` con `class_school/site/year` (team vuoto = solo classe e sede), bonus in `team_boosts` con `kind = 'public'` (`sql/07_public_bonuses.sql`). Banner animato `components/PrizeBanner.tsx` (polling di `/api/premio` ogni 20 s, cache 5 s, una volta per dispositivo; non mostra premi più vecchi di 30 minuti a chi apre l'app per la prima volta).

**Classi.** Hanno una classe solo gli studenti in corso (1°-4° anno); pre-iscritti, ex allievi/specializzati e docenti no: non compaiono nella classifica delle classi né delle sedi e non hanno un QR di classe (hanno quello di squadra), ma i loro punti contano per la squadra. Scuola, sede e anno hanno grafie vecchie nei dati (anno "4° ANNO 2026", scuola "CCMA Marco Aurelio" / "APC ROMANIA", sede "Marco Aurelio Roma"): ogni confronto di classe passa da `lib/classKey.ts` (`canonClass`, `sameClass`), quindi la stessa classe è riconosciuta in qualunque grafia (classifiche, Anteprima, blocco duplicati). `sql/08_normalize_class_qr.sql` allinea i QR di classe già creati, senza toccare codici e PIN.

**Script SQL**: in `sql/`, numerati nell'ordine in cui vanno eseguiti nello SQL Editor di Supabase (`01_…`, `02_…`); il prossimo prende il numero successivo.

**Bonus squadra a persone** (`lib/boosts.ts`, pannello admin): l'admin sceglie squadra, punti e minuti; il bonus imita i voti veri: circa il 20-25% dei punti va solo alla squadra (pezzi da 1-2 punti, come i voti ai QR di squadra), il resto a partecipanti confermati della squadra scelti a caso, da 1 a 4 punti ciascuno (mai di più per intervento; l'eventuale avanzo va alla squadra), tutto in momenti casuali dell'intervallo (tabella `boost_allocations`, con `user_id` vuoto per i punti solo squadra; vedi `sql/03_boost_allocations.sql`). I punti alle persone contano come voti ricevuti: squadra, individuali, classi e sedi. Se la tabella non esiste ancora il pannello ricade sul vecchio bonus "solo squadra". Eliminare un bonus toglie anche le sue assegnazioni; "Ferma" tiene quelle già scattate.

**Guida fotocamera**: componente `components/CameraHelp.tsx`, usato nella pagina di scansione ("Non funziona?") e nella pagina pubblica `/guida`; le immagini (Android/Chrome) sono in `public/help/`. Per iPhone non ci sono schermate, solo testo.