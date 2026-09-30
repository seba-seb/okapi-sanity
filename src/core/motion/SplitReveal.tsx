import { useRef, type ReactNode } from "react";

import { gsap } from "./gsap";
import { useSplit } from "./useSplit";

export type SplitMode = "words" | "lines";

/** Line-masked text reveal on scroll. Key it by the text (see useSplit). */
export function SplitReveal({ mode, children }: { mode: SplitMode; children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useSplit(
    ref,
    {
      type: mode === "lines" ? "lines" : "words,lines",
      mask: "lines",
      linesClass: "split-line", // mask gets "split-line-mask" (see globals.css)
    },
    (self) =>
      gsap.from(mode === "lines" ? self.lines : self.words, {
        yPercent: 110,
        duration: mode === "lines" ? 0.9 : 0.7,
        ease: "power3.out",
        stagger: mode === "lines" ? 0.12 : 0.04,
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      }),
  );
  return (
    <span ref={ref} data-split style={{ display: "block" }}>
      {children}
    </span>
  );
}
