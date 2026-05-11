# Slaply

Instant AI packaging audit for `slaply.co`.

## Current Production Stack

- Next.js App Router
- Cloudflare Workers via OpenNext
- Cloudflare D1 for scan, payment, event, and cost records
- Cloudflare R2 for uploaded artwork
- OpenAI vision scan locked to `gpt-5.4-mini`
- PromptPay QR payment flow with manual admin unlock

## Core Flow

Landing -> Upload artwork -> AI scan -> Free preview -> PromptPay QR -> full report unlock

## Local Commands

```sh
npm run dev
npm run build
npm run build:cloudflare
npm run preview:cloudflare
```

Production deploy:

```sh
npm run deploy:cloudflare:production
```

Required private values should live in local env files or Cloudflare secrets only. Do not commit secret values.

## Required Runtime Configuration

```env
NEXT_PUBLIC_SITE_URL=https://slaply.co
SCAN_PRICE_THB=399
MOCK_AI_SCAN=false
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.4-mini
PAYMENT_GATEWAY=promptpay_qr
PROMPTPAY_ACCOUNT_NAME=
REPORT_FROM_EMAIL=reports@slaply.co
ADMIN_UNLOCK_TOKEN=
```

Cloudflare bindings are defined in `wrangler.jsonc`:

- `SLAPLY_DB`
- `SLAPLY_UPLOADS`
- `WORKER_SELF_REFERENCE`
- `ASSETS`

See `docs/CLOUDFLARE_MIGRATION.md` for current Cloudflare operation notes.
