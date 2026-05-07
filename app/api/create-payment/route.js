import { slaplyConfig } from "../../../lib/slaply-config";

export async function POST() {
  return Response.json(
    {
      ok: false,
      code: "not_implemented",
      paymentGateway: slaplyConfig.paymentGateway,
      amount: slaplyConfig.fullReportPrice,
      currency: slaplyConfig.currency,
      message:
        "Next step: create a PromptPay QR payment request tied to scan_id. If using a manual QR, admin unlock is required after payment verification."
    },
    { status: 501 }
  );
}
