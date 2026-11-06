-- Private owner testing entitlement. Enable only through authenticated administration.
-- New browser sessions remain limited; the public API never mutates this flag.
ALTER TABLE brand_sessions ADD COLUMN unlimited_trial INTEGER NOT NULL DEFAULT 0 CHECK(unlimited_trial IN (0, 1));
CREATE INDEX brand_sessions_unlimited_trial ON brand_sessions(id) WHERE unlimited_trial = 1;
