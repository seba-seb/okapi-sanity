import { useEffect } from "react";

import { EDITOR_CHANNEL } from "../../lib/editorBridge";

/** True for a Studio form field the autofocus would land in. */
function isFieldElement(el: unknown): boolean {
  const node = el as HTMLElement | null;
  if (!node || typeof node !== "object" || typeof node.tagName !== "string") {
    return false;
  }
  const tag = node.tagName.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (node.isContentEditable) return true;
  return !!node.closest?.('[contenteditable="true"], [role="textbox"]');
}

/**
 * Stops a canvas click from dropping a text cursor into the Studio field.
 *
 * Clicking a preview element makes Presentation navigate the document pane to
 * that field (wanted — the breadcrumb + field appear) AND focus its input (not
 * wanted — it drops a cursor in a field the user didn't ask to edit and pulls
 * keyboard focus off the canvas, so the arrow-key reorder stops firing).
 *
 * We can't just blur the input afterwards: the Studio fires `onFocusPath` on
 * blur, which clears the pane's focus path and collapses the breadcrumb — the
 * navigation we want to keep. So instead we *prevent* the programmatic focus:
 * for a brief window after a canvas click, `.focus()` on a field is a no-op.
 * No blur happens, so the focus path (and the breadcrumb) stay put; the field is
 * just never given the keyboard, and focus stays on the canvas.
 *
 * A real click INTO a Studio field records a Studio pointer first, which
 * disables the guard — so manual editing focuses normally. If the timing ever
 * misses, the worst case is the old behavior (field focused), never broken
 * navigation. Mounted globally in the Studio layout. Renders nothing.
 */
export function CanvasAutofocusGuard() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(EDITOR_CHANNEL);

    let armedUntil = 0;
    let studioPointerAt = 0;

    channel.onmessage = (e: MessageEvent) => {
      if (e.data?.type === "canvas-select") armedUntil = Date.now() + 1200;
    };

    const onPointerDown = () => {
      studioPointerAt = Date.now();
    };
    window.addEventListener("pointerdown", onPointerDown, true);

    // Swallow the field autofocus that Presentation triggers right after a
    // canvas click — without blurring (see the doc comment above).
    const nativeFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (
      this: HTMLElement,
      options?: FocusOptions,
    ): void {
      const now = Date.now();
      if (
        now <= armedUntil &&
        now - studioPointerAt > 250 &&
        isFieldElement(this)
      ) {
        return; // canvas-click autofocus → no-op, keyboard stays on the canvas
      }
      return nativeFocus.call(this, options);
    };

    return () => {
      HTMLElement.prototype.focus = nativeFocus;
      window.removeEventListener("pointerdown", onPointerDown, true);
      channel.close();
    };
  }, []);

  return null;
}
