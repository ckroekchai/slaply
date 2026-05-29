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
            </div>
          </div>
        </section>

        <section id="scan" className="cta">
          <div className="container">
            <div className="cta-panel">
              <div className="cta-copy">
                <h2>Better artwork in. Better scan out.</h2>
                <p>
                  Use high-quality final artwork, crop out non-artwork or title block areas, and select the right
                  category before submitting.
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
