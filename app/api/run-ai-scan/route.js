import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getIssueCounts, inferIssueType, sortIssuesForReport } from "../../../lib/audit-issue-utils";
import { auditJsonSchema, auditResultSchema } from "../../../lib/ai-audit-schema";
import { getCloudflareDataStore, isCloudflareDataEnabled } from "../../../lib/cloudflare-data";
import { buildMockAuditResult, isMockAiScanEnabled, mockAiModel } from "../../../lib/mock-ai-scan";
import { formatProductCategory } from "../../../lib/scan-form-options";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Slaply, an AI pre-flight packaging audit assistant.

Analyze the submitted artwork only as a pre-flight confidence check before print, production, launch, or marketplace listing.

The design may already be approved by the customer. Do not re-judge the approved creative direction, visual style, brand taste, layout preference, or aesthetic quality unless there is a concrete visible risk that could affect print, production, launch, listing, customer understanding, or readability.

Audit only these issue categories:
- Text Errors: Typo / misspelling, Grammar error, Missing word, Duplicate word, Incorrect spacing, Incorrect line break, Wrong product name, Wrong variant / flavor / shade, Wrong size / unit, Inconsistent number, Placeholder text, Internal note left in design, Wrong URL / handle / contact, QR instruction mismatch, Date / promotion typo, Language inconsistency error, Claim wording typo, or copy errors that should be checked before production/listing.
- Hierarchy: Product identity is hard to identify, Product type is unclear, Variant/flavor/shade/formula/size/ or quantity may be confused, Size/unit/price/promo/deadline/ or offer condition is hard to locate, CTA/QR instruction/ or customer instruction may be missed, an exact visible benefit claim or likely selling keyword is present but is not prominent enough within its local panel/frame, or two visible information elements may cause practical confusion. This is not design hierarchy, general text-size checking, or aesthetic critique.
- Readability: Low contrast or blurry text that is physically unreadable, curved/distorted text hard to read, QR/barcode low contrast or visually risky, low-resolution or pixelated product illustration/detail, visible watermark/stock-preview/designer-preview mark, text over busy image that is physically unreadable, or transparent/outlined text risk. Do not flag text only because it is small.

Boundaries:
- Do not provide legal advice.
- Do not provide FDA, Thai FDA, regulatory, food-safety, medical, or compliance approval.
- Do not provide print-ready certification, prepress approval, dieline approval, or manufacturing approval.
- Do not guarantee sales performance.
- Do not suggest broad redesigns, new art direction, new brand style, new visual concepts, or subjective design improvements.
- Do not say the design is not beautiful, not premium enough, not modern enough, or not on-brand unless a specific visible element creates a concrete pre-flight risk.
- Only flag concrete visible risks that matter before print, production, launch, or listing.
- Analyze only for the selected product category. Do not judge the artwork using standards from another category.
- Return customer-facing text only in the selected report language.
- When quoting visible artwork text, preserve the exact visible wording even if it is in another language.
- If the selected report language is English, every customer-facing explanation must be English prose. Thai text is allowed only when it is an exact quote from the artwork.
- Return only structured JSON matching the schema.`;

const allowedImageDetails = new Set(["auto", "low", "high"]);
const allowedServiceTiers = new Set(["auto", "default", "flex", "scale", "priority"]);
const requiredLiveModel = "gpt-5.4-mini";

function buildUserPrompt(scan) {
  const optional = (value) => value || "Not provided";

  const category = formatProductCategory(scan.product_category);
  const language = scan.language === "english" ? "English" : "Thai";

  return `Audit this artwork as a Slaply pre-flight audit.

Context:
- Product category: ${category}
- Sales channel: ${optional(scan.sales_channel)}
- Target customer: ${optional(scan.target_customer)}
- Price tier: ${optional(scan.price_tier)}
- Main concern: ${optional(scan.main_concern)}
- Launch stage: ${optional(scan.launch_stage)}
- Report language: ${language}

Audit scope:
- This is a pre-flight audit before print, production, launch, or marketplace listing.
- The design may already be approved. Do not re-audit approved design decisions.
- Only flag concrete visible risks that could matter before print, production, launch, or listing.
- Do not critique the artwork as a designer. Do not judge taste, beauty, brand style, mood, art direction, or overall design quality.
- If an issue is only a subjective design preference, omit it.
- If the recommendation would require a broad redesign without a specific visible pre-flight risk, omit it.
- Every issue must answer: what could go wrong if this is printed, produced, launched, or listed without checking?

