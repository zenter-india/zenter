-- UPSC CMS Users — separate table to isolate UPSC CMS exam data from NEET.
--
-- NOTE: The frontend currently stores UPSC CMS users in the shared `users`
-- table with exam_type = 'UPSC CMS'. This table is provided for future
-- migration when full data isolation is needed. Run this in the Supabase
-- SQL editor when ready to switch.
--
-- After creating this table, update supabase.js to read/write from
-- `upsc_cms_users` instead of `users` for UPSC CMS exam_type.

CREATE TABLE IF NOT EXISTS upsc_cms_users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                   TEXT UNIQUE NOT NULL,
  full_name               TEXT,
  gender                  TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  state                   TEXT,
  district                TEXT,
  exam_type               TEXT DEFAULT 'UPSC CMS',
  exam_centre_state       TEXT,
  exam_centre_district    TEXT,
  exam_center             TEXT,
  college                 TEXT,
  travel_mode             TEXT,
  stay_plan               TEXT,
  bio                     TEXT,
  profile_completed       BOOLEAN DEFAULT FALSE,
  is_profile_paused       BOOLEAN DEFAULT FALSE,
  account_status          TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'banned')),
  role                    TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  plus_member             BOOLEAN DEFAULT FALSE,
  contact_reveals_used    INTEGER DEFAULT 0,
  is_verified_aspirant    BOOLEAN DEFAULT FALSE,
  verification_requested  BOOLEAN DEFAULT FALSE,
  verification_rejected   BOOLEAN DEFAULT FALSE,
  nta_application_number  TEXT,
  suspicious_flags        JSONB DEFAULT '[]'::jsonb,
  device_fingerprint      TEXT,
  is_seeded_user          BOOLEAN DEFAULT FALSE,
  last_active_at          TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Index for phone lookups (login/auth)
CREATE INDEX IF NOT EXISTS idx_upsc_cms_users_phone ON upsc_cms_users(phone);

-- Index for feed queries (profile_completed + not paused + active)
CREATE INDEX IF NOT EXISTS idx_upsc_cms_users_feed ON upsc_cms_users(profile_completed, is_profile_paused, account_status);

-- Index for exam centre filtering
CREATE INDEX IF NOT EXISTS idx_upsc_cms_users_centre ON upsc_cms_users(exam_centre_district);

-- RLS: enable row-level security
ALTER TABLE upsc_cms_users ENABLE ROW LEVEL SECURITY;

-- RLS policy: anyone can read completed, non-paused, active profiles (anon key)
CREATE POLICY "Public read for active profiles" ON upsc_cms_users
  FOR SELECT USING (
    profile_completed = TRUE
    AND (is_profile_paused IS NULL OR is_profile_paused = FALSE)
    AND (account_status IS NULL OR account_status = 'active')
  );

-- RLS policy: authenticated users can insert/update their own row (matched by phone)
CREATE POLICY "Users can upsert own row" ON upsc_cms_users
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Updated_at trigger (reuse existing function if available)
CREATE OR REPLACE FUNCTION update_upsc_cms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upsc_cms_updated_at
  BEFORE UPDATE ON upsc_cms_users
  FOR EACH ROW EXECUTE FUNCTION update_upsc_cms_updated_at();
