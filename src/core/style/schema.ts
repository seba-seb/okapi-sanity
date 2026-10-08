import { defineField, defineType } from "sanity";

import { ALIGN, COLORS, RADII, SPACE, WIDTHS } from "./tokens";

const list = (values: readonly string[]) => ({ list: values.map((v) => ({ title: v, value: v })) });

/** One breakpoint's choices — tokens only, no free values. */
export const styleProps = defineType({
  name: "styleProps",
  title: "Style",
  type: "object",
  fields: [
    defineField({ name: "marginTop", title: "Margin top", type: "string", options: list(SPACE) }),
    defineField({ name: "marginBottom", title: "Margin bottom", type: "string", options: list(SPACE) }),
    defineField({ name: "padding", title: "Padding", type: "string", options: list(SPACE) }),
    defineField({ name: "background", title: "Background", type: "string", options: list(COLORS) }),
    defineField({ name: "color", title: "Text color", type: "string", options: list(COLORS) }),
    defineField({ name: "radius", title: "Corner radius", type: "string", options: list(RADII) }),
    defineField({ name: "maxWidth", title: "Max width", type: "string", options: list(Object.keys(WIDTHS)) }),
    defineField({ name: "textAlign", title: "Text align", type: "string", options: list(ALIGN) }),
    defineField({ name: "hide", title: "Hide", type: "boolean" }),
  ],
});

/** Per-block style with desktop-first overrides; rendered by core/style/stylesheet. */
export const blockStyle = defineType({
  name: "blockStyle",
  title: "Style",
  type: "object",
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({ name: "base", title: "All screens", type: "styleProps" }),
    defineField({ name: "tablet", title: "Tablet and below", type: "styleProps", options: { collapsible: true, collapsed: true } }),
    defineField({ name: "mobile", title: "Mobile", type: "styleProps", options: { collapsible: true, collapsed: true } }),
  ],
});
