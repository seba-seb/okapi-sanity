/**
 * Default field values for a freshly-created block.
 *
 * Two insert paths need these and must agree:
 *  1. The Studio array input, which resolves each schema's `initialValue`.
 *  2. The Presentation on-canvas insert (right-click "Insert before/after" and
 *     the "+" menu). The library's `getArrayInsertPatches` inserts a bare
 *     `{_type,_key}` and does NOT resolve `initialValue`, so without help a new
 *     text block comes in EMPTY — and since Heading/Paragraph/Eyebrow/Button
 *     render `null` when empty, the block is invisible on the canvas.
 *
 * To keep both paths identical, the schema `initialValue`s import the strings /
 * helpers below, and the runtime patch to `@sanity/visual-editing` reads
 * `INSERT_DEFAULTS` off `globalThis` (published by VisualEditingBridge) to seed
 * canvas inserts. This module is intentionally dependency-free (no `sanity`, no
 * React) so it can be imported from both the Studio schema and the front-end.
 */

export const HEADING_TEXT = "Heading";
export const PARAGRAPH_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";
export const EYEBROW_TEXT = "Eyebrow";
export const BUTTON_LABEL = "Button Text";
/** Served from `public/`; shown by Image / Card blocks that have no image yet. */
export const PLACEHOLDER_IMAGE = "/placeholder.svg";

export const CARD_HEADING = "Card Heading";
export const CARD_BODY =
  "A short supporting line that describes what this card is about.";

/** Builds a single-block Portable Text value from a plain string. */
export function ptFromString(text: string) {
  return [
    {
      _type: "block",
      _key: "initial",
      style: "normal",
      markDefs: [],
      children: [{ _type: "span", _key: "initial0", text, marks: [] }],
    },
  ];
}

/**
 * The default (primary) button seeded into a new Button Group. A group starts
 * with one; the SECOND button added defaults to "outline" — see
 * ButtonsArrayInput, which watches the array and can't be done via a static
 * `initialValue` (that has no view of sibling count).
 */
export function defaultButton() {
  return {
    _type: "button",
    _key: "button0",
    label: BUTTON_LABEL,
    style: "primary",
    newTab: false,
    fullWidth: false,
  };
}

/**
 * The blocks seeded into a new Content wrapper: an eyebrow, heading, paragraph,
 * and a button group carrying a primary + outline pair. Keys are static but
 * unique within each nested array; the canvas insert re-keys the whole subtree.
 */
export function defaultContentWrapperContent() {
  return [
    { _type: "eyebrow", _key: "cwEyebrow", text: EYEBROW_TEXT },
    { _type: "heading", _key: "cwHeading", text: ptFromString(HEADING_TEXT) },
    {
      _type: "paragraph",
      _key: "cwParagraph",
      text: ptFromString(PARAGRAPH_TEXT),
    },
    {
      _type: "buttonWrapper",
      _key: "cwButtons",
      size: "md",
      buttons: [
        { _type: "button", _key: "cwBtnA", label: BUTTON_LABEL, style: "primary", newTab: false, fullWidth: false },
        { _type: "button", _key: "cwBtnB", label: BUTTON_LABEL, style: "outline", newTab: false, fullWidth: false },
      ],
    },
  ];
}

/** The default card seeded into a new Grid. */
export function defaultCard() {
  return {
    _type: "card",
    _key: "card0",
    layout: "imageTop",
    heading: CARD_HEADING,
    body: CARD_BODY,
  };
}

/**
 * `_type` → factory producing the default field values for a new block of that
 * type (everything except `_type`/`_key`, which the caller stamps). Factories
 * rather than shared constants so every insert gets its own object graph; the
 * patch additionally re-keys nested array items so keys stay unique.
 */
export const INSERT_DEFAULTS: Record<string, () => Record<string, unknown>> = {
  heading: () => ({ text: ptFromString(HEADING_TEXT) }),
  paragraph: () => ({ text: ptFromString(PARAGRAPH_TEXT) }),
  eyebrow: () => ({ text: EYEBROW_TEXT }),
  button: () => ({ label: BUTTON_LABEL }),
  buttonWrapper: () => ({ size: "md", buttons: [defaultButton()] }),
  contentWrapper: () => ({ content: defaultContentWrapperContent() }),
  card: () => ({ layout: "imageTop", heading: CARD_HEADING, body: CARD_BODY }),
  grid: () => ({ items: [defaultCard()] }),
  logo3d: () => ({ preset: "shape1", maxWidth: 35 }),
};
