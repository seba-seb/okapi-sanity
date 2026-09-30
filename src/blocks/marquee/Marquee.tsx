import { useRef } from "react";

import { editable } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import type { Block } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { gsap, ScrollTrigger, skipDecorative, useGSAP } from "@/core/motion/gsap";

type Data = { items?: string[]; separator?: string; direction?: "left" | "right"; duration?: number; outline?: boolean };

/**
 * Decorative loop: skipped in the preview (a moving target can't be clicked,
 * and the duplicate copy would put every word on the canvas twice). The copy
 * exists only when animating, and is aria-hidden.
 */
export function Marquee({ block, path, ctx }: BlockProps<Data & Block>) {
  const c = clean(block);
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const items = (c.items ?? []).filter(Boolean);
  const key = JSON.stringify([items, c.separator, c.direction, c.duration]);

  useGSAP(
    () => {
      if (skipDecorative()) return;
      const t = track.current!;
      // Clone once for a seamless loop.
      const copy = t.firstElementChild!.cloneNode(true) as HTMLElement;
      copy.setAttribute("aria-hidden", "true");
      t.appendChild(copy);
      const left = c.direction !== "right";
      const loop = gsap.fromTo(
        t,
        { xPercent: left ? 0 : -50 },
        { xPercent: left ? -50 : 0, duration: c.duration ?? 24, ease: "none", repeat: -1 },
      );
      // Scroll velocity boosts the speed, then eases back.
      ScrollTrigger.create({
        trigger: root.current,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          gsap.to(loop, { timeScale: 1 + Math.min(Math.abs(self.getVelocity()) / 300, 5), duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: 1, duration: 1, delay: 0.2, ease: "power2.out" });
        },
      });
      return () => copy.remove();
    },
    { scope: root, dependencies: [key], revertOnUpdate: true },
  );

  if (!items.length) return null;
  return (
    <div
      ref={root}
      className="marquee overflow-hidden"
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <div ref={track} className="flex w-max">
        <div className={`flex shrink-0 items-center ${c.outline ? "marquee--outline" : ""}`}>
          {items.map((word, i) => (
            <span key={i} className="flex items-center">
              <span className="marquee__word">{word}</span>
              <span className="marquee__sep text-brand" aria-hidden="true">
                {c.separator ?? "✦"}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
