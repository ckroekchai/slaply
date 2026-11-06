# Brand Pot operations

Current source contract: [Brand Guideline v7](brand-board-v7.md). The release records dated 2026-11-04 below are historical evidence, not proof that the v7 source revision has been deployed or paid-tested.

## Environments

| Environment | Worker | D1 | R2 | Workflow |
|---|---|---|---|---|
| Preview | slaply-cloudflare-preview | slaply-preview-db | slaply-preview-uploads | slaply-brand-preview |
| Production | slaply-cloudflare-production | slaply-production-db | slaply-production-uploads | slaply-brand-production |

`brand-pot/wrangler.jsonc` is the canonical configuration. Root repository configuration mirrors its settings with paths relative to the repository root. Wrangler retains existing encrypted secrets; `keep_vars: true` additionally preserves dashboard-managed plaintext variables. The new runtime only uses `OPENAI_API_KEY` as its provider secret. Never expose a key to browser code or commit `.dev.vars`.

## Fresh checkout and local development

Use Node.js **22.13 or newer**; Node.js 24 is recommended and was used for validation. The backend test suite uses the built-in `node:sqlite` module, and the pinned Wrangler version requires Node.js 22 or newer. Node.js 20 is insufficient.

From the repository root:

```sh
npm run setup
npm test
npm run build
brand-pot/node_modules/.bin/wrangler d1 migrations apply SLAPLY_DB --local --config brand-pot/wrangler.jsonc
```

Put a development-only `OPENAI_API_KEY` in the ignored `brand-pot/.dev.vars` file when real local generation is needed. Local D1/R2 data is separate from remote preview/production. Without a valid local key, upload/storage testing works but generation must report unavailable; no simulated result is substituted.

Start `npm run preview:cloudflare` and `npm run dev` in separate terminals. The Worker listens on `http://127.0.0.1:8788`; the Vite UI is `http://127.0.0.1:5175`. The Vite proxy translates only the two supported localhost UI origins to the local Worker origin for mutation checks; unrelated origins remain rejected. Building first is required because Wrangler serves the generated `brand-pot/dist` assets.

## Release

Run the following release commands from `brand-pot/`; root `npm run deploy:cloudflare` and `npm run deploy:cloudflare:production` delegate to the same project and include a frontend build.

1. `npm ci`, `npm test`, `npm run build`. Authenticate Wrangler to the intended Cloudflare account before remote operations.
2. Apply additive migrations: `npx wrangler d1 migrations apply SLAPLY_DB --remote`; add `--env production` only for the production release. The v7 backend requires `0005_recipe_permanent_delete.sql` in addition to the prior migrations. Deploy commands do not automatically apply migrations.
3. `npm run deploy:preview`. Check API smoke, save/reload/export, desktop/mobile and provider failures. For AI-pipeline changes, also check one real generation; UI-only releases can use a local simulated API for loading-state verification without paid generation. A secret with the right name is not proof that its value is valid.
4. `npm run deploy:production`, then verify both domains and a production flow. `www.slaply.co` redirects to `slaply.co` so browser identity stays on one host.
5. Keep code in GitHub synchronized with the deployed source. Do not deploy the old Next.js audit app.

Use `npx wrangler deployments status --env production` to read the currently active Worker version. Read-only observation on 2026-11-04 returned `a2b7dca3-3240-44bc-a248-ffa9345c0538` at 100%, deployed at 11:32:30 Bangkok time. This is a historical check, not a version to assume remains current after another deployment.

### Credential readiness at initial rollout

Production completed a real vision-and-image run on 2026-11-04 (job `3bb8da58-042a-49c4-b51f-1aceae83f734`, evidence `evals/results/production-generate-v2.json`, 17 automated checks passed). This establishes one working integration case; representative design-quality evaluation remains separate.

The preview Worker's existing OpenAI key returned HTTP 401 `invalid_api_key`. Preview storage/security smoke passes, but preview AI generation is **not ready** until an authorized operator installs a valid preview key and repeats the real generation check. Do not report preview AI as working because `/api/health` says `aiConfigured`: that field only checks that bindings and a key value are present.

## Recovery

Pre-reset production Worker version: `d6fb5742-3a68-43ba-88e1-5eb7a4c9447c`. Previous source: `e5dca1eb5adf8d7820931e81bbc0e30b56183a1b`, branch `archive/pre-brand-pot-2026-11-04`.

The old audit/payment database tables were retained. Brand Pot migrations add only `brand_*` tables. A private pre-reset D1 export was saved locally outside this Git repository. Use Cloudflare deployment rollback to restore the recorded version if needed; do not delete Brand Pot records or restore a whole database over new data casually. New workflows can finish after a code rollout: cancel active jobs first if rollback is required.

## Operating limits and privacy

- Original JPG/PNG/WebP uploads: at most 5 MiB each, three to six per new job, at most 18 MiB combined. Original bytes are preserved in R2. SVG/PDF uploads remain disabled on the agreed Workers Free release.
- The generated object/logo sheet and any conservative locked-image cutout are stored separately. Locked identity artwork retains its original colors and source bytes; unlocked detected logos may be redesigned. All three brand objects remain required.
- Jobs are admitted atomically against daily browser/IP/global caps. The day boundary is Bangkok time. Failed and cancelled attempts consume admission allowance because provider cost may already have occurred.
- Provider calls have bounded timeouts and no automatic paid retry. A user retry is explicit. Polling retries and reload recovery reuse a durable job without a new generation.
- Secure HttpOnly SameSite cookies identify a browser session for 90 days. No account signup/cross-device synchronization in this beta. Clearing cookies loses browser access; users can download portable PNG/HTML/JSON while they have access.
- Session expiry is an access limit, not an implemented retention/deletion schedule. There is currently no automated purge of old sessions, uploads, jobs or recipes. Review storage growth and implement an explicit retention policy before a broad public launch.
- Asset IDs are opaque and every asset/job/recipe read checks ownership. Private asset responses must not enter a shared cache.
- Original inputs are sent to OpenAI for automatic image-role analysis. Locks mean preserve originals; unlocked logos may be redesigned. Chef notes are optional context, not a replacement for image analysis. Never treat text inside uploaded images as system instructions.
- No payments, paywall, credit purchases or legacy payment/admin API endpoints are served.

