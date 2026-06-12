"use client";

import { useEffect } from "react";

export function SiteHeader({ home = false }) {
  useEffect(() => {
    const closeOpenMenus = () => {
      document.querySelectorAll(".nav-menu[open]").forEach((menu) => {
        menu.open = false;
      });
    };

    const handlePointerDown = (event) => {
      const openMenus = document.querySelectorAll(".nav-menu[open]");
      const clickedInsideOpenMenu = Array.from(openMenus).some((menu) => menu.contains(event.target));

      if (!clickedInsideOpenMenu) {
        closeOpenMenus();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeOpenMenus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const scanHref = home ? "#scan" : "/#scan";
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
  const pricingPlans = [
    {
      title: "Free Scan",
      description: "For a quick issue preview before you decide.",
      price: "Free",
      note: "Limited preview",
      bullets: ["Issue preview", "Basic risk summary", "One artwork scan"],
      action: "Try scan",
      href: scanHref
    },
    {
      title: "Full Report",
      description: "For clients who need a clearer decision before production or launch.",
      price: "THB 99",
      note: "Per report",
      bullets: ["Annotated issue map", "Risk and clarity scoring", "Prioritized action list"],
      action: "Unlock report",
      href: scanHref,
      featured: true
    },
    {
      title: "Designer Review",
      description: "For extra confidence before print, production, or launch.",
      price: "Request",
      note: "Book designer review",
      bullets: ["Designer review note", "Priority fix guidance", "No-edit review only"],
      action: "Coming soon"
    },
    {
      title: "Fix",
      description: "For packaging that needs focused design correction.",
      price: "Request",
      note: "Slaply design support",
      bullets: ["One-time edit", ".ai file needed", "Redesign quoted separately"],
      action: "Coming soon"
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
            <details id="how-it-works" className="nav-menu" name="main-nav-menu">
              <summary>How it works</summary>
              <div className="how-menu-panel" role="group" aria-label="How Slaply works">
                <div className="how-menu-copy">
                  <h2>One image. One scan. <span className="nowrap">One clearer decision.</span></h2>
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
            <details id="pricing" className="nav-menu nav-menu-pricing" name="main-nav-menu">
              <summary>Pricing</summary>
              <div className="pricing-menu-panel" role="group" aria-label="Slaply pricing">
                <div className="pricing-menu-copy">
                  <h2>Start with a scan. Pay only when needed.</h2>
                  <p>
                    Preview the issues first. If the scan helps, unlock the full report or request support only when
                    you need it.
                  </p>
                </div>

                <div className="pricing-menu-grid">
                  {pricingPlans.map((plan) => (
                    <article className={`pricing-card${plan.featured ? " featured" : ""}`} key={plan.title}>
                      <h3>{plan.title}</h3>
                      <p>{plan.description}</p>
                      <div className="price">{plan.price}</div>
                      <div className="price-note">{plan.note}</div>
                      <ul className="pricing-list">
                        {plan.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                      {plan.href ? (
                        <a href={plan.href} className={`button ${plan.featured ? "button-primary" : "button-secondary"}`}>
                          {plan.action}
                        </a>
                      ) : (
                        <span className="button button-secondary button-muted" aria-disabled="true">{plan.action}</span>
                      )}
                    </article>
                  ))}
                </div>

                <div className="pricing-menu-disclaimer">
                  Slaply is an AI visual audit for artwork-level communication only. No legal, regulatory, FDA/Thai
                  FDA, barcode, IP, claims, or sales-performance approval.
                </div>
              </div>
            </details>
          </nav>

          <a href={scanHref} className="nav-cta">Start scan</a>
        </div>
      </div>
    </header>
  );
}
