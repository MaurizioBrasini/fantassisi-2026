-- Impostazioni dell'app (per ora: fase Anteprima / Voto aperto).
-- Da eseguire UNA volta nello SQL Editor di Supabase. Finche' non lo si esegue la fase resta "auto":
-- il voto si apre da solo giovedi' 8 ottobre 2026 alle 00:00 (ora italiana).

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

-- Accesso solo dal server (come le altre tabelle): nessun permesso al pubblico
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;

-- Sola lettura per il ruolo di controllo
grant select on table public.app_settings to claude_agent;
drop policy if exists "agent read" on public.app_settings;
create policy "agent read" on public.app_settings for select to claude_agent using (true);
