import { editable } from "@/sanity/dataAttr";
import { urlForImage } from "@/sanity/image";
import { clean } from "@/lib/clean";
import { alignItems, alignToken } from "@/lib/style";
import type {
  GapSize,
  RenderContext,
  SectionData,
  SectionPadding,
} from "@/lib/types";

import { Blocks } from "./BlockRenderer";

/** Named vertical padding → CSS length (see the `--section-*` vars in globals.css). */
const SECTION_PAD: Record<SectionPadding, string> = {
  none: "0px",
  even: "var(--section-px)",
  small: "var(--section-pad-sm)",
  medium: "var(--section-pad-md)",
  large: "var(--section-pad-lg)",
  pageTop: "var(--section-pad-page-top)",
};

/** T-shirt gap → CSS length (the `--space-*` scale in globals.css). */
const GAP: Record<GapSize, string> = {
  xs: "var(--space-xs)",
  sm: "var(--space-sm)",
  md: "var(--space-md)",
  lg: "var(--space-lg)",
  xl: "var(--space-xl)",
  "2xl": "var(--space-2xl)",
};

export function Section({
  section,
  path,
  ctx,
}: {
  section: SectionData;
  path: string;
  ctx: RenderContext;
}) {
  const c = clean(section);
  const theme = c.theme ?? "light";
  const fullHeight = !!c.fullHeight;

  // Show the section's internal name in the overlay tag ("Section Testimonials")
  // so stacked sections are distinguishable; falls back to just "Section".
  const name = typeof c.name === "string" ? c.name.trim() : "";
  const overlayTitle = name ? `Section ${name}` : undefined;

  const containerStyle = {
    paddingTop: SECTION_PAD[c.paddingTop ?? "medium"] ?? SECTION_PAD.medium,
    paddingBottom:
      SECTION_PAD[c.paddingBottom ?? "medium"] ?? SECTION_PAD.medium,
    gap: GAP[c.gap ?? "md"] ?? GAP.md,
    alignItems: alignItems(c.contentAlign),
    // Full-height (hero) sections center their content vertically.
    justifyContent: fullHeight ? "center" : undefined,
    // Cascades to text blocks (AlignBlock) and the button group, which read
    // `var(--alignment)`. Normalized to start | center | end | stretch — valid
    // for align-items / justify-content / text-align alike.
    "--alignment": alignToken(c.contentAlign),
  } as React.CSSProperties;

  const bgRef = section.backgroundImage?.asset?._ref;
  const bgSrc = bgRef ? urlForImage(section.backgroundImage!).width(2400).url() : null;
  const overlay = (c.overlayOpacity ?? 0) / 100;

  return (
    <section
      className={`section ${fullHeight ? "section--fullheight" : ""}`}
      data-theme={theme}
      {...editable(
        ctx.documentId,
        ctx.documentType,
        path,
        section._type,
        overlayTitle,
      )}
    >
      {bgSrc && (
        <div className="section__bg" aria-hidden="true">
          <img src={bgSrc} alt="" />
          {overlay > 0 && (
            <div className="section__overlay" style={{ opacity: overlay }} />
          )}
        </div>
      )}
      <div className="section__container" style={containerStyle}>
        <Blocks
          blocks={section.content}
          pathPrefix={`${path}.content`}
          ctx={ctx}
        />
      </div>
    </section>
  );
}
