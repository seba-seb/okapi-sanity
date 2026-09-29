import { editable } from "@/sanity/dataAttr";
import { clean } from "@/lib/clean";
import { ch, wrapStyle } from "@/lib/style";
import type { BlockProps } from "./props";
import { AlignBlock } from "./AlignBlock";
import { RichText, richTextIsEmpty } from "./RichText";

type ParagraphData = {
  text?: unknown; // Portable Text array (or a legacy string)
  size?: string;
  color?: string;
  textWrap?: string;
  maxWidth?: number;
  marginBottom?: string;
};

export function Paragraph({ block, path, ctx }: BlockProps<ParagraphData & any>) {
  if (richTextIsEmpty(block.text)) return null;
  const c = clean(block);
  // Horizontal alignment comes from the section's --alignment via AlignBlock;
  // the paragraph only owns its max-width and wrap.
  return (
    <AlignBlock space="sm" marginBottom={c.marginBottom}>
      <p
        className={`paragraph paragraph--${c.size ?? "md"} c-${c.color ?? "muted"}`}
        style={{
          maxWidth: ch(c.maxWidth),
          // Preserve author line breaks (the `pre-line` half that matters) via
          // the longhand, so it doesn't collide with the `textWrap` shorthand —
          // both `white-space` and `text-wrap` set text-wrap-mode.
          whiteSpaceCollapse: "preserve-breaks",
          textWrap: wrapStyle(c.textWrap ?? "pretty"),
        }}
        {...editable(ctx.documentId, ctx.documentType, path, block._type)}
      >
        {/* Rich text (stega-cleaned) so the block stays a single draggable
            overlay target — see clean.ts / RichText. */}
        <RichText value={c.text} />
      </p>
    </AlignBlock>
  );
}
