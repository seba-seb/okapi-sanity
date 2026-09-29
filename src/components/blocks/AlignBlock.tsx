import type { CSSProperties, ReactNode } from "react";

import { spaceVar } from "@/lib/style";

/**
 * Layout wrapper for a single text block (Eyebrow / Heading / Paragraph).
 *
 * It stretches full-width within the section and aligns its child horizontally
 * from the section's `--alignment` custom property (start | center | end |
 * stretch) — so horizontal alignment is set ONCE on the Section instead of per
 * block. The child keeps its own `max-width`; alignment is purely the wrapper's
 * job. See `.align-block` in globals.css and `contentAlign` in Section.tsx.
 *
 * Bottom margin (the block's vertical rhythm) lives on this outer element:
 *  - `marginBottom` — an explicit spacing token from the block's field, set via
 *    the Studio picker or the on-canvas drag handle (`BlockMarginResizer`). It
 *    renders INLINE so, like the button group's `marginTop`, it beats the
 *    top-level `.section__container > *` margin reset and applies everywhere.
 *  - `space` — the per-type DEFAULT rhythm, used only while `marginBottom` is
 *    unset. It's a class (`.align-block--space-*`) the section reset trims at
 *    the top level and a content wrapper / container trims at its edges.
 */
export function AlignBlock({
  children,
  space,
  marginBottom,
}: {
  children: ReactNode;
  space?: "lg" | "md" | "sm";
  /** Explicit spacing token ("none" | "xs" … "3xl") from the block's field. */
  marginBottom?: string;
}) {
  const hasExplicit = typeof marginBottom === "string" && marginBottom !== "";
  const className =
    space && !hasExplicit
      ? `align-block align-block--space-${space}`
      : "align-block";
  const style: CSSProperties | undefined = hasExplicit
    ? { marginBottom: spaceVar(marginBottom) }
    : undefined;
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
