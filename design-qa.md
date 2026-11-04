# Brand Pot production design QA — 2026-11-04

final result: passed

## Source and evidence

- Visual truth: existing `../exports/slaply-playground.html` (Brand Pot v5), captured as `brand-pot/qa/source-empty-comparable.jpg`.
- Implementation: Cloudflare preview, identical application assets to `https://slaply.co/`, captured as `brand-pot/qa/implementation-empty-final.jpg` after fonts and session loaded.
- Desktop comparison: both CSS viewports 1280 × 1040, reported DPR 0.9. Browser capture produces 1422 px width for both. Source full-page image is 1422 × 1156; implementation is 1422 × 1181 because the disclosed upload limits add 23 CSS px. No image resampling was used.
- Same route `/`, empty ingredients, light theme. Original simulated credits intentionally replaced with AI Beta quota; no payments.
- Both full-view images were opened together in the same comparison input. Full-resolution text, pot artwork, icons and spacing were readable; a separate crop was unnecessary.
- Real production result: `brand-pot/qa/production-result-desktop.jpg`, 1494 × 1034 native screenshot; `brand-pot/qa/production-result-mobile.jpg`, 433 × 3163 full-page capture at CSS 390 × 844, DPR 0.9. Document width 390: no horizontal overflow.
- Screenshots are local QA evidence and are not published in Git. Original prototype files were not modified.

## Comparison history and findings

1. Initial paired comparison (`implementation-empty-comparable.jpg`) found [P2] status text shifted left under the pot. The new max-width lacked automatic horizontal margins. Added `margin-inline:auto` and explicit wrapping to `.cooking-status`.
2. Final paired capture after deployment confirms centered status, unchanged pot scale, ingredient carousel, hero and notes. No remaining P0/P1/P2 visual findings.
3. Initial capture immediately after reload was rejected because fonts/session were still loading; final evidence was recaptured with `document.fonts.status === 'loaded'`.

## Required fidelity surfaces

- Typography: original local Space Grotesk and Noto Sans Thai retained; hero hierarchy, label sizes and Thai wrapping match source. Generated Thai concept is legible. Thai brand name is rendered as exact text by code.
- Spacing: source geometry retained. Additional upload/privacy line intentionally shifts subsequent sections down 23 px. Fixed status alignment. On mobile the customization panel follows the artwork and remains reachable.
- Colors: original cream/coral/navy interface tokens and pot artwork retained. Result colors come from the structured recipe; appearance controls remain editable.
- Images: same original pot, wordmark treatment, ingredient icons and curated accent assets; no replacement approximations. Production creates a separate AI illustration and overlays the original product. Downloaded JSON embeds both originals byte-for-byte. PNG export is 1600 × 1120.
- Copy: exact requested placeholders preserved. Simulated credits/prototype disclaimers replaced with factual Beta, quota, upload and browser-session disclosure. Download dialog distinguishes digital artwork from production-ready packaging files.

## Interaction and runtime verification

- Uploaded two original POKO fixture images through Chrome's native file picker. Generation started automatically at the second ingredient.
- Production job `166529b6-b574-44c0-9985-e232cf490f08` reached ready in approximately 50 seconds. Real AI illustration, Thai concept, palette and original product displayed correctly.
- Saved recipe, reloaded across the final deployment, reopened recipe, edited concept and combined Bloom + Orbit; generation quota stayed at 4 rounds.
- PNG, JSON and self-contained HTML downloaded. JSON original bytes match fixtures; generated image and fonts embedded in HTML. Visual PNG inspection passed.
- Desktop and mobile result states inspected; no console errors/warnings on production.
- Automated source checks: 54 tests passed; build passed. Paid production integration eval: 17 automated checks passed. Final deployed smoke: 10 checks passed.

## Accepted constraints and next quality gate

This pass covers the web flow and its fidelity, not universal model quality. The six-case repeated human evaluation matrix is still incomplete. The product remains AI Beta. One AI illustration is generated per round; Bloom/Orbit/Ribbon are curated accents. Recipes belong to a browser cookie, with no account or cross-device synchronization. Preview OpenAI authentication is invalid; production generation is verified working. Payments remain deferred.

## Implementation checklist

- [x] Preserve v5 visual direction and exact placeholders.
- [x] Fix and recapture status alignment.
- [x] Verify production upload, generation, save, reload, customization and export.
- [x] Check mobile overflow and production console.
- [x] Document Beta constraints and broader evaluation gap.

