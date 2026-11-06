# Brand Guideline Board v7

Source contract and validation guide, 6 November 2026. “v7” names this interaction and board revision; the portable recipe and job schema remains **6**. Prompt version is `brand-guideline-2026-11-06.1`. This record does not establish deployment or a completed paid-provider evaluation of v7.

## Inputs and explicit generation

- New jobs require **3–6** separately uploaded JPG, PNG or WebP images. The limit remains **5 MiB per image, 18 MiB combined**. The server checks trusted stored sizes before AI admission.
- The first two slots read **วัตถุดิบหลัก**. The instruction reads **ใส่วัตถุดิบอย่างน้อย 3 อย่าง**. No ingredient-role dropdown is shown.
- Vision classifies each original as logo, product or reference. Upload order does not assign a logo. Legacy client role values are accepted for compatibility but normalized to `auto`; they cannot bypass the lock policy or three-input minimum.
- Uploading, changing a lock, editing notes, switching a board tab and changing sliders do not submit a generation. Only **Shake my brand** starts a new job. Reconnecting to a previously accepted job reuses that job.
- **อธิบายเชฟ** edits the global `brief.chefNotes` (up to 2,000 characters) and optional per-ingredient `notes` (up to 300 characters). The existing brand name and description stay available. A generated recipe stores its input brief and notes; reopening restores them. Changes to the next cooking brief do not silently rewrite the input record of a previous AI result.

## Locks and original integrity

Locking means preserve the original, not merely emphasize its style. An unlocked detected logo can be redesigned. A locked detected logo uses the original artwork, with an alpha cutout and fitted content bounds where the background can be separated confidently.

Preparation runs in the browser only after Shake, before the paid job request. It preserves source dimensions and RGB values and stores a PNG derivative separately; original file bytes and URLs remain unchanged. Transparent originals can be reused without another upload. Complex or uncertain backgrounds, oversized pixel surfaces and oversized derivatives retain the original with a short notice instead of erasing important details. Automatic cutout is conservative, not a universal segmentation guarantee.

The submitted ingredient contract is:

```js
{
  id,                    // owned original upload
  locked,                // boolean
  notes,                 // optional, <= 300 characters
  cutoutId,              // optional, owned PNG (or the same transparent WebP); requires locked=true
  cutoutStatus,          // "removed" or "transparent" when cutoutId exists
  cutoutBounds: { x, y, w, h } // normalized, finite, within the original canvas
}
```

Backend admission validates ownership, PNG format (or same-source transparent WebP), dimensions and bounds. A cutout does not replace the image sent to vision: classification uses the original input. The derivative is a presentation asset.

Preparation has a separate cancellation coordinator. Stop, input edits, reset and recipe restoration invalidate pending preparation. An old completion cannot publish a job or clear a newer preparation's busy state. Rapid repeated Shake clicks cannot duplicate preparation. Accepted provider work has separate durable cancellation and usage accounting; stopping does not imply a refund or that an upstream request never started.

## Four board directions and three objects

The toolbar above the board owns `customization.boardVariant`:

| Stored value | Tab | Composition |
| --- | --- | --- |
| `ai` | AI แนะนำ | Atmospheric concept art, expressive AI direction and a complete practical guideline |
| `minimal` | Minimal | Quiet surface, generous space, restrained typography |
| `professional` | Professional | Clear document grid, rules and explicit specifications |
| `creative` | Creative | Large campaign type, asymmetric modules and bold color surfaces |

The four whole-board styles have distinct layouts. They retain identity/logo, concept, all three generated objects with their explanations, five palette values, typography, a pattern and application examples. The six existing sliders and multi-select object picker remain. Old direction dropdowns are removed; switching tabs is free of provider calls. The tab and slider state is included in confirmed saves, reopening and exports.

Exactly **three brand-specific objects** remain required. The shared generated sheet reserves its fourth cell for the new logo when the input logo is not locked; it does not consume an object cell. Missing object definitions fail validation before image generation. The browser and PNG/PDF/HTML exports share the same 2400 × 1800 scene. The original locked logo is not recolored by brand sliders.

