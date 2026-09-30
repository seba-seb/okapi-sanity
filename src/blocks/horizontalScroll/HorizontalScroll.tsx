import { useRef } from "react";

import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import type { Block } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { Blocks } from "@/core/render/BlockRenderer";
import { gsap, ScrollTrigger, skipLayout, useGSAP } from "@/core/motion/gsap";

type Data = { heading?: string; items?: Block[]; panelWidth?: number };

/**
 * Layout motion (runs in the preview too). React-safety: GSAP pins `pin`,
 * wrapping it in a pin-spacer INSIDE the outer div, which React owns and never
 * reorders. The track's children can change freely; the trigger is rebuilt
 * when the item list changes and re-measured when the track resizes.
 * Reduced motion → plain native horizontal scroll.
 */
export function HorizontalScroll({ block, path, ctx }: BlockProps<Data & Block>) {
  const c = clean(block);
  const pin = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const itemsKey = (block.items ?? []).map((i) => i._key).join(",");

  useGSAP(
    () => {
      if (skipLayout()) return;
      const t = track.current!;
      const p = pin.current!;
      const distance = () => Math.max(0, t.scrollWidth - p.clientWidth);
      gsap.to(t, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: p,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      // Text edits inside an item change the track's width, not the page's
      // height — ScrollRefresh wouldn't see it.
      let timer: number | undefined;
      const ro = new ResizeObserver(() => {
        clearTimeout(timer);
        timer = window.setTimeout(() => ScrollTrigger.refresh(), 120);
      });
      ro.observe(t);
      return () => {
        ro.disconnect();
        clearTimeout(timer);
      };
    },
    { scope: pin, dependencies: [itemsKey], revertOnUpdate: true },
  );

  return (
    <div className="hscroll" {...editable(ctx.documentId, ctx.documentType, path, block._type)}>
      <div ref={pin} className="flex min-h-svh flex-col justify-center gap-lg overflow-hidden py-xl">
        {c.heading ? (
          <h2 className="heading heading--2xl heading--bold px-section-x">{c.heading}</h2>
        ) : null}
        <div
          ref={track}
          className="hscroll__track flex w-max gap-md px-section-x"
          style={{ "--panel-w": `${c.panelWidth ?? 45}vw` } as React.CSSProperties}
        >
          <Blocks blocks={block.items} pathPrefix={`${path}.items`} ctx={ctx} />
        </div>
      </div>
    </div>
  );
}
