-- =============================================================================
-- FANTASSISI 2026 - SCHEMA DEL DATABASE
-- Letto dal database reale il 2 ottobre 2026, aggiornato il 4 ottobre 2026 con le migrazioni
-- numerate di questa cartella (01-09).
--
-- Solo DOCUMENTAZIONE: descrive com'e' fatto il database su Supabase. Non va eseguito da zero:
-- le modifiche si fanno con gli script numerati (01_..., 02_...) nell'SQL Editor, nell'ordine.
-- Per sapere quali sono gia' stati eseguiti: pannello admin -> "Stato del sistema".
--
-- Accesso: il browser NON legge il database. Le tabelle hanno RLS attiva e i ruoli anon e
-- authenticated non hanno nessun permesso; il sito legge e scrive dal server con la chiave
-- service role. Il ruolo claude_agent ha solo lettura (policy "agent read").
-- =============================================================================

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  school text,
  site text,
  year text,
  role text DEFAULT 'student'::text,
  team text,
  auth_token text,
  created_at timestamp with time zone DEFAULT now(),
  is_didatta boolean NOT NULL DEFAULT false,
  pin text,
  status text NOT NULL DEFAULT 'confermato'::text,
  phone text,
  CONSTRAINT users_auth_token_key UNIQUE (auth_token),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['student'::text, 'staff'::text, 'admin'::text]))),
  CONSTRAINT users_team_check CHECK ((team = ANY (ARRAY['Matricole'::text, 'Veterani'::text, 'Didatti&Docenti'::text])))
);
CREATE UNIQUE INDEX idx_users_pin_unique ON public.users USING btree (pin) WHERE (pin IS NOT NULL);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.users FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- votes
-- ---------------------------------------------------------------------------
CREATE TABLE public.votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  voter_id uuid,
  recipient_id uuid,
  points integer,
  voted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT votes_pkey PRIMARY KEY (id),
  CONSTRAINT votes_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_one_vote_per_day ON public.votes USING btree (voter_id, recipient_id, date_from_timestamp(voted_at));
CREATE INDEX idx_votes_recipient ON public.votes USING btree (recipient_id);
CREATE INDEX idx_votes_voted_at ON public.votes USING btree (voted_at);
CREATE INDEX idx_votes_voter ON public.votes USING btree (voter_id);
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.votes FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- event_votes
-- ---------------------------------------------------------------------------
CREATE TABLE public.event_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  event_id uuid,
  voted_at timestamp with time zone DEFAULT now(),
  points integer DEFAULT 1,
  team_target text,
  class_school text,
  class_site text,
  class_year text,
  qr_type text,
  CONSTRAINT event_votes_pkey PRIMARY KEY (id),
  CONSTRAINT event_votes_event_id_fkey FOREIGN KEY (event_id) REFERENCES votable_events(id) ON DELETE CASCADE,
  CONSTRAINT event_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_event_votes_user ON public.event_votes USING btree (user_id);
