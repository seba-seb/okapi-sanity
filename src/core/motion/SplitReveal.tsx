import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { previewPrefix } from "@/core/sanity/env";

if (typeof window !== "undefined") gsap.registerPlugin(SplitText, ScrollTrigger, useGSAP);

export type SplitMode = "words" | "lines";

// ponytail: the preview routes are exactly /preview/*. Checked synchronously —
// useIsPresentationTool() starts at null, so it would animate, then stop.
const skipAnimation = () =>
  location.pathname.startsWith(previewPrefix) ||
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Line-masked text reveal on scroll. Rules this follows (see CLAUDE.md):
 * - Splits an inner <span>, never the element carrying `data-sanity` (the
 *   overlay target must keep stable nodes).
 * - The caller keys this by the text, so an edit remounts it instead of React
 *   patching SplitText's DOM; `useGSAP` reverts the split on unmount.
 * - No animation under /preview: editing re-splits on every keystroke.
 * - Hidden by CSS ([data-split]) until split, so it doesn't flash in → out.
 */
export function SplitReveal({ mode, children }: { mode: SplitMode; children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current!;
      if (skipAnimation()) {
        gsap.set(el, { visibility: "visible" });
        return;
      }
      SplitText.create(el, {
        type: mode === "lines" ? "lines" : "words,lines",
        mask: "lines",
        linesClass: "split-line", // mask gets "split-line-mask" (see globals.css)
        autoSplit: true, // re-split on font load / resize, keeping progress
        onSplit(self) {
          gsap.set(el, { visibility: "visible" });
          return gsap.from(mode === "lines" ? self.lines : self.words, {
            yPercent: 110,
            duration: mode === "lines" ? 0.9 : 0.7,
            ease: "power3.out",
            stagger: mode === "lines" ? 0.12 : 0.04,
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          });
        },
      });
    },
    { scope: ref },
  );

  return (
    <span ref={ref} data-split style={{ display: "block" }}>
      {children}
    </span>
  );
}
