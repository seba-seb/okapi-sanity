/**
 * Shared max-width ranges (in `ch`) for text blocks.
 *
 * A single source of truth so the Studio schema sliders and the on-canvas
 * drag-to-resize handle clamp to exactly the same bounds. `ch` (character
 * width) is used instead of `px` because it ties line length to the font — a
 * "measure" of ~45-75ch is the classic readable column, regardless of size.
 */
export const CH_MAX_WIDTH = {
  heading: { min: 2, max: 16, step: 0.1, unit: "ch" },
  paragraph: { min: 2, max: 70, step: 1, unit: "ch" },
  // The 3D logo isn't text — it sizes in `rem` (root font-size), ~128px–1024px.
  logo3d: { min: 8, max: 64, step: 1, unit: "rem" },
} as const;

/** Default measure for a new paragraph (in `ch`). Headings default to Auto. */
export const PARAGRAPH_MAX_WIDTH_DEFAULT = 60;

export type ResizableType = keyof typeof CH_MAX_WIDTH;
export type MaxWidthUnit = "ch" | "rem";

/** The CSS length unit a block's max-width is expressed in. */
export function unitFor(type: ResizableType): MaxWidthUnit {
  return CH_MAX_WIDTH[type].unit;
}

/** Narrows an arbitrary `data-sanity-type` to a block that supports resizing. */
export function isResizableType(
  type: string | null | undefined,
): type is ResizableType {
  return type === "heading" || type === "paragraph" || type === "logo3d";
}
