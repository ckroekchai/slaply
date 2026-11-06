# Slaply AI quality gate

The Brand Pot has historical **AI Beta** deployment evidence on `https://slaply.co`: a Thai beverage generation passed the automated API flow on 2026-11-04, including a generated image, exact supplied brand name, idempotent replay, save/reload and owner isolation. This establishes that earlier integration case, not deployment or paid validation of the v7 source changes. Payment integration remains deferred. See [Brand Guideline v7](brand-board-v7.md) for the current contract and focused local evidence.

## Input and interaction limits

The current input contract is three to six JPG/PNG/WebP images, at most **5 MiB per image and 18 MiB combined**, with up to 40 million pixels per image. The aggregate limit must be checked before AI quota admission; originals remain immutable. New AI jobs start only from Shake, with automatic image-role recognition, preservation locks, optional global chef notes and per-ingredient notes. Local cutout may conservatively retain an uncertain original; it must not silently damage it. A saved indicator must reflect current content matching a server-confirmed saved version, including after edits made while saving.

Recipe removal first uses private recoverable trash. Its separate permanent-delete action requires an owned trashed version and explicit UI confirmation; test this only on disposable QA data. Purging clears recipe content and suppresses automatic fallback restoration, while preserving shared original/generated assets and independent versions. No existing customer recipe may be used as an irreversible test fixture.

The bill screen is a work/download summary during AI Beta; it must not submit a payment, buy credits, or imply a settled financial transaction. Animation checks include an observable cooking/pouring state plus a reduced-motion alternative. Slider colors must follow the requested styling while live artwork and exports keep the same color values.

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

## Verify reversible recipe trash without another generation

`--mode trash` submits no new AI jobs. It requires an existing active, disposable test recipe and its existing owner session: `BASE_URL`, `EVAL_RECIPE_ID`, and `EVAL_SESSION_COOKIE` must be supplied through the process environment. Never paste the cookie into shell arguments, command history, source code, or reports. If no QA session has been retained, verify the control in the already authenticated browser or use the backend integration tests; do not generate a paid job just to obtain a trash fixture.

The mode checks other-session delete/restore denial, private trash listing, repeated deletion, suppression of deleted recipes on reload, and exact content restoration. It attempts restoration in a `finally` block if a check fails after deletion. A failed cleanup must be reported as unresolved, not described as restored. Generation mode now runs these same checks after its newly created test recipe is saved; older generation reports predate those added checks.

## Evidence required before removing the AI Beta label

The proposed broader quality gate is three independent generations for each of the six cases, with model and prompt versions recorded by the backend. This gate has not been completed. Keep each job's structured recipe and provider usage record; do not invent a score when evidence is absent. A reviewer inspects the live result and downloaded PNG/HTML side by side at desktop and mobile widths.

Each output must pass all of these:

- **Identity:** exact supplied name and readable Thai/English text. Source files remain unchanged. Locked original identity retains colors, proportions and letterforms; a cutout changes only confident background alpha. An unlocked detected logo receives a coherent new design.
- **Direction:** concept, all three distinct objects, the logo policy and visible composition follow the supplied ingredients and chef brief. Four board variants must differ structurally while retaining every guideline topic. No invented factual product claims or copied reference logos.
- **Usability:** text, object selection/scale, hue, brightness, and saturation behave consistently in live view and export. Saving and reopening preserve the same approved state.
- **Reliability:** failures are explicit, input edits never auto-generate, cancelled/stale cutout preparation cannot submit a late job, superseded jobs never overwrite the latest result, idempotent retries do not create a second job, purged recipes do not resurrect, and access remains isolated.
- **Cost:** usage records include failed/superseded requests; acceptance limits are enforced on the server. No claim of refunds unless provider accounting confirms one.

Block release for a privacy failure, credential disclosure, corrupted original, false factual claim, invalid persisted recipe, or repeatable live/export mismatch. A visual result that fails the brief requires prompt or renderer revision and rerunning the affected cases. Three repeated outputs per case are an initial consistency check, not a statistical guarantee.

## Historical evidence status (2026-11-04)

These records predate the v7 source changes. Use the v7 guide's validation method and actual new run reports for release acceptance; do not carry forward an earlier pass as evidence for a changed policy.

- Evaluation matrix and guarded API runner: authored.
- Runner syntax check: passed. Paid-mode opt-in guard: verified to reject before any network request when `RUN_PAID_EVAL` is absent.
- Preview API smoke: **passed 10 checks**, 2026-11-04, against `https://slaply-cloudflare-preview.c-kroekchai.workers.dev` (deployed version `87bacd9b-f9f0-4aa6-b576-65aa3027a512`). Evidence: `evals/results/preview-smoke.json`. No valid AI jobs were submitted.
- Production generation: **passed 17 automated checks**, 2026-11-04, `thai_beverage`, against `https://slaply.co`. Evidence: `evals/results/production-generate-v2.json`; job `3bb8da58-042a-49c4-b51f-1aceae83f734`. The runner recorded 53.1 seconds for the whole evaluation (including API smoke, upload, generation, and saving), not model-only latency.
- Pre-annotation local verification: **51/51 tests passed; production build passed**. Evidence: `evals/results/local-verification-2026-11-04.json`. Tests include cancellation, atomic admission limits, stale-job recovery, output escaping, and live/export data consistency; these are local automated checks, not substitutes for live human review.
- Preview provider authentication: failed with the existing preview credential; production provider access succeeded. No key values are recorded here.
- Live paid cancellation/admission-limit modes: not run by the evaluation author.
- Human desktop/mobile/export review: deployment owner is performing it separately; the production API report deliberately leaves human review unset.
- Annotation backend verification: **20/20 focused tests passed**, including exact 18 MiB aggregate admission and one-byte-over rejection before quota, 5 MiB per-image limit, private/idempotent trash and restore, preserved assets/jobs, no reload resurrection, and inactive payment endpoints. Evidence: `evals/results/annotation-backend-verification-2026-11-04.json`.
- Annotation frontend/browser checks (saved/dirty indicator, cooking movement, slider colors, bill layout): implementation and visual verification in progress; earlier reports do not establish these newer behaviors.
- Full six-case repeated quality gate: **not completed**. Food and skincare fixtures remain required; do not call the model trained, stabilized, or broadly validated.

Saved evaluation reports belong in `evals/results/` only when created by actual runs. Do not commit provider keys, cookies, private customer inputs, or full environment files.
