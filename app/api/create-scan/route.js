import { NextResponse } from "next/server";
import { getStorageBucket, getSupabaseServerClient } from "../../../lib/supabase-server";
import { scanContextSchema, validateUploadFile } from "../../../lib/scan-validation";

export const runtime = "nodejs";

function redirectToScan(request, error) {
  const url = new URL("/scan", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

function safeFileName(name) {
  const fallback = "artwork";
  return (name || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || fallback;
}

export async function POST(request) {
  let formData;

  try {
    formData = await request.formData();
  } catch {
    return redirectToScan(request, "Could not read the submitted form.");
  }

  const image = formData.get("image");
  const uploadError = validateUploadFile(image);

  if (uploadError) {
    return redirectToScan(request, uploadError);
  }

  const parsed = scanContextSchema.safeParse({
    email: formData.get("email"),
    product_category: formData.get("product_category"),
    sales_channel: formData.get("sales_channel"),
    target_customer: formData.get("target_customer"),
    price_tier: formData.get("price_tier"),
    main_concern: formData.get("main_concern"),
    launch_stage: formData.get("launch_stage"),
    language: formData.get("language"),
    consent: formData.get("consent")
  });

  if (!parsed.success) {
    return redirectToScan(request, "Please complete all required scan details.");
  }

  const scanId = crypto.randomUUID();
  const bucket = getStorageBucket();
  const supabase = getSupabaseServerClient();
  const context = parsed.data;
  const extension = image.type === "image/png" ? "png" : "jpg";
  const storagePath = `${scanId}/${Date.now()}-${safeFileName(image.name)}.${extension}`;
  const fileBuffer = await image.arrayBuffer();

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  const { error: uploadSupabaseError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: image.type,
      upsert: false
    });

  if (uploadSupabaseError) {
    return redirectToScan(request, "Upload failed. Please try again with a JPG or PNG image.");
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      email: context.email,
      country: "TH"
    })
    .select("id")
    .single();

  if (customerError) {
    return redirectToScan(request, "Could not create customer record.");
  }

  const { error: scanError } = await supabase.from("scans").insert({
    id: scanId,
    customer_id: customer.id,
    customer_email: context.email,
    image_url: publicUrlData.publicUrl,
    image_storage_path: storagePath,
    product_category: context.product_category,
    sales_channel: context.sales_channel,
    target_customer: context.target_customer,
    price_tier: context.price_tier,
    main_concern: context.main_concern,
    launch_stage: context.launch_stage,
    language: context.language,
    scan_status: "uploaded",
    payment_status: "unpaid"
  });

  if (scanError) {
    return redirectToScan(request, "Could not create scan record.");
  }

  await supabase.from("events").insert([
    {
      scan_id: scanId,
      customer_email: context.email,
      event_name: "image_uploaded",
      event_data: { file_type: image.type, file_size: image.size }
    },
    {
      scan_id: scanId,
      customer_email: context.email,
      event_name: "form_completed",
      event_data: {
        product_category: context.product_category,
        sales_channel: context.sales_channel,
        language: context.language
      }
    }
  ]);

  const redirectUrl = new URL(`/scan/${scanId}`, request.url);
  redirectUrl.searchParams.set("created", "1");
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
