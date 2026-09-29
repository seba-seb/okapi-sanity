import { editable } from "@/sanity/dataAttr";
import { clean } from "@/lib/clean";
import { alignItems, px, responsiveVars } from "@/lib/style";
import type { Block, ResponsiveNumber } from "@/lib/types";
import type { BlockProps } from "./props";
import { Blocks } from "../BlockRenderer";

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
    "--col-gap": px(c.columnGap) ?? "24px",
    "--row-gap": px(c.rowGap) ?? "24px",
    "--align-items": alignItems(c.alignItems),
    alignSelf: "stretch",
  } as React.CSSProperties;

  return (
    <div
      className="grid"
      style={style}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <Blocks blocks={block.items} pathPrefix={`${path}.items`} ctx={ctx} />
    </div>
  );
}
