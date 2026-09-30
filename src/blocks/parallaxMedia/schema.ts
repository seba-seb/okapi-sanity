import { defineField, defineType } from "sanity";
import { ImagesIcon } from "@sanity/icons";

import { sliderField } from "@/blocks/_shared/fields";

/** Full-bleed image that drifts inside its frame; optional clip reveal. */
export const parallaxMedia = defineType({
  name: "parallaxMedia",
  title: "Parallax Media",
  type: "object",
  icon: ImagesIcon,
  fields: [
    defineField({
      name: "image",
      title: "Image",
      type: "image",
      options: { hotspot: true },
      description: "Empty = a gradient from the section theme.",
      fields: [defineField({ name: "alt", title: "Alt text", type: "string" })],
    }),
    defineField({ name: "caption", title: "Caption", type: "string" }),
    sliderField({ name: "height", title: "Height", min: 40, max: 110, step: 5, suffix: "vh", initialValue: 80 }),
    sliderField({ name: "strength", title: "Parallax", min: 0, max: 30, step: 5, suffix: "%", initialValue: 15 }),
    defineField({ name: "reveal", title: "Clip reveal", type: "boolean", initialValue: true }),
  ],
  preview: { select: { title: "caption", media: "image" }, prepare: ({ title, media }) => ({ title: title || "Parallax Media", media }) },
});
