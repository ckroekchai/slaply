import { NextResponse } from "next/server";
import { getCloudflareDataStore, isCloudflareDataEnabled } from "../../../lib/cloudflare-data";
import { slaplyConfig } from "../../../lib/slaply-config";

export const runtime = "nodejs";

function wantsHtmlRedirect(request) {
  return request.headers.get("accept")?.includes("text/html");
}

function redirectToAdmin(request, params = {}) {
  const url = new URL("/admin/unlock", request.url);

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request) {
  const shouldRedirect = wantsHtmlRedirect(request);
  const adminToken = process.env.ADMIN_UNLOCK_TOKEN;

  if (!adminToken) {
    const error = "ADMIN_UNLOCK_TOKEN is not configured.";
    if (shouldRedirect) return redirectToAdmin(request, { error });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  let formData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid unlock request." }, { status: 400 });
  }

  const scanId = formData.get("scan_id");
  const paymentId = formData.get("payment_id");
  const token = formData.get("token");
  const note = formData.get("note") || "Manual PromptPay verification";

  if (!scanId || token !== adminToken) {
    const error = "Invalid scan ID or admin token.";
    if (shouldRedirect) return redirectToAdmin(request, { error });
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }

  if (!isCloudflareDataEnabled()) {
    const error = "Cloudflare admin backend is not enabled.";
    if (shouldRedirect) return redirectToAdmin(request, { error });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  const store = await getCloudflareDataStore();
  const scan = await store.getScan(scanId);

  if (!scan) {
    const error = "Scan not found.";
    if (shouldRedirect) return redirectToAdmin(request, { error });
    return NextResponse.json({ ok: false, error }, { status: 404 });
  }

  const reportUrl = `${slaplyConfig.siteUrl.replace(/\/$/, "")}/scan/${scanId}`;

  await store.unlockScan({ scan, paymentId, reportUrl, note });

  if (shouldRedirect) {
    return NextResponse.redirect(new URL(`/scan/${scanId}?unlocked=1`, request.url), { status: 303 });
  }

  return NextResponse.json({ ok: true, scan_id: scanId, report_url: reportUrl });
}
