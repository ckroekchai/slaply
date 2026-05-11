# Slaply Production Deployment

Use this checklist when promoting the current MVP to `slaply.co`.

## 1. Vercel

- Import `https://github.com/ckroekchai/slaply.git`
- Framework preset: Next.js
- Build command: `npm run build`
- Output settings: default Next.js settings

## 2. Environment Variables

Set these in Vercel Project Settings:

```env
NEXT_PUBLIC_SITE_URL=https://slaply.co
SCAN_PRICE_THB=399
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=packaging-uploads
MOCK_AI_SCAN=true
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.4-mini
PAYMENT_GATEWAY=promptpay_qr
PROMPTPAY_ACCOUNT_NAME=
REPORT_FROM_EMAIL=reports@slaply.co
ADMIN_UNLOCK_TOKEN=
```

Keep `MOCK_AI_SCAN=true` until OpenAI billing is enabled. With mock mode enabled, the app must not call OpenAI.

## 3. Supabase

- Run `supabase/schema.sql` in the Supabase SQL editor
- Create the `packaging-uploads` storage bucket
- Keep uploaded artwork private
- Use the service role key only on the server and only through Vercel env vars

## 4. Domain

- Add `slaply.co` in Vercel Domains
- Point DNS from Cloudflare or the registrar to Vercel
- Confirm `NEXT_PUBLIC_SITE_URL=https://slaply.co`

## 5. PromptPay MVP

- The customer QR image is `public/slaply-promptpay-qr.jpg`
- Current behavior: QR request creates a pending payment and shows the fixed QR
- Current temporary behavior: hidden report guidance is revealed after a 10-second confirmation countdown
- Later behavior: replace the countdown with a real payment callback/webhook before public paid launch

## 6. Pre-Launch Smoke Test

Run this on the deployed domain:

- Open `/`
- Click Start scan and confirm it scrolls to the upload section
- Upload a JPG/PNG
- Confirm missing fields highlight in red
- Submit scan
- Open queued page
- Run AI scan
- Confirm report preview renders
- Generate PromptPay QR
- Confirm hidden guidance stays blurred first, then opens after countdown
- Test `/admin/unlock` with `ADMIN_UNLOCK_TOKEN`

## 7. Go-Live Blockers

Do not run broad paid traffic until these are done:

- Real payment confirmation is connected or manual verification process is staffed
- `hello@`, `support@`, `billing@`, and `reports@` email aliases exist
- OpenAI billing is enabled and `MOCK_AI_SCAN=false` is tested with real images
- First 10-20 paid beta reports are manually reviewed before delivery
