import { useRef } from "react";

import { editable } from "@/core/sanity/dataAttr";
import type { Block } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { Blocks } from "@/core/render/BlockRenderer";
import { gsap, skipLayout, useGSAP } from "@/core/motion/gsap";

/**
 * Stacking is plain CSS `position: sticky` (no pin-spacers → nothing for React
 * to trip over). GSAP only scrubs each card's scale/brightness while the next
 * one slides over it. Layout motion: runs in the preview too.
 */
export function StackCards({ block, path, ctx }: BlockProps<{ items?: Block[] } & Block>) {
  const root = useRef<HTMLDivElement>(null);
  const itemsKey = (block.items ?? []).map((i) => i._key).join(",");

  useGSAP(
    () => {
      if (skipLayout()) return;
      const cards = gsap.utils.toArray<HTMLElement>(root.current!.children);
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        // fromTo: tweening from filter "none" starts at brightness(0) — a black flash.
        gsap.fromTo(card, { scale: 1, filter: "brightness(1)" }, {
          scale: 0.9,
          filter: "brightness(0.7)",
          ease: "none",
          scrollTrigger: { trigger: next, start: "top bottom", end: "top 20%", scrub: true },
        });
      });
    },
    { scope: root, dependencies: [itemsKey], revertOnUpdate: true },
  );

  return (
    <div
      ref={root}
      className="stack flex flex-col gap-xl self-stretch"
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <Blocks blocks={block.items} pathPrefix={`${path}.items`} ctx={ctx} />
    </div>
  );
}
