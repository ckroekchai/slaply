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
