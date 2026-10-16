import { blockMeta } from "@/blocks/meta";

/** Appends an array-item selector to a path. */
export function keyed(path: string, key: string): string {
  return `${path}[_key=="${key}"]`;
}

/**
 * Human-readable labels per block `_type`, from the registry (blocks/meta.ts). Shown
 * on the Presentation hover overlay (see the `@sanity/visual-editing` patch,
 * which reads `data-sanity-title`). Falls back to a camelCase→Title split.
 */
export function blockTitle(type?: string): string {
  if (!type) return "Block";
  return (
    blockMeta(type)?.title ??
    type
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

/**
 * The props that make an element an editable, labeled overlay target: the
 * click-to-edit `data-sanity` attribute plus a `data-sanity-title` the overlay
 * shows on hover (the element's name, e.g. "Heading", instead of the page).
 */
/**
 * The attributes that make a rendered element a selectable target on the
 * Okapi Editor canvas: its GROQ path (what the editor writes to), its
 * block type, and the label the selection outline shows. The id/type
 * arguments are kept for call-site compatibility.
 */
export function editable(
  _id: string,
  _type: string,
  path: string,
  blockType?: string,
  /** Overrides the label — e.g. a section passes "Section — <name>". */
  title?: string,
): { "data-sanity-title": string; "data-sanity-path": string; "data-sanity-type": string; "data-b": string } {
  return {
    // The block's _key: what core/style/stylesheet targets.
    "data-b": path.match(/\[_key=="([^"]+)"\]$/)?.[1] ?? "",
    "data-sanity-title": title || blockTitle(blockType),
    "data-sanity-path": path,
    "data-sanity-type": blockType ?? "",
  };
}
