import { blockMeta } from "@/blocks/meta";
import { createDataAttribute } from "@sanity/visual-editing/create-data-attribute";

import { dataset, projectId, studioUrl } from "@/core/sanity/env";

/**
 * Produces the `data-sanity` attribute string that turns a rendered element
 * into a click-to-edit target in the Presentation tool.
 *
 * `path` is a GROQ-style path to the field, e.g.
 * `sections[_key=="abc"].content[_key=="def"]`.
 */
export function dataAttr(id: string, type: string, path: string): string {
  return createDataAttribute({
    projectId,
    dataset,
    baseUrl: studioUrl,
    id,
    type,
    path,
  }).toString();
}

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
export function editable(
  id: string,
  type: string,
  path: string,
  blockType?: string,
  /** Overrides the overlay label — e.g. a section passes "Section — <name>". */
  title?: string,
): {
  "data-sanity": string;
  "data-sanity-title": string;
  "data-sanity-path": string;
  "data-sanity-type": string;
  "data-sanity-id": string;
} {
  return {
    "data-sanity": dataAttr(id, type, path),
    "data-sanity-title": title || blockTitle(blockType),
    // Raw GROQ path (e.g. sections[_key=="a"].content[_key=="b"]) used to match
    // this element from the Studio for live hover-preview. See previewBridge.ts.
    "data-sanity-path": path,
    // Block `_type` and document id — read by the on-canvas resize handle to
    // know which blocks are resizable and where to write the change back.
    "data-sanity-type": blockType ?? "",
    "data-sanity-id": id,
  };
}
