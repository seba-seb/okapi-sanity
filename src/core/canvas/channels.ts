/**
 * Shared contract for the live hover-preview feature.
 *
 * The Studio and the front-end preview are served from the same origin, so a
 * `BroadcastChannel` is the simplest bridge between them. When you hover an
 * option in a dropdown (the custom `PreviewSelect` input), the Studio
 * broadcasts a `preview` message; the `PreviewBridge` mounted in the preview
 * applies it to the matching element without touching the draft, then reverts
 * on `clear`.
 */

export const PREVIEW_CHANNEL = "sanity-hover-preview";

/**
 * Channel for the on-canvas drag-to-resize handle. The preview (where the
 * dragging happens) can't write to the dataset — it has no write token — so on
 * pointer-up it broadcasts a `commit` and the Studio, which is authenticated,
 * patches the draft. See `CanvasResizer` (preview) and `CanvasResizeListener`
 * (Studio).
 */
export const RESIZE_CHANNEL = "sanity-canvas-resize";

export type ResizeMessage =
  | {
      type: "commit";
      /** Base document id (no `drafts.` prefix). */
      id: string;
      /** GROQ path of the block, e.g. `sections[_key=="a"].content[_key=="b"]`. */
      path: string;
      /** The numeric field being written, e.g. "maxWidth". */
      field: string;
      /** The new value (in `ch`), or `null` to unset it (max-width: none). */
      value: number | null;
    }
  | {
      /**
       * Real-time preview from the Studio range slider while dragging
       * (studio→preview). Applied straight to the DOM so the canvas tracks the
       * drag; the draft is written only on release (Sanity throttles rapid
       * patches, so a draft-only approach lags until you let go).
       */
      type: "preview";
      /** GROQ path of the block, matching its `data-sanity-path` attribute. */
      path: string;
      /** The numeric field being previewed, e.g. "maxWidth". */
      field: string;
      /** The candidate value (in `ch`), or `null` for max-width: none. */
      value: number | null;
    };

export type PreviewMessage =
  | {
      type: "preview";
      /** GROQ path of the block, matching its `data-sanity-path` attribute. */
      path: string;
      /** The block's `_type`, e.g. "heading". */
      blockType: string;
      /** The field being previewed, e.g. "size". */
      field: string;
      /** The candidate value being hovered. */
      value: string;
    }
  /** Hover ended without a click: restore what was there. */
  | { type: "clear" }
  /**
   * The hovered value was clicked and written to the draft. Drop the pending
   * revert WITHOUT restoring: the DOM already shows the committed value, and
   * restoring could land after React re-rendered it — leaving the old value on
   * screen while React believes the new one is there.
   */
  | { type: "commit" };

type PathSegment = string | number | { _key: string } | [number | "", number | ""];

/**
 * A form path (["sections", {_key:"a"}, "content", {_key:"b"}, "size"]) →
 * the block's GROQ path as rendered in `data-sanity-path`
 * (`sections[_key=="a"].content[_key=="b"]`) + the field name ("size").
 * Null for anything that isn't a keyed-array block field.
 */
export function toBlockTarget(path: readonly PathSegment[]): { path: string; field: string } | null {
  const field = path[path.length - 1];
  if (typeof field !== "string" || path.length < 3) return null;
  let out = "";
  for (const seg of path.slice(0, -1)) {
    if (typeof seg === "string") out += out ? `.${seg}` : seg;
    else if (seg && typeof seg === "object" && "_key" in seg) out += `[_key=="${seg._key}"]`;
    else return null; // index / range segments: not a block path
  }
  return { path: out, field };
}

import type { Path } from "sanity";

/**
 * Serializes a Sanity form path (array of segments) into the same GROQ string
 * the front-end stamps as `data-sanity-path`, e.g.
 * `["sections", {_key:"a"}, "content", {_key:"b"}]` →
 * `sections[_key=="a"].content[_key=="b"]`.
 */
export function groqPath(segments: Path): string {
  let out = "";
  for (const seg of segments) {
    if (typeof seg === "string") {
      out += out ? `.${seg}` : seg;
    } else if (typeof seg === "number") {
      out += `[${seg}]`;
    } else if (Array.isArray(seg)) {
      out += `[${seg[0]}:${seg[1]}]`;
    } else if (seg && typeof seg === "object" && "_key" in seg) {
      out += `[_key=="${seg._key}"]`;
    }
  }
  return out;
}
