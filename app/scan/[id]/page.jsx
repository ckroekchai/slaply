import { PaymentCountdown } from "../../../components/PaymentCountdown";
import { ReportIssueList } from "../../../components/ReportIssueList";
import { RunAiScanForm } from "../../../components/RunAiScanForm";
import { SiteHeader } from "../../../components/SiteHeader";
import { getSafePayment, getPaymentById } from "../../../lib/payments";
import { getSafeScan, getScanById } from "../../../lib/scans";
import { getPromptPayDisplayName, getReportPriceThb } from "../../../lib/promptpay";

export const dynamic = "force-dynamic";

function getPreviewMetrics(preview) {
  const issues = preview?.issues || [];
  const mediumCount = issues.filter((issue) => issue.severity === "Medium").length;
  const readabilityRisk = Math.max(1, Math.min(9, Math.round((100 - (preview?.overall_score || 72)) / 6)));

  return [
    { label: "Text Errors", value: issues.length || 3 },
    { label: "Missing Info", value: mediumCount || 2 },
    { label: "Readability risk", value: readabilityRisk || 5 }
  ];
}

function clampPercent(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0.08, Math.min(0.92, value));
}

function ArtworkPins({ issues = [] }) {
  const pinnedIssues = issues.filter((issue) => issue.location).slice(0, 4);

  return pinnedIssues.map((issue, index) => (
    <span
      className="pin artwork-pin"
      key={issue.id}
      style={{
        left: `${clampPercent(issue.location?.x, 0.5) * 100}%`,
        top: `${clampPercent(issue.location?.y, 0.5) * 100}%`
      }}
    >
      {issue.id || index + 1}
    </span>
  ));
}

function UploadedArtwork({ imageUrl, issues = [] }) {
  return (
    <div className="pack-zone">
      <div className="pack-card artwork-card" aria-label="Uploaded packaging artwork">
        {imageUrl ? <img src={imageUrl} alt="Uploaded packaging artwork" /> : null}
        <ArtworkPins issues={issues} />
      </div>
    </div>
  );
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

  return (
    <>
      <div className="liquid-orb orb-1" />
      <div className="liquid-orb orb-2" />
      <div className="liquid-orb orb-3" />
      <SiteHeader />
      <main className="page-shell">
        <section className="container report-page">
          <div className="report-page-head">
            <div>
              <span className="eyebrow">{hasPreview ? "Scan report" : "Scan queued"}</span>
              <h2>{hasPreview ? "Scan report" : "Scan queued"}</h2>
              <p>
                {scan.product_category} · {scan.language === "thai" ? "Thai report" : "English report"}
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
                    <h3>{hasPreview ? "Audit summary" : "Scan queued"}</h3>
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
                          <h4>Artwork uploaded</h4>
                          <span className="severity">Next</span>
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