See [board-style-references.md](board-style-references.md) for the inspected official examples and Slaply's own interpretation. Referenced companies' marks or template assets are not shipped as customer branding.

## Recipe trash and permanent deletion

Apply additive migration `0005_recipe_permanent_delete.sql` before deploying this backend revision. It adds `brand_recipes.purged_at`; it does not remove any existing recipe or asset.

- `DELETE /api/recipes/:id` moves an active version to recoverable trash.
- `POST /api/recipes/:id/restore` restores an unpurged version.
- `DELETE /api/recipes/:id/permanent` requires that version already be trashed and owned by the current session. Active versions return 409; unavailable or already purged versions return 404.
- The UI first shows a second trash action, then an explicit warning that restoration will be impossible. Cancel receives initial focus. Only a matching `{ id, permanentlyDeleted: true, sourcePurged: boolean }` response removes the card.
- The backend clears the selected version's recipe JSON and retains a content-free tombstone to prevent generated-fallback resurrection. When the final unpurged version of its job is removed, the job's recipe and analysis JSON are also cleared. Other versions, job accounting and shared original/generated image assets remain. This action is permanent recipe deletion, not a claim of total asset erasure or an automated retention policy.
- The frontend clears a matching cached result/history by source job ID only when the backend reports `sourcePurged: true`. It does not infer this from the paginated local recipe list. Downloaded files on the user's device are unaffected.

## Validation method and evidence boundary

From `production/brand-pot`:

```sh
node --test tests/generation-preparation.test.mjs tests/locked-cutout.test.mjs tests/kitchen-jobs.test.mjs tests/ingredient-roles.test.mjs tests/recipe-state.test.mjs
npm test
npm run build
```

The focused command passed **38 tests** during this source revision, and the Vite production build passed. Coverage includes Stop/stale/duplicate preparation races, unchanged original pixels, serializer-to-real-Worker cutout admission, minimum-three gating, chef-note persistence, all board customization fields, confirmed deletion and shared-version cache preservation. These tests use local fixtures and make no paid generation requests. Whole-suite results and later revisions must be recorded from their actual runs rather than inferred from this focused result.

Browser acceptance must use disposable local fixtures or specifically authorized QA recipes:

1. Upload three images and edit locks/notes; observe zero new job submissions until Shake. Verify fewer than three remains disabled, even with a logo and long brief.
2. Verify chef notes reach a submitted request and survive a generated recipe's save/reopen. Use stale-preparation controls to verify Stop and reset cannot start a late job.
3. Compare locked and unlocked runs: original file integrity and fitted cutout versus an AI-created logo. Check all three generated objects against the customer's identity, not just whether the schema has three entries.
4. Inspect all four tabs on desktop and mobile, keyboard navigation, every slider, object selection and saved reload. Compare actual downloaded PNG/PDF/HTML with the selected live board; a ready button is not a downloaded artifact.
5. Check trash/restore. Test irreversible purge only on an explicitly disposable QA recipe after confirming its name. Verify its disappearance after reload, restore denial and retention of an independent sibling recipe/version.

For real-provider acceptance, use the guarded evaluation tooling with explicit paid opt-in and record prompt/model versions, result IDs, actual usage and human review separately. A health flag, mocked job, source test or build is not paid integration evidence. Historical v6 paid runs do not validate the new v7 classification, lock/redesign policy or fourth logo cell.

## Hosting and release scope

Workers **Free** remains the deployment target. JPG/PNG/WebP uploads are enabled; SVG/PDF uploads and the separate converter remain deferred. Exporting a raster board as PDF is independent of uploading a PDF. No hosting upgrade, subscription, payment integration or paywall is introduced.

Release must record migration application, built source revision, target Worker version and observed post-deploy upload/generate/edit/save/reload/export behavior. At the time this guide was authored, v7 production deployment and live paid evaluation were still separate pending work; do not treat this file as their completion record.
