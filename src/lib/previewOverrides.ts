/**
 * Applies a single dropdown value to a live DOM element so a Studio editor can
 * *preview* it on hover without committing to the draft. Each applier mirrors
 * exactly what the matching block component renders for that field, and returns
 * a `revert` closure that restores the element when the hover ends.
 *
 * Keep these in sync with the block components in `src/components/blocks`.
 */
import { alignItems, alignToken, justifyContent } from "./style";

type Revert = () => void;
type Applier = (root: HTMLElement, value: string) => Revert;

const NOOP: Revert = () => {};

const COLOR = ["default", "muted", "brand"];
const HEADING_SIZE = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];
const EYEBROW_SIZE = ["xs", "sm", "md"];
const PARAGRAPH_SIZE = ["sm", "md", "lg", "xl"];
const BTN_STYLE = ["primary", "secondary", "outline", "link"];
const BTN_SIZE = ["sm", "md", "lg", "xl"];

function setOrRemove(el: HTMLElement, name: string, value: string | null): void {
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** Snapshots the attributes any applier might touch, before it mutates them. */
function snap(el: HTMLElement): Revert {
  const className = el.getAttribute("class");
  const style = el.getAttribute("style");
  const dataTheme = el.getAttribute("data-theme");
  return () => {
    setOrRemove(el, "class", className);
    setOrRemove(el, "style", style);
    setOrRemove(el, "data-theme", dataTheme);
  };
}

function swapClass(
  el: HTMLElement,
  prefix: string,
  values: string[],
  value: string,
): void {
  for (const v of values) el.classList.remove(`${prefix}${v}`);
  if (value) el.classList.add(`${prefix}${value}`);
}

/** Applier that mutates the element carrying `data-sanity-path` itself. */
function onRoot(mutate: (el: HTMLElement, value: string) => void): Applier {
  return (root, value) => {
    const revert = snap(root);
    mutate(root, value);
    return revert;
  };
}

/** Applier that mutates a section's inner content container. */
function onSectionContainer(
  mutate: (el: HTMLElement, value: string) => void,
): Applier {
  return (root, value) => {
    const el = root.querySelector<HTMLElement>(":scope > .section__container");
    if (!el) return NOOP;
    const revert = snap(el);
    mutate(el, value);
    return revert;
  };
}

function ratio(el: HTMLElement, value: string): void {
  if (value === "auto") {
    el.classList.remove("media--ratio");
    el.style.removeProperty("aspect-ratio");
  } else {
    el.classList.add("media--ratio");
    el.style.aspectRatio = value;
  }
}

const APPLIERS: Record<string, Applier> = {
  // Section
  "section:theme": onRoot((el, v) => el.setAttribute("data-theme", v)),
  "section:contentAlign": onSectionContainer((el, v) => {
    el.style.alignItems = alignItems(v);
    // Text blocks (AlignBlock) and the button group align off --alignment.
    el.style.setProperty("--alignment", alignToken(v));
  }),

  // Heading
  "heading:size": onRoot((el, v) => swapClass(el, "heading--", HEADING_SIZE, v)),

  // Eyebrow
  "eyebrow:size": onRoot((el, v) => swapClass(el, "eyebrow--", EYEBROW_SIZE, v)),
  "eyebrow:color": onRoot((el, v) => swapClass(el, "c-", COLOR, v)),

  // Paragraph
  "paragraph:size": onRoot((el, v) =>
    swapClass(el, "paragraph--", PARAGRAPH_SIZE, v),
  ),
  "paragraph:color": onRoot((el, v) => swapClass(el, "c-", COLOR, v)),

  // Button
  "button:style": onRoot((el, v) => swapClass(el, "btn--", BTN_STYLE, v)),

  // Button group
  "buttonWrapper:direction": onRoot((el, v) => {
    el.style.flexDirection = v === "row" ? "row" : "column";
  }),
  // Size lives on the group; the swapped class re-drives --btn-font-size, which
  // every button inside inherits — so one class swap resizes them all.
  "buttonWrapper:size": onRoot((el, v) =>
    swapClass(el, "btn-group--size-", BTN_SIZE, v),
  ),

  // Grid
  "grid:alignItems": onRoot((el, v) => {
    el.style.setProperty("--align-items", alignItems(v));
  }),

  // Image & video
  "imageBlock:aspectRatio": onRoot(ratio),
  "imageBlock:objectFit": onRoot((el, v) => el.style.setProperty("--fit", v)),
  "loopingVideo:aspectRatio": onRoot(ratio),
  "loopingVideo:objectFit": onRoot((el, v) => el.style.setProperty("--fit", v)),
};

/**
 * Applies a hover preview and returns a `revert`, or `null` if this field has
 * no visual applier (e.g. heading `level`, slider `align`) — the option is
 * still selectable, it just has no live preview.
 */
export function applyPreview(
  root: HTMLElement,
  blockType: string,
  field: string,
  value: string,
): Revert | null {
  const applier = APPLIERS[`${blockType}:${field}`];
  if (!applier) return null;
  try {
    return applier(root, value);
  } catch {
    return null;
  }
}
