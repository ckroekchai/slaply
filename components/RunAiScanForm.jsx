"use client";

import { useState } from "react";

const thinkingLetters = "Thinking".split("");

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
          <span className="thinking-word" aria-label="Thinking">
            {thinkingLetters.map((letter, index) => (
              <span key={`${letter}-${index}`} style={{ "--letter-index": index }} aria-hidden="true">
                {letter}
              </span>
            ))}
          </span>
        ) : (
          "Run AI scan"
        )}
      </button>
    </form>
  );
}
