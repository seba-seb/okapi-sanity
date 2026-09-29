import { createElement } from "react";

import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import { ch, wrapStyle } from "@/theme/style";
import type { BlockProps } from "@/blocks/_shared/props";
import { AlignBlock } from "@/blocks/_shared/AlignBlock";
import { RichText, richTextIsEmpty } from "@/blocks/_shared/RichText";
import { SplitReveal, type SplitMode } from "@/core/motion/SplitReveal";

type HeadingData = {
  text?: unknown; // Portable Text array (or a legacy string)
  level?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  size?: string;
  textWrap?: string;
  maxWidth?: number;
  marginBottom?: string;
  animation?: "none" | SplitMode;
};

export function Heading({ block, path, ctx }: BlockProps<HeadingData & any>) {
  if (richTextIsEmpty(block.text)) return null;
  const c = clean(block);
  const Tag = c.level ?? "h2";
  // Horizontal alignment comes from the section's --alignment via AlignBlock;
  // the heading only owns its max-width and wrap.
  return (
    <AlignBlock space="md" marginBottom={c.marginBottom}>
      {createElement(
        Tag,
        {
          className: `heading heading--${c.size ?? "xl"} heading--bold`,
          style: {
            textWrap: wrapStyle(c.textWrap ?? "balance"),
            maxWidth: ch(c.maxWidth),
          },
          ...editable(ctx.documentId, ctx.documentType, path, block._type),
        },
        // Rich text (stega-cleaned) rendered inside the semantic tag, so the
        // block stays a single draggable overlay target — see clean.ts / RichText.
        c.animation && c.animation !== "none"
          ? createElement(
              SplitReveal,
              // New text → new key → React drops the split DOM, never patches it.
              { key: JSON.stringify(c.text), mode: c.animation },
              createElement(RichText, { value: c.text }),
            )
          : createElement(RichText, { value: c.text }),
      )}
    </AlignBlock>
  );
}
