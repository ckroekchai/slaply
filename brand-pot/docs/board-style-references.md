# Four Slaply board directions

Reviewed 6 November 2026. These are design references, not assets copied into Slaply. All layouts, geometry, typography combinations and labels are Slaply implementations; customer colors, generated objects and identity remain the source of the finished board.

## Current official references

| Reference | Date / evidence | What informs the board |
| --- | --- | --- |
| [Canva — Design Trends 2025](https://www.canva.com/collections/design-trends-2025/) | 2025 collection; includes brand-board examples alongside Analog Meets AI, Shape Theory and Serious Fun | A concept-art direction can combine an atmospheric backdrop, tactile generated objects and expressive editorial typography while retaining a complete practical guideline. |
| [Canva — Behind the scenes of DesignDNA](https://www.canva.dev/blog/engineering/behind-the-scenes-of-canvas-designdna-campaign/) | Official 2025 campaign article | One coherent design system can have strongly individual compositions. This supports four whole-board directions rather than cosmetic recolors of one grid. |
| [Apple — Say hello to MacBook Neo](https://www.apple.com/newsroom/2026/03/say-hello-to-macbook-neo/) | 4 March 2026 official product presentation | Quiet product focus, generous clear space, restrained sans-serif hierarchy and carefully balanced scale inform Minimal. |
| [MUJI — The art of simple design](https://www.muji.eu/pages/muji-stories/the-art-of-simple-design.html) | Current official page, accessed 6 November 2026; publication date is not stated | Plain surfaces, useful simplicity and an uncluttered material sensibility complement the dated Apple reference. |
| [Notion — Brand Guidelines template](https://www.notion.com/templates/brand-guidelines) and [Design Team in a Box](https://www.notion.com/templates/design-team-in-a-box) | Current official template listings and visible template previews, accessed 6 November 2026 | Scannable sections and predictable modules for logo, typography, colors and team use inform Professional. |
| [Figma — Using the Figma brand](https://www.figma.com/using-the-figma-brand/) and [official brand guidelines PDF](https://static.figma.com/uploads/6645755656177435f83e10b48d9947645b55a033) | Current official page and 11-page PDF, accessed 6 November 2026; the PDF's publication date is not asserted | A strong grid, clear space, typographic precision and explicit color specifications inform Professional. |
| [Spotify — 2025 Wrapped](https://newsroom.spotify.com/2025-wrapped/) and [2025 Wrapped user experience](https://newsroom.spotify.com/2025-12-03/2025-wrapped-user-experience/) | Official 2025 campaign and 3 December 2025 article | Oversized type, assertive color blocks, asymmetry and a rhythmic campaign composition inform Creative, combined with Canva's playful 2025 examples. |

The style translation above is our design inference from these references. It does not suggest an affiliation with those companies or reproduce their marks, illustrations or templates.

## Implementation

All directions use the same 2400 × 1800 scene and retain identity, concept, all three generated objects with reasons, five palette colors with exact values, typography, pattern, social application and business card.

1. **AI แนะนำ:** a soft brand-color atmosphere, rounded modules and a wide visual stage with floating selected objects and colored halos around a protected identity plate. A large object family and editorial type chosen from the AI recommendation keep the concept-art character paired with practical guideline information.
2. **Minimal:** an open off-white surface, broad outer margins, quiet horizontal rhythm and restrained grotesk type. Most sections share the page surface, so empty space creates structure.
3. **Professional:** a document rule, outlined modules, narrow strategy column and horizontal color specification rows. Object and typography modules form a separate working-system row.
4. **Creative:** an oversized campaign title band, dark type specimen, asymmetric modules and a tall three-object column. Bold brand surfaces and display type create a distinct reading order.

The four tabs select `customization.boardVariant = ai | minimal | professional | creative` locally. Switching does not generate a new recipe or call a paid API. Text, logo size, object selection/size and color adjustments remain available. Legacy recipes default to `ai`.

The browser preview and PNG/PDF/HTML exporters use the same scene renderer and locally bundled fonts. A locked original keeps its source pixels and colors; an approved transparent cutout can be fitted using validated alpha-content bounds. A newly generated logo is isolated to its assigned fourth atlas cell, with the other three cells kept for the customer's three generated objects.

## Export integrity verification

`evals/verify-board-artifacts.mjs` checks downloaded PNG and PDF bytes independently of the production exporter. It verifies 2400 × 1800 dimensions, actual palette pixels, logo placement, exact RGB bytes embedded in the PDF, one 8 × 6 inch page, and bounded PDF rasterization differences. Fonts and overall composition still need a separate browser review.

For a generated or diecut identity, provide the saved recipe explicitly; the checker never treats a crop flag in the scene alone as authorization:

```sh
node evals/verify-board-artifacts.mjs --png board.png --pdf board.pdf --scene scene.json --recipe recipe.json --logo displayed-source.png --out report.json
```

`--logo` is the displayed source: the complete generated atlas, the complete original image, or the full-resolution transparent derivative. For a derivative, additionally pass `--original-logo preserved-original.png`. The checker verifies that its canvas dimensions and visible source colors survive, that alpha only decreases, and that any supplied original/derivative digests match. It then checks the explicitly saved alpha-content bounds. Generated identities must use exactly the reserved fourth atlas cell and the recipe's saved color adjustments. Optional same-browser independent references remain available through `--logo-reference`.

The offline private-fixture renderer now runs all four explicit `boardVariant` values. Actual provider fixtures with cutouts need a local `<fixture-id>-cutout.png` alongside the preserved original and generated atlas. Missing files fail clearly; the runner never substitutes the original for a cutout. Native Sharp/Poppler dependencies are only for this optional artifact QA; the contract tests in the normal test suite use Node alone.
