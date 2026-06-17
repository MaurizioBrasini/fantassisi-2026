-- =============================================
-- FANTASSISI 2026 – SCHEMA DATABASE
-- =============================================

-- Tabella utenti
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE,
  school TEXT,
  site TEXT,
  year TEXT,
  role TEXT CHECK (role IN ('student', 'staff', 'admin')) DEFAULT 'student',
  team TEXT CHECK (team IN ('Matricole', 'Veterani')),
  auth_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella voti tra persone
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  points INT,
  voted_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella eventi votabili
CREATE TABLE IF NOT EXISTS votable_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  event_type TEXT CHECK (event_type IN ('presentation', 'song')),
  team_target TEXT CHECK (team_target IN ('Matricole', 'Veterani')),
  location TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  qr_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella voti evento
CREATE TABLE IF NOT EXISTS event_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES votable_events(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella QR bonus
CREATE TABLE IF NOT EXISTS bonus_qr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  title TEXT,
  amount INT DEFAULT 5,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  max_uses_per_user INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella riscatti bonus
CREATE TABLE IF NOT EXISTS bonus_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bonus_id UUID REFERENCES bonus_qr(id) ON DELETE CASCADE,
  redeemed_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella admin
CREATE TABLE IF NOT EXISTS admins (
  user_id UUID REFERENCES users(id) PRIMARY KEY,
  is_super BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_votes_recipient ON votes(recipient_id);
CREATE INDEX IF NOT EXISTS idx_votes_voted_at ON votes(voted_at);
CREATE INDEX IF NOT EXISTS idx_event_votes_user ON event_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_redemptions_user ON bonus_redemptions(user_id);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Users can read all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert votes" ON votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Users can insert event votes" ON event_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert bonus redemptions" ON bonus_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);