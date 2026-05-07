import { getSafeScan, getScanById } from "../../../lib/scans";

export const dynamic = "force-dynamic";

function ScanStatus({ scan }) {
  if (!scan) return null;

  if (scan.scan_status === "preview_ready") {
    return <span className="status-pill">Preview ready</span>;
  }

  if (scan.scan_status === "failed") {
    return <span className="severity high">Scan failed</span>;
  }

  return <span className="status-pill">Upload received</span>;
}

export default async function ReportPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const pageError = typeof query?.error === "string" ? query.error : "";
  const { scan, imageUrl } = await getScanById(id);
  const safeScan = getSafeScan(scan);

  if (!scan) {
    return (
      <main className="page-shell">
        <section className="container section-header">
          <span className="eyebrow">Report preview</span>
          <h2>Scan not found.</h2>
          <p>Please check the report link and try again.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="container report-page">
        <div className="report-page-head">
          <div>
            <span className="eyebrow">Report preview</span>
            <h2>Scan report</h2>
            <p>
              {scan.product_category} · {scan.sales_channel} · {scan.language === "thai" ? "Thai report" : "English report"}
            </p>
          </div>
          <ScanStatus scan={scan} />
        </div>

        <div className="report-page-grid">
          <div className="pack-card report-artwork">
            {imageUrl ? <img src={imageUrl} alt="Uploaded packaging artwork" /> : null}
          </div>

          <div className="report-zone">
            <div className="report-head">
              <h3>{safeScan?.preview ? "Audit summary" : "Scan queued"}</h3>
              {safeScan?.payment_status === "paid" ? (
                <span className="status-pill">Paid</span>
              ) : (
                <span className="severity">Free preview</span>
              )}
            </div>

            {safeScan?.preview ? (
              <>
                <div className="score-grid">
                  <div className="score-card"><b>{safeScan.preview.overall_score}</b><span>Overall</span></div>
                  <div className="score-card"><b>{safeScan.preview.readiness_level}</b><span>Readiness</span></div>
                </div>

                <p className="report-summary">{safeScan.preview.summary}</p>

                <div className="issue-list">
                  {safeScan.preview.issues.map((issue) => (
                    <div className="issue" key={issue.id}>
                      <div className="issue-top">
                        <h4>{issue.id}. {issue.title}</h4>
                        <span className={issue.severity === "High" ? "severity high" : "severity"}>{issue.severity}</span>
                      </div>
                      <p>{issue.why_it_matters}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {pageError ? <div className="form-alert">{pageError}</div> : null}

                <div className="issue">
                  <div className="issue-top">
                    <h4>Artwork uploaded</h4>
                    <span className="severity">Next</span>
                  </div>
                  <p>The next step is to run the AI visual audit and render the free preview here.</p>
                </div>

                <form action="/api/run-ai-scan" method="post">
                  <input type="hidden" name="scan_id" value={scan.id} />
                  <button type="submit" className="button button-primary">Run AI scan</button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
