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
