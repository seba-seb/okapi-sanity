import type { Routes } from "@/core/lib/routes";
import type { Page } from "@/core/lib/types";
import type { Components } from "@/core/render/components";

/**
 * Editor (Studio tool) ↔ canvas (/edit-canvas iframe), same origin, via
 * postMessage. The canvas fetches nothing: it renders only what the
 * authenticated editor sends it, so the route itself exposes no drafts.
 */
export type ToCanvas =
  | { type: "render"; doc: Page; routes: Routes; components: Components }
  /** `scroll`: bring it into view (selection came from the layers panel). */
  | { type: "select"; path: string | null; scroll?: boolean; paths?: string[] }
  /** Remount the page once with decorative motion on ("Play" in the editor). */
  | { type: "replay" };

export type ToEditor =
  | { type: "ready" }
  /** `add`: shift/⌘-click — toggle this block in the selection. */
  | { type: "select"; path: string | null; add?: boolean }
  /** Inline text edit. `final` on Enter/blur; intermediate ones keep the draft live. */
  | { type: "text"; path: string; field: string; kind: "pt" | "string"; value: string; pt?: unknown[]; final: boolean }
  /** A block dragged on the canvas and dropped before/after another. */
  | { type: "move"; from: string; target: string; position: "before" | "after" }
  /** A file dropped on an image-bearing block. */
  | { type: "drop"; path: string; field: string; file: File }
  /** Shortcut pressed while focus is in the canvas. */
  | { type: "key"; key: string; mod: boolean; shift: boolean; alt: boolean };

const TAG = "remarkable-editor";
type Envelope<T> = { tag: typeof TAG; msg: T };

export function post<T extends ToCanvas | ToEditor>(target: Window | null | undefined, msg: T) {
  target?.postMessage({ tag: TAG, msg } satisfies Envelope<T>, location.origin);
}

/** Subscribe to protocol messages from the same origin only. */
export function listen<T extends ToCanvas | ToEditor>(handler: (msg: T, source: MessageEventSource | null) => void) {
  const onMessage = (e: MessageEvent) => {
    if (e.origin !== location.origin) return;
    const env = e.data as Envelope<T> | undefined;
    if (env?.tag === TAG) handler(env.msg, e.source);
  };
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}

export { CANVAS_PATH } from "@/core/sanity/env";
