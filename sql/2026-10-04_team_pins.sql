-- PIN fissi dei QR di squadra: 1212 = Matricole, 3434 = Veterani.
-- Da eseguire UNA volta nello SQL Editor di Supabase.
--
-- Cosa fa, tutto in un'unica transazione (o va tutto o non cambia niente):
--  1) controlla che esista ESATTAMENTE un QR di squadra (qr_type = 'team') per ciascuna squadra;
--     se ce ne sono 0 o piu' di uno si ferma con un messaggio e non tocca nulla;
--  2) chi oggi ha 1212 o 3434 (utenti, altri QR evento, QR ricarica) riceve un PIN casuale libero;
--  3) assegna 1212 al QR di squadra Matricole e 3434 a quello Veterani.
-- Lo spazio PIN e' unico su users + votable_events + bonus_qr (lo impone l'app, non il DB),
-- quindi il PIN casuale e' scelto tra quelli non usati in nessuna delle tre tabelle.

do $$
declare
  team_row record;
  holder record;
  n int;
  fixed_pin text;
  new_pin text;
  team_event_id uuid;
begin
  for team_row in select * from (values ('Matricole', '1212'), ('Veterani', '3434')) as t(team, pin) loop
    fixed_pin := team_row.pin;

    select count(*) into n from public.votable_events where qr_type = 'team' and team_target = team_row.team;
    if n <> 1 then
      raise exception 'Squadra %: trovati % QR di squadra (ne serve esattamente 1). Non ho cambiato nulla: dimmi quale tenere.', team_row.team, n;
    end if;
    select id into team_event_id from public.votable_events where qr_type = 'team' and team_target = team_row.team;

    -- chi ha gia' questo PIN, escluso il QR di squadra stesso
    for holder in
      select 'users' as tbl, id from public.users where pin = fixed_pin
      union all
      select 'votable_events', id from public.votable_events where pin = fixed_pin and id <> team_event_id
      union all
      select 'bonus_qr', id from public.bonus_qr where pin = fixed_pin
    loop
      select lpad(g::text, 4, '0') into new_pin
      from generate_series(0, 9999) g
      where lpad(g::text, 4, '0') not in ('1212', '3434')
        and not exists (select 1 from public.users where pin = lpad(g::text, 4, '0'))
        and not exists (select 1 from public.votable_events where pin = lpad(g::text, 4, '0'))
        and not exists (select 1 from public.bonus_qr where pin = lpad(g::text, 4, '0'))
      order by random()
      limit 1;

      if holder.tbl = 'users' then
        update public.users set pin = new_pin where id = holder.id;
      elsif holder.tbl = 'votable_events' then
        update public.votable_events set pin = new_pin where id = holder.id;
      else
        update public.bonus_qr set pin = new_pin where id = holder.id;
      end if;
      raise notice 'PIN % tolto a % %, nuovo PIN %', fixed_pin, holder.tbl, holder.id, new_pin;
    end loop;

    update public.votable_events set pin = fixed_pin where id = team_event_id;
  end loop;
end $$;

-- Controllo finale: deve mostrare 2 righe, una per squadra, con i PIN giusti
select title, team_target, pin, active from public.votable_events where qr_type = 'team' order by team_target;
