# Slaply

Phase 1 production build for `slaply.co`.

Product: Instant AI Packaging Audit.

Current MVP flow:

Landing -> Upload artwork -> AI scan -> Free preview -> PromptPay QR -> hidden guidance reveal

Current build status lives in `SLAPLY_PHASE1_NEXT_STEPS.md`.

Required private env values live in `.env.local` and must not be committed.
Run `supabase/schema.sql` in the Supabase SQL editor before testing uploads.

Use `MOCK_AI_SCAN=true` while OpenAI billing is not enabled. The scan flow will return a production-shaped mock report
and will not call OpenAI. Switch to `MOCK_AI_SCAN=false` with a real `OPENAI_API_KEY` when ready.

For the first PromptPay MVP, add:

```env
PAYMENT_GATEWAY=promptpay_qr
PROMPTPAY_ACCOUNT_NAME=
ADMIN_UNLOCK_TOKEN=
```

The PromptPay QR shown to customers is the fixed image in `public/slaply-promptpay-qr.jpg`.
Until a real PromptPay callback is connected, the report page keeps hidden guidance blurred after the QR is generated,
then reveals it with a 10-second confirmation countdown. Manual admin unlock remains available at `/admin/unlock`.

Deployment details live in `docs/PRODUCTION_DEPLOYMENT.md`.
