# Slaply private asset converter

This independently deployable Worker converts a **server-supplied immutable original** to a separate PNG. It has no OpenAI key, public route, database, or storage binding. Its default HTTP handler always returns 404. The application remains responsible for ownership, immutable R2 storage, and publishing the returned derivative only after checking its metadata/hash.

## Service contract

Bind service `slaply-asset-converter`, entrypoint `AssetConverter`, as `ASSET_CONVERTER`. Call its named entrypoint with:

```js
const response = await env.ASSET_CONVERTER.fetch(new Request('https://converter.internal/convert', {
  method: 'POST',
  headers: { 'Content-Type': originalMime, 'X-Source-SHA256': originalSha256 },
  body: originalBytes,
}));
```

MIME is exactly `image/svg+xml` or `application/pdf`; SHA-256 is lowercase 64-character hex. Body is the original bytes, at most 5 MiB. Neither uploaded client previews nor input URLs are accepted. Content-Length is checked when supplied; streamed byte count is always bounded.

Optional `X-Max-Edge` accepts exactly `512` or `2048`; default2048. Use2048 for the stored board preview and512 for a temporary vision derivative. The source hash is unchanged; each derivative has its own returned hash/dimensions. This prevents six vector files from expanding to large PNG/base64 payloads in the AI Worker. No other size is accepted.

Success: HTTP 200, `Content-Type: image/png`, PNG body. `X-Conversion-Metadata` is JSON:

```json
{
  "width": 2048, "height": 1024,
  "sourceWidth": 200, "sourceHeight": 100,
  "renderer": "resvg-0.49.0",
  "converterVersion": "slaply-converter-2026-11-05.2",
  "mime": "image/png", "originalMime": "image/svg+xml",
  "originalSha256": "64-hex", "sha256": "64-hex",
  "originalPreserved": true,
  "linearMemoryBytes": 18350080
}
```

PDF adds `pageIndex:0,pageCount:1`, renderer `pdfium-2.15.1`; SVG adds `elementCount`. `linearMemoryBytes` describes the WASM heap only, not total isolate memory. Do not expose memory/internal diagnostics in product copy. Store source and derivative hashes separately. Never replace or rewrite the original.

Failure: `{ "error": { "code": "PDF_MULTIPAGE", "message": "..." } }`. Codes: `INVALID_INPUT` (400), `INPUT_TOO_LARGE` (413), `CONVERTER_BUSY` (503), and 422 for `SOURCE_MISMATCH`, `UNSUPPORTED_FORMAT`, `INVALID_SVG`, `UNSUPPORTED_SVG`, `SVG_COMPLEXITY`, `INVALID_DIMENSIONS`, `SVG_RENDER_FAILED`, `INVALID_PDF`, `PDF_ENCRYPTED`, `PDF_MULTIPAGE`, `UNSUPPORTED_PDF`, `PDF_COMPLEXITY`, `PDF_MISSING_FONT`, `PDF_RENDER_FAILED`, `CONVERSION_MEMORY`, or sanitized `CONVERSION_FAILED`. The main app must also map binding timeout/CPU termination to an actionable conversion failure. Retry only `CONVERTER_BUSY` with a bounded delay; do not retry malformed files.

## Accepted profile

- SVG: UTF-8, static outlined artwork, explicit px/numeric width+height or valid viewBox; shapes, groups, gradients and clip paths. No text/fonts, image embeds, scripts/events, animation, foreignObject, external resources, style sheets, DTD/entities, `use`, filters, masks or unknown elements/attributes. Unsupported input is rejected, never stripped. Maximum 4096 elements, depth32, aggregate path/points data256k characters. Inline style properties have an allowlist. Paint, opacity, geometry, stroke and enum values are parsed before rendering; malformed points, invalid colors, CSS variables/calculations, modern unsupported color functions and font-relative lengths are rejected instead of silently changing or dropping artwork. Internal paint references must resolve to gradients and clip references to clipPath. This is an intentionally limited SVG subset.
- PDF: exactly one unencrypted static page; no forms, annotations, JavaScript actions or attachments. All text-object fonts must be embedded, including objects nested inside forms. Missing/unembedded fonts are rejected instead of intentionally substituting them. CropBox and intrinsic rotation are rendered. Embedded fonts are checked structurally through PDFium; this does not prove visual equivalence for every malformed font/color-profile edge case. Unsupported/corrupt content may still require additional corpus testing.
- PNG derivative: original aspect ratio, longest edge at most2048, area at most4,000,000 pixels, alpha preserved. No automatic crop, background replacement or pixel editing. Vector coordinates remain in the unchanged original; derivative rasterization is explicitly separate.

## Build and tests

Requires Node22.13+ and Rust stable with `wasm32-unknown-unknown` target. `npm ci --ignore-scripts && npm test` builds locked upstream resvg0.49.0 and bundles precompiled WASM modules. For a task-local Rust toolchain, set `CARGO_HOME`/`RUSTUP_HOME`; the local QA toolchain under `../qa/private/converter-toolchain/` is also discovered when present. No machine HOME/PATH is rewritten.

The resvg build disables text, system fonts, SVGZ and raster image decoders. PDFium's published binary is loaded via `WebAssembly.Instance(precompiledModule, imports)`; no dynamic compilation, CDN, Canvas, or DOM rendering is needed. Build tooling caps the binaries' declared WASM maximum memories and records original/patched SHA-256 in `dist/manifest.json`: SVG64MiB, PDF48MiB. One active conversion per isolate; extra concurrent requests get503. The deployed CPU limit is1000ms. Local workerd does not demonstrate the production CPU cutoff; timing tests measure local wall time only.

`npm test` uses actual workerd via Miniflare, not a renderer mock. It fully decodes output with Sharp, checks pixels/alpha, source hashes, deterministic output, font/encryption/page rejection, rotation/CropBox, no network calls, named Service Binding access and default HTTP404. The encrypted fixture is synthetic, generated with pypdf from one blank page; its password is test-only.

Optional private corpus test:

```sh
SLAPLY_PRIVATE_REFERENCE_PDF='/absolute/path/to/private/reference.pdf' npm test
```

It expects a multipage reference and also creates an in-memory one-page copy for embedded-font rendering. It never writes/extracts/publishes the original or derivative. The author's 17-page4.1MB reference passed rejection and unchanged-hash checks; the in-memory first page rendered2048×1447 with a48,365,568-byte WASM heap in approximately135ms locally. Synthetic SVG/PDF tests used approximately18MB heaps. These are measured fixture results, not universal performance guarantees.

Build outputs and development tools are ignored. Review `wrangler.jsonc` before deployment; no deploy is run by tests or build.

## Dependencies and notices

resvg0.49.0 and its Rust dependency versions are locked by Cargo.lock; upstream resvg is MIT/Apache-2.0. The PDFium wrapper is MIT and its bundled notices include PDFium BSD-style and Apache-2.0 notices. xmldom and fflate are MIT. See `licenses/` for upstream notices retained with this source. No third-party conversion service is required.
