import { NextResponse } from "next/server";
import { getCloudflareDataStore, isCloudflareDataEnabled } from "../../../lib/cloudflare-data";
import { getReportPriceThb } from "../../../lib/promptpay";

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

function isReportReady(scanStatus) {
  return scanStatus === "completed" || scanStatus === "preview_ready";
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

  if (!isCloudflareDataEnabled()) {
    return NextResponse.json({ ok: false, error: "Cloudflare payment backend is not enabled." }, { status: 500 });
  }

  const store = await getCloudflareDataStore();
  const scan = await store.getScan(scanId);

  if (!scan) {
    return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });
  }

  if (scan.payment_status === "paid") {
    if (shouldRedirect) return redirectToReport(request, scanId, { paid: "1" });
    return NextResponse.json({ ok: true, scan_id: scanId, payment_status: "paid" });
  }

  if (!isReportReady(scan.scan_status)) {
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

  let payment = await store.getPendingPayment(scanId);

  if (!payment) {
    payment = await store.createPayment({ scan, amount });
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
