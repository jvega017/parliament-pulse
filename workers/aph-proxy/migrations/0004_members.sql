-- Wave 24: members table + description column on signals.
-- description stores the RSS <description> text so member party/state
-- can be parsed from senators_details items in subsequent runs.

ALTER TABLE signals ADD COLUMN description TEXT;

CREATE TABLE IF NOT EXISTS members (
  mpid         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  chamber      TEXT NOT NULL DEFAULT 'Senate',
  party        TEXT,
  state        TEXT,
  role         TEXT,
  profile_url  TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_members_name  ON members(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_members_party ON members(party);
