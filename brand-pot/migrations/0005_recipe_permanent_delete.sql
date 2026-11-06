-- Content-free tombstones keep permanently deleted recipes out of fallback restores.
ALTER TABLE brand_recipes ADD COLUMN purged_at TEXT;
