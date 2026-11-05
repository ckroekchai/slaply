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

- Latest local verification passed **137 application tests and all 13 converter tests**, including the two optional private PDF corpus checks. Application tests cover admission, original integrity, role isolation, idempotency, cancellation, failures, provider output validation, rendering, export metadata, and frontend upload/decode order. Converter tests execute actual WASM inside workerd; they do not mock the renderer.
- The private render matrix uses three owner-provided brands across three templates, with Thai and English text and both transparent and opaque logos. All three final live-provider outputs and their complete boards have been reviewed.
- Evaluation used **four paid generation runs**: the three original brand cases plus one EYEBSTYLE revision after customer-facing application copy was corrected in prompt version `brand-guideline-2026-11-05.2`. Their summed usage-based cost estimate is **US$0.10756449**. This is a measured evaluation estimate, not a billing reconciliation or a promise about future cost.
- `evals/verify-board-artifacts.mjs` decodes actual PNG and PDF files. It checks dimensions, all five flat swatches, logo containment and original colors, exact embedded RGB bytes, and physical PDF page size. It reports cross-renderer edge sampling separately; it does not falsely label rasterized PDF bytes identical when a viewer interpolates edges.
- Actual Chrome checks cover all three layouts and font pairs. Coverage includes manual editor choices: **TK's Display font pair and EYEBSTYLE's Minimal layout**. These verify editable layouts and export parity; they are not claims that the model independently selected those options. Browser checks retained exact original-logo references and verified the PDF's embedded RGB pixels against its corresponding PNG. Local complete-App mobile editing and recipe save/reload have also passed; production verification remains separate.
- Supported static, outlined SVG and single-page PDF inputs passed local converter and integration review, including original/derivative separation. The user deferred remote document support to retain the Free hosting plan; local acceptance is not a deployed capability.
- A private, expiring remote-dev harness uses the production Worker's encrypted API secret with preview D1/R2. It does not deploy production code or enable global Version URLs. Fixed fixture hashes and explicit per-run admission bounded the original three cases and the one copy-revision run. No API key is exported or printed.
- Source is published in [draft PR #1](https://github.com/ckroekchai/slaply/pull/1). [GitHub Actions run 42042006587](https://github.com/ckroekchai/slaply/actions/runs/42042006587) passed both `verify` and `converter` jobs for commit [`2d3b928e12e0348228181d16428fbf4f38d4cfba`](https://github.com/ckroekchai/slaply/commit/2d3b928e12e0348228181d16428fbf4f38d4cfba). Public CI runs the synthetic converter suite; the private corpus checks above were run locally and its artwork is not published.

## Release scope and deployment

The user chose to remain on **Workers Free** and release **JPG/PNG/WebP only**. SVG/PDF admission is disabled by default and in both deployment configurations (`ENABLE_DOCUMENT_UPLOADS=false`); the UI reads the server's document-upload capability. No converter Service Binding is configured and no new subscription is created. Deferred document requests fail before storage or AI quota is consumed.

The converter was tested locally but not deployed: Cloudflare rejected its configured `limits.cpu_ms: 1000` on the Free plan. This is a deferred feature, not a blocker for the agreed raster-only release.

For the current release, run `npm run setup`, `npm test` and `npm run build` from the repository root. Apply additive D1 migrations to the intended environment, deploy preview with `npm run deploy:cloudflare`, then production with `npm run deploy:cloudflare:production`. Preview migrations 0003/0004 have already been applied. Encrypted provider secrets stay in the existing Worker configuration.

For a future document-upload rollout, first obtain explicit authorization for the hosting plan change. Use `npm run setup:converter`, Rust 1.99.1 with the `wasm32-unknown-unknown` target, `npm run test:converter`, and `npm run check:converter`. Deploy the private converter separately, then add the `ASSET_CONVERTER` Service Binding targeting `slaply-asset-converter` / entrypoint `AssetConverter` and enable `ENABLE_DOCUMENT_UPLOADS=true` in the intended app environment. Verify real remote SVG/PDF uploads before enabling production. See `converter/README.md` for the accepted format profile and exact contract. A successful dry-run does not prove hosting-plan eligibility.

CI builds locked converter dependencies, tests real workerd, and verifies both WASM modules without deploying. Build outputs and private artwork are excluded from the repository. Source and render hashes remain separate throughout saving and portable JSON export.

## Release gates

- [x] Review all three final live-provider outputs and complete composed boards.
- [x] Verify actual-browser exports across all three layouts and font pairs, distinguishing manual editor overrides from model selections.
- [x] Complete local supported-input review for static raster images, outlined static SVG, and single-page PDF, including actual workerd conversion and private PDF checks.
- [x] Pass 137 application tests, all 13 local converter tests, and both public GitHub CI jobs for the published draft source.
- [x] Apply preview migrations `0003_asset_metadata.sql` and `0004_asset_derivatives.sql`.
- [x] Complete local real-browser mobile editing, saved reload, trash/restore and receipt PDF/JSON downloads.
- [x] Apply the user's raster-only scope: no Paid subscription or converter deployment. Document uploads remain disabled.
- [ ] Apply `0003_asset_metadata.sql` and `0004_asset_derivatives.sql` to production; neither production migration has been applied yet.
- [ ] Complete release review, merge/deploy the application, and run production upload/save/reload/export smoke checks. No production release or converter deployment is claimed by the checks above.

Static image validation currently checks container structure, CRC/markers and dimension limits. It is not a full server-side pixel decoder. Creative quality is reviewed against fixture briefs and cannot be guaranteed universally by a finite passing test suite.

### Local complete-App verification

The built application served from loopback used the final reviewed Cafe Claire result, with providers disabled and all external fetches forbidden. After editing the concept, selecting Minimal/Display and automatic logo backdrop, saving and reloading retained every value and the confirmed saved state. Trash and restore returned the recipe to its active list. Receipt downloads produced a one-page 576 × 432 pt PDF and a portable JSON whose original-logo bytes matched the source SHA-256. The 390 px page did not overflow; detail mode scrolled only its 1200 px board within a 358 px panel. No new job or provider call occurred. Screenshots and safe status reports are in ignored `qa/private/browser/`.
