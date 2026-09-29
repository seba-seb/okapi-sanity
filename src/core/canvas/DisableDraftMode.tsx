"use client";

import { useIsPresentationTool } from "@sanity/visual-editing/react";

export function DisableDraftMode() {
  const isPresentation = useIsPresentationTool();

  // Inside the Presentation tool, Sanity manages draft mode itself, so we
  // only show the "exit" banner on the standalone site.
  if (isPresentation !== false) return null;

  return (
    <div className="draft-banner">
      <span>Draft mode is on</span>
      <a href="/api/draft-mode/disable" data-astro-prefetch="false">Exit</a>
    </div>
  );
}
