-- Classifiche calcolate dal database (somme), invece di scaricare tutti i voti a ogni ricalcolo.
-- Da eseguire UNA volta nello SQL Editor di Supabase. Copiare TUTTO il file, dalla prima riga.
--
-- Perche': ogni pochi secondi il server ricalcola le classifiche. Senza queste funzioni deve leggere
-- tutte le righe di votes, event_votes e boost_allocations a pagine da 1000 (con 50-100 mila voti
-- a fine evento sono centinaia di letture in fila a ogni ricalcolo). Con queste funzioni il database
-- restituisce gia' le somme (poche centinaia di righe). Il risultato e' identico.
-- Se le funzioni mancano, l'app torna da sola al metodo vecchio: non si rompe nulla.
-- Si puo' rieseguire senza danni.

-- 1) Somme per le classifiche (squadre, individuali, classi, sedi) in un solo oggetto JSON.
--    Un solo risultato: niente limite delle 1000 righe dell'API.
create or replace function public.standings_aggregates(p_now timestamptz default now())
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('recipient_id', recipient_id, 'points', pts))
      from (select recipient_id, sum(coalesce(points, 0))::int as pts from public.votes group by recipient_id) v
    ), '[]'::jsonb),
    'event_votes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_target', team_target, 'qr_type', qr_type,
        'class_school', class_school, 'class_site', class_site, 'class_year', class_year, 'points', pts))
      from (
        select team_target, qr_type, class_school, class_site, class_year, sum(coalesce(points, 1))::int as pts
        from public.event_votes
        group by team_target, qr_type, class_school, class_site, class_year
      ) e
    ), '[]'::jsonb),
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', user_id, 'team', team,
        'class_school', class_school, 'class_site', class_site, 'class_year', class_year, 'points', pts))
      from (
        select user_id, team, class_school, class_site, class_year, sum(points)::int as pts
        from public.boost_allocations
        where at <= p_now
        group by user_id, team, class_school, class_site, class_year
      ) a
    ), '[]'::jsonb)
  );
$$;

-- 2) Totali della sfida karaoke (finestra oraria), stessa logica del tabellone karaoke.
create or replace function public.karaoke_totals(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'Matricole',
      coalesce((select sum(coalesce(v.points, 0)) from public.votes v join public.users u on u.id = v.recipient_id
                where v.voted_at >= p_from and v.voted_at < p_to and u.team = 'Matricole'), 0)
    + coalesce((select sum(coalesce(points, 1)) from public.event_votes
                where voted_at >= p_from and voted_at < p_to and team_target = 'Matricole'), 0),
    'Veterani',
      coalesce((select sum(coalesce(v.points, 0)) from public.votes v join public.users u on u.id = v.recipient_id
                where v.voted_at >= p_from and v.voted_at < p_to and u.team = 'Veterani'), 0)
    + coalesce((select sum(coalesce(points, 1)) from public.event_votes
                where voted_at >= p_from and voted_at < p_to and team_target = 'Veterani'), 0)
  );
$$;

-- 3) Controllo dello stato del database per la scheda "Stato del sistema" del pannello admin.
create or replace function public.fantassisi_db_check()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'old_unique_event_vote_index', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_one_event_vote_per_user'),
    'event_vote_time_index', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_event_votes_user_event_time'),
    'event_votes_voted_at_index', exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_event_votes_voted_at'),
    'app_settings', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_settings'),
    'boost_allocations', exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'boost_allocations'),
    'public_bonus_columns', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'team_boosts' and column_name = 'kind'),
    'allocation_class_columns', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'boost_allocations' and column_name = 'class_school')
  );
$$;

-- 4) Indice per le letture a finestra oraria dei voti ai QR (karaoke)
create index if not exists idx_event_votes_voted_at on public.event_votes using btree (voted_at);

-- 5) Solo il server (chiave service role) puo' chiamare queste funzioni.
revoke all on function public.standings_aggregates(timestamptz) from public, anon, authenticated;
revoke all on function public.karaoke_totals(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.fantassisi_db_check() from public, anon, authenticated;
grant execute on function public.standings_aggregates(timestamptz) to service_role;
grant execute on function public.karaoke_totals(timestamptz, timestamptz) to service_role;
grant execute on function public.fantassisi_db_check() to service_role;

-- 6) Dice all'API di Supabase di rileggere lo schema (altrimenti le funzioni nuove risultano non trovate)
notify pgrst, 'reload schema';

-- 7) Controllo: deve restituire un oggetto con votes, event_votes, allocations
select jsonb_typeof(public.standings_aggregates()) as standings, public.fantassisi_db_check() as stato;
