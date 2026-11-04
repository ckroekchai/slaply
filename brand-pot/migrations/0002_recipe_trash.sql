-- Reversible recipe trash. Originals, generated assets, jobs and recipe JSON stay intact.
ALTER TABLE brand_recipes ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS brand_recipes_session_trash_created
  ON brand_recipes(session_id, deleted_at, created_at);
