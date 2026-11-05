-- Metadata describes the exact immutable original; no existing object is rewritten.
ALTER TABLE brand_assets ADD COLUMN width INTEGER;
ALTER TABLE brand_assets ADD COLUMN height INTEGER;
ALTER TABLE brand_assets ADD COLUMN sha256 TEXT;
