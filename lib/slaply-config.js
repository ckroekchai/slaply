export const slaplyConfig = {
  domain: "slaply.co",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://slaply.co",
  productName: "Instant AI Packaging Audit",
  currency: "THB",
  fullReportPrice: 399,
  paymentGateway: "promptpay_qr",
  reportEmail: process.env.REPORT_FROM_EMAIL || "reports@slaply.co"
};
