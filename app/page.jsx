import { SiteHeader } from "../components/SiteHeader";
import { ScanUploadForm } from "../components/ScanUploadForm";

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const error = typeof params?.error === "string" ? params.error : "";

  return (
    <>
      <div className="liquid-orb orb-1" />
      <div className="liquid-orb orb-2" />
      <div className="liquid-orb orb-3" />

      <SiteHeader home />

      <main id="top">
        <section className="hero">
          <div className="container">
            <div className="hero-content">
              <div className="eyebrow">Instant AI packaging audit</div>
              <h1>Catch the mistakes<br /><span className="liquid-text">Before they cost you.</span></h1>
              <p className="hero-copy">
                Upload your final artwork and get an AI visual audit that spots text errors, missing info, readability
                risk, clarity, and hierarchy before you print, produce, list, or launch.
              </p>

              <div className="hero-actions">
                <a href="#scan" className="button button-primary">Start scan</a>
                <a href="#pricing" className="button button-secondary">View pricing</a>
              </div>

              <p className="microcopy">
                <span>✓ Beauty product</span>
                <span>✓ Supplement product</span>
                <span>✓ Food &amp; Pet product</span>
              </p>
            </div>

            <div className="product-stage">
              <div className="glass-device">
                <div className="window">
                  <div className="window-bar">
                    <div className="window-title">Example Slaply report</div>
                  </div>

                  <div className="report-ui">
                    <div className="pack-zone">
                      <div className="pack-card artwork-card" aria-label="Sample packaging artwork">
                        <img src="/post-1.png?v=20260507003144" alt="Sample perfume packaging artwork" />
                        <span className="pin artwork-pin marker-one">1</span>
                        <span className="pin artwork-pin marker-two">2</span>
                        <span className="pin artwork-pin marker-three">3</span>
                        <span className="pin artwork-pin marker-four">4</span>
                      </div>
                    </div>

                    <div className="report-zone">
                      <div className="report-head">
                        <h3>Audit summary</h3>
                        <span className="status-pill">Scan complete</span>
                      </div>

                      <div className="score-grid">
                        <div className="score-card"><b>3</b><span>Text Errors</span></div>
                        <div className="score-card"><b>2</b><span>Missing Info</span></div>
                        <div className="score-card"><b>5</b><span>Readability</span></div>
                      </div>

                      <div className="issue-list">
                        <div className="issue">
                          <div className="issue-top">
                            <h4>1. Main benefit is hard to read</h4>
                            <span className="severity high">High</span>
                          </div>
                          <p>The main product benefit is not clear enough in the visible artwork.</p>
                        </div>

                        <div className="issue">
                          <div className="issue-top">
                            <h4>2. Important details are hard to find</h4>
                            <span className="severity">Medium</span>
                          </div>
                          <p>Key product details may be too small, low-contrast, or difficult to locate.</p>
                        </div>

                        <div className="issue">
                          <div className="issue-top">
                            <h4>3. Wording issue</h4>
                            <span className="severity">Action</span>
                          </div>
                          <p>Some text may be misspelled or written inconsistently.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="process">
          <div className="container">
            <div className="section-header">
              <h2>One image. One scan.<br />One clearer decision.</h2>
              <p>
                Slaply is not another image generator. Upload your high quality print-ready artwork, preview the key
                issues, then unlock the full report only when you need more detail.
              </p>
            </div>

            <div className="process-row">
              <article className="step">
                <h3>Upload</h3>
                <p>Add your high quality print-ready artwork and short product context.</p>
                <ul className="step-bullets">
                  <li>Print-ready artwork</li>
                  <li>Product category</li>
                  <li>Report language</li>
                </ul>
              </article>

              <article className="step scan-step">
                <h3>Scan</h3>
                <p>AI checks text errors, missing information, readability risk, clarity, and hierarchy.</p>
                <ul className="step-bullets">
                  <li>Text errors</li>
                  <li>Missing critical info</li>
                  <li>Readability risk</li>
                </ul>
              </article>

              <article className="step">
                <h3>Unlock</h3>
                <p>See an annotated preview with the key findings mapped to points on the artwork.</p>
                <ul className="step-bullets">
                  <li>Annotated preview</li>
                  <li>Risk summary</li>
                  <li>Download full report</li>
                </ul>
              </article>

              <article className="step">
                <h3>Take action</h3>
                <p>Choose your next move with a clear next step: fix, hand off, or approve for launch.</p>
                <ul className="step-bullets">
                  <li>Fix yourself</li>
                  <li>Send to designer</li>
                  <li>Request Slaply fix</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="pricing">
          <div className="container">
            <div className="section-header">
              <h2>Start with a scan.<br />Pay only when needed.</h2>
              <p>
                Slaply keeps pricing simple. Preview the issues first. If the scan helps, unlock the full report or
                request designer support only when you need.
              </p>
            </div>

            <div className="pricing-grid">
              <article className="pricing-card">
                <h3>Free Scan</h3>
                <p>For a quick issue preview before you decide.</p>
                <div className="price">Free</div>
                <div className="price-note">Limited preview</div>
                <ul className="pricing-list">
                  <li>Issue preview</li>
                  <li>Basic risk summary</li>
                  <li>One artwork scan</li>
                </ul>
                <a href="#scan" className="button button-secondary">Try scan</a>
              </article>

              <article className="pricing-card featured">
                <h3>Full Report</h3>
                <p>For clients who need a clearer decision before production or launch.</p>
                <div className="price">THB 399</div>
                <div className="price-note">Per report</div>
                <ul className="pricing-list">
                  <li>Annotated issue map</li>
                  <li>Risk and clarity scoring</li>
                  <li>Prioritized action list</li>
                </ul>
                <a href="#scan" className="button button-primary">Unlock report</a>
              </article>

              <article className="pricing-card">
                <h3>Designer Review</h3>
                <p>For extra confidence before print, production, or launch.</p>
                <div className="price">Request</div>
                <div className="price-note">Book designer review</div>
                <ul className="pricing-list">
                  <li>Designer review note</li>
                  <li>Priority fix guidance</li>
                  <li>No-edit review only</li>
                </ul>
                <span className="button button-secondary button-muted" aria-disabled="true">Coming soon</span>
              </article>

              <article className="pricing-card">
                <h3>Fix</h3>
                <p>For packaging that needs focused design correction.</p>
                <div className="price">Request</div>
                <div className="price-note">Slaply design support</div>
                <ul className="pricing-list">
                  <li>One-time edit</li>
                  <li>.ai file needed</li>
                  <li>Redesign quoted separately</li>
                </ul>
                <span className="button button-secondary button-muted" aria-disabled="true">Coming soon</span>
              </article>
            </div>

            <div className="disclaimer">
              Slaply is an AI visual audit for artwork-level communication only.<br />It does not cover legal,
              regulatory, FDA/Thai FDA, claims, barcode, IP, or sales-performance.
            </div>
          </div>
        </section>

        <section id="scan" className="cta">
          <div className="container">
            <div className="cta-panel">
              <div className="cta-copy">
                <h2>Check your pack before mistakes hit the rack.</h2>
                <p>
                  Start with one image and product category. Slaply will show where the packaging may fail before you
                  spend on production, ads, or marketplace launch.
                </p>
              </div>

              <ScanUploadForm error={error} />
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-row">
          <span>© 2026 Slaply. Instant AI packaging audit.</span>
          <span>AI visual review · No legal or compliance approval</span>
        </div>
      </footer>
    </>
  );
}
