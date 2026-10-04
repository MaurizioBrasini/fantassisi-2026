-- Bonus PALESI (premi con banner) accanto a quelli nascosti, nello stesso generatore.
-- Da eseguire UNA volta nello SQL Editor di Supabase, PRIMA di mettere online il codice che li usa.
-- Finche' non lo si esegue il generatore resta sul solo modo nascosto e i punteggi non cambiano.
--
-- team_boosts: un bonus palese e' una riga con kind = 'public' (chi, quanto, perche'); i punti veri
--   stanno in boost_allocations, come per i bonus nascosti, e maturano subito.
-- boost_allocations: oltre a "a una persona" e "solo alla squadra" ora c'e' anche "a una classe"
--   (scuola/sede/anno), con o senza i punti alla squadra (team vuoto = solo classe e sede).

-- 1) team_boosts
alter table public.team_boosts alter column team drop not null;
alter table public.team_boosts drop constraint if exists team_boosts_team_check;
alter table public.team_boosts
  add constraint team_boosts_team_check check (team is null or team in ('Matricole', 'Veterani'));

alter table public.team_boosts add column if not exists kind text not null default 'hidden';
alter table public.team_boosts drop constraint if exists team_boosts_kind_check;
alter table public.team_boosts add constraint team_boosts_kind_check check (kind in ('hidden', 'public'));

alter table public.team_boosts add column if not exists reason text;        -- motivo mostrato nel banner
alter table public.team_boosts add column if not exists target_type text;   -- person | class | site
alter table public.team_boosts drop constraint if exists team_boosts_target_type_check;
alter table public.team_boosts
  add constraint team_boosts_target_type_check check (target_type is null or target_type in ('person', 'class', 'site'));
alter table public.team_boosts add column if not exists target_label text;  -- es. "Mario Rossi", "SPC Roma 2° Anno", "Roma"

create index if not exists idx_team_boosts_public on public.team_boosts (created_at desc) where kind = 'public';

-- 2) boost_allocations
alter table public.boost_allocations alter column team drop not null;
alter table public.boost_allocations drop constraint if exists boost_allocations_team_check;
alter table public.boost_allocations
  add constraint boost_allocations_team_check check (team is null or team in ('Matricole', 'Veterani'));

alter table public.boost_allocations add column if not exists class_school text;
alter table public.boost_allocations add column if not exists class_site text;
alter table public.boost_allocations add column if not exists class_year text;

-- 3) Dice all'API di Supabase di rileggere lo schema (altrimenti le nuove colonne risultano 'non trovate')
notify pgrst, 'reload schema';
