import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getIssueCounts, inferIssueType, sortIssuesForReport } from "../../../lib/audit-issue-utils";
import { auditJsonSchema, auditResultSchema } from "../../../lib/ai-audit-schema";
import { getCloudflareDataStore, isCloudflareDataEnabled } from "../../../lib/cloudflare-data";
import { buildAiAuditPrompt, PROMPT_VERSION } from "../../../lib/ai-prompt-builder";
import { buildMockAuditResult, isMockAiScanEnabled, mockAiModel } from "../../../lib/mock-ai-scan";

export const runtime = "nodejs";

const allowedImageDetails = new Set(["auto", "low", "high"]);
const allowedServiceTiers = new Set(["auto", "default", "flex", "scale", "priority"]);
const requiredLiveModel = "gpt-5.4-mini";

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
  const detail = process.env.OPENAI_IMAGE_DETAIL || "high";
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
    event_data: { model, mock: useMock, prompt_version: PROMPT_VERSION }
  });

  try {
    if (useMock) {
      const validated = auditResultSchema.parse(buildMockAuditResult(scan));
      await store.markScanPreviewReady(scanId, {
        model,
        rawOutput: {
          mock: true,
          reason: process.env.MOCK_AI_SCAN === "true" ? "MOCK_AI_SCAN=true" : "OPENAI_API_KEY missing",
          prompt_version: PROMPT_VERSION
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
          prompt_version: PROMPT_VERSION,
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
    const prompt = buildAiAuditPrompt(scan);
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
        { role: "system", content: prompt.systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: prompt.userPrompt },
            { type: "image_url", image_url: { url: imageDataUrl, detail: imageDetail } }
          ]
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    const parsedJson = JSON.parse(content);
    const validated = auditResultSchema.parse(normalizeAuditResult(parsedJson));
    const usage = response.usage || {};

    await store.markScanPreviewReady(scanId, {
      model,
      rawOutput: { ...response, prompt_version: prompt.promptVersion },
      validated
    });
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
        prompt_version: prompt.promptVersion,
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
      event_data: { model, prompt_version: PROMPT_VERSION, message }
    });

    if (shouldRedirect) {
      return redirectToReport(request, scanId, { error: message });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
