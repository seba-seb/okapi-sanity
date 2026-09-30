import { useRef } from "react";

import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import type { Block } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { gsap } from "@/core/motion/gsap";
import { useSplit } from "@/core/motion/useSplit";

function Scrub({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useSplit(ref, { type: "words" }, (self) =>
    gsap.fromTo(
      self.words,
      { opacity: 0.15 },
      {
        opacity: 1,
        ease: "none",
        stagger: 0.1,
        scrollTrigger: { trigger: ref.current, start: "top 85%", end: "bottom 45%", scrub: true },
      },
    ),
  );
  return (
    <span ref={ref} data-split className="block">
      {text}
    </span>
  );
}

export function TextScrub({ block, path, ctx }: BlockProps<{ text?: string; size?: string } & Block>) {
  const c = clean(block);
  if (!c.text) return null;
  return (
    <p
      className={`heading heading--${c.size ?? "xl"} heading--bold m-0 self-stretch`}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      {/* Keyed by the text: an edit remounts the split instead of patching it. */}
      <Scrub key={c.text} text={c.text} />
    </p>
  );
}