## Browser annotation release — seven requested refinements

final result: passed

### Source and comparison

The seven user browser comments and marked screenshots are the requested-change source. Current production was captured before changes, then compared with the deployed result at the same 1017 × 588 CSS viewport (DPR 2). Both receipt images were opened together in one comparison input, as were both full-page images. Local screenshot files under `brand-pot/qa/annotations/` remain ignored and unpublished.

- Before: `before-page.png`, `before-export.png`.
- After: `after-page.png`, `after-export.png`. Same FOLKJA recipe, five originals and unchanged customizations; carousel set back to slot six for final comparison. The status below the pot changes from freshly served to restored-recipe wording after reload, an existing runtime behavior.
- Local mobile evidence: `local-receipt-mobile.png`, viewport 390 × 844; document width 390, no horizontal overflow.
- Production reversible-trash evidence: `production-trash.png`, using the agent's separate POKO QA recipe; user FOLKJA recipe remained intact.

### Requested behavior and evidence

1. **Only the name arrow moves.** Final arrow right edge 290.898px; pot image left edge 298.5px (7.602px clearance). Note bounds (left168.187/top622.397) and pot bounds (left298.5/top516.859/420×280) match the baseline. The final arrow translation is -34px; note and pot positions are unchanged.
2. **18 MB combined upload limit.** UI copy and preflight updated; authoritative backend accepts exactly18MiB and rejects18MiB+1byte before quota admission. Individual limit remains5MiB. Older recipes without byte metadata still receive the server check.
3. **Subtle boiling rattle.** Actual local UI generation action activates `pot-rattle`, 0.48s stepped loop, ≤1px translation and0.24deg rotation. Both moving and resting transforms observed. Manual reduced motion yields animation:none; stopping generation removes the animation. OS reduced-motion rule is also present. This loading-state check used an isolated local simulated API, not a paid generation.
4. **Confirmed saved state.** Save produces filled black SVG (`fill=#000000`) and “เก็บสูตรแล้ว”; slider edit returns “เก็บสูตรนี้”. Production reload recognizes the user's already-saved recipe. Snapshot tests cover failed save and edits while save is in flight.
5. **Brand-colored sliders.** All five live FOLKJA sliders use rgb(23,62,51), the rendered brand ink. Local POKO recipe uses rgb(24,75,58). Native range appearance and keyboard operation retained.
6. **Restaurant bill downloads.** Cream receipt, Slaply wordmark, line items, quantity, file types, dashed separators and ฿0 Beta total. All four download rows visible at1017×588 after compact-height refinement. Main CTA remains “ดาวน์โหลด”. Actual JSON download from the new receipt preserved edited concept, selected objects, embedded AI image and both original images byte-for-byte. No payment action added.
7. **Trash button on saved cards.** Separate accessible button, not nested in the open-recipe button. Real production test moved one agent QA recipe to trash, reloaded, confirmed it did not reopen, restored it, and reopened exact edited content. Local test also covered undo. No permanent deletion or asset removal.

### Iterations and fidelity surfaces

- Initial arrow adjustment was insufficient against bounding boxes; final -34px leaves a visible gap.
- Initial receipt was too tall for the annotated short viewport. Added compact-height layout so all four downloads and total are visible; mobile retains a longer readable receipt with internal scrolling.
- Typography: existing local fonts preserved; short-screen receipt uses a compact hierarchy; exact save copy matches the request.
- Spacing: original hero, ingredients, note and pot geometry retained. Only arrow position and requested receipt/card controls change.
- Colors: cream/coral/navy application preserved; saved icon black and sliders use brand ink as requested.
- Images: original pot and user imagery unchanged; receipt intentionally replaces the previous hero-thumbnail layout with bill line items.
- Copy: total18MB, confirmed saved label, receipt and recoverable-trash wording updated within scope. Payment integration remains deferred.

### Release checks

63 automated tests passed, Vite production build passed, preview and production smoke each passed10 checks. Production console showed no warnings/errors. Additive migration0002 applied before both deploys. Production version `965c1291-e59a-4ac1-9695-0d17cb0fe0bc`; preview `d23e132b-df9c-4877-8936-fa8f31f2adac`. www remains308 to the apex. No additional paid AI call was made for this refinement pass; broader model-quality evaluation remains outside these seven UI corrections.
