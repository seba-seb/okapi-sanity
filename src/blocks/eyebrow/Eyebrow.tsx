import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import type { BlockProps } from "@/blocks/_shared/props";
import { AlignBlock } from "@/blocks/_shared/AlignBlock";

type EyebrowData = {
  text?: string;
  size?: "xs" | "sm" | "md";
  color?: "brand" | "default" | "muted";
  marginBottom?: string;
};

export function Eyebrow({ block, path, ctx }: BlockProps<EyebrowData & any>) {
  if (!block.text) return null;
  const c = clean(block);
  // Horizontal alignment comes from the section's --ok-alignment via AlignBlock.
  return (
    <AlignBlock space="lg" marginBottom={c.marginBottom}>
      <p
        className={`ok-eyebrow ok-eyebrow--${c.size ?? "sm"} ok-c-${c.color ?? "brand"}`}
        {...editable(ctx.documentId, ctx.documentType, path, block._type)}
      >
        {/* Cleaned (stega-free) text so the block is a single draggable overlay
            target — see clean.ts. */}
        {c.text}
      </p>
    </AlignBlock>
  );
}