-- 04: tolto l'indice univoco idx_one_event_vote_per_user (lo stesso QR si rivota dopo un'attesa,
-- controllata dall'app: squadra 15 minuti, classe 1 ora). Indici aggiunti:
CREATE INDEX idx_event_votes_user_event_time ON public.event_votes USING btree (user_id, event_id, voted_at DESC);
CREATE INDEX idx_event_votes_voted_at ON public.event_votes USING btree (voted_at);  -- 09 (karaoke)
ALTER TABLE public.event_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.event_votes FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- votable_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.votable_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  event_type text,
  team_target text,
  location text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  qr_code text,
  created_at timestamp with time zone DEFAULT now(),
  qr_type text DEFAULT 'team'::text,
  active boolean DEFAULT true,
  class_school text,
  class_site text,
  class_year text,
  pin text,
  CONSTRAINT votable_events_qr_code_key UNIQUE (qr_code),
  CONSTRAINT votable_events_pkey PRIMARY KEY (id),
  CONSTRAINT votable_events_event_type_check CHECK ((event_type = ANY (ARRAY['presentation'::text, 'song'::text]))),
  CONSTRAINT votable_events_qr_type_check CHECK ((qr_type = ANY (ARRAY['team'::text, 'class'::text]))),
  CONSTRAINT votable_events_team_target_check CHECK ((team_target = ANY (ARRAY['Matricole'::text, 'Veterani'::text])))
);
CREATE UNIQUE INDEX votable_events_pin_key ON public.votable_events USING btree (pin) WHERE (pin IS NOT NULL);
ALTER TABLE public.votable_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.votable_events FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- bonus_qr
-- ---------------------------------------------------------------------------
CREATE TABLE public.bonus_qr (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text,
  title text,
  amount integer DEFAULT 5,
  valid_from timestamp with time zone,
  valid_to timestamp with time zone,
  max_uses_per_user integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  active boolean DEFAULT true,
  pin text,
  CONSTRAINT bonus_qr_code_key UNIQUE (code),
  CONSTRAINT bonus_qr_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX bonus_qr_pin_key ON public.bonus_qr USING btree (pin) WHERE (pin IS NOT NULL);
ALTER TABLE public.bonus_qr ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.bonus_qr FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- bonus_redemptions
-- ---------------------------------------------------------------------------
CREATE TABLE public.bonus_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  bonus_id uuid,
  redeemed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bonus_redemptions_pkey PRIMARY KEY (id),
  CONSTRAINT bonus_redemptions_bonus_id_fkey FOREIGN KEY (bonus_id) REFERENCES bonus_qr(id) ON DELETE CASCADE,
  CONSTRAINT bonus_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_bonus_redemptions_user ON public.bonus_redemptions USING btree (user_id);
ALTER TABLE public.bonus_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.bonus_redemptions FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- team_boosts
-- ---------------------------------------------------------------------------
-- Bonus decisi dall'admin/staff. kind = 'hidden' (a tempo, imita i voti veri) oppure 'public'
-- (premio palese immediato con banner: target_type/target_label/reason). I punti veri stanno in
-- boost_allocations; le righe vecchie con distributed = false maturano linearmente (solo squadra).
CREATE TABLE public.team_boosts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team text,                                   -- 07: puo' essere vuoto (premio a una sede)
  total_points integer NOT NULL,
  start_at timestamp with time zone NOT NULL DEFAULT now(),
  end_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  distributed boolean NOT NULL DEFAULT false,  -- 03
  kind text NOT NULL DEFAULT 'hidden',         -- 07
  reason text,                                 -- 07
  target_type text,                            -- 07: person | class | site
  target_label text,                           -- 07
  CONSTRAINT team_boosts_pkey PRIMARY KEY (id),
  CONSTRAINT team_boosts_team_check CHECK ((team IS NULL OR team = ANY (ARRAY['Matricole'::text, 'Veterani'::text]))),
  CONSTRAINT team_boosts_kind_check CHECK ((kind = ANY (ARRAY['hidden'::text, 'public'::text]))),
  CONSTRAINT team_boosts_target_type_check CHECK ((target_type IS NULL OR target_type = ANY (ARRAY['person'::text, 'class'::text, 'site'::text, 'team'::text]))),
  CONSTRAINT team_boosts_total_points_check CHECK ((total_points > 0))
);
CREATE INDEX idx_team_boosts_public ON public.team_boosts USING btree (created_at DESC) WHERE (kind = 'public'::text);
ALTER TABLE public.team_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.team_boosts FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- boost_allocations (03, colonne di classe dal 07)
-- Una riga = punti di un bonus che maturano al momento "at". Tre forme:
--   user_id valorizzato         -> conta come voto ricevuto da quella persona
--   class_school/site/year      -> conta per classe e sede (e per la squadra solo se team e' valorizzato)
--   nessuno dei due             -> solo punteggio di squadra
-- ---------------------------------------------------------------------------
CREATE TABLE public.boost_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  boost_id uuid NOT NULL,
  user_id uuid,
  team text,
  points integer NOT NULL,
  at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  class_school text,
  class_site text,
  class_year text,
  CONSTRAINT boost_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT boost_allocations_boost_id_fkey FOREIGN KEY (boost_id) REFERENCES team_boosts(id) ON DELETE CASCADE,
  CONSTRAINT boost_allocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT boost_allocations_team_check CHECK ((team IS NULL OR team = ANY (ARRAY['Matricole'::text, 'Veterani'::text]))),
  CONSTRAINT boost_allocations_points_check CHECK ((points > 0))
);
CREATE INDEX idx_boost_allocations_boost ON public.boost_allocations USING btree (boost_id);
CREATE INDEX idx_boost_allocations_at ON public.boost_allocations USING btree (at);
ALTER TABLE public.boost_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.boost_allocations FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- app_settings (05): impostazioni dell'app. Oggi una sola chiave:
--   'voting_phase' -> {"mode": "auto" | "preview" | "open"}  (fase Anteprima / Voto aperto)
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT app_settings_pkey PRIMARY KEY (key),
  CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent read" ON public.app_settings FOR SELECT TO claude_agent USING (true);

-- ---------------------------------------------------------------------------
-- admins: tabella storica, NON usata dall'app (i ruoli stanno in users.role). Si puo' ignorare.
-- ---------------------------------------------------------------------------
CREATE TABLE public.admins (
  user_id uuid NOT NULL,
  is_super boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admins_pkey PRIMARY KEY (user_id),
  CONSTRAINT admins_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Funzioni (le RPC di reset vivono qui, non nel repository: modificarle dall'SQL Editor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.date_from_timestamp(timestamp with time zone)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT $1::date;
$function$;

CREATE OR REPLACE FUNCTION public.reset_full()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM votes WHERE true;
  DELETE FROM event_votes WHERE true;
  DELETE FROM bonus_redemptions WHERE true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_scores()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM votes WHERE true;
  DELETE FROM event_votes WHERE true;
END;
$function$;

-- reset_today: storica, NON usata (conta il giorno in UTC). Il pannello usa reset_votes_on_date.
CREATE OR REPLACE FUNCTION public.reset_today()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM votes 
  WHERE voted_at >= CURRENT_DATE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_votes_on_date()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM votes WHERE (voted_at AT TIME ZONE 'Europe/Rome')::date = (now() AT TIME ZONE 'Europe/Rome')::date;
  DELETE FROM event_votes WHERE (voted_at AT TIME ZONE 'Europe/Rome')::date = (now() AT TIME ZONE 'Europe/Rome')::date;
END;
$function$;

CREATE OR REPLACE FUNCTION public.voted_date_utc(ts timestamp with time zone)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT (ts AT TIME ZONE 'UTC')::date;
$function$;

-- ---------------------------------------------------------------------------
-- Funzioni di 09_aggregates.sql (eseguibili solo dal server, ruolo service_role)
--   standings_aggregates(p_now)  -> jsonb {votes, event_votes, allocations}: le somme usate da
--                                   lib/standings.ts al posto della lettura di tutte le righe
--   karaoke_totals(p_from, p_to) -> jsonb {Matricole, Veterani}: totali della sfida karaoke
--   coin_usage(p_user, p_since)  -> jsonb {votes, event_votes, bonus}: saldo coin in una sola lettura
--   fantassisi_db_check()        -> jsonb con lo stato delle migrazioni (scheda "Stato del sistema")
-- Il testo completo e' in sql/09_aggregates.sql.
-- ---------------------------------------------------------------------------