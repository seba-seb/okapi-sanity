import { useRef } from "react";

import { editable } from "@/core/sanity/dataAttr";
import { urlForImage } from "@/core/sanity/image";
import { clean } from "@/core/lib/clean";
import type { Block, SanityImage } from "@/core/lib/types";
import type { BlockProps } from "@/blocks/_shared/props";
import { gsap, skipDecorative, skipLayout, useGSAP } from "@/core/motion/gsap";

type Data = { image?: SanityImage; caption?: string; height?: number; strength?: number; reveal?: boolean };

/** Parallax = layout (runs in preview); the clip reveal = decorative (doesn't). */
export function ParallaxMedia({ block, path, ctx }: BlockProps<Data & Block>) {
  const c = clean(block);
  const frame = useRef<HTMLElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const strength = c.strength ?? 15;
  const ref = block.image?.asset?._ref;
  const src = ref ? urlForImage(block.image!).width(2000).url() : null;

  useGSAP(
    () => {
      if (!skipLayout() && strength > 0)
        gsap.fromTo(
          media.current,
          { yPercent: -strength },
          {
            yPercent: strength,
            ease: "none",
            scrollTrigger: { trigger: frame.current, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      if (c.reveal !== false && !skipDecorative())
        gsap.from(frame.current, {
          clipPath: "inset(18% 12% 18% 12% round 24px)",
          duration: 1.2,
          ease: "power3.out",
          scrollTrigger: { trigger: frame.current, start: "top 85%", once: true },
        });
    },
    { scope: frame, dependencies: [strength, c.reveal], revertOnUpdate: true },
  );

  return (
    <figure
      ref={frame}
      className="relative m-0 self-stretch overflow-hidden rounded-main"
      style={{ height: `${c.height ?? 80}vh` }}
      {...editable(ctx.documentId, ctx.documentType, path, block._type)}
    >
      <div
        ref={media}
        className="absolute inset-x-0"
        style={{ top: `-${strength}%`, bottom: `-${strength}%` }}
      >
        {src ? (
          <img src={src} alt={c.image?.alt ?? ""} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="parallax__fallback h-full w-full" />
        )}
      </div>
      {c.caption ? (
        <figcaption className="absolute bottom-md left-md rounded-pill bg-bg/80 px-sm py-xs text-sm text-fg">
          {c.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
