# Slaply Cloudflare Migration

This document tracks the staged migration from Vercel + Supabase to Cloudflare.
It is intentionally preview-first. Do not switch production DNS or disable Vercel/Supabase from this file alone.

## Current rollback anchor

- Production source branch: `main`
- Safe rollback branch already present locally: `backup/pre-cloudflare-2026-05-10`
- Current production commit at audit time: `a16bec9 Adjust upload dropzone vertical alignment`
- Current production hosting: Vercel
- Current database/storage: Supabase

Rollback command if Cloudflare cutover ever fails after an approved DNS switch:

```sh
cd "/Users/folk/Documents/New project 2/slaply"
git switch main
git pull --ff-only origin main
git revert --no-commit a16bec9..HEAD
git commit -m "Rollback to pre-cloudflare production"
git push origin main
```

Only run the rollback command after confirming no newer approved production changes should be preserved.
If the working tree is not clean, stop and inspect before continuing.

## Phase 3 preview scope

The first Cloudflare preview keeps the application behavior the same:

- Next.js app runs through OpenNext on Cloudflare Workers.
- Static assets are served from the OpenNext asset output.
- Supabase database and storage stay unchanged.
- OpenAI calls stay unchanged.
- PromptPay/manual unlock flow stays unchanged.
- Vercel production remains the public rollback path.
- Production DNS remains unchanged until a separate approval.

## Production cutover status

As of 2026-05-11, the public domain is served by Cloudflare Workers:

- Worker: `slaply-cloudflare-production`
- Domain routes: `www.slaply.co/*`, `slaply.co/*`
- D1 database: `slaply-production-db`
- R2 bucket: `slaply-production-uploads`
- Data backend flag: `DATA_BACKEND=cloudflare`
- Current AI mode: `MOCK_AI_SCAN=true` until a valid production `OPENAI_API_KEY` is provided.

Vercel and Supabase are not deleted or disabled. They remain the rollback/fallback sources.

## Production D1/R2 migration

Production data was exported from Supabase and imported into Cloudflare:

- `customers`: 50 rows
- `scans`: 50 rows
- `payments`: 25 rows
- `events`: 203 rows
- Storage copied from Supabase bucket `packaging-uploads`: 10 objects, about 24.9 MB

Two Cloudflare test scans were then created after migration to verify new writes, so production D1 counts can be higher than the original Supabase counts.

Run a dry-run export without writing to Cloudflare:

```sh
npm run migrate:cloudflare:dry-run
```

Apply a full Supabase-to-Cloudflare migration:

```sh
node scripts/migrate-supabase-to-cloudflare.mjs \
  --apply-db \
  --database=slaply-production-db \
  --copy-storage \
  --r2-bucket=slaply-production-uploads
```

Apply only a small sample:

```sh
node scripts/migrate-supabase-to-cloudflare.mjs \
  --limit=3 \
  --apply-db \
  --database=slaply-preview-db \
  --copy-storage \
  --r2-bucket=slaply-preview-uploads
```

The script writes generated SQL and manifests under `.migration/`, which is intentionally ignored by git.

## Cloudflare build commands

Local preview build:

```sh
npm run build:cloudflare
```

This build runs from a temporary copy that excludes `.env*` files and strips known sensitive env names from the build process.
Do not run `opennextjs-cloudflare build` directly from the project root while `.env.local` contains real secrets.

Local Cloudflare preview:

```sh
npm run preview:cloudflare
```

Cloudflare preview deployment:

```sh
npm run deploy:cloudflare
```

Cloudflare production deployment:

```sh
npm run deploy:cloudflare:production
```

`@opennextjs/cloudflare` and `wrangler` are pinned as dev dependencies so Cloudflare builds use the lockfile version.
`preview_urls` is disabled in `wrangler.jsonc`; keep `workers_dev` enabled for the single preview URL.

## Required Cloudflare environment names

Set values in Cloudflare without exposing them in reports:

- `NEXT_PUBLIC_SITE_URL`
- `SCAN_PRICE_THB`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `MOCK_AI_SCAN`
- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL`
- `OPENAI_IMAGE_DETAIL` (optional, defaults to `auto`)
- `OPENAI_MAX_COMPLETION_TOKENS` (optional latency/cost guard)
- `OPENAI_REASONING_EFFORT` (optional GPT-5 latency guard)
- `OPENAI_SERVICE_TIER` (optional OpenAI processing tier)
- `OPENAI_VERBOSITY` (optional GPT-5 output length guard)
- `OPENAI_BASE_URL` (optional, for Cloudflare AI Gateway)
- `OPENAI_INPUT_COST_PER_MILLION_TOKENS` (optional cost estimate)
- `OPENAI_OUTPUT_COST_PER_MILLION_TOKENS` (optional cost estimate)
- `PAYMENT_GATEWAY`
- `PROMPTPAY_ACCOUNT_NAME`
- `REPORT_FROM_EMAIL`
- `ADMIN_UNLOCK_TOKEN`

Note: Vercel currently has `SCAN_PRICE`, while the app reads `SCAN_PRICE_THB`.
Keep `SCAN_PRICE_THB` in Cloudflare unless the app is explicitly changed to support both names.

For production, keep `MOCK_AI_SCAN=true` if `OPENAI_API_KEY` is missing or invalid. Switch it to `false` only after the real OpenAI key has been verified on the Worker.

## Preview smoke test checklist

- Homepage loads.
- `/scan` redirects to `/#scan`.
- `/success` loads.
- `/admin/unlock` loads but no production unlock is submitted without approval.
- `/api/get-scan` returns a safe response for an approved test scan.
- `/api/create-scan` validates JPG/PNG and file size.
- `/api/run-ai-scan` works with `MOCK_AI_SCAN=true` before live OpenAI testing.
- `/scan/[id]` renders report data and signed image URL.
- `/api/create-payment` does not alter real production payment data except for an approved test scan.
- Browser console has no major runtime or CORS errors.

## Post-cutover smoke test checklist

- `https://www.slaply.co/` returns `server: cloudflare` and no `x-vercel-id`.
- `https://slaply.co/` returns `server: cloudflare` and no `x-vercel-id`.
- Existing migrated report pages render from D1/R2.
- New upload creates a D1 scan and R2 object.
- Run AI scan completes with mock output while `MOCK_AI_SCAN=true`.
- Payment creation inserts a Cloudflare D1 payment row.
- `/robots.txt` and `/sitemap.xml` return 200 from Cloudflare.
- Vercel production is still available as rollback by changing DNS/proxy/routes back.

## Cutover guardrails

Do not perform these actions without separate explicit approval:

- Change Cloudflare DNS records for `slaply.co` or `www.slaply.co`.
- Attach production custom domain to a Worker/Pages project.
- Deploy over an existing production Worker.
- Rotate or reveal secrets.
- Migrate or delete Supabase data/storage.
- Disable Vercel or Supabase.
