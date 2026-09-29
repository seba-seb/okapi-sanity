import { editable, keyed } from "@/sanity/dataAttr";
import { clean } from "@/lib/clean";
import { spaceVar } from "@/lib/style";
import type { Block } from "@/lib/types";
import type { BlockProps } from "./props";
import { Button } from "./Button";

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
    "btn-group",
    // Size cascades to every button via `--btn-font-size` (see globals.css).
    `btn-group--size-${c.size ?? "md"}`,
    isRow ? "" : "btn-group--column",
    c.wrap === false ? "btn-group--nowrap" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      style={{
        flexDirection: isRow ? "row" : "column",
        // Horizontal alignment comes from the section's --alignment. For a row
        // that's the main axis (justify-content); for a column it's the cross
        // axis (align-items). A row keeps its buttons vertically centered.
        justifyContent: isRow ? "var(--alignment, start)" : undefined,
        alignItems: isRow ? "center" : "var(--alignment, start)",
        gap: spaceVar(c.gap) ?? "var(--space-sm)",
        // Falls back to the `.btn-group` default (--space-lg) when unset.
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
