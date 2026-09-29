import { defineField, defineType } from "sanity";

import { sliderField } from "../shared/fields";

export const loopingVideo = defineType({
  name: "loopingVideo",
  title: "Looping Video",
  type: "object",
  fields: [
    defineField({
      name: "videoFile",
      title: "Video file",
      type: "file",
      options: { accept: "video/mp4,video/webm" },
      description: "Upload an MP4 or WebM. Keep it small — it autoplays on loop.",
    }),
    defineField({
      name: "externalUrl",
      title: "…or external video URL",
      type: "url",
      description: "Used if no file is uploaded (e.g. a CDN-hosted MP4).",
    }),
    defineField({
      name: "poster",
      title: "Poster image",
      type: "image",
      options: { hotspot: true },
      description: "Shown while the video loads.",
    }),
    defineField({
      name: "aspectRatio",
      title: "Aspect ratio",
      type: "string",
      initialValue: "16/9",
      options: {
        list: [
          { title: "Auto (natural)", value: "auto" },
          { title: "1:1 — Square", value: "1/1" },
          { title: "4:3", value: "4/3" },
          { title: "16:9", value: "16/9" },
          { title: "21:9 — Ultrawide", value: "21/9" },
          { title: "9:16 — Vertical", value: "9/16" },
        ],
        layout: "dropdown",
      },
    }),
    defineField({
      name: "objectFit",
      title: "Fit",
      type: "string",
      initialValue: "cover",
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
      name: "autoplay",
      title: "Autoplay",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "controls",
      title: "Show controls",
      type: "boolean",
      initialValue: false,
    }),
    sliderField({
      name: "radius",
      title: "Corner radius",
      min: 0,
      max: 48,
      step: 1,
      suffix: "px",
      initialValue: 0,
    }),
    sliderField({
      name: "maxWidth",
      title: "Max width",
      min: 120,
      max: 1400,
      step: 8,
      suffix: "px",
      allowUnset: true,
      unsetLabel: "Full",
    }),
  ],
  preview: {
    select: { media: "poster", fileName: "videoFile.asset.originalFilename" },
    prepare: ({ media, fileName }) => ({
      title: "Looping Video",
      subtitle: fileName || "Autoplay · muted · loop",
      media,
    }),
  },
});
