export default async function AdminUnlockPage({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";
  const scanId = typeof params?.scan_id === "string" ? params.scan_id : "";
  const paymentId = typeof params?.payment_id === "string" ? params.payment_id : "";
  const mockEnabled = process.env.MOCK_AI_SCAN === "true" || !process.env.OPENAI_API_KEY;

  return (
    <main className="page-shell">
      <section className="container section-header">
        <span className="eyebrow">Admin fallback</span>
        <h2>Manual unlock</h2>
        <p>
          Internal fallback route for PromptPay transfers. Use only after verifying the transfer in the bank account.
        </p>
        {mockEnabled ? <span className="dev-pill">Mock AI scan mode is active</span> : null}

        <form className="scan-form admin-unlock-form" action="/api/admin-unlock" method="post">
          {error ? <div className="form-alert">{error}</div> : null}
          <input name="scan_id" placeholder="Scan ID" defaultValue={scanId} required />
          <input name="payment_id" placeholder="Payment ID (optional)" defaultValue={paymentId} />
          <input name="token" type="password" placeholder="Admin unlock token" required />
          <input name="note" placeholder="Verification note" defaultValue="Manual PromptPay verification" />
          <button type="submit" className="button button-primary">Unlock paid report</button>
        </form>
      </section>
    </main>
  );
}
