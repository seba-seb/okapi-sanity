import { editable } from "@/sanity/dataAttr";
import { clean } from "@/lib/clean";
import type { BlockProps } from "./props";

type ButtonData = {
  label?: string;
  href?: string;
  newTab?: boolean;
  style?: "primary" | "secondary" | "outline" | "link";
  fullWidth?: boolean;
};

export function Button({
  block,
  path,
  ctx,
  standalone = false,
  dragFlow,
}: BlockProps<ButtonData & any> & {
  standalone?: boolean;
  /**
   * Overrides the Presentation drag-reorder axis for this button. The library
   * otherwise infers the axis by checking whether sibling rects share an exact
   * `y` (see `calcTargetFlow` in @sanity/visual-editing), which is unreliable
   * for center-aligned buttons — so a Button in a row group would drag
   * vertically. Set by ButtonWrapper to match the group's flex direction.
   */
  dragFlow?: "horizontal" | "vertical";
}) {
  if (!block.label) return null;
  const c = clean(block);

  const style = c.style ?? "primary";
  // Every style but the plain text "link" carries the trailing chevron chip.
  const showChevron = style !== "link";

  const className = [
    "btn",
    `btn--${style}`,
    // Size is inherited from the group's `--btn-font-size` (see ButtonWrapper).
    c.fullWidth ? "btn--full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const linkProps = c.newTab
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <a
      href={c.href || "#"}
      className={className}
      style={standalone ? { alignSelf: "flex-start" } : undefined}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
      {...(dragFlow ? { "data-sanity-drag-flow": dragFlow } : {})}
      {...linkProps}
    >
      <span className="btn__label">{c.label}</span>
      {showChevron ? (
        <span className="btn__chevron" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      ) : null}
    </a>
  );
}
