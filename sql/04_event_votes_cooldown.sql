-- Stesso QR/PIN votabile piu' volte, con attesa che dipende dal tipo (la controlla l'app):
--   QR/PIN di squadra: ogni 15 minuti
--   QR/PIN di classe (e sede): ogni ora
--   voto a una persona (tabella votes): uno al giorno, invariato
-- Da eseguire UNA volta nello SQL Editor di Supabase, PRIMA di mettere online il codice che
-- permette il rivoto: finche' l'indice vecchio c'e', il secondo voto allo stesso QR viene rifiutato
-- dal database con un errore.

-- Toglie "un solo voto per persona per QR" (valeva per tutti i QR di evento)
drop index if exists public.idx_one_event_vote_per_user;

-- Per trovare in fretta l'ultimo voto di una persona a un QR
create index if not exists idx_event_votes_user_event_time
  on public.event_votes using btree (user_id, event_id, voted_at desc);
