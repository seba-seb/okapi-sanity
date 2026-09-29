import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import type { BlockProps } from "@/blocks/_shared/props";
import { resolveLink, useRoutes, type LinkValue } from "@/core/lib/routes";

type ButtonData = {
  label?: string;
  link?: LinkValue;
  /** Legacy (pre-`link`) fields, still honoured by resolveLink. */
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
  const routes = useRoutes();
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

  const link = resolveLink(c.link ?? c, routes) ?? { href: "#" };

  return (
    <a
      className={className}
      style={standalone ? { alignSelf: "flex-start" } : undefined}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
      {...(dragFlow ? { "data-sanity-drag-flow": dragFlow } : {})}
      {...link}
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
