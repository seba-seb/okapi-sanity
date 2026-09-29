import { keyed } from "@/sanity/dataAttr";
import { dedupeByKey } from "@/lib/dedupe";
import type { Block as BlockType, RenderContext } from "@/lib/types";

import { Eyebrow } from "./blocks/Eyebrow";
import { Heading } from "./blocks/Heading";
import { Paragraph } from "./blocks/Paragraph";
import { Button } from "./blocks/Button";
import { ButtonWrapper } from "./blocks/ButtonWrapper";
import { ImageBlock } from "./blocks/ImageBlock";
import { LoopingVideo } from "./blocks/LoopingVideo";
import { ContentWrapper } from "./blocks/ContentWrapper";
import { Card } from "./blocks/Card";
import { Grid } from "./blocks/Grid";
import { Slider } from "./blocks/Slider";
import { Logo3d } from "./blocks/Logo3d";

type BlockRenderProps = {
  block: BlockType;
  path: string;
  ctx: RenderContext;
};

/** Renders a single block by switching on its `_type`. */
export function Block({ block, path, ctx }: BlockRenderProps) {
  switch (block._type) {
    case "eyebrow":
      return <Eyebrow block={block} path={path} ctx={ctx} />;
    case "heading":
      return <Heading block={block} path={path} ctx={ctx} />;
    case "paragraph":
      return <Paragraph block={block} path={path} ctx={ctx} />;
    case "button":
      return <Button block={block} path={path} ctx={ctx} standalone />;
    case "buttonWrapper":
      return <ButtonWrapper block={block} path={path} ctx={ctx} />;
    case "imageBlock":
      return <ImageBlock block={block} path={path} ctx={ctx} />;
    case "loopingVideo":
      return <LoopingVideo block={block} path={path} ctx={ctx} />;
    case "contentWrapper":
      return <ContentWrapper block={block} path={path} ctx={ctx} />;
    case "card":
      return <Card block={block} path={path} ctx={ctx} />;
    case "grid":
      return <Grid block={block} path={path} ctx={ctx} />;
    case "slider":
      return <Slider block={block} path={path} ctx={ctx} />;
    case "logo3d":
      return <Logo3d block={block} path={path} ctx={ctx} />;
    default:
      if (process.env.NODE_ENV === "development") {
        return (
          <div style={{ padding: 12, border: "1px dashed #f00", color: "#f00" }}>
            Unknown block type: <code>{block._type}</code>
          </div>
        );
      }
      return null;
  }
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
