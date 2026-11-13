import { defineField, defineType } from "sanity";

import { CARD_HEADING, CARD_BODY } from "@/blocks/defaults";

/**
 * A card is a fixed composition — image + heading + body — not a freeform block
 * container. Three styles:
 *  - imageTop:        image sits above the text.
 *  - imageBackground: image fills the card behind the text, which flips the card
 *                     to a dark theme so light text stays readable.
 *  - simple:          text only; the image field hides itself.
 */
export const card = defineType({
  name: "card",
  title: "Card",
  type: "object",
  fields: [
    defineField({
      name: "layout",
      title: "Style",
      type: "string",
      initialValue: "imageTop",
      description:
        "Image on top, image as a dark background, or a simple text-only card.",
      options: {
        list: [
          { title: "Image on top", value: "imageTop" },
          { title: "Image background (dark)", value: "imageBackground" },
          { title: "Simple — no image", value: "simple" },
        ],
      },
    }),
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      // The simple style has no image, so hide the field entirely.
      hidden: ({ parent }) => parent?.layout === "simple",
      fields: [
        // Alt text lives on the image (asset `altText`, edited in the Okapi Editor) and
        // wins at render (core/sanity/client.ts → withImageAlt). This per-block field
        // only shows for older content that still has a value.
        defineField({
          name: "alt",
          title: "Alt text (old, per block)",
          type: "string",
          hidden: ({ value }) => !value,
          description: "Used only if the image itself has no alt text. Edit alt on the image in the Okapi Editor.",
        }),
      ],
    }),
    defineField({
      name: "heading",
      title: "Heading",
      type: "string",
      initialValue: CARD_HEADING,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "text",
      rows: 3,
      initialValue: CARD_BODY,
    }),
    defineField({
      name: "href",
      title: "Link (optional)",
      type: "string",
      description: "Makes the whole card clickable.",
    }),
  ],
  preview: {
    select: { heading: "heading", layout: "layout", media: "image" },
    prepare: ({ heading, layout, media }) => {
      const style =
        layout === "imageBackground"
          ? "image background"
          : layout === "simple"
            ? "no image"
            : "image on top";
      return { title: heading || "Card", subtitle: `Card · ${style}`, media };
    },
  },
});