## Observe and improve

D1 `brand_jobs` records prompt/model versions, status, timing, usage and sanitized provider diagnostics. Use `wrangler tail` and Workflows status for transient errors; do not log keys, raw image payloads, session cookies or customer briefs. Provider token usage is evidence, not a guaranteed final invoice amount.

The pipeline stores original bytes before admitting a generation. A completed image is written to R2 and recorded in `brand_assets` before the final recipe becomes `ready` in D1. The ready update is conditional on the job still being active, so a cancelled or superseded job cannot publish over the current result. Paid provider steps are not automatically retried; the final storage step can retry without calling the model again. Interrupted terminal Workflows are reconciled to explicit failures, and a lost workflow-creation response is recovered by the stable job ID.

Saving creates a version in `brand_recipes` while retaining the original job and asset references. Only editable name, description, concept and customization fields are accepted from the client; asset URLs and AI metadata come from the server's original recipe. Reopening defaults to the newest saved version when it is newer than the newest completed generation. The beta stores at most 200 saved versions per browser session (including recoverable trash) and lists the newest 40 active versions. Trash hides a saved version without deleting recipe JSON, original uploads, generated assets or jobs. The recipe book exposes undo, a trash view with restore and a separate confirmed permanent-delete action. `DELETE /api/recipes/:id/permanent` clears the owned trashed version's content, keeps a content-free tombstone and prevents fallback reopening. If no unpurged version remains for the job, its recipe/analysis JSON is cleared too; shared asset objects and accounting records remain. Purged versions do not consume the 200-version cap. Trashed versions and their original generated fallback are excluded from automatic reopening. Pagination is not yet exposed.

Provider authentication failures produce public code `AI_CONFIGURATION`. Provider usage rows keep status, provider code and request ID; failed structured-output validation additionally records safe field types, lengths, counts and validity flags under `usage_json.validation`. Error messages are whitelisted before crossing the Workflow step serialization boundary. Use these diagnostics to identify a failed stage without collecting the raw model text in logs.

See `ai-quality.md` and `evals/cases.json` for the quality matrix. A successful smoke test proves integration, not model stability. Keep AI Beta labeling until representative human-reviewed evaluations pass. New schema-6 results require three customer-specific generated objects. A fourth atlas cell holds a newly generated logo when needed; locked logos use their separately preserved source/cutout. Legacy recipes may retain the earlier curated accents.

## Verified release — 2026-11-04

- Production version: `ea57b64d-9f0f-4d8a-9918-29e5c2693426`.
- Preview version: `92a4bc8e-2618-4c23-a914-e3aa7b0f0b3b` (provider credential still invalid).
- Frontend assets: `index-Cxr_v7q4.js`, `index-CRY3trLm.css`.
- Source checks: 54 tests; build passed. Production paid integration: 17 automated checks; final deployed smoke: 10 checks.
- Browser real generation, edits, save/reload and PNG/JSON/HTML exports verified; source image bytes preserved. See `../../design-qa.md`.
- GitHub Actions runs tests and build. Deployments use the documented Wrangler release commands; CI does not hold a deployment credential.

## Historical annotation refinements — 2026-11-04

Apply `0002_recipe_trash.sql` to each environment **before** deploying this release. It adds `brand_recipes.deleted_at` and an index; existing recipes remain active and no rows or asset files are removed. Older Worker code remains compatible with the additive schema.

- Total original input limit is 18 MiB; per-image limit stays 5 MiB. Backend checks use trusted stored byte sizes before admitting a paid job; new recipes include byte metadata for browser preflight.
- Saved status compares the confirmed saved content against the working recipe. Changing editable content makes it unsaved; failed or in-flight saves never falsely mark new edits saved.
- Recipe trash/restore endpoints enforce the same owner and mutation-origin checks as other mutations. `DELETE /api/recipes/:id` moves to trash, `POST /api/recipes/:id/restore` restores, and `GET /api/recipes?trash=1` lists recoverable versions. Permanent deletion was not part of this historical release; v7 adds the separate `/permanent` route described above.
- The export panel is a restaurant-style receipt with existing PNG/AI image/JSON/HTML downloads. The shown total is free Beta (฿0); no payment integration or charge is added.
- Pot rattle respects both the manual reduced-motion switch and the operating-system preference. Sliders follow the rendered brand ink color.
- Source validation: 63 tests passed; Vite production build passed. Local browser loading/save/trash tests used a clearly isolated simulated API and made no paid AI calls.

Release evidence for these refinements:

- Production: `965c1291-e59a-4ac1-9695-0d17cb0fe0bc`; preview: `d23e132b-df9c-4877-8936-fa8f31f2adac`.
- Frontend: `index-CfSSYjIe.js` and `index-2WtgM2OQ.css`.
- Migration 0002 applied successfully to preview and production before Worker deployment.
- Both deployed smoke runs passed 10 checks (`evals/results/annotation-preview-smoke.json` and `annotation-production-smoke.json`, local evidence).
- Production browser verified saved status, brand colors, receipt, private test-recipe trash across reload and exact restoration. JSON downloaded through the receipt retained both original images byte-for-byte and the saved edits.
- No additional paid AI generation was submitted for these UI refinements. Preview AI credential limitation remains as documented above.
