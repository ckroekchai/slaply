-- Additive Brand Pot beta schema. Existing audit/payment tables are untouched.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS brand_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brand_sessions_ip_created ON brand_sessions(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS brand_assets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES brand_sessions(id),
  kind TEXT NOT NULL CHECK(kind IN ('original', 'generated')),
  r2_key TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','ready','failed')),
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brand_assets_session_day ON brand_assets(session_id, day);
CREATE INDEX IF NOT EXISTS brand_assets_ip_day ON brand_assets(ip_hash, day);
CREATE INDEX IF NOT EXISTS brand_assets_day ON brand_assets(day);

CREATE TABLE IF NOT EXISTS brand_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES brand_sessions(id),
  ip_hash TEXT NOT NULL,
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','analyzing','generating','ready','cancelled','failed')),
  phase TEXT NOT NULL,
  input_json TEXT NOT NULL,
  analysis_json TEXT,
  recipe_json TEXT,
  error_code TEXT,
  error_message TEXT,
  usage_json TEXT,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, request_key)
);
CREATE INDEX IF NOT EXISTS brand_jobs_session_day ON brand_jobs(session_id, day);
CREATE INDEX IF NOT EXISTS brand_jobs_ip_day ON brand_jobs(ip_hash, day);
CREATE INDEX IF NOT EXISTS brand_jobs_day ON brand_jobs(day);

CREATE TABLE IF NOT EXISTS brand_recipes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES brand_sessions(id),
  job_id TEXT NOT NULL REFERENCES brand_jobs(id),
  version_number INTEGER NOT NULL,
  recipe_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, job_id, version_number)
);
CREATE INDEX IF NOT EXISTS brand_recipes_session_created ON brand_recipes(session_id, created_at);
