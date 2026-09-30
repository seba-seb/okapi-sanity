import { useRef } from "react";

import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import type { Block } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { gsap } from "@/core/motion/gsap";
import { useSplit } from "@/core/motion/useSplit";

type Effect = "rise" | "wave" | "spread";

function Letters({ text, effect }: { text: string; effect: Effect }) {
  const ref = useRef<HTMLSpanElement>(null);
  useSplit(ref, { type: "chars", mask: effect === "rise" ? "chars" : undefined }, (self) => {
    // Already on screen at load (a hero)? A scroll-scrubbed entrance would
    // start half-played, so play it on time instead. Further down: scrub.
    const onScreen = ref.current!.getBoundingClientRect().top < innerHeight * 0.95;
    const timing = onScreen
      ? { duration: 1.2, ease: "power3.out" }
      : { ease: "none", scrollTrigger: { trigger: ref.current, start: "top 95%", end: "top 25%", scrub: 1 } };
    if (effect === "wave")
      return gsap.from(self.chars, { yPercent: 60, rotationX: -90, opacity: 0, stagger: { each: 0.04, from: "center" }, ...timing });
    if (effect === "spread")
      return gsap.from(self.chars, { letterSpacing: "0.5em", opacity: 0.2, ...timing });
    return gsap.from(self.chars, { yPercent: 110, rotate: 6, stagger: 0.03, ...timing });
  });
  return (
    <span ref={ref} data-split className="block">
      {text}
    </span>
  );
}

export function BigType({ block, path, ctx }: BlockProps<{ text?: string; effect?: Effect } & Block>) {
  const c = clean(block);
  if (!c.text) return null;
  return (
    <p
      className="bigtype m-0 self-stretch text-center"
      style={{ perspective: "600px" }}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <Letters key={`${c.text}|${c.effect}`} text={c.text} effect={c.effect ?? "rise"} />
    </p>
  );
}
