import { getCloudflareDataStore } from "./cloudflare-data";

export async function getPaymentById(paymentId, scanId) {
  if (!paymentId) return { payment: null, error: null };

  const store = await getCloudflareDataStore();
  return { payment: await store.getPaymentById(paymentId, scanId), error: null };
}

export function getSafePayment(payment) {
  if (!payment) return null;

  return {
    id: payment.id,
    scan_id: payment.scan_id,
    amount: payment.amount,
    currency: payment.currency,
    payment_status: payment.payment_status,
    provider: payment.provider,
    created_at: payment.created_at,
    paid_at: payment.paid_at
  };
}
