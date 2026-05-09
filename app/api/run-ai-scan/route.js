import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getIssueCounts, inferIssueType, sortIssuesForReport } from "../../../lib/audit-issue-utils";
import { auditJsonSchema, auditResultSchema } from "../../../lib/ai-audit-schema";
import { buildMockAuditResult, isMockAiScanEnabled, mockAiModel } from "../../../lib/mock-ai-scan";
import { formatProductCategory } from "../../../lib/scan-form-options";
import { getStorageBucket, getSupabaseServerClient } from "../../../lib/supabase-server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are Slaply, an AI packaging visual audit assistant.
Analyze the front image of a product package and evaluate its commercial visual communication quality.
Assess message clarity, visual hierarchy, readability, trust signal, premium perception, marketplace or shelf readiness, and pre-production visual risk.

Boundaries:
- Do not provide legal advice.
- Do not provide FDA, Thai FDA, regulatory, or compliance approval.
- Do not provide print-ready certification.
- Do not guarantee sales performance.
- Only provide visual communication and packaging or promotion readiness feedback.
- Analyze only for the selected product category. Do not judge the artwork using standards from another category.
- Return customer-facing text only in the selected report language.
- Return only structured JSON matching the schema.`;

function buildUserPrompt(scan) {
  const optional = (value) => value || "Not provided";

  const category = formatProductCategory(scan.product_category);
  const language = scan.language === "english" ? "English" : "Thai";

  return `Audit this artwork.

Context:
- Product category: ${category}
- Sales channel: ${optional(scan.sales_channel)}
- Target customer: ${optional(scan.target_customer)}
- Price tier: ${optional(scan.price_tier)}
- Main concern: ${optional(scan.main_concern)}
- Launch stage: ${optional(scan.launch_stage)}
- Report language: ${language}

Category guardrails:
- Treat "${category}" as the only category for this audit.
- If the selected category is "Beauty / Skincare", focus on beauty/skincare packaging communication such as benefit clarity, trust cues, ingredient/result proof, premium perception, and shelf/marketplace readability.
- If the selected category is "Supplement / Wellness", focus on supplement/wellness packaging communication such as use-case clarity, hierarchy, trust cues, readability, and customer confidence. Do not provide medical, FDA, Thai FDA, or regulatory approval.
- If the selected category is "Food / Snack / Pet", focus on food/snack/pet packaging communication such as product type, appetite appeal, hierarchy, readability, and trust cues. Do not provide food-safety or regulatory approval.
- If the selected category is "Ads / Promotion", audit it as ad/promotion creative, not as packaging. Focus on offer clarity, visual hierarchy, CTA/readability, trust cues, and promotion readiness.

Dieline and panel context:
- If the artwork is a dieline, unfolded carton, label layout, or packaging net, do not flag text or logos as upside down, rotated, mirrored, or reversed solely because one unfolded panel appears inverted. Some panels are intentionally rotated so they read correctly after folding or assembly.
- Only report orientation as an issue when the exact final-facing panel is clearly wrong after considering the fold/assembly context. If uncertain, omit the orientation issue.
- When judging whether a logo, text block, badge, icon, or product name is too small or too large, compare it against the specific panel, frame, label area, or local bounding area where it sits. Do not compare it against the entire unfolded artwork unless the element is meant to serve the entire artwork.

Language guardrails:
- All customer-facing fields must be written in ${language}.
- Do not mix Thai and English in report prose unless the visible artwork text itself is being quoted.

Issue taxonomy and counts:
- Classify every issue as exactly one issue_type: "Text Errors", "Hierarchy", or "Readability".
- "Text Errors" means visible typo, misspelling, incorrect spacing, grammar, wording, sentence, or copy error.
- "Hierarchy" means weak visual priority, unclear main message, competing focal points, missing emphasis, weak trust cue placement, unclear composition, confusing image choice, CTA/offer hierarchy, or poor design hierarchy.
- "Readability" means visible text, number, date, label, small detail, or a visible watermark/stock-preview/designer-preview mark is physically hard to read, easy to miss, or unsafe for production because of size, contrast, spacing, crowding, blur, low resolution, or watermark presence. Do not classify general composition, image choice, or visual concept issues as Readability; those belong in Hierarchy.
- issue_counts.text_errors must equal the number of issues with issue_type "Text Errors".
- issue_counts.hierarchy must equal the number of issues with issue_type "Hierarchy".
- issue_counts.readability must equal the number of issues with issue_type "Readability".
- If no issues are found for a type, set that count to 0.
- Sort issues in this order: all Text Errors first, then Hierarchy, then Readability.
- Assign sequential id values starting from 1 after sorting. The id is used as the annotation number on the image and the report item number.
- Each issue must describe one concrete visible mistake or risk. Do not combine multiple unrelated locations into one issue.
- Only include an issue if you can point to one exact visible anchor in the artwork. If the problem is too broad to mark on a specific word, number, logo, icon, badge, product photo, offer, or visual area, omit it.
- For Text Errors, the recommendation must start by repeating the exact wrong word, misspelling, spacing issue, or sentence problem visible in the artwork, then provide exactly one corrected wording option.
- For Hierarchy and Readability, the title and recommendation must name the exact visible element to change, such as the specific word, number, offer, product image, icon, badge, date, logo, CTA, or visual area. Do not use vague phrases such as "secondary text", "main image", "headline", or "supporting details" unless you also identify the exact visible content.
- For Readability, only discuss what is hard to read. If the problem is an unclear image, visual composition, or message priority, classify it as Hierarchy instead.
- Always inspect for watermarks, including faint repeated marks, low-opacity logo/text overlays, stock-preview marks, designer-preview marks, and diagonal or background watermark patterns. If any production-visible watermark is present, create a Readability issue even if the rest of the artwork is readable, and place the annotation directly on the clearest watermark instance.

