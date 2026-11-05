# Brand Guideline Board v6

Implementation and evaluation record, 2026-11-05. This work extends Brand Pot while keeping existing recipes and uploaded originals. Payments remain disabled.

## Contract and rendering

- Ingredient roles are `logo`, `product`, and `reference`. One logo plus a nonempty brief is sufficient; legacy multi-image requests still work. There is at most one logo.
- Original objects retain their exact bytes, SHA-256, MIME type and dimensions. Priority locks do not select the logo.
- AI produces bounded art direction: template, font pair, image style, density, five palette roles, type samples, pattern choice and two application examples. It cannot supply asset URLs, CSS or coordinates.
- The shared 2400 × 1800 scene includes original logo, concept, visual direction, palette values, typography, pattern and two applications. Editorial, Expressive and Minimal use distinct geometry and actual local font pairs.
- The browser and exports use the same scene and measured text. PNG, PDF and offline HTML include the full board. Original logo nodes always use contain, without cropping, recoloring, filters or generated replacements.
- PNG is explicitly sRGB with 300 dpi physical metadata. PDF embeds the same RGB pixels losslessly and assigns an sRGB ICC profile, on one 576 × 432 point page. PDF is a raster board, not editable vector artwork or a CMYK production file.

## Economical provider policy

The selected current models are `gpt-6-luna` and `gpt-image-2.6-flare`. Direct image generation uses one 1024 × 1024 PNG, `quality: low`, `complexity: low`. Model/settings are server-owned and recorded with each admitted job; there is no silent model fallback or retry of a potentially charged provider stage.

Pricing references: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Flare](https://developers.openai.com/api/docs/models/gpt-image-2.6-flare), [pricing](https://developers.openai.com/api/docs/pricing), [image generation](https://developers.openai.com/api/docs/guides/image-generation). Token-rate parity does not establish identical per-image cost across models. Costs are estimates from actual returned usage, including cache writes/hits, not a billing reconciliation. Missing usage remains unknown.

## Evaluation evidence and boundaries

Private fixture manifests and client artwork live under ignored `qa/private/`. The public repository contains only generic verification scripts and synthetic test images. Source files are never modified.

- Unit/API/workflow tests cover admission, original integrity, role isolation, idempotency, cancellation, failure propagation, malformed provider output, image structure, schema, usage accounting, rendering geometry and export metadata.
- The private render matrix uses three owner-provided brands across three templates, with Thai and English text and both transparent and opaque logos.
- `evals/verify-board-artifacts.mjs` decodes actual PNG and PDF files. It checks dimensions, all five flat swatches, logo containment and original colors, exact embedded RGB bytes, and physical PDF page size. It reports cross-renderer edge sampling separately; it does not falsely label rasterized PDF bytes identical when a viewer interpolates edges.
- Actual Chrome exports are checked separately from Node rendering. Passing mock-provider integration or Node font tests does not prove browser font loading or live API quality.
- A private, expiring remote-dev harness uses the production Worker's encrypted API secret with preview D1/R2. It does not deploy production code or enable global Version URLs. Fixed fixture hashes and one-time admission bound the evaluation to three jobs. No API key is exported or printed.

## Converter build and deployment order

The current converter configuration requires **Cloudflare Workers Paid** because it sets `limits.cpu_ms: 1000`. Cloudflare rejected the deployment on Workers Free; the converter has not been deployed. Confirm the account plan before attempting the converter deployment. A successful local dry-run does not validate account plan eligibility.

Run the following from the repository root. The converter has a separate dependency lockfile and private Worker deployment; application deployment scripts deliberately do not publish it implicitly. Both application Wrangler configurations bind its named `AssetConverter` entrypoint as `ASSET_CONVERTER` in preview and production.

1. Install the application and converter dependencies with `npm run setup` and `npm run setup:converter`. The latter uses `npm ci --ignore-scripts`.
2. Install the tested compiler with `rustup toolchain install 1.99.1 --profile minimal --target wasm32-unknown-unknown`. Set `RUSTUP_TOOLCHAIN=1.99.1` for converter builds/tests. Version 1.99.1 matches the locally validated compiler; do not rely on a moving `stable` alias for release artifacts.
3. Run `npm test`, `npm run build`, `npm run test:converter`, and `npm run check:converter`. The converter test compiles locked Rust dependencies and executes real WASM inside workerd. The check builds again and performs a Wrangler dry-run, including both WASM modules. `converter/dist/manifest.json` records source and packaged SHA-256 values and memory limits; CI retains it as an artifact.
4. Deploy the private converter with `npm run deploy:converter` before either application Worker. It has no public route. This command builds and deploys only the converter; it does not deploy the application or apply database migrations.
5. In `brand-pot/`, apply pending preview migrations with `npx wrangler d1 migrations apply SLAPLY_DB --config wrangler.jsonc --remote`. This includes `0003_asset_metadata.sql` and `0004_asset_derivatives.sql`. Then return to the root and run `npm run deploy:cloudflare`; verify raster, supported SVG, and supported single-page PDF uploads, derivative access, and saved recipe reload against preview.
6. After the release checks pass, in `brand-pot/` apply production migrations with `npx wrangler d1 migrations apply SLAPLY_DB --config wrangler.jsonc --env production --remote`. Return to the root and run `npm run deploy:cloudflare:production`, then verify production upload/save/reload/export behavior.

The converter CI job installs Rust 1.99.1 with the WASM target, uses both npm lockfiles plus `Cargo.lock`, runs its real workerd test suite, and checks packaging without credentials or publication. A clean checkout must build the converter: `dist/` and `rust/target/` are intentionally ignored. Existing raster recipes do not require conversion; SVG/PDF originals remain separate from PNG derivatives throughout saving and export.

## Release gates still requiring completion

- [ ] Review all three live-provider outputs and their complete composed boards.
- [ ] Verify real-browser exports for each font pair and layout, plus mobile editing and recipe save/reload.
- [ ] Complete supported-input review, including common SVG/PDF logo sources; currently only static PNG/JPEG/WebP are admitted.
- [ ] Resolve remaining findings and rerun affected tests.
- [ ] Apply additive migrations `0003_asset_metadata.sql` and `0004_asset_derivatives.sql` to production before release; verify the preview migration state first.
- [ ] Publish reviewed source, verify CI, deploy, and run production smoke checks.

Static image validation currently checks container structure, CRC/markers and dimension limits. It is not a full server-side pixel decoder. Creative quality is reviewed against fixture briefs and cannot be guaranteed universally by a finite passing test suite.
