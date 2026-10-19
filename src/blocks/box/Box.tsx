import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import type { Block } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { Blocks } from "@/core/render/BlockRenderer";
import { space } from "@/core/style/tokens";

type Data = { layout?: "stack" | "row" | "grid"; columns?: number; gap?: string; align?: string; justify?: string; wrap?: boolean; items?: Block[] };

const JUSTIFY: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", between: "space-between" };
const ALIGN: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };

/** Free layout container. Mobile/tablet collapse lives in globals.css (.ok-box--*). */
export function Box({ block, path, ctx }: BlockProps<Data & Block>) {
  const c = clean(block);
  const layout = c.layout ?? "stack";
  const style = {
    gap: space(c.gap ?? "md"),
    alignItems: c.align ? ALIGN[c.align] : undefined,
    justifyContent: layout !== "grid" && c.justify ? JUSTIFY[c.justify] : undefined,
    flexWrap: layout === "row" ? (c.wrap === false ? "nowrap" : "wrap") : undefined,
    "--ok-box-cols": layout === "grid" ? (c.columns ?? 3) : undefined,
  } as React.CSSProperties;
  return (
    <div className={`ok-box ok-box--${layout}`} style={style} {...editable(ctx.documentId, ctx.documentType, path, block._type, c.name ? `Box — ${c.name}` : undefined)}>
      <Blocks blocks={block.items} pathPrefix={`${path}.items`} ctx={ctx} />
    </div>
  );
}
