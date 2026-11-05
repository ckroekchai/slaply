# Slaply — The Brand Pot

Slaply turns one logo plus a brief, or two to six image ingredients, into an editable Brand Guideline Board. The current application is **`brand-pot/`**, using the approved Brand Pot design. Payment is deliberately excluded while AI quality is being developed.

## Run and verify

```sh
npm run setup
npm run build
npm test
# In separate terminals, for local development:
npm run preview:cloudflare
npm run dev
```

Use `brand-pot/node_modules/.bin/wrangler d1 migrations apply SLAPLY_DB --local --config brand-pot/wrangler.jsonc` before local API testing. Real model calls require `OPENAI_API_KEY` in `brand-pot/.dev.vars` (never commit it). Frontend localhost:5175 proxies API requests to the Worker at localhost:8788. An absent API key produces an explicit unavailable state; there is no simulated AI fallback.

## Runtime

- Vite + React frontend, original Slaply assets and local Thai fonts.
- Cloudflare Worker serves APIs and static assets on `slaply.co` and `www.slaply.co`.
- Cloudflare Workflows performs durable vision analysis, illustration generation and publication.
- D1 stores sessions, jobs, recipes, provider usage and errors. R2 preserves original uploads and generated assets separately.
- GPT-6 Luna returns a validated brand system; GPT Image 2.6 Flare creates one separate decorative image at low quality/complexity. A controlled renderer composes original logos, typography, colors and applications across three layouts and three Thai/English font pairs.
- Export a 2400 × 1800 sRGB PNG/PDF, offline HTML, or portable recipe JSON. Original image bytes remain unchanged.
- This release stays on Workers Free and accepts JPG, PNG and WebP (5 MiB per file, 18 MiB total). SVG/PDF upload is disabled; its tested converter remains available for a later Paid-plan rollout.
- Opaque HttpOnly session cookies scope private uploads and recipes to one browser. Download portable files for a personal backup; accounts and cross-device sync are not included in this beta.
- Server admission limits default to 5 jobs per browser, 10 per IP and 40 total per Bangkok calendar day. Accepted attempts, including cancelled/failed requests, consume admission budget because upstream work can already have started. These are operating caps, not billing credits.

## Deployment

```sh
npm run deploy:cloudflare             # isolated existing preview Worker
npm run deploy:cloudflare:production  # existing production Worker and domains
```

Apply additive D1 migrations to the intended environment before deploying. Existing encrypted Worker secrets are retained. `OPENAI_API_KEY` stays server-side. The `brand-pot/wrangler.jsonc` file is the canonical deployment configuration; root config mirrors it for direct Wrangler use.

See [Brand Guideline v6](brand-pot/docs/brand-board-v6.md) for the current architecture, provider cost evidence, export validation and deferred SVG/PDF support. Model names, quotas and prompt version are explicit. See [AI quality and evaluation](brand-pot/docs/ai-quality.md) for the acceptance matrix and opt-in real API test runner, and [operations](brand-pot/docs/operations.md) for rollout/rollback and limits.

## Prior audit product

The original Next.js packaging-audit source remains in `app/`, `components/`, `lib/`, `slaply-ai/` and related folders for reference. It is not built or served by Brand Pot, and its payment/admin endpoints are not part of the new Worker. The exact previous product is preserved in branch `archive/pre-brand-pot-2026-11-04` at commit `e5dca1eb5adf8d7820931e81bbc0e30b56183a1b`. Do not use the old audit configuration to deploy the new application.
