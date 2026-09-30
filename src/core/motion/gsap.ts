import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { previewPrefix } from "@/core/sanity/env";

// One registration for the whole site; import GSAP from here, not from "gsap".
if (typeof window !== "undefined") gsap.registerPlugin(SplitText, ScrollTrigger, useGSAP);

export { gsap, SplitText, ScrollTrigger, useGSAP };

/**
 * The motion policy, in one place:
 * - DECORATIVE motion (entrances, text splits, loops) is skipped in the editor
 *   preview — it would replay or re-split on every keystroke — and with
 *   prefers-reduced-motion.
 * - LAYOUT motion (pin, horizontal scroll, scrub) still runs in the preview:
 *   without it the editor can't reach the content it's editing. It's skipped
 *   only for reduced motion (blocks fall back to a native layout).
 *
 * `inPreview` is checked synchronously from the URL (the preview routes are
 * exactly /preview/*); useIsPresentationTool() starts at null, so it would
 * animate, then stop.
 */
export const inPreview = () =>
  typeof location !== "undefined" &&
  (location.pathname.startsWith(previewPrefix) ||
    // Dev-only: lets /lab exercise the editor's motion policy without a draft cookie.
    (import.meta.env.DEV && new URLSearchParams(location.search).has("as-preview")));
export const reducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const skipDecorative = () => inPreview() || reducedMotion();
export const skipLayout = reducedMotion;
