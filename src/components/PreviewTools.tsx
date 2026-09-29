import { useEffect } from "react";

import { previewPrefix } from "@/sanity/env";
import { DisableDraftMode } from "./DisableDraftMode";
import { EditorShortcuts } from "./EditorShortcuts";
import { InsertPalette } from "./InsertPalette";
import { CanvasAddButton } from "./CanvasAddButton";
import { CanvasLogo3dEditor } from "./CanvasLogo3dEditor";
import { PreviewBridge } from "./PreviewBridge";
import { CanvasResizer } from "./CanvasResizer";
import { SpacingResizer } from "./SpacingResizer";
import { BlockMarginResizer } from "./BlockMarginResizer";
import { SectionSpacingResizer } from "./SectionSpacingResizer";
import { VisualEditingBridge } from "./VisualEditingBridge";

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
      <CanvasLogo3dEditor />
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
