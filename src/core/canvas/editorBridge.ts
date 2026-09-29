/**
 * Shared contract for the block keyboard shortcuts (delete / duplicate / copy /
 * paste) that act on the element selected in the Presentation preview.
 *
 * The preview owns the selection, the clipboard, and the mutation — it applies
 * the change optimistically through `@sanity/visual-editing`'s document mutator
 * (the same low-latency path typing uses), so edits appear instantly.
 *
 * The only cross-frame traffic is this `command` message: clicking a preview
 * overlay can move keyboard focus into the Studio window, so a shortcut pressed
 * there is forwarded over the channel back to the preview, which executes it.
 */

export const EDITOR_CHANNEL = "sanity-editor-ops";

export type EditorAction = "delete" | "duplicate" | "copy" | "paste";

export type EditorMessage =
  | { type: "command"; action: EditorAction }
  // Sent by the preview on a canvas click so the Studio can suppress the
  // autofocus that Presentation drops into the clicked element's field. See
  // `CanvasAutofocusGuard`.
  | { type: "canvas-select" }
  // Sent from the Studio (when focus is there) to open the preview's quick-insert
  // palette. See `InsertPalette`.
  | { type: "open-palette" };

/**
 * Maps a keydown to an editor action (or null). Kept pure so the preview and the
 * Studio derive the exact same shortcut from a key press.
 *
 * Backspace maps to delete too: on Mac the key labelled "delete" IS Backspace.
 */
export function actionForKey(e: KeyboardEvent): EditorAction | null {
  if (e.altKey) return null;
  const mod = e.metaKey || e.ctrlKey;
  if (!mod && (e.key === "Delete" || e.key === "Backspace")) return "delete";
  if (mod && (e.key === "d" || e.key === "D")) return "duplicate";
  if (mod && (e.key === "c" || e.key === "C")) return "copy";
  if (mod && (e.key === "v" || e.key === "V")) return "paste";
  return null;
}

/**
 * True when focus is in a text-editing context (a form input, textarea, or
 * rich-text editor), where our shortcuts must defer to native behavior so
 * typing, Backspace, and native copy/paste keep working.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const candidates: (HTMLElement | null)[] = [el];
  const active = el?.ownerDocument?.activeElement as HTMLElement | null;
  if (active) candidates.push(active);

  for (const node of candidates) {
    if (!node || !node.tagName) continue;
    const tag = node.tagName.toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (node.isContentEditable) return true;
    if (
      typeof node.closest === "function" &&
      node.closest('[contenteditable="true"], [role="textbox"]')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * True when the user has an actual text range selected — native copy should win
 * over block-copy so people can still copy text out of the page.
 */
export function hasTextSelection(doc: Document | undefined): boolean {
  const sel = doc?.getSelection?.();
  return !!sel && !sel.isCollapsed && sel.toString().trim().length > 0;
}
