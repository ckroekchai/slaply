import { NextResponse } from "next/server";
import { getSafeScan, getScanById } from "../../../lib/scans";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get("scan_id");

  if (!scanId) {
    return NextResponse.json({ ok: false, error: "Missing scan_id." }, { status: 400 });
  }

  const { scan, imageUrl } = await getScanById(scanId);

  if (!scan) {
    return NextResponse.json({ ok: false, error: "Scan not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    scan: getSafeScan(scan),
    image_url: imageUrl
  });
}
