import { useEffect } from "react";

import {
  EDITOR_CHANNEL,
  actionForKey,
  hasTextSelection,
  isEditableTarget,
} from "../../lib/editorBridge";

/**
 * Clicking a preview overlay can move keyboard focus into the Studio window, so
 * a shortcut pressed afterwards fires here rather than in the iframe. This
 * forwards those keystrokes over the shared channel to the preview's
 * `EditorShortcuts` (which owns the selection, clipboard, and optimistic write)
 * and opens the preview's `InsertPalette` on ⌘/Ctrl + E / F.
 *
 * Keystrokes while editing a field (or with a text range selected) are left
 * alone so typing and native copy keep working. Renders nothing.
 */
export function EditorKeyForwarder() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(EDITOR_CHANNEL);

    const onKeyDown = (e: KeyboardEvent) => {
      // Quick-insert palette: ⌘/Ctrl + E or F (leave ⌘F find alone in a field).
      const mod = e.metaKey || e.ctrlKey;
      if (
        mod &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key === "e" || e.key === "E" || e.key === "f" || e.key === "F")
      ) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        channel.postMessage({ type: "open-palette" });
        return;
      }

      const action = actionForKey(e);
      if (!action) return;
      if (isEditableTarget(e.target)) return;
      if (action === "copy" && hasTextSelection(document)) return;
      e.preventDefault();
      channel.postMessage({ type: "command", action });
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      channel.close();
    };
  }, []);

  return null;
}
