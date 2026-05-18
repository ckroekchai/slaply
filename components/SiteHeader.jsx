export function SiteHeader({ home = false }) {
  const steps = [
    {
      title: "Upload",
      body: "Add print-ready artwork and short product context.",
      bullets: ["Artwork", "Category", "Report language"]
    },
    {
      title: "Scan",
      body: "AI checks text, clarity, hierarchy, and readability risks.",
      bullets: ["Text errors", "Missing info", "Readability risk"]
    },
    {
      title: "Unlock",
      body: "Preview key findings mapped to points on the artwork.",
      bullets: ["Annotated preview", "Risk summary", "Full report"]
    },
    {
      title: "Take action",
      body: "Fix, hand off, or approve the artwork with clearer next steps.",
      bullets: ["Fix yourself", "Send to designer", "Request Slaply fix"]
    }
  ];

  return (
    <header>
      <div className="container">
        <div className="nav">
          <a href={home ? "#top" : "/"} className="brand" aria-label="Slaply Home">
            <span className="mark">S</span>
            <span>Slaply</span>
          </a>

          <nav className="nav-links" aria-label="Main navigation">
            <details id="how-it-works" className="nav-menu">
              <summary>How it works</summary>
              <div className="how-menu-panel" role="group" aria-label="How Slaply works">
                <div className="how-menu-copy">
                  <h2>One image. One scan. One clearer decision.</h2>
                  <p>
                    Upload your final artwork, preview the key risks, then unlock the full report only when you need
                    more detail.
                  </p>
                </div>

                <div className="how-menu-grid">
                  {steps.map((step, index) => (
                    <article className="how-menu-step" key={step.title}>
                      <span>{index + 1}</span>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                      <ul>
                        {step.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </div>
            </details>
            <a href={home ? "#pricing" : "/#pricing"}>Pricing</a>
          </nav>

          <a href={home ? "#scan" : "/#scan"} className="nav-cta">Start scan</a>
        </div>
      </div>
    </header>
  );
}
