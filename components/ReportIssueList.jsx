"use client";

import { useEffect, useState } from "react";
import { inferIssueType } from "../lib/audit-issue-utils";

function severityClass(severity) {
  return `severity ${severity?.toLowerCase() || "medium"}`;
}

function getDisplayTitle(issue, typeIndex, isThai) {
  const issueType = inferIssueType(issue);
  const pointLabel = isThai ? `จุด${typeIndex}` : `point ${typeIndex}`;
  const prefix = `${issueType} ${pointLabel}`;

  return issue.title ? `${prefix}: ${issue.title}` : prefix;
}

export function ReportIssueList({ issues = [], language = "thai", initiallyUnlocked = false, autoRevealSeconds = 0 }) {
  const [isUnlocked, setIsUnlocked] = useState(initiallyUnlocked);
  const isThai = language !== "english";
  const typeIndexes = {};

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
      {issues.map((issue, index) => {
        const issueType = inferIssueType(issue);
        typeIndexes[issueType] = (typeIndexes[issueType] || 0) + 1;
        const itemNumber = issue.display_id || index + 1;

        return (
          <div className="issue" key={`${issueType}-${itemNumber}-${issue.id}`}>
            <div className="issue-top">
              <h4>{itemNumber}. {getDisplayTitle(issue, typeIndexes[issueType], isThai)}</h4>
              <span className={severityClass(issue.severity)}>{issue.severity}</span>
            </div>
            <p>{isUnlocked ? issue.recommendation || issue.why_it_matters : issue.why_it_matters}</p>
          </div>
        );
      })}
    </div>
  );
}