Allowed issue types:
- Text Errors
- Hierarchy
- Readability

Out-of-scope examples:
- Do not say the layout is not beautiful enough.
- Do not say the brand should look more premium unless a specific visible element creates a concrete trust, readability, or listing risk.
- Do not recommend changing the font, color palette, illustration style, photography style, or brand mood unless it directly affects readability, misunderstanding, or a pre-flight risk.
- Do not suggest a new headline, new campaign idea, new brand positioning, or new copy direction unless correcting a visible text error.
- Do not provide compliance, FDA, Thai FDA, legal, food-safety, medical, prepress, print-ready, or manufacturing approval.
- Do not use phrases such as "ควรออกแบบใหม่", "layout ยังไม่ดีพอ", "ควรทำให้ดู premium ขึ้น", "ควรเปลี่ยนภาพหลัก", "องค์ประกอบดูไม่สมดุล", or equivalent design-critique language.

Category guardrails:
- Treat "${category}" as the only category for this audit.
- Do not audit the artwork using standards from another product category.
- If the selected category is "Beauty / Skincare", focus only on pre-flight risks such as visible text errors, product/variant/benefit clarity, important claim or selling-keyword visibility, ingredient/result-proof clarity if visible, trust cue visibility, watermarks, and low-resolution product illustration details. Do not judge whether the beauty design style is attractive or premium enough.
- If the selected category is "Supplement / Wellness", focus only on pre-flight risks such as use-case clarity, product/variant clarity, dosage/unit/quantity clarity if visible, trust cue visibility, watermarks, low-resolution product illustration details, and customer understanding. Do not provide medical, FDA, Thai FDA, regulatory, or health-claim approval.
- If the selected category is "Food / Snack / Pet", focus only on pre-flight risks such as product type clarity, flavor/variant clarity, size/unit clarity, date/offer clarity if visible, appetite-related communication clarity, watermarks, and low-resolution product illustration details. Do not provide food-safety or regulatory approval.
- If the selected category is "Ads / Promotion", audit it only as a pre-launch or listing communication asset. Focus on visible text errors, offer/price/date/CTA clarity, hierarchy of purchase-critical information, watermarks, QR/barcode risk if present, and low-resolution product illustration or image details. Do not judge the creative concept, visual taste, or campaign strategy.

Dieline and panel context:
- If the artwork is a dieline, unfolded carton, label layout, or packaging net, do not flag text or logos as upside down, rotated, mirrored, or reversed solely because one unfolded panel appears inverted. Some panels are intentionally rotated so they read correctly after folding or assembly.
- Only report orientation as an issue when the exact final-facing panel is clearly wrong after considering the fold/assembly context. If uncertain, omit the orientation issue.
- Do not flag text size as an issue by default. Routine small copy, body copy, ingredient lists, directions, manufacturer/distributor information, warnings, legal/support copy, and similar back-panel product information should be omitted when the only concern is that the text is small, dense, or somewhat hard to read.
- The only text-size/prominence exception is a Hierarchy issue for an exact visible benefit claim or likely selling keyword that should help sell the product but is not prominent enough within its own local panel, frame, label area, or badge. Compare only against that local area, not the full unfolded artwork.
- Do not classify small text as Readability. If the concern is only "this text is small", omit it unless it matches the claim/selling-keyword Hierarchy exception or is an actual visible Text Error.
- Do not provide print-ready certification, dieline approval, cutter guide approval, or manufacturing approval.

Language guardrails:
- All customer-facing fields must be written in ${language}.
- Customer-facing fields include summary, issues[].title, issues[].why_it_matters, issues[].recommendation, conversion_recommendations, priority_fixes, next_steps, and paid_report_content.
- When identifying visible text, quote the exact text as it appears in the artwork, even if it is in another language.
- If ${language} is English, write all explanatory prose in English. Do not use Thai explanation phrases such as "ควรตรวจยืนยัน", "ก่อนผลิต", or "อาจมองไม่เห็น" unless those words are exact visible artwork text being quoted.
- If ${language} is Thai, write all explanatory prose in Thai. English words may appear only for exact visible artwork text, standard product/category terms, or unavoidable proper nouns.
- Do not mix Thai and English in explanatory prose unless quoting exact visible artwork text.

