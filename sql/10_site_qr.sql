-- 10: QR di sede.
-- Oltre a squadra e classe, un QR puo' essere "di sede" (qr_type = 'site'): chi lo scansiona vota la
-- sede (class_site) e i punti vanno alla classifica per sede. Serve solo allargare il controllo sul tipo.
-- Eseguire nello SQL Editor di Supabase (idempotente).

alter table public.votable_events drop constraint if exists votable_events_qr_type_check;
alter table public.votable_events add constraint votable_events_qr_type_check check (qr_type in ('team', 'class', 'site'));

notify pgrst, 'reload schema';

select qr_type, count(*) from public.votable_events group by 1 order by 1;
