import { defineField, defineType } from "sanity";
import { MasterDetailIcon } from "@sanity/icons";

import { sliderField } from "./shared/fields";
import { blockMembers } from "./shared/blocks";

/** Named vertical-padding steps. "Page top" reserves room for a fixed nav, so
 *  it only applies to the TOP edge — the bottom list omits it. */
const SECTION_PADDING_OPTIONS_TOP = [
  { title: "None", value: "none" },
  { title: "Even", value: "even" },
  { title: "Small", value: "small" },
  { title: "Medium", value: "medium" },
  { title: "Large", value: "large" },
  { title: "Page top", value: "pageTop" },
];
const SECTION_PADDING_OPTIONS_BOTTOM = SECTION_PADDING_OPTIONS_TOP.filter(
  (o) => o.value !== "pageTop",
);

/** T-shirt gap steps, mapped to the `--space-*` scale in globals.css. */
const GAP_OPTIONS = [
  { title: "XS", value: "xs" },
  { title: "SM", value: "sm" },
  { title: "MD", value: "md" },
  { title: "LG", value: "lg" },
  { title: "XL", value: "xl" },
  { title: "2XL", value: "2xl" },
];

export const section = defineType({
  name: "section",
  title: "Section",
  type: "object",
  icon: MasterDetailIcon,
  // Two tabs only. No group is marked `default`, so the Studio opens on the
  // implicit "All fields" tab (prepended first) — tabs read: All fields /
  // Content / Styles.
  groups: [
    { name: "content", title: "Content" },
    { name: "styles", title: "Styles" },
  ],
  fields: [
    defineField({
      name: "name",
      title: "Internal name",
      type: "string",
      group: "content",
      initialValue: "Section",
      description: "Only shown in the Studio, to help you find this section.",
    }),
    defineField({
      name: "content",
      title: "Content",
      type: "array",
      of: blockMembers(),
      group: "content",
    }),

    // THEME — cascades colors to every child (buttons, cards, text).
    defineField({
      name: "theme",
      title: "Theme",
      type: "string",
      group: "styles",
      initialValue: "light",
      description:
        "Hover to preview; click to set. Themes cascade to every child.",
      options: {
        list: [
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" },
          { title: "Brand", value: "brand" },
        ],
      },
    }),

    // SPACING — named vertical padding + a t-shirt gap scale, all rendered as
    // hover-preview segmented buttons (see the global PreviewSelect input).
    defineField({
      name: "paddingTop",
      title: "Padding top",
      type: "string",
      group: "styles",
      initialValue: "medium",
      description:
        '"Even" matches the section\'s left/right padding. "Page top" clears a fixed nav for a section at the very top of the page.',
      options: { list: SECTION_PADDING_OPTIONS_TOP },
    }),
    defineField({
      name: "paddingBottom",
      title: "Padding bottom",
      type: "string",
      group: "styles",
      initialValue: "medium",
      description: '"Even" matches the section\'s left/right padding.',
      options: { list: SECTION_PADDING_OPTIONS_BOTTOM },
    }),
    // Horizontal alignment sits directly above Gap (per request).
    defineField({
      name: "contentAlign",
      title: "Horizontal alignment",
      type: "string",
      group: "styles",
      initialValue: "start",
      options: {
        list: [
          { title: "Left", value: "start" },
          { title: "Center", value: "center" },
          { title: "Right", value: "end" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    defineField({
      name: "gap",
      title: "Gap between blocks",
      type: "string",
      group: "styles",
      initialValue: "md",
      description: "Vertical space between blocks, from the spacing scale.",
      options: { list: GAP_OPTIONS },
    }),

    // LAYOUT — full-height hero mode.
    defineField({
      name: "fullHeight",
      title: "Full viewport height",
      type: "boolean",
      group: "styles",
      description: "Great for hero sections.",
      initialValue: false,
    }),

    // BACKGROUND — kept at the very bottom of the form. `overlayOpacity` sits
    // just above the image it applies to and only appears once an image is set.
    sliderField({
      name: "overlayOpacity",
      title: "Overlay opacity",
      description: "Darkens the background image so text stays readable.",
      group: "styles",
      // Only relevant with a background image — hide it otherwise.
      hidden: ({ parent }) =>
        !(parent as { backgroundImage?: { asset?: unknown } } | undefined)
          ?.backgroundImage?.asset,
      min: 0,
      max: 100,
      step: 5,
      suffix: "%",
      initialValue: 0,
    }),
    defineField({
      name: "backgroundImage",
      title: "Background image",
      type: "image",
      group: "styles",
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: { name: "name", theme: "theme", content: "content" },
    prepare: ({ name, theme, content }) => ({
      title: name || "Section",
      subtitle: `Section · ${theme ?? "light"} · ${content?.length ?? 0} block(s)`,
    }),
  },
});
