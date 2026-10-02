-- Bonus squadra assegnato a persone (punti individuali casuali, da 1 a 4 per persona per intervento).
-- Da eseguire UNA volta nello SQL Editor di Supabase. Finche' non lo si esegue il pannello "Bonus
-- squadra" continua a funzionare come prima (solo punteggio di squadra).

-- 1) Distingue i bonus a persone da quelli solo squadra gia' esistenti
alter table public.team_boosts add column if not exists distributed boolean not null default false;

-- 2) Le assegnazioni: a chi, quanti punti, da quando contano
create table if not exists public.boost_allocations (
  id uuid primary key default gen_random_uuid(),
  boost_id uuid not null references public.team_boosts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  points integer not null check (points > 0),
  at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_boost_allocations_boost on public.boost_allocations (boost_id);
create index if not exists idx_boost_allocations_at on public.boost_allocations (at);

-- 3) Accesso solo dal server (come le altre tabelle): nessun permesso al pubblico
alter table public.boost_allocations enable row level security;
revoke all on table public.boost_allocations from anon, authenticated;

-- 4) Sola lettura per il ruolo di controllo
grant select on table public.boost_allocations to claude_agent;
drop policy if exists "agent read" on public.boost_allocations;
create policy "agent read" on public.boost_allocations for select to claude_agent using (true);