Issue taxonomy and counts:
- Classify every issue as exactly one issue_type: "Text Errors", "Hierarchy", or "Readability".
- "Text Errors" means visible typo, misspelling, incorrect spacing, missing word, duplicate word, grammar issue, wording issue, sentence issue, wrong unit, inconsistent number, inconsistent product name, inconsistent variant, wrong date, wrong URL/contact/handle, placeholder text, or internal note left in the artwork.
- "Hierarchy" means production, launch, or listing information risk - not design critique. Only classify an issue as "Hierarchy" when a specific visible element may cause customers, production teams, or listing viewers to miss or misunderstand purchase-critical information before print, production, launch, or marketplace listing. Hierarchy issues are limited to: product identity is hard to identify; product type is unclear; variant, flavor, shade, formula, size, pack size, unit, price, promo, deadline, or offer condition may be missed or confused; CTA, QR instruction, scan instruction, or customer instruction may be missed; an exact visible benefit claim or likely selling keyword is present but not prominent enough within its local panel/frame; or two visible information elements may cause practical confusion, such as two variants, two sizes, two offers, or mismatched labels.
- Use "claim" only when there is an exact visible claim word or claim sentence in the artwork.
- "Readability" means a visible non-size readability or production-visibility risk such as text/number/label physically unreadable because of blur, low contrast, distortion, or busy image; QR/barcode area visually risky; product illustration/graphic detail visibly low-resolution or pixelated enough that it may print broken; or visible watermark/stock-preview/designer-preview mark. Readability must not include text size or routine small body copy.
- Do not classify general composition, image choice, brand mood, typography taste, color taste, or visual concept issues as Readability. If they create a concrete misunderstanding risk, classify as Hierarchy. If they are only subjective design preference, omit them.
- issue_counts.text_errors must equal the number of issues with issue_type "Text Errors".
- issue_counts.hierarchy must equal the number of issues with issue_type "Hierarchy".
- issue_counts.readability must equal the number of issues with issue_type "Readability".
- If no issues are found for a type, set that count to 0.
- Sort issues in this order: all Text Errors first, then Hierarchy, then Readability.
- Assign sequential id values starting from 1 after sorting. The id is used as the annotation number on the image and the report item number.
- Each issue must describe one concrete visible mistake or risk. Do not combine multiple unrelated locations into one issue.
- Only include an issue if you can point to one exact visible anchor in the artwork, such as a specific word, number, logo, icon, badge, product photo, variant label, offer, date, QR/barcode area, watermark, pixelated illustration detail, or visual group.
- If a broad concern cannot be anchored to a specific visible element or visible group, omit it.

Text Errors rules:
- Only flag actual visible text errors or inconsistencies. Do not rewrite copy for style, persuasion, tone, or conversion.
- For Text Errors, the recommendation must start by repeating the exact wrong word, misspelling, spacing issue, sentence problem, inconsistent number, wrong unit, or placeholder visible in the artwork, then provide exactly one corrected wording option or checking instruction.
- If the visible wording may be intentional and cannot be confirmed as an error, use cautious wording in the selected report language. For English reports, use wording like "Check before production whether...". For Thai reports, wording like "ควรตรวจยืนยัน..." is acceptable.

Hierarchy rules:
- Treat "Hierarchy" as production/listing information risk, not design hierarchy.
- Only flag Hierarchy when a specific visible element may cause customers, production teams, or listing viewers to miss or misunderstand purchase-critical information before print, production, launch, or marketplace listing.
- Hierarchy issues are limited to:
  - product identity is hard to identify
  - product type is unclear
  - product name, formula, flavor, shade, variant, size, quantity, pack size, unit, price, promo, deadline, or offer condition may be missed or confused
  - CTA, QR instruction, scan instruction, or customer instruction may be missed
  - an exact visible benefit claim or likely selling keyword is present but is not prominent enough within its local panel, frame, label area, or badge
  - two visible information elements may cause practical confusion, such as two variants, two sizes, two offers, or mismatched labels
