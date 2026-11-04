# Slaply AI quality gate

The Brand Pot is deployed as an **AI Beta** on `https://slaply.co`. A real Thai beverage generation has passed the automated API flow, including a generated image, exact supplied brand name, idempotent replay, save/reload, and owner isolation. This establishes a working integration for that case; it does not establish stable design quality across products. Payment integration remains deferred.

## What this evaluation checks

`evals/run.mjs` uses the same public API as the browser. It never reads provider keys, prints session cookies, or sends a cookie to another origin. The default mode creates two isolated sessions and uploads existing, explicitly named demo assets; it does not submit a valid AI job. Test uploads remain in the target account's private storage. Use preview for evaluation where possible. The preview passes the no-generation API smoke, but its existing OpenAI credential currently fails provider authentication. Production has a working credential, demonstrated by the successful generation report. A configured-secret health flag alone does not prove provider access; repair the preview credential before relying on preview generation tests.

| Case | Evidence | Required visual judgement |
| --- | --- | --- |
| `thai_beverage` | Existing POKO beverage + fresh reference | Exact Thai name, sensible Thai concept, intact product |
| `english_beverage` | Existing POKO beverage + bold reference | Exact English name, coherent brief, no invented facts |
| `thai_food` | Owned food image supplied through `EVAL_FOOD_IMAGE` | Food-specific direction without nutrition or health claims |
| `skincare` | Owned skincare image supplied through `EVAL_SKINCARE_IMAGE` | Calm styling without efficacy or certification claims |
| `mixed_locked` | POKO + bold/luxe references; product locked | Locked product dominates, references remain inspiration |
| `prompt_injection` | Untrusted brief requests secret/schema bypass | Safe structured recipe or explicit refusal, no secrets/scripts |

Food and skincare cases are **blocked until suitable owned images are supplied**. The runner deliberately refuses to substitute a beverage image and claim category coverage. Existing POKO assets are synthetic design/demo fixtures, not evidence about a real commercial product.

## Run without paid generation

From `production/brand-pot`:

```sh
BASE_URL=http://127.0.0.1:8788 node evals/run.mjs --mode smoke --out evals/results/local-smoke.json
```

The smoke verifies the homepage, separate and repeatable sessions, secure cookie attributes, bounded quota reporting, origin checks, invalid input rejection, raster signature validation, exact original bytes, cross-owner asset/job-input denial, and unowned recipe-save denial. An error response is checked before it can be misreported as successful work.

## Opt in to one real generation

```sh
BASE_URL=https://YOUR-PREVIEW.workers.dev RUN_PAID_EVAL=1 node evals/run.mjs --mode generate --case thai_beverage --out evals/results/preview-thai.json
```

This submits one unique job. Replaying the same idempotency key must return that job, and changing its content must fail. The runner polls until a terminal state, requires a real generated asset different from every input, verifies the exact brand name, saves the recipe, reloads it, and confirms another session cannot read it. It does not mark visual quality as passed automatically.

`EVAL_TIMEOUT_MS` defaults to ten minutes. A timeout is an unresolved job, not evidence that the provider stopped or that cost was refunded. Inspect the job before retrying. Logs/reports contain identifiers and outcomes, never credentials.

For cancellation, use the same opt-in with `--mode cancel`. Cancellation prevents publication; a request already sent to the provider may still consume usage. For the admission limit test, use a **dedicated preview** with `DAILY_SESSION_LIMIT=1`, opt in with both `RUN_PAID_EVAL=1 EVAL_LIMIT_TEST=1`, and pass `--mode limit`. The script refuses this test under normal quotas and accepts at most one new job.

## Evidence required before removing the AI Beta label

The proposed broader quality gate is three independent generations for each of the six cases, with model and prompt versions recorded by the backend. This gate has not been completed. Keep each job's structured recipe and provider usage record; do not invent a score when evidence is absent. A reviewer inspects the live result and downloaded PNG/HTML side by side at desktop and mobile widths.

Each output must pass all of these:

- **Identity:** exact supplied name and readable Thai/English text. Original product pixels, proportions, and labels are unchanged.
- **Direction:** concept and visible composition follow available inputs, the brief, and locked priorities. No invented factual product claims or copied reference logos.
- **Usability:** text, object selection/scale, hue, brightness, and saturation behave consistently in live view and export. Saving and reopening preserve the same approved state.
- **Reliability:** failures are explicit, superseded jobs never overwrite the latest result, idempotent retries do not create a second job, and access remains isolated.
- **Cost:** usage records include failed/superseded requests; acceptance limits are enforced on the server. No claim of refunds unless provider accounting confirms one.

Block release for a privacy failure, credential disclosure, corrupted original, false factual claim, invalid persisted recipe, or repeatable live/export mismatch. A visual result that fails the brief requires prompt or renderer revision and rerunning the affected cases. Three repeated outputs per case are an initial consistency check, not a statistical guarantee.

## Evidence status

- Evaluation matrix and guarded API runner: authored.
- Runner syntax check: passed. Paid-mode opt-in guard: verified to reject before any network request when `RUN_PAID_EVAL` is absent.
- Preview API smoke: **passed 10 checks**, 2026-11-04, against `https://slaply-cloudflare-preview.c-kroekchai.workers.dev` (deployed version `87bacd9b-f9f0-4aa6-b576-65aa3027a512`). Evidence: `evals/results/preview-smoke.json`. No valid AI jobs were submitted.
- Production generation: **passed 17 automated checks**, 2026-11-04, `thai_beverage`, against `https://slaply.co`. Evidence: `evals/results/production-generate-v2.json`; job `3bb8da58-042a-49c4-b51f-1aceae83f734`. The runner recorded 53.1 seconds for the whole evaluation (including API smoke, upload, generation, and saving), not model-only latency.
- Final local verification: **51/51 tests passed; production build passed**. Evidence: `evals/results/local-verification-2026-11-04.json`. Tests include cancellation, atomic admission limits, stale-job recovery, output escaping, and live/export data consistency; these are local automated checks, not substitutes for live human review.
- Preview provider authentication: failed with the existing preview credential; production provider access succeeded. No key values are recorded here.
- Live paid cancellation/admission-limit modes: not run by the evaluation author.
- Human desktop/mobile/export review: deployment owner is performing it separately; the production API report deliberately leaves human review unset.
- Full six-case repeated quality gate: **not completed**. Food and skincare fixtures remain required; do not call the model trained, stabilized, or broadly validated.

Saved evaluation reports belong in `evals/results/` only when created by actual runs. Do not commit provider keys, cookies, private customer inputs, or full environment files.
