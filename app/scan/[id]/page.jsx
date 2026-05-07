export default async function ReportPage({ params }) {
  const { id } = await params;

  return (
    <main className="page-shell">
      <section className="container section-header">
        <span className="eyebrow">Report preview</span>
        <h2>Scan report</h2>
        <p>
          Report route ready for scan <strong>{id}</strong>. The next build step will load scan data,
          show the unpaid preview, and unlock the full report after PromptPay payment confirmation.
        </p>
      </section>
    </main>
  );
}
