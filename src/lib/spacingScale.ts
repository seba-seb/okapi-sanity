/**
 * Spacing tokens → px, mirroring the `--space-*` custom properties in
 * globals.css. Shared by the on-canvas spacing drag handles (button-group gap +
 * top margin in `SpacingResizer`, text-block bottom margin in
 * `BlockMarginResizer`) so a dragged value snaps to the exact same steps the
 * Studio's spacing picker offers.
 */

export type SpacingStep = { token: string; px: number };

/** Gap tokens (no "None") — the space *between* items. */
export const GAP_SCALE: SpacingStep[] = [
  { token: "xs", px: 8 },
  { token: "sm", px: 16 },
  { token: "md", px: 24 },
  { token: "lg", px: 40 },
  { token: "xl", px: 64 },
  { token: "2xl", px: 96 },
];

/** Margin tokens — the full scale, adding None (0) and 3XL to the gap steps. */
export const MARGIN_SCALE: SpacingStep[] = [
  { token: "none", px: 0 },
  ...GAP_SCALE,
  { token: "3xl", px: 144 },
];

/** Snaps a px value to the nearest step in `scale`. */
export function snapSpacing(scale: SpacingStep[], pxValue: number): SpacingStep {
  let best = scale[0];
  let bestDist = Infinity;
  for (const step of scale) {
    const dist = Math.abs(pxValue - step.px);
    if (dist < bestDist) {
      bestDist = dist;
      best = step;
    }
  }
  return best;
}
