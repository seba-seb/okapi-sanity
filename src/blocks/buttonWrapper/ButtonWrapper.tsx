import { editable, keyed } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import { spaceVar } from "@/theme/style";
import type { Block } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { Button } from "@/blocks/button/Button";

type ButtonWrapperData = {
  buttons?: Block[];
  direction?: "row" | "column";
  size?: "sm" | "md" | "lg" | "xl";
  wrap?: boolean;
  gap?: string | number;
  marginTop?: string;
};

export function ButtonWrapper({
  block,
  path,
  ctx,
}: BlockProps<ButtonWrapperData & any>) {
  if (!block.buttons?.length) return null;
  const c = clean(block);
  const isRow = (c.direction ?? "row") === "row";

  const className = [
    "ok-btn-group",
    // Size cascades to every button via `--ok-btn-font-size` (see globals.css).
    `ok-btn-group--size-${c.size ?? "md"}`,
    isRow ? "" : "ok-btn-group--column",
    c.wrap === false ? "ok-btn-group--nowrap" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      style={{
        flexDirection: isRow ? "row" : "column",
        // Horizontal alignment comes from the section's --ok-alignment. For a row
        // that's the main axis (justify-content); for a column it's the cross
        // axis (align-items). A row keeps its buttons vertically centered.
        justifyContent: isRow ? "var(--ok-alignment, start)" : undefined,
        alignItems: isRow ? "center" : "var(--ok-alignment, start)",
        gap: spaceVar(c.gap) ?? "var(--ok-space-sm)",
        // Falls back to the `.ok-btn-group` default (--ok-space-lg) when unset.
        marginTop: spaceVar(c.marginTop),
        alignSelf: "stretch",
      }}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      {block.buttons.map((btn: Block) => (
        <Button
          key={btn._key}
          block={btn}
          path={keyed(`${path}.buttons`, btn._key)}
          ctx={ctx}
          dragFlow={isRow ? "horizontal" : "vertical"}
        />
      ))}
    </div>
  );
}
