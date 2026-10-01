-- Bonus a tempo per le squadre (bilanciamento del punteggio). Da eseguire nello SQL Editor
-- di Supabase PRIMA di usare il pannello "Bonus squadra" in admin. Finché la tabella non
-- esiste, dashboard e tabellone funzionano come prima (nessun bonus).
create table if not exists public.team_boosts (
  id uuid primary key default gen_random_uuid(),
  team text not null check (team in ('Matricole', 'Veterani')),
  total_points integer not null check (total_points > 0),
  start_at timestamptz not null default now(),
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid
);

alter table public.team_boosts enable row level security;

-- Lettura pubblica (le dashboard leggono con la chiave anon, come per votable_events);
-- nessuna policy di scrittura: si scrive solo dalla rotta server /api/admin/boosts.
drop policy if exists "Public can read team boosts" on public.team_boosts;
create policy "Public can read team boosts" on public.team_boosts for select using (true);
