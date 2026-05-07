# Slaply Phase 1 Next Steps

Current status: static liquid-glass landing page approved in `slaply-design-liquidglass.html`.

## Product Goal

Build Phase 1 as a paid transactional flow:

Landing -> Upload artwork -> Context form -> AI scan -> Free preview -> Payment -> Full report

This is not a SaaS dashboard. Phase 1 succeeds when real customers can pay for a report, unlock it, receive the link, and the payout path to the bank is verified.

## Immediate Decisions

0. Source control
   - GitHub repository locked: `https://github.com/ckroekchai/slaply.git`
   - Use this repository as the base for the Next.js production project

1. Domain and email
   - Production domain locked: `slaply.co`
   - Domain already registered
   - Set DNS in Cloudflare
   - Create business email: `hello@slaply.co`
   - Add aliases: `support@`, `billing@`, `reports@`

2. Payment
   - Initial test price locked: `THB 399`
   - First payment gateway direction: PromptPay QR code
   - Stripe Checkout remains optional later if card/international payment is needed
   - Important: a manual PromptPay QR does not automatically confirm payment; it needs operator verification and manual unlock
   - If automatic unlock is required, use a PromptPay provider/gateway that supports payment callbacks/webhooks

3. Platform
   - Next.js app on Vercel
   - Supabase Postgres + Storage
   - OpenAI vision model with strict structured JSON

4. Launch constraint
   - No login/dashboard
   - No PDF/AI/PSD upload
   - No compliance/legal/FDA/Thai FDA/prepress approval claims
   - Manual admin unlock must exist before paid launch

## Build Order

### Milestone 1: Production App Shell

- Create Next.js app
- Move approved HTML design into the `/` landing page
- Preserve responsive behavior and liquid-glass styling
- Add routes:
  - `/scan`
  - `/scan/[id]`
  - `/success`
  - `/admin/unlock`
- Add API placeholders:
  - `/api/create-scan`
  - `/api/run-ai-scan`
  - `/api/get-scan`
  - `/api/create-payment`
  - `/api/payment-webhook`
  - `/api/resend-report`
  - `/api/admin-unlock`

Done when: approved landing page runs inside Next.js and deploys cleanly.

### Milestone 2: Upload And Context Form

- Build `/scan`
- Accept only JPG/PNG
- Collect:
  - email
  - product category
  - sales channel
  - target customer
  - price tier
  - main concern
  - launch stage
  - language
  - consent
- Save customer and scan rows
- Upload image to Supabase Storage

Done when: a user can create a scan record from the website.

### Milestone 3: AI Preview

- Build `/api/run-ai-scan`
- Call OpenAI vision with structured JSON schema
- Validate JSON server-side
- Save score, readiness level, issues, recommendations, and raw output
- Render unpaid preview at `/scan/[id]`
- Hide full recommendations until paid

Done when: 10 internal images return valid JSON and render as preview.

### Milestone 4: Paid Full Report

- Build paid state for `/scan/[id]`
- Show full report only when `payment_status = paid`
- Render:
  - overall score
  - score breakdown
  - annotated image markers
  - issue list
  - why it matters
  - recommendations
  - next steps
  - disclaimer

Done when: paid report is useful as the paid deliverable.

### Milestone 5: PromptPay Payment And Unlock

- Build `/api/create-payment`
- Build `/api/payment-webhook`
- Attach `scan_id` to payment metadata
- Webhook sets:
  - `payment_status = paid`
  - `scan_status = paid_unlocked`
- Send report email from `reports@slaply.co`
- Add manual admin unlock/resend fallback

Done when: PromptPay payment can be verified, report unlock works, and manual rescue works.

### Milestone 6: Paid Beta Gate

- Run 10-20 real packaging scans
- Human-review all early reports
- Verify payment provider balance
- Verify payout to bank
- Track revenue, fees, AI cost, and payout status

Done when: Slaply is ready for a limited paid beta.

## Database Tables

Use Supabase tables:

- `customers`
- `scans`
- `payments`
- `events`

Required scan statuses:

- `created`
- `uploaded`
- `scanning`
- `preview_ready`
- `failed`
- `paid_unlocked`

Required payment statuses:

- `unpaid`
- `created`
- `pending`
- `paid`
- `failed`
- `refunded`

## Event Tracking

Track at minimum:

- `landing_viewed`
- `upload_started`
- `image_uploaded`
- `form_completed`
- `scan_started`
- `scan_completed`
- `scan_failed`
- `preview_viewed`
- `unlock_clicked`
- `payment_started`
- `payment_succeeded`
- `report_unlocked`
- `report_viewed`
- `report_email_sent`

## Next Practical Step

Start with Milestone 1: create the production Next.js app and migrate `slaply-design-liquidglass.html` into the real landing page.

## Credentials And Assets Needed Next

Before Milestone 2 can become functional, prepare:

- Cloudflare DNS access for `slaply.co`
- Vercel project access
- Supabase project URL
- Supabase anon key
- Supabase service role key
- Supabase Storage bucket name for artwork uploads
- OpenAI API key
- PromptPay merchant/account details for QR generation
- Decision: manual PromptPay verification first, or PromptPay provider with webhook
- Report sender email: `reports@slaply.co`
- A private admin password or operator access method for manual unlock

## Current Implementation Status

- Next.js App Router shell created
- Approved liquid-glass landing page migrated to `/`
- Landing CTAs now point to `/scan`
- Placeholder pages created for `/scan`, `/scan/[id]`, `/success`, and `/admin/unlock`
- API placeholders created for scan creation, AI scan, scan fetch, payment creation, payment webhook, resend report, and admin unlock
- `slaply.co`, `THB 399`, and `promptpay_qr` stored in project config
