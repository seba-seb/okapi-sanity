"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";

type Slide = { key: string; node: ReactNode };

type Props = {
  styleVars: React.CSSProperties;
  loop: boolean;
  align: string;
  showArrows: boolean;
  showDots: boolean;
  editAttr: Record<string, string>;
  slides: Slide[];
};

export function SliderClient({
  styleVars,
  loop,
  align,
  showArrows,
  showDots,
  editAttr,
  slides,
}: Props) {
  // Guard the Embla `align` option: it must be exactly "start" | "center" |
  // "end" (Embla looks it up in a lookup table), so coerce anything else.
  const safeAlign = align === "center" || align === "end" ? align : "start";

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop,
    align: safeAlign,
    containScroll: "trimSnaps",
  });

  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => {
      setSnaps(emblaApi.scrollSnapList());
      onSelect();
    };
    sync();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", sync);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", sync);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="embla" style={styleVars} {...editAttr}>
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container">
          {slides.map((slide) => (
            <div className="embla__slide" key={slide.key}>
              {slide.node}
            </div>
          ))}
        </div>
      </div>

      {(showArrows || showDots) && (
        <div className="embla__controls">
          {showDots ? (
            <div className="embla__dots">
              {snaps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`embla__dot ${i === selected ? "embla__dot--selected" : ""}`}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => emblaApi?.scrollTo(i)}
                />
              ))}
            </div>
          ) : (
            <span />
          )}

          {showArrows ? (
            <div className="embla__buttons">
              <button
                type="button"
                className="embla__button"
                aria-label="Previous slide"
                disabled={!canPrev}
                onClick={() => emblaApi?.scrollPrev()}
              >
                &#8249;
              </button>
              <button
                type="button"
                className="embla__button"
                aria-label="Next slide"
                disabled={!canNext}
                onClick={() => emblaApi?.scrollNext()}
              >
                &#8250;
              </button>
            </div>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
