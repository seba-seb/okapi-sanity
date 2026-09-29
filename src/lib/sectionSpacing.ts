/**
 * Section vertical-padding tokens, for the on-canvas section spacing handles
 * (`SectionSpacingResizer`). Unlike the block spacing scale (fixed px, see
 * spacingScale.ts), section padding maps to responsive `clamp()`/`vw` CSS vars,
 * so the pixel value of each token depends on the viewport and must be resolved
 * live. Mirrors `SECTION_PAD` in components/Section.tsx and the padding options
 * in schemaTypes/section.ts.
 */

import type { SpacingStep } from "./spacingScale";

export type SectionPadToken =
  | "none"
  | "even"
  | "small"
  | "medium"
  | "large"
  | "pageTop";

/** token → CSS length (the `--section-*` vars in globals.css). */
export const SECTION_PAD_CSS: Record<SectionPadToken, string> = {
  none: "0px",
  even: "var(--section-px)",
  small: "var(--section-pad-sm)",
  medium: "var(--section-pad-md)",
  large: "var(--section-pad-lg)",
  pageTop: "var(--section-pad-page-top)",
};

/**
 * Draggable steps per edge. "Page top" reserves room for a fixed nav, so it only
 * makes sense on the TOP edge — the bottom scale omits it (kept in sync with the
 * per-edge option lists in schemaTypes/section.ts).
 */
export const SECTION_PAD_TOP_TOKENS: SectionPadToken[] = [
  "none",
  "even",
  "small",
  "medium",
  "large",
  "pageTop",
];
export const SECTION_PAD_BOTTOM_TOKENS: SectionPadToken[] = [
  "none",
  "even",
  "small",
  "medium",
  "large",
];

/**
 * Resolve each token's CSS length to its current pixel height (clamp/vw depend
 * on the viewport) via a hidden probe. Cheap enough to call once per drag.
 */
export function resolveSectionPadScale(
  tokens: SectionPadToken[],
): SpacingStep[] {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:absolute;left:-9999px;top:0;width:0;visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);
  const steps: SpacingStep[] = tokens.map((token) => {
    probe.style.height = SECTION_PAD_CSS[token];
    return { token, px: probe.getBoundingClientRect().height };
  });
  probe.remove();
  return steps;
}
