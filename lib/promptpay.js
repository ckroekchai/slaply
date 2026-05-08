import { slaplyConfig } from "./slaply-config";

export function getReportPriceThb() {
  const amount = Number(process.env.SCAN_PRICE_THB || slaplyConfig.fullReportPrice);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("SCAN_PRICE_THB must be a positive number.");
  }

  return amount;
}

export function getPromptPayDisplayName() {
  return process.env.PROMPTPAY_ACCOUNT_NAME || "Slaply";
}
