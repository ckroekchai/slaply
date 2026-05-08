export function SiteHeader({ home = false }) {
  return (
    <header>
      <div className="container">
        <div className="nav">
          <a href={home ? "#top" : "/"} className="brand" aria-label="Slaply Home">
            <span className="mark">S</span>
            <span>Slaply</span>
          </a>

          <nav className="nav-links" aria-label="Main navigation">
            <a href={home ? "#how-it-works" : "/#how-it-works"}>How it works</a>
            <a href={home ? "#pricing" : "/#pricing"}>Pricing</a>
          </nav>

          <a href={home ? "#scan" : "/#scan"} className="nav-cta">Start scan</a>
        </div>
      </div>
    </header>
  );
}
