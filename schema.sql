-- Conduit Launch Jam — submissions.
-- email is the primary key so a resubmission UPSERTs (latest entry per person wins).
CREATE TABLE IF NOT EXISTS entries (
  email        TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  handle       TEXT,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  video_url    TEXT NOT NULL,
  build_url    TEXT,
  prompts      TEXT NOT NULL,
  tier         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_created ON entries (created_at);
