-- Bonus PALESI anche a una SQUADRA (Matricole o Veterani).
-- Da eseguire UNA volta nello SQL Editor di Supabase, DOPO 07_public_bonuses.sql.
-- Finche' non lo si esegue il premio alla squadra viene rifiutato dal database (gli altri funzionano).

alter table public.team_boosts drop constraint if exists team_boosts_target_type_check;
alter table public.team_boosts add constraint team_boosts_target_type_check check (target_type is null or target_type in ('person', 'class', 'site', 'team'));

notify pgrst, 'reload schema';
