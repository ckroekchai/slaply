-- Original objects remain immutable. Only the trusted converter creates previews.
ALTER TABLE brand_assets ADD COLUMN render_r2_key TEXT;
ALTER TABLE brand_assets ADD COLUMN render_mime TEXT;
ALTER TABLE brand_assets ADD COLUMN render_bytes INTEGER;
ALTER TABLE brand_assets ADD COLUMN render_width INTEGER;
ALTER TABLE brand_assets ADD COLUMN render_height INTEGER;
ALTER TABLE brand_assets ADD COLUMN render_sha256 TEXT;
ALTER TABLE brand_assets ADD COLUMN renderer_version TEXT;
ALTER TABLE brand_assets ADD COLUMN converter_version TEXT;
