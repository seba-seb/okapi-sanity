import { keyed } from "@/core/sanity/dataAttr";
import { dedupeByKey } from "@/core/lib/dedupe";
import type { Block as BlockType, RenderContext } from "@/core/lib/types";

import { BLOCK_COMPONENTS } from "@/blocks/components";
import type { ContentBlockType } from "@/blocks/meta";

type BlockRenderProps = {
  block: BlockType;
  path: string;
  ctx: RenderContext;
};

/** Renders a single block by looking its `_type` up in the registry. */
export function Block({ block, path, ctx }: BlockRenderProps) {
  const Component = BLOCK_COMPONENTS[block._type as ContentBlockType];
  if (Component) return <Component block={block} path={path} ctx={ctx} />;
  if (process.env.NODE_ENV === "development") {
    return (
      <div style={{ padding: 12, border: "1px dashed #f00", color: "#f00" }}>
        Unknown block type: <code>{block._type}</code>
      </div>
    );
  }
  return null;
}

/** Renders a list of blocks, computing each block's editable path. */
export function Blocks({
  blocks,
  pathPrefix,
  ctx,
}: {
  blocks?: BlockType[];
  pathPrefix: string;
  ctx: RenderContext;
}) {
  if (!blocks?.length) return null;
  return (
    <>
      {dedupeByKey(blocks).map((block) => (
        <Block
          key={block._key}
          block={block}
          path={keyed(pathPrefix, block._key)}
          ctx={ctx}
        />
      ))}
    </>
  );
}
