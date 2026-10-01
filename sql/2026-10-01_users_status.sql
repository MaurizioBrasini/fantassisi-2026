-- Stato iscrizione dell'utente: 'confermato' | 'lista_attesa'
-- Gli utenti già presenti diventano 'confermato'. Da eseguire nello SQL Editor di Supabase
-- PRIMA di importare il file Excel con i fogli confermati/lista d'attesa.
alter table public.users
  add column if not exists status text not null default 'confermato';