- Do not use Hierarchy for subjective design feedback.
- Do not comment on whether the layout is beautiful, premium, balanced, modern, stylish, or on-brand.
- Do not suggest broad redesign, new art direction, new composition, new style, new image choice, or brand improvement.
- Do not say a design element should be more prominent unless the issue creates a concrete production, launch, listing, or customer-understanding risk.
- If the comment would reopen approved design direction rather than prevent a pre-flight mistake, omit it.
- Do not create a Hierarchy issue only because text is small. The only text-size/prominence exception is an exact visible benefit claim or likely selling keyword that should help sell the product but is not prominent enough inside its own local panel, frame, label area, or badge. If it is routine body copy, ingredient/direction/legal/support copy, or a non-selling detail, omit it.
- For claim/selling-keyword Hierarchy issues, name the exact claim or keyword, explain why that visible selling point may be missed in the final product, and recommend a narrow prominence check rather than a redesign.
- Do not create an issue only because something might be missed in a thumbnail, listing preview, marketplace preview, or mobile preview. Audit the submitted artwork itself, not a hypothetical reduced preview.
- Each Hierarchy issue must name the exact visible element that creates the risk, explain what may be missed or misunderstood, explain why it matters before print, production, launch, or listing, and recommend a narrow verification or adjustment rather than a redesign.
- Use cautious wording such as "ควรตรวจยืนยันก่อนผลิตว่า...", "อาจมองไม่เห็นในงานจริง...", "อาจทำให้ลูกค้าเข้าใจ variant ผิด...", "อาจทำให้ข้อมูลขนาดสินค้าไม่ถูกเห็นก่อนซื้อ...", or "อาจทำให้ offer condition มองไม่เห็น..." when the report language is Thai.
- When writing Thai report text, use "อาจมองไม่เห็น" for visibility risks. Avoid Thai wording equivalent to "may be overlooked".

Readability rules:
- Do not discuss text size, small text, body copy size, or 2 mm thresholds in Readability issues.
- Only discuss non-size readability or production risks: visible watermark, QR/barcode risk, physically unreadable text caused by blur/low contrast/distortion/busy image, or low-resolution/pixelated product illustration and graphic detail that may print broken.
- For product illustrations, icons, decorative scenes, mascots, product-use images, or other graphic details, flag only when the local area is visibly low-pixel, jagged, blocky, compressed, or blurry enough that printing may make it look broken. Do not critique illustration style or art direction.
- Always inspect for watermarks, including faint repeated marks, pale gray repeated patterns, low-opacity logo/text overlays, stock-preview marks, designer-preview marks, and diagonal or background watermark patterns floating above the artwork. Look across blank areas and behind panels for repeated semi-transparent symbols or words. If any production-visible watermark is present, create a Readability issue even if the rest of the artwork is readable, and place the annotation directly on the clearest watermark instance.
- If the issue is an unclear image, broad visual concept, or aesthetic concern, do not classify it as Readability. Classify it as Hierarchy only if it creates a concrete misunderstanding risk; otherwise omit it.

Annotation location:
- For every issue, set location.x and location.y to the center of the exact visible area where the mistake appears inside the artwork image, normalized from 0 to 1 within the visible artwork boundaries.
- The annotation marker must sit directly on top of the problem, not beside it. Center the marker over the exact word, number, logo, icon, watermark, image detail, panel, frame, QR/barcode area, or design element being discussed.
- If the issue is about a word, line, number, logo, QR/barcode area, watermark, or pixelated illustration detail, point to that exact target, not the center of the whole panel.
- If the issue is about a visible number, price, percentage, date, size, unit, quantity, or measurement, place the annotation marker directly on top of that exact number or value.
- If the issue title, detail, or recommendation quotes or references any exact word, letter, text string, number, date, unit, price, percentage, or claim in the artwork, place the annotation marker directly on top of that exact quoted/referenced text.
- If the issue is about a visual group rather than one word, point to the most representative visible part of that group that proves the issue.
- Do not point to dimensions, dieline measurements, rulers, or production marks unless the issue specifically mentions that dimension, measurement, ruler, or production mark.
- Do not invent a location outside the actual visible artwork. The annotation must land on the visible mistake or its closest visible element.
- Never place an annotation on blank background, empty margin, whitespace, or the surrounding page/card area.
- Before returning JSON, verify each annotation number against its report item. A user should be able to look at marker 1 and understand issue 1 without guessing. If the marker would not visually explain that exact item, revise the location or remove the issue.

