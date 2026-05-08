"use client";

import { useState } from "react";

export function RunAiScanForm({ scanId }) {
  const [isThinking, setIsThinking] = useState(false);

  return (
    <form
      action="/api/run-ai-scan"
      method="post"
      className={`run-scan-form ${isThinking ? "is-thinking" : ""}`}
      onSubmit={() => setIsThinking(true)}
    >
      <input type="hidden" name="scan_id" value={scanId} />
      <button type="submit" className="button button-primary" disabled={isThinking} aria-live="polite">
        {isThinking ? (
          <span className="thinking-label">
            <span>Thinking</span>
            <span className="thinking-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </span>
        ) : (
          "Run AI scan"
        )}
      </button>
    </form>
  );
}
