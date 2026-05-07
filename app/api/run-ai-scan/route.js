import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auditJsonSchema, auditResultSchema } from "../../../lib/ai-audit-schema";
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
- Only provide visual communication and packaging readiness feedback.
- Return customer-facing text in Thai by default unless the scan language is English.
- Return only structured JSON matching the schema.`;

function buildUserPrompt(scan) {
  return `Audit this packaging artwork.

Context:
- Product category: ${scan.product_category}
- Sales channel: ${scan.sales_channel}
- Target customer: ${scan.target_customer}
- Price tier: ${scan.price_tier}
- Main concern: ${scan.main_concern}
- Launch stage: ${scan.launch_stage}
- Report language: ${scan.language}

Score honestly. Prioritize issues that can affect commercial visual communication before production or launch.`;
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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY." }, { status: 500 });
  }

  const supabase = getSupabaseServerClient();
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

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
    event_data: { model }
  });

  try {
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
    const validated = auditResultSchema.parse(parsedJson);

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
