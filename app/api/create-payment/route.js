import { NextResponse } from "next/server";
import { getReportPriceThb } from "../../../lib/promptpay";
import { getSupabaseServerClient } from "../../../lib/supabase-server";

export const runtime = "nodejs";

function wantsHtmlRedirect(request) {
  return request.headers.get("accept")?.includes("text/html");
}

async function readScanId(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    return formData.get("scan_id");
  }

  const body = await request.json();
  return body.scan_id;
}

function redirectToReport(request, scanId, params = {}) {
  const url = new URL(`/scan/${scanId}`, request.url);

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  url.hash = "payment";
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request) {
  const shouldRedirect = wantsHtmlRedirect(request);
  let scanId;

  try {
    scanId = await readScanId(request);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payment request." }, { status: 400 });
  }

  if (!scanId) {
    return NextResponse.json({ ok: false, error: "Missing scan_id." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .select("id, customer_email, scan_status, payment_status")
    .eq("id", scanId)
    .single();

  if (scanError || !scan) {
    return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });
  }

  if (scan.payment_status === "paid") {
    if (shouldRedirect) return redirectToReport(request, scanId, { paid: "1" });
    return NextResponse.json({ ok: true, scan_id: scanId, payment_status: "paid" });
  }

  if (scan.scan_status !== "preview_ready") {
    const error = "Please run the AI scan before unlocking the full report.";
    if (shouldRedirect) return redirectToReport(request, scanId, { error });
    return NextResponse.json({ ok: false, error }, { status: 409 });
  }

  let amount;

  try {
    amount = getReportPriceThb();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment configuration error.";
    if (shouldRedirect) return redirectToReport(request, scanId, { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const { data: existingPayment } = await supabase
    .from("payments")
    .select("*")
    .eq("scan_id", scanId)
    .eq("provider", "promptpay_qr")
    .in("payment_status", ["created", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let payment = existingPayment;

  if (!payment) {
    const { data: createdPayment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        scan_id: scanId,
        customer_email: scan.customer_email,
        provider: "promptpay_qr",
        provider_payment_id: `manual-${crypto.randomUUID()}`,
        amount,
        currency: "THB",
        payment_status: "pending",
        raw_event: {
          method: "manual_promptpay_qr"
        }
      })
      .select("*")
      .single();

    if (paymentError || !createdPayment) {
      const error = "Could not create payment request.";
      if (shouldRedirect) return redirectToReport(request, scanId, { error });
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    payment = createdPayment;

    await supabase.from("events").insert({
      scan_id: scanId,
      customer_email: scan.customer_email,
      event_name: "payment_request_created",
      event_data: {
        payment_id: payment.id,
        provider: "promptpay_qr",
        amount,
        currency: "THB"
      }
    });
  }

  if (shouldRedirect) {
    return redirectToReport(request, scanId, { payment_id: payment.id });
  }

  return NextResponse.json({
    ok: true,
    scan_id: scanId,
    payment_id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    payment_status: payment.payment_status
  });
}
