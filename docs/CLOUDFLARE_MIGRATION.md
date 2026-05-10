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

## Cloudflare build commands

Local preview build:

```sh
npm run build:cloudflare
```

Local Cloudflare preview:

```sh
npm run preview:cloudflare
```

Cloudflare preview deployment:

```sh
npm run deploy:cloudflare
```

`@opennextjs/cloudflare` and `wrangler` are pinned as dev dependencies so Cloudflare builds use the lockfile version.

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
- `PAYMENT_GATEWAY`
- `PROMPTPAY_ACCOUNT_NAME`
- `REPORT_FROM_EMAIL`
- `ADMIN_UNLOCK_TOKEN`

Note: Vercel currently has `SCAN_PRICE`, while the app reads `SCAN_PRICE_THB`.
Keep `SCAN_PRICE_THB` in Cloudflare unless the app is explicitly changed to support both names.

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

## Cutover guardrails

Do not perform these actions without separate explicit approval:

- Change Cloudflare DNS records for `slaply.co` or `www.slaply.co`.
- Attach production custom domain to a Worker/Pages project.
- Deploy over an existing production Worker.
- Rotate or reveal secrets.
- Migrate or delete Supabase data/storage.
- Disable Vercel or Supabase.
