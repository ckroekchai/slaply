import { NextResponse } from "next/server";
import { getCloudflareDataStore, isCloudflareDataEnabled } from "../../../lib/cloudflare-data";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isCloudflareDataEnabled()) {
    return NextResponse.json({ ok: false, error: "Cloudflare upload backend is not enabled." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key || key.includes("..") || key.startsWith("/")) {
    return NextResponse.json({ ok: false, error: "Invalid upload key." }, { status: 400 });
  }

  const store = await getCloudflareDataStore();
  const response = await store.getScanImageResponse(key);

  if (!response) {
    return NextResponse.json({ ok: false, error: "Upload not found." }, { status: 404 });
  }

  return response;
}
