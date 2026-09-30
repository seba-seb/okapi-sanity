import { useEffect } from "react";

import { ScrollTrigger } from "./gsap";

/**
 * Re-measures every ScrollTrigger when the page's content height changes:
 * a live edit that wraps a heading onto a new line, an image that loads, a
 * block inserted from the canvas. Without it pins and scrub ranges keep the
 * numbers from the first layout. Mounted once, by PageBuilder.
 *
 * Also dispatches `motion:refresh` so non-GSAP measurers (sliders) can hook in.
 */
export function ScrollRefresh() {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    let timer: number | undefined;
    let last = main.offsetHeight;
    const ro = new ResizeObserver(() => {
      // Pin spacers change main's height too; only react to real changes so a
      // refresh can't feed itself.
      const h = main.offsetHeight;
      if (Math.abs(h - last) < 2) return;
      last = h;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        ScrollTrigger.refresh();
        last = main.offsetHeight;
        window.dispatchEvent(new CustomEvent("motion:refresh"));
      }, 120);
    });
    ro.observe(main);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, []);
  return null;
}
