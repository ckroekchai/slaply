"use client";

import { useEffect, useState } from "react";

function severityClass(severity) {
  return severity === "High" ? "severity high" : "severity";
}

export function ReportIssueList({ issues = [], initiallyUnlocked = false, autoRevealSeconds = 0 }) {
  const [isUnlocked, setIsUnlocked] = useState(initiallyUnlocked);

  useEffect(() => {
    if (initiallyUnlocked) {
      setIsUnlocked(true);
      return undefined;
    }

    if (!autoRevealSeconds) {
      setIsUnlocked(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIsUnlocked(true);
    }, autoRevealSeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [initiallyUnlocked, autoRevealSeconds]);

  return (
    <div className={isUnlocked ? "issue-list" : "issue-list issue-list-locked"}>
      {issues.map((issue) => (
        <div className="issue" key={issue.id}>
          <div className="issue-top">
            <h4>{issue.id}. {issue.title}</h4>
            <span className={severityClass(issue.severity)}>{issue.severity}</span>
          </div>
          <p>{isUnlocked ? issue.recommendation || issue.why_it_matters : issue.why_it_matters}</p>
        </div>
      ))}
    </div>
  );
}
