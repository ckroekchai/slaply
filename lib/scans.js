import { getStorageBucket, getSupabaseServerClient } from "./supabase-server";

export async function getScanById(scanId) {
  const supabase = getSupabaseServerClient();

  const { data: scan, error } = await supabase
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .single();

  if (error || !scan) {
    return { scan: null, imageUrl: null, error };
  }

  let imageUrl = scan.image_url;

  if (scan.image_storage_path) {
    const { data } = await supabase.storage
      .from(getStorageBucket())
      .createSignedUrl(scan.image_storage_path, 60 * 60);

    if (data?.signedUrl) {
      imageUrl = data.signedUrl;
    }
  }

  return { scan, imageUrl, error: null };
}

export function getSafeScan(scan) {
  if (!scan) return null;

  const isPaid = scan.payment_status === "paid";
  const output = scan.ai_validated_output || null;
  const isMock = scan.ai_model === "mock-ai-scan-v1" || scan.ai_raw_output?.mock === true;

  return {
    id: scan.id,
    created_at: scan.created_at,
    customer_email: scan.customer_email,
    product_category: scan.product_category,
    sales_channel: scan.sales_channel,
    target_customer: scan.target_customer,
    price_tier: scan.price_tier,
    main_concern: scan.main_concern,
    launch_stage: scan.launch_stage,
    language: scan.language,
    scan_status: scan.scan_status,
    payment_status: scan.payment_status,
    is_mock: isMock,
    overall_score: scan.overall_score,
    readiness_level: scan.readiness_level,
    preview: output
      ? {
          overall_score: output.overall_score,
          readiness_level: output.readiness_level,
          summary: output.summary,
          issues: output.issues?.slice(0, 3).map((issue) => ({
            id: issue.id,
            code: issue.code,
            title: issue.title,
            severity: issue.severity,
            why_it_matters: issue.why_it_matters,
            recommendation: issue.recommendation,
            location: issue.location
          })),
          recommendations_locked: !isPaid
        }
      : null,
    full_report: isPaid ? output : null
  };
}
