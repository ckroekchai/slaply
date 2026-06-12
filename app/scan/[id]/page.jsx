import { ReportIssueList } from "../../../components/ReportIssueList";
import { RunAiScanForm } from "../../../components/RunAiScanForm";
import { SiteHeader } from "../../../components/SiteHeader";
import { UploadedArtwork } from "../../../components/UploadedArtwork";
import { getSafeScan, getScanById } from "../../../lib/scans";
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

export default async function ReportPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const pageError = typeof query?.error === "string" ? query.error : "";
  const { scan, imageUrl } = await getScanById(id);
  const safeScan = getSafeScan(scan);
  const hasPreview = Boolean(safeScan?.preview);
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
  const reportContext = (
    <>
      {categoryLabel}
      {"\u00a0\u00a0·\u00a0\u00a0"}
      {languageLabel}
    </>
  );

  return (
    <>
      <div className="liquid-orb orb-1" />
      <div className="liquid-orb orb-2" />
      <div className="liquid-orb orb-3" />
      <SiteHeader />
      <main className="page-shell report-shell">
        <section className="container report-page">
          <div className="glass-device report-device">
            <div className="window">
              <div className="window-bar" aria-hidden="true" />

              <div className="report-ui">
                <UploadedArtwork imageUrl={imageUrl} issues={hasPreview ? safeScan.preview.issues : []} />

                <div className="report-zone">
                  <div className="report-head">
                    <div className="report-title-stack">
                      <h3>{hasPreview ? "Scan report" : "Artwork uploaded"}</h3>
                      <p className="report-context">{reportContext}</p>
                    </div>
                    {hasPreview ? <span className="status-pill">Scan complete</span> : null}
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
                        initiallyUnlocked
                      />
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