Annotation location:
- For every issue, set location.x and location.y to the center of the exact visible area where the mistake appears inside the artwork image, normalized from 0 to 1 within the visible artwork boundaries.
- The annotation marker must sit directly on top of the problem, not beside it. Center the marker over the exact word, number, logo, icon, watermark, image detail, panel, frame, or design element being discussed.
- If the issue is about a small word, line, number, logo, or watermark, point to that exact small target, not the center of the whole panel.
- If the issue is about a visual group rather than one word, point to the most representative visible part of that group that proves the issue.
- Do not point to dimensions, dieline measurements, rulers, or production marks unless the issue specifically mentions that dimension, measurement, ruler, or production mark.
- Do not invent a location outside the actual visible artwork. The annotation must land on the visible mistake or its closest visible element.
- Never place an annotation on blank background, empty margin, whitespace, or the surrounding page/card area.
- Before returning JSON, verify each annotation number against its report item. A user should be able to look at marker 1 and understand issue 1 without guessing. If the marker would not visually explain that exact item, revise the location or remove the issue.

Severity labels:
- Use High for a problem that may affect understanding, trust, or cause the communication to be misunderstood.
- Use Medium for a problem that affects clarity or trust but does not change the main communication.
- Use Low for a small polish recommendation that is useful to review but not required to fix.
- Do not use any other severity label.

Score honestly. Prioritize issues that can affect commercial visual communication before production or launch.
Include paid-report-ready conversion recommendations, priority fixes, and concise sample report content.`;
}

function getLiveModel() {
  return process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
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

async function loadImageDataUrl(supabase, scan) {
  if (!scan.image_storage_path) {
    throw new Error("Scan is missing image_storage_path.");
  }

  const { data, error } = await supabase.storage
    .from(getStorageBucket())
    .download(scan.image_storage_path);

  if (error || !data) {
    throw new Error("Could not download scan image.");
  }

  const arrayBuffer = await data.arrayBuffer();
  const mimeType = data.type || (scan.image_storage_path.endsWith(".png") ? "image/png" : "image/jpeg");
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
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

  const supabase = getSupabaseServerClient();
  const useMock = isMockAiScanEnabled();
  const model = useMock ? mockAiModel : getLiveModel();

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .single();

  if (scanError || !scan) {
    return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });
  }

  await supabase
    .from("scans")
    .update({ scan_status: "scanning", error_message: null })
    .eq("id", scanId);

  await supabase.from("events").insert({
    scan_id: scanId,
    customer_email: scan.customer_email,
    event_name: "scan_started",
    event_data: { model, mock: useMock }
  });

  try {
    if (useMock) {
      const validated = auditResultSchema.parse(buildMockAuditResult(scan));

      await supabase
        .from("scans")
        .update({
          scan_status: "preview_ready",
          ai_model: model,
          ai_raw_output: {
            mock: true,
            reason: process.env.MOCK_AI_SCAN === "true" ? "MOCK_AI_SCAN=true" : "OPENAI_API_KEY missing"
          },
          ai_validated_output: validated,
          overall_score: validated.overall_score,
          readiness_level: validated.readiness_level,
          error_message: null
        })
        .eq("id", scanId);

      await supabase.from("events").insert({
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

    const imageDataUrl = await loadImageDataUrl(supabase, scan);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model,
      temperature: 0.2,
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
            { type: "image_url", image_url: { url: imageDataUrl } }
          ]
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    const parsedJson = JSON.parse(content);
    const validated = auditResultSchema.parse(normalizeAuditResult(parsedJson));

    await supabase
      .from("scans")
      .update({
        scan_status: "preview_ready",
        ai_model: model,
        ai_raw_output: response,
        ai_validated_output: validated,
        overall_score: validated.overall_score,
        readiness_level: validated.readiness_level,
        error_message: null
      })
      .eq("id", scanId);

    await supabase.from("events").insert({
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
    const message = error instanceof Error ? error.message : "AI scan failed.";

    await supabase
      .from("scans")
      .update({
        scan_status: "failed",
        error_message: message
      })
      .eq("id", scanId);

    await supabase.from("events").insert({
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
