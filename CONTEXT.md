# FantAssisi 2026 — Documento di handoff tecnico
### Per il collaudo beta con gruppo utenti — 16 luglio 2026

Questo documento descrive l'intero progetto da zero, non solo le ultime modifiche. È pensato per chi prende in carico lo sviluppo/collaudo a partire da domani senza contesto pregresso.

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
| Database/Auth | Supabase (Postgres). Autenticazione tramite cookie `user_role`, non tramite Supabase Auth standard |
| Funzioni server-side sensibili | RPC Postgres `SECURITY DEFINER` |
| Repository | GitHub |
| Deploy | Render |

**Vincolo importante sul workflow**: chi gestisce il codice (Maurizio, committente/proprietario del progetto) **non è uno sviluppatore di professione** e lavora **esclusivamente tramite l'interfaccia web di GitHub**, non da terminale/git CLI. I file di grandi dimensioni vengono caricati con il metodo "upload file" dell'interfaccia web, non incollati manualmente. Chiunque prenda in carico il progetto deve tenerne conto se prevede modifiche che il committente dovrà poi eseguire o verificare autonomamente: le istruzioni vanno sempre date in termini di "che file scaricare/caricare da GitHub", non di comandi git.

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
- Sistema **CBT coins**: 20 monete al giorno, usate per votare tra pari
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

Qualsiasi modifica alla logica di punteggio va applicata **in entrambi** gli endpoint, altrimenti i due meccanismi si disallineano.

---

## 5. Classifiche

Directory: `app/ranking/`

Tre viste:
- Per individuo
- Per sede (pesata sul numero reale di classi per sede — non è una semplice somma, tiene conto del numero di classi per normalizzare sedi di dimensioni diverse)
- Per classe

**Le classifiche sommano correttamente sia `votes` che `event_votes`.** In una sessione precedente esisteva un bug per cui una delle due tabelle non veniva conteggiata in una vista specifica: è stato risolto e va tenuto d'occhio in fase di beta, perché è il tipo di errore che si nota solo quando i numeri non tornano rispetto ai voti effettivamente dati.

---

## 6. Pannello admin

File: `app/admin/page.tsx`, accessibile solo ai ruoli `admin`/`staff`.

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
