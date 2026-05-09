"use client";

import { useState } from "react";

function clampPercent(value, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0.02, Math.min(0.98, value));
}

function getPinPosition(issue, imageSize) {
  const x = clampPercent(issue.location?.x, 0.5);
  const y = clampPercent(issue.location?.y, 0.5);

  if (!imageSize?.width || !imageSize?.height) {
    return { left: `${x * 100}%`, top: `${y * 100}%` };
  }

  const aspectRatio = imageSize.width / imageSize.height;

  if (aspectRatio >= 1) {
    const renderedHeight = 1 / aspectRatio;
    const topOffset = (1 - renderedHeight) / 2;

    return {
      left: `${x * 100}%`,
      top: `${(topOffset + y * renderedHeight) * 100}%`
    };
  }

  const renderedWidth = aspectRatio;
  const leftOffset = (1 - renderedWidth) / 2;

  return {
    left: `${(leftOffset + x * renderedWidth) * 100}%`,
    top: `${y * 100}%`
  };
}

function ArtworkPins({ issues = [], imageSize }) {
  const pinnedIssues = issues.filter((issue) => issue.location);

  return pinnedIssues.map((issue, index) => (
    <span
      className="pin artwork-pin"
      key={issue.id}
      style={getPinPosition(issue, imageSize)}
    >
      {issue.display_id || issue.id || index + 1}
    </span>
  ));
}

export function UploadedArtwork({ imageUrl, issues = [] }) {
  const [imageSize, setImageSize] = useState(null);

  return (
    <div className="pack-zone">
      <div className="pack-card artwork-card" aria-label="Uploaded packaging artwork">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Uploaded packaging artwork"
            onLoad={(event) => {
              setImageSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight
              });
            }}
          />
        ) : null}
        <ArtworkPins issues={issues} imageSize={imageSize} />
      </div>
    </div>
  );
}
