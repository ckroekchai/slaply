# Slaply Cloudflare Operations

Slaply production now runs on Cloudflare as the core platform.

## Production Runtime

- Worker: `slaply-cloudflare-production`
- Domain routes: `www.slaply.co/*`, `slaply.co/*`
- D1 database binding: `SLAPLY_DB`
- D1 database name: `slaply-production-db`
- R2 bucket binding: `SLAPLY_UPLOADS`
- R2 bucket name: `slaply-production-uploads`
- Data backend flag: `DATA_BACKEND=cloudflare`
- OpenAI model: `gpt-5.4-mini`

## Cloudflare Build Commands

Local Cloudflare build:

```sh
npm run build:cloudflare
```

Local Cloudflare preview:

```sh
npm run preview:cloudflare
```

Preview deployment:

```sh
npm run deploy:cloudflare
```

Production deployment:

```sh
npm run deploy:cloudflare:production
```

The Cloudflare build runs from a temporary copy that excludes `.env*` files and strips known sensitive env names from the build process.

## Required Cloudflare Configuration

Set values in Cloudflare without exposing secret values in reports:

- `NEXT_PUBLIC_SITE_URL`
- `SCAN_PRICE_THB`
- `DATA_BACKEND`
- `MOCK_AI_SCAN`
- `OPENAI_API_KEY`
- `OPENAI_VISION_MODEL` (must be `gpt-5.4-mini`; app runtime is locked to this model)
- `OPENAI_IMAGE_DETAIL` (optional, defaults to `auto`)
- `OPENAI_MAX_COMPLETION_TOKENS` (optional latency/cost guard)
- `OPENAI_REASONING_EFFORT` (optional GPT-5 latency guard; defaults to `low`)
- `OPENAI_SERVICE_TIER` (optional OpenAI processing tier)
- `OPENAI_VERBOSITY` (optional GPT-5 output length guard)
- `OPENAI_BASE_URL` (optional, for Cloudflare AI Gateway)
- `OPENAI_INPUT_COST_PER_MILLION_TOKENS` (optional cost estimate)
- `OPENAI_OUTPUT_COST_PER_MILLION_TOKENS` (optional cost estimate)
- `PAYMENT_GATEWAY`
- `PROMPTPAY_ACCOUNT_NAME`
- `REPORT_FROM_EMAIL`
- `ADMIN_UNLOCK_TOKEN`

## Smoke Test Checklist

- Homepage loads from Cloudflare.
- `/scan` redirects to `/#scan`.
- `/success` loads.
- `/admin/unlock` loads.
- `/api/create-scan` creates a D1 scan and R2 object for an approved test image.
- `/api/run-ai-scan` completes with either mock output or live OpenAI output, depending on `MOCK_AI_SCAN`.
- `/scan/[id]` renders report data and the uploaded artwork from R2.
- `/api/create-payment` inserts a D1 payment row for an approved test scan.
- `/robots.txt` and `/sitemap.xml` return 200.
- Browser console has no major runtime or CORS errors.

## Guardrails

- Do not rotate or reveal secrets.
- Do not delete D1 data or R2 objects without an approved data-retention plan.
- Do not change production routes or bindings without a rollback plan.
- Keep `wrangler.jsonc` as the source of Cloudflare bindings.
