-- Allinea ai valori standard i QR di classe creati all'inizio (anno come "4 ANNO 2026", scuola come
-- "CCMA Marco Aurelio" o "APC ROMANIA"). Il codice riconosce gia' tutte le grafie (lib/classKey.ts),
-- quindi questo script NON e' indispensabile: serve solo a tenere i dati puliti e uguali a quelli dei
-- profili. Non cambia ne' i codici QR ne' i PIN: i QR gia' stampati o salvati restano validi.
-- Da eseguire UNA volta nello SQL Editor di Supabase. Copiare TUTTO il file.

update public.votable_events set class_year = 'primo'          where class_year = '1' || chr(176) || ' ANNO 2026';
update public.votable_events set class_year = 'secondo'        where class_year = '2' || chr(176) || ' ANNO 2026';
update public.votable_events set class_year = 'terzo'          where class_year = '3' || chr(176) || ' ANNO 2026';
update public.votable_events set class_year = 'quarto'         where class_year = '4' || chr(176) || ' ANNO 2026';
update public.votable_events set class_year = 'preiscrizione'  where class_year = 'PRE-ISCRITTI 2027 E 2028';

update public.votable_events set class_school = 'CCMA' where class_school = 'CCMA Marco Aurelio';
update public.votable_events set class_school = 'APC'  where class_school = 'APC ROMANIA';

update public.event_votes set class_year = 'primo'    where class_year = '1' || chr(176) || ' ANNO 2026';
update public.event_votes set class_year = 'secondo'  where class_year = '2' || chr(176) || ' ANNO 2026';
update public.event_votes set class_year = 'terzo'    where class_year = '3' || chr(176) || ' ANNO 2026';
update public.event_votes set class_year = 'quarto'   where class_year = '4' || chr(176) || ' ANNO 2026';
update public.event_votes set class_school = 'CCMA' where class_school = 'CCMA Marco Aurelio';
update public.event_votes set class_school = 'APC'  where class_school = 'APC ROMANIA';

-- Controllo: gli anni dei QR di classe devono essere solo primo, secondo, terzo, quarto
select class_year, count(*) from public.votable_events where qr_type = 'class' group by 1 order by 1;