Severity labels:
- Use High for a visible issue that may cause customer misunderstanding, wrong purchase expectations, wrong variant/quantity/unit interpretation, a major unreadable purchase-critical detail, visible watermark/mockup mark, or a serious risk before production/listing.
- Use Medium for a visible issue that affects clarity, trust, readability, or listing confidence but does not directly change the main communication.
- Use Low for a small pre-flight check or polish issue that is useful to review but not required to fix before production/listing.
- Do not use any other severity label.

Scoring:
- Score as a pre-flight confidence score, not a design-quality score.
- Penalize only concrete visible risks related to Text Errors, Hierarchy, or Readability before print, production, launch, or listing.
- Do not lower the score because the style is not your personal preference.
- Do not inflate or deflate the score based on subjective beauty, brand taste, or premium impression unless tied to a concrete visible risk within the allowed issue types.
- If the artwork has no concrete visible pre-flight risks, the score should be high even if you would personally design it differently.

Recommendation tone:
- Use cautious, production-safe wording.
- For English reports, prefer phrases like "Check before production...", "May be hard to read in the final artwork...", or "Review before listing...".
- For Thai reports, prefer phrases like "ควรตรวจยืนยันก่อนผลิต", "อาจอ่านยากในงานจริง", or "ควรเช็กก่อนขึ้น listing".
- Avoid phrases like "ควรออกแบบใหม่", "ดีไซน์ยังไม่ดีพอ", "layout ไม่สวย", "brand ดูไม่ premium", or broad redesign language.

