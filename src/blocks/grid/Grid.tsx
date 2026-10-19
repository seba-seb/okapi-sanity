import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import { alignItems, px, responsiveVars } from "@/theme/style";
import type { Block, ResponsiveNumber } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { Blocks } from "@/core/render/BlockRenderer";

type GridData = {
  items?: Block[];
  columns?: ResponsiveNumber;
  columnGap?: number;
  rowGap?: number;
  alignItems?: "stretch" | "start" | "center" | "end";
};

export function Grid({ block, path, ctx }: BlockProps<GridData & any>) {
  if (!block.items?.length) return null;
  const c = clean(block);

  const style = {
    ...responsiveVars("cols", c.columns, { mobile: 1, tablet: 2, desktop: 2 }),
    "--ok-col-gap": px(c.columnGap) ?? "24px",
    "--ok-row-gap": px(c.rowGap) ?? "24px",
    "--ok-align-items": alignItems(c.alignItems),
    alignSelf: "stretch",
  } as React.CSSProperties;

  return (
    <div
      className="ok-grid"
      style={style}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <Blocks blocks={block.items} pathPrefix={`${path}.items`} ctx={ctx} />
    </div>
  );
}
