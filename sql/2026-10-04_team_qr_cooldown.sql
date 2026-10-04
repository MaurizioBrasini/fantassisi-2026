-- QR/PIN di squadra rivotabili ogni 15 minuti (invece di una sola volta in tutto l'evento).
-- Da eseguire UNA volta nello SQL Editor di Supabase, PRIMA di mettere online il codice che
-- permette il rivoto: finche' l'indice vecchio c'e', il secondo voto allo stesso QR di squadra
-- verrebbe rifiutato dal database con un errore.
--
-- Cosa cambia: l'indice "un solo voto per persona per QR" resta per tutti i QR (classe, ...)
-- TRANNE quelli di squadra (qr_type = 'team'). L'attesa di 15 minuti la controlla l'app.
-- I voti a persone (tabella votes) non cambiano: restano uno al giorno per persona.

drop index if exists public.idx_one_event_vote_per_user;

create unique index if not exists idx_one_event_vote_per_user
  on public.event_votes using btree (user_id, event_id)
  where qr_type is distinct from 'team';

-- Per trovare in fretta l'ultimo voto di una persona a un QR
create index if not exists idx_event_votes_user_event_time
  on public.event_votes using btree (user_id, event_id, voted_at desc);