Output:
- Return only structured JSON matching the schema.
- Do not add fields that are not in the schema.
- Use the schema's summary, recommendation, priority, next-step, or equivalent fields to provide concise pre-flight guidance.
- Keep every customer-facing field concise. Prefer one short sentence for summary, why_it_matters, recommendation, conversion recommendation details, priority reasons, next steps, paid report section body, and handoff note.
- Do not add explanatory filler, broad strategy, or long paragraph-style report writing.
- Do not include broad conversion strategy, sample report copy, or redesign recommendations unless the schema explicitly supports them and they are tied to a concrete pre-flight risk.`;
}

function getLiveModel() {
  return requiredLiveModel;
}

function getOpenAiClient() {
  const options = { apiKey: process.env.OPENAI_API_KEY };

  if (process.env.OPENAI_BASE_URL) {
    options.baseURL = process.env.OPENAI_BASE_URL;
  }

  return new OpenAI(options);
}

function getOpenAiImageDetail() {
  const detail = process.env.OPENAI_IMAGE_DETAIL || "auto";
  return allowedImageDetails.has(detail) ? detail : "auto";
}

function getOpenAiRequestOptions(model) {
  const options = {};
  const maxCompletionTokens = Number(process.env.OPENAI_MAX_COMPLETION_TOKENS || 0);
  const serviceTier = process.env.OPENAI_SERVICE_TIER;

  if (Number.isFinite(maxCompletionTokens) && maxCompletionTokens > 0) {
    options.max_completion_tokens = Math.floor(maxCompletionTokens);
  }

  if (allowedServiceTiers.has(serviceTier)) {
    options.service_tier = serviceTier;
  }

  if (/^gpt-5/i.test(model)) {
    options.reasoning_effort = process.env.OPENAI_REASONING_EFFORT || "low";
    options.verbosity = process.env.OPENAI_VERBOSITY || "low";
  }

  return options;
}

function estimateAiCostUsd(usage) {
  if (!usage) return null;

  const inputRate = Number(process.env.OPENAI_INPUT_COST_PER_MILLION_TOKENS || 0);
  const outputRate = Number(process.env.OPENAI_OUTPUT_COST_PER_MILLION_TOKENS || 0);

  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate) || (inputRate <= 0 && outputRate <= 0)) {
    return null;
  }

  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  return Number((((inputTokens * inputRate) + (outputTokens * outputRate)) / 1_000_000).toFixed(8));
}

function normalizeAuditResult(result) {
  const issues = sortIssuesForReport(result.issues || []).map((issue, index) => ({
    ...issue,
    id: index + 1,
    issue_type: inferIssueType(issue)
  }));

  return {
    ...result,
    issues,
    issue_counts: getIssueCounts({ issues })
  };
}

function wantsHtmlRedirect(request) {
  return request.headers.get("accept")?.includes("text/html");
}

function redirectToReport(request, scanId, params = {}) {
  const url = new URL(`/scan/${scanId}`, request.url);

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url, { status: 303 });
}

function sanitizeAiErrorMessage(message) {
  if (/incorrect api key|api key provided|401/i.test(message)) {
    return "OpenAI authentication failed. Check OPENAI_API_KEY.";
  }

  return message.replace(/sk-[A-Za-z0-9_*.-]+/g, "[redacted OpenAI key]");
}

export async function POST(request) {
  let scanId;
  const shouldRedirect = wantsHtmlRedirect(request);

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      scanId = formData.get("scan_id");
    } else {
      const body = await request.json();
      scanId = body.scan_id;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!scanId) {
    return NextResponse.json({ ok: false, error: "Missing scan_id." }, { status: 400 });
  }

  if (!isCloudflareDataEnabled()) {
    return NextResponse.json({ ok: false, error: "Cloudflare scan backend is not enabled." }, { status: 500 });
  }

  const store = await getCloudflareDataStore();
  const useMock = isMockAiScanEnabled();
  const model = useMock ? mockAiModel : getLiveModel();
  const scan = await store.getScan(scanId);
  const startedAt = Date.now();

  if (!scan) {
    return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });
  }

  await store.markScanScanning(scanId);
  await store.insertEvent({
    scan_id: scanId,
    customer_email: scan.customer_email,
    event_name: "scan_started",
    event_data: { model, mock: useMock }
  });

  try {
    if (useMock) {
      const validated = auditResultSchema.parse(buildMockAuditResult(scan));
      await store.markScanPreviewReady(scanId, {
        model,
        rawOutput: {
          mock: true,
          reason: process.env.MOCK_AI_SCAN === "true" ? "MOCK_AI_SCAN=true" : "OPENAI_API_KEY missing"
        },
        validated
      });
      await store.insertScanCost({
        scanId,
        model,
        inputTokens: 0,
        outputTokens: 0,
        estimatedAiCostUsd: 0,
        processingTimeMs: Date.now() - startedAt
      });
      await store.insertEvent({
        scan_id: scanId,
        customer_email: scan.customer_email,
        event_name: "scan_completed",
        event_data: {
          model,
          mock: true,
          overall_score: validated.overall_score,
          readiness_level: validated.readiness_level
        }
      });

      if (shouldRedirect) {
        return redirectToReport(request, scanId, { scanned: "1" });
      }

      return NextResponse.json({ ok: true, mock: true, scan_id: scanId, result: validated });
    }

    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY.");
    }

    const imageDataUrl = await store.getScanImageDataUrl(scan);
    const openai = getOpenAiClient();
    const imageDetail = getOpenAiImageDetail();

    const response = await openai.chat.completions.create({
      model,
      ...getOpenAiRequestOptions(model),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "slaply_packaging_audit",
          strict: true,
          schema: auditJsonSchema
        }
      },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: buildUserPrompt(scan) },
            { type: "image_url", image_url: { url: imageDataUrl, detail: imageDetail } }
          ]
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    const parsedJson = JSON.parse(content);
    const validated = auditResultSchema.parse(normalizeAuditResult(parsedJson));
    const usage = response.usage || {};

    await store.markScanPreviewReady(scanId, { model, rawOutput: response, validated });
    await store.insertScanCost({
      scanId,
      model,
      inputTokens: usage.prompt_tokens || null,
      outputTokens: usage.completion_tokens || null,
      estimatedAiCostUsd: estimateAiCostUsd(usage),
      processingTimeMs: Date.now() - startedAt
    });
    await store.insertEvent({
      scan_id: scanId,
      customer_email: scan.customer_email,
      event_name: "scan_completed",
      event_data: {
        model,
        overall_score: validated.overall_score,
        readiness_level: validated.readiness_level
      }
    });

    if (shouldRedirect) {
      return redirectToReport(request, scanId, { scanned: "1" });
    }

    return NextResponse.json({ ok: true, scan_id: scanId, result: validated });
  } catch (error) {
    const message = sanitizeAiErrorMessage(error instanceof Error ? error.message : "AI scan failed.");

    await store.markScanFailed(scanId, message);
    await store.insertScanCost({
      scanId,
      model,
      processingTimeMs: Date.now() - startedAt,
      errorReason: message
    });
    await store.insertEvent({
      scan_id: scanId,
      customer_email: scan.customer_email,
      event_name: "scan_failed",
      event_data: { model, message }
    });

    if (shouldRedirect) {
      return redirectToReport(request, scanId, { error: message });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
