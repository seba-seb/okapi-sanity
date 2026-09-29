import { defineField, defineType } from "sanity";
import { ImageIcon } from "@sanity/icons";

export const imageBlock = defineType({
  name: "imageBlock",
  title: "Image",
  type: "object",
  icon: ImageIcon,
  fields: [
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      validation: (rule) => rule.required(),
      fields: [
        defineField({
          name: "alt",
          title: "Alt text",
          type: "string",
          description: "Describe the image for screen readers and SEO.",
        }),
      ],
    }),
    defineField({
      name: "aspectRatio",
      title: "Aspect ratio",
      type: "string",
      initialValue: "1/1",
      options: {
        list: [
          { title: "Square (1:1)", value: "1/1" },
          { title: "4:3", value: "4/3" },
          { title: "3:2", value: "3/2" },
          { title: "16:9", value: "16/9" },
          { title: "21:9 — Ultrawide", value: "21/9" },
          { title: "3:4 — Portrait", value: "3/4" },
          { title: "Auto (natural)", value: "auto" },
          { title: "Custom", value: "custom" },
        ],
      },
    }),
    defineField({
      name: "customAspectRatio",
      title: "Custom ratio",
      type: "string",
      description: 'Width / height — e.g. "16/10", "1.85", or "4 / 3".',
      hidden: ({ parent }) => parent?.aspectRatio !== "custom",
    }),
    defineField({
      name: "objectFit",
      title: "Fit",
      type: "string",
      initialValue: "cover",
      hidden: ({ parent }) => parent?.aspectRatio === "auto",
      options: {
        list: [
          { title: "Cover", value: "cover" },
          { title: "Contain", value: "contain" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    defineField({
      name: "radius",
      title: "Corner radius",
      type: "string",
      initialValue: "none",
      description: '"Main" is the standard 16px corner.',
      options: {
        list: [
          { title: "None", value: "none" },
          { title: "Main", value: "main" },
        ],
      },
    }),
  ],
  preview: {
    select: { media: "image", title: "image.alt" },
    prepare: ({ media, title }) => ({
      title: title || "Image",
      subtitle: "Image",
      media,
    }),
  },
});
