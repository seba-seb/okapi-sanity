import { stegaClean } from "@sanity/client/stega";

/**
 * Strips Sanity's stega encoding from a value.
 *
 * In draft mode, fetched strings carry invisible stega characters that power
 * click-to-edit overlays. Those characters are fine to *display*, but they
 * break any string used as data — an HTML tag name, a CSS class, a
 * `data-ok-theme` attribute, an equality check, etc. Wrap such values in `clean`.
 *
 * We ALSO clean displayed leaf text (heading/paragraph/eyebrow copy, button
 * labels). A stega string rendered as a direct child registers a second
 * overlay target on the block pointing at its scalar field, which shadows the
 * block's array-item node and breaks drag-to-reorder — worst on inline-block
 * blocks (eyebrow) where it covers the whole element. Cleaning leaves the block
 * with a single array-item target: reliably draggable, and clicking it selects
 * the block to edit in the Studio form. (Live preview still updates as you type
 * — that comes from the query stream, not stega.)
 */
export function clean<T>(value: T): T {
  return stegaClean(value) as T;
}
