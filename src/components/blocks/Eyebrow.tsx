import { editable } from "@/sanity/dataAttr";
import { clean } from "@/lib/clean";
import type { BlockProps } from "./props";
import { AlignBlock } from "./AlignBlock";

type EyebrowData = {
  text?: string;
  size?: "xs" | "sm" | "md";
  color?: "brand" | "default" | "muted";
  marginBottom?: string;
};

export function Eyebrow({ block, path, ctx }: BlockProps<EyebrowData & any>) {
  if (!block.text) return null;
  const c = clean(block);
  // Horizontal alignment comes from the section's --alignment via AlignBlock.
  return (
    <AlignBlock space="lg" marginBottom={c.marginBottom}>
      <p
        className={`eyebrow eyebrow--${c.size ?? "sm"} c-${c.color ?? "brand"}`}
        {...editable(ctx.documentId, ctx.documentType, path, block._type)}
      >
        {/* Cleaned (stega-free) text so the block is a single draggable overlay
            target — see clean.ts. */}
        {c.text}
      </p>
    </AlignBlock>
  );
}
