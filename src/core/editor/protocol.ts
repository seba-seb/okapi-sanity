import type { Routes } from "@/core/lib/routes";
import type { Page } from "@/core/lib/types";

/**
 * Editor (Studio tool) ↔ canvas (/edit-canvas iframe), same origin, via
 * postMessage. The canvas fetches nothing: it renders only what the
 * authenticated editor sends it, so the route itself exposes no drafts.
 */
export type ToCanvas =
  | { type: "render"; doc: Page; routes: Routes }
  | { type: "select"; path: string | null };

export type ToEditor =
  | { type: "ready" }
  | { type: "select"; path: string | null };

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

export const CANVAS_PATH = "/edit-canvas";
