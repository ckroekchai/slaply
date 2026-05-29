import { PaymentCountdown } from "../../../components/PaymentCountdown";
import { ReportIssueList } from "../../../components/ReportIssueList";
import { RunAiScanForm } from "../../../components/RunAiScanForm";
import { SiteHeader } from "../../../components/SiteHeader";
import { UploadedArtwork } from "../../../components/UploadedArtwork";
import { getSafePayment, getPaymentById } from "../../../lib/payments";
import { getSafeScan, getScanById } from "../../../lib/scans";
import { getPromptPayDisplayName, getReportPriceThb } from "../../../lib/promptpay";
import { formatProductCategory } from "../../../lib/scan-form-options";

export const dynamic = "force-dynamic";

function getPreviewMetrics(preview) {
  const counts = preview?.issue_counts || { text_errors: 0, hierarchy: 0, readability: 0 };
  const totalIssues = (counts.text_errors || 0) + (counts.hierarchy || 0) + (counts.readability || 0);

  if (preview && totalIssues === 0) {
    return [
      { label: "Overall score", value: preview.overall_score ?? "—" },
      { label: "Readiness", value: preview.readiness_level || "Ready" },
      { label: "Issues found", value: 0 }
    ];
  }

  return [
    { label: "Text Errors", value: counts.text_errors || 0 },
    { label: "Hierarchy", value: counts.hierarchy || 0 },
    { label: "Readability", value: counts.readability || 0 }
  ];
}

function PaymentBlock({ payment, scanId, reportPrice, autoRevealSeconds = 0 }) {
  const promptPayQrUrl = "/slaply-promptpay-qr.jpg";
  const isUnlocked = payment?.payment_status === "paid";
  const shouldShowConfirmationCountdown = Boolean(payment && !isUnlocked && autoRevealSeconds);

  return (
    <div className="unlock-card" id="payment">
      <div>
        <span className="eyebrow">Full report</span>
        <h3>Unlock the complete audit</h3>
        <p>Move from preview to the full list of issues, detailed findings, and recommended actions.</p>
      </div>

      {payment ? (
        <div className="payment-panel">
          <img className="payment-qr" src={promptPayQrUrl} alt="PromptPay QR code" />
          <div className="payment-meta">
            <strong>PromptPay QR</strong>
            <span>
              {isUnlocked ? "THB" : "Pay THB"} {payment.amount.toLocaleString("en-US")} to {getPromptPayDisplayName()}
            </span>
            <span>Reference: {payment.id.slice(0, 8).toUpperCase()}</span>
            <small>
              {isUnlocked
                ? "PromptPay QR is ready. The full report is now unlocked."
                : "Scan this PromptPay QR. Slaply will open the hidden guidance after payment confirmation."}
            </small>
            <PaymentCountdown enabled={shouldShowConfirmationCountdown} seconds={autoRevealSeconds} />
          </div>
        </div>
      ) : (
        <form action="/api/create-payment" method="post" className="unlock-form">
          <input type="hidden" name="scan_id" value={scanId} />
          <button type="submit" className="button button-primary">
            Generate PromptPay QR · THB {reportPrice.toLocaleString("en-US")}
          </button>
        </form>
      )}
    </div>
  );
}

export default async function ReportPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const pageError = typeof query?.error === "string" ? query.error : "";
  const paymentId = typeof query?.payment_id === "string" ? query.payment_id : "";
  const { scan, imageUrl } = await getScanById(id);
  const safeScan = getSafeScan(scan);
  const { payment } = await getPaymentById(paymentId, id);
  const safePayment = getSafePayment(payment);
  const reportPrice = getReportPriceThb();
  const hasPreview = Boolean(safeScan?.preview);
  const isPaid = safeScan?.payment_status === "paid";
  const autoRevealSeconds = safePayment && !isPaid ? 10 : 0;
  const metrics = getPreviewMetrics(safeScan?.preview);

  if (!scan) {
    return (
      <>
        <SiteHeader />
        <main className="page-shell">
          <section className="container section-header">
            <span className="eyebrow">Report preview</span>
            <h2>Scan not found.</h2>
            <p>Please check the report link and try again.</p>
          </section>
        </main>
      </>
    );
  }

  const categoryLabel = formatProductCategory(scan.product_category);
  const languageLabel = scan.language === "thai" ? "Thai report" : "English report";

  return (
    <>
      <div className="liquid-orb orb-1" />
      <div className="liquid-orb orb-2" />
      <div className="liquid-orb orb-3" />
      <SiteHeader />
      <main className="page-shell report-shell">
        <section className="container report-page">
          <div className="report-page-head">
            <div>
              <h2>{hasPreview ? "Scan report" : "Scan queued"}</h2>
              <p>
                {categoryLabel}
                {"\u00a0\u00a0·\u00a0\u00a0"}
                {languageLabel}
              </p>
            </div>
          </div>

          <div className="glass-device report-device">
            <div className="window">
              <div className="window-bar" aria-hidden="true" />

              <div className="report-ui">
                <UploadedArtwork imageUrl={imageUrl} issues={hasPreview ? safeScan.preview.issues : []} />

                <div className="report-zone">
                  <div className="report-head">
                    <h3>{hasPreview ? "Audit summary" : "Artwork uploaded"}</h3>
                    {hasPreview ? <span className="status-pill">{isPaid ? "Paid" : "Scan complete"}</span> : null}
                  </div>

                  {hasPreview ? (
                    <>
                      <div className="score-grid">
                        {metrics.map((metric) => (
                          <div className="score-card" key={metric.label}>
                            <b>{metric.value}</b>
                            <span>{metric.label}</span>
                          </div>
                        ))}
                      </div>

                      <ReportIssueList
                        issues={safeScan.preview.issues}
                        summary={safeScan.preview.summary}
                        language={safeScan.language}
                        initiallyUnlocked={isPaid}
                        autoRevealSeconds={autoRevealSeconds}
                      />

                      {isPaid ? (
                        safePayment ? (
                          <PaymentBlock payment={safePayment} scanId={scan.id} reportPrice={reportPrice} />
                        ) : null
                      ) : (
                        <PaymentBlock
                          payment={safePayment}
                          scanId={scan.id}
                          reportPrice={reportPrice}
                          autoRevealSeconds={autoRevealSeconds}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {pageError ? <div className="form-alert">{pageError}</div> : null}

                      <div className="issue">
                        <div className="issue-top">
                          <h4>All set</h4>
                          <span className="status-pill status-pill-ready">Ready to scan</span>
                        </div>
                        <p>Review your uploaded artwork before starting the AI scan.</p>
                      </div>

                      <RunAiScanForm scanId={scan.id} />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
