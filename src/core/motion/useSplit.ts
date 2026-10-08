import type { RefObject } from "react";

import { gsap, SplitText, skipDecorative, useGSAP } from "./gsap";

/**
 * SplitText the way this starter needs it (see AGENTS.md → animations):
 * - `ref` is an INNER element, never the one carrying `data-sanity`.
 * - The caller keys the component by its text, so an edit remounts it instead
 *   of React patching split DOM; useGSAP reverts the split on unmount.
 * - Decorative: skipped in the preview and with reduced motion.
 * - The element starts hidden ([data-split] in globals.css) and is shown once
 *   split, so it never flashes in → out → in.
 * `animate` returns the animation so autoSplit can carry its progress across
 * re-splits (font load, resize).
 */
export function useSplit(
  ref: RefObject<HTMLElement | null>,
  vars: SplitText.Vars,
  animate: (split: SplitText) => gsap.core.Animation | void,
) {
  useGSAP(
    () => {
      const el = ref.current!;
      if (skipDecorative()) {
        gsap.set(el, { visibility: "visible" });
        return;
      }
      SplitText.create(el, {
        ...vars,
        autoSplit: true,
        onSplit(self) {
          gsap.set(el, { visibility: "visible" });
          return animate(self);
        },
      });
    },
    { scope: ref },
  );
}
