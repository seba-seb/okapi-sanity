import { useEffect } from "react";

import { previewPrefix } from "@/core/sanity/env";
import { DisableDraftMode } from "@/core/canvas/DisableDraftMode";
import { EditorShortcuts } from "@/core/canvas/EditorShortcuts";
import { InsertPalette } from "@/core/canvas/InsertPalette";
import { CanvasAddButton } from "@/core/canvas/CanvasAddButton";
import { BLOCK_CANVAS_TOOLS } from "@/blocks/components";
import { PreviewBridge } from "@/core/canvas/PreviewBridge";
import { CanvasResizer } from "@/core/canvas/CanvasResizer";
import { SpacingResizer } from "@/core/canvas/SpacingResizer";
import { BlockMarginResizer } from "@/core/canvas/BlockMarginResizer";
import { SectionSpacingResizer } from "@/core/canvas/SectionSpacingResizer";
import { VisualEditingBridge } from "@/core/canvas/VisualEditingBridge";

/**
 * Everything the Next `(frontend)/layout.tsx` mounted under `draftMode()`.
 * One island so every tool shares a React tree; all of them import
 * `@sanity/visual-editing` from the same module graph as `PageBuilder`, which
 * keeps the single optimistic actor.
 */
export function PreviewTools() {
  useKeepLinksInPreview();
  return (
    <>
      <VisualEditingBridge />
      <PreviewBridge />
      <EditorShortcuts />
      <InsertPalette />
      <CanvasAddButton />
      {BLOCK_CANVAS_TOOLS.map((Tool, i) => (
        <Tool key={i} />
      ))}
      <CanvasResizer />
      <SpacingResizer />
      <BlockMarginResizer />
      <SectionSpacingResizer />
      <DisableDraftMode />
    </>
  );
}

/**
 * Internal links point at the static public pages (no drafts, no overlays).
 * Rewrite them to the mirrored /preview route so navigating keeps the editor.
 */
function useKeepLinksInPreview() {
  useEffect(() => {
    const skip = /^\/(preview|studio|api)(\/|$)/;
    const rewrite = () => {
      document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((a) => {
        const href = a.getAttribute("href")!;
        if (href.startsWith("//") || skip.test(href)) return;
        a.setAttribute("href", previewPrefix + (href === "/" ? "" : href));
        a.setAttribute("data-astro-prefetch", "false");
      });
    };
    rewrite();
    const mo = new MutationObserver(rewrite);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
}
