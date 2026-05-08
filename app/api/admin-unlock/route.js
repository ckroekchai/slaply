import { NextResponse } from "next/server";
import { slaplyConfig } from "../../../lib/slaply-config";
import { getSupabaseServerClient } from "../../../lib/supabase-server";

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

  const supabase = getSupabaseServerClient();
  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .select("id, customer_email")
    .eq("id", scanId)
    .single();

  if (scanError || !scan) {
    const error = "Scan not found.";
    if (shouldRedirect) return redirectToAdmin(request, { error });
    return NextResponse.json({ ok: false, error }, { status: 404 });
  }

  const reportUrl = `${slaplyConfig.siteUrl.replace(/\/$/, "")}/scan/${scanId}`;

  await supabase
    .from("scans")
    .update({
      payment_status: "paid",
      report_url: reportUrl
    })
    .eq("id", scanId);

  let paymentQuery = supabase
    .from("payments")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      raw_event: {
        method: "manual_admin_unlock",
        note
      }
    });

  paymentQuery = paymentId ? paymentQuery.eq("id", paymentId) : paymentQuery.eq("scan_id", scanId);
  await paymentQuery;

  await supabase.from("events").insert({
    scan_id: scanId,
    customer_email: scan.customer_email,
    event_name: "report_unlocked_manually",
    event_data: {
      payment_id: paymentId || null,
      note
    }
  });

  if (shouldRedirect) {
    return NextResponse.redirect(new URL(`/scan/${scanId}?unlocked=1`, request.url), { status: 303 });
  }

  return NextResponse.json({ ok: true, scan_id: scanId, report_url: reportUrl });
}
