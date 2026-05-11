import { NextResponse } from "next/server";
import { getCloudflareDataStore, isCloudflareDataEnabled } from "../../../lib/cloudflare-data";
import { scanContextSchema, validateUploadFile } from "../../../lib/scan-validation";

export const runtime = "nodejs";

function redirectToScan(request, error) {
  const url = new URL("/", request.url);
  url.searchParams.set("error", error);
  url.hash = "scan";
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
    language: formData.get("language"),
    consent: formData.get("consent")
  });

  if (!parsed.success) {
    return redirectToScan(request, "Please complete all required scan details.");
  }

  const scanId = crypto.randomUUID();
  const context = parsed.data;
  const extension = image.type === "image/png" ? "png" : "jpg";
  const storagePath = `${scanId}/${Date.now()}-${safeFileName(image.name)}.${extension}`;

  if (!isCloudflareDataEnabled()) {
    return redirectToScan(request, "Cloudflare upload backend is not enabled.");
  }

  try {
    const store = await getCloudflareDataStore();
    await store.createScan({ scanId, image, context, storagePath });
    const redirectUrl = new URL(`/scan/${scanId}`, request.url);
    redirectUrl.searchParams.set("created", "1");
    return NextResponse.redirect(redirectUrl, { status: 303 });
  } catch (error) {
    console.error("Cloudflare scan create failed", error);
    return redirectToScan(request, "Upload failed. Please try again with a JPG or PNG image.");
  }
}
