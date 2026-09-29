import { defineField, defineType } from "sanity";

import { responsiveNumberField, sliderField } from "../shared/fields";
import { cardOrImageMembers } from "../shared/blocks";

export const slider = defineType({
  name: "slider",
  title: "Slider",
  type: "object",
  fieldsets: [{ name: "behavior", title: "Behavior", options: { columns: 2 } }],
  fields: [
    defineField({
      name: "slides",
      title: "Slides",
      description: "Each slide is a card or an image.",
      type: "array",
      of: cardOrImageMembers(),
    }),
    // Responsive: how many slides are visible per breakpoint (drag sliders).
    responsiveNumberField({
      name: "slidesPerView",
      title: "Slides per view",
      description: "Drag to set how many slides show at each screen size.",
      min: 1,
      max: 5,
      step: 1,
      initialValue: { mobile: 1, tablet: 2, desktop: 3 },
    }),
    sliderField({
      name: "gap",
      title: "Gap between slides",
      min: 0,
      max: 64,
      step: 2,
      suffix: "px",
      initialValue: 24,
    }),
    defineField({
      name: "loop",
      title: "Loop",
      type: "boolean",
      fieldset: "behavior",
      initialValue: true,
    }),
    defineField({
      name: "align",
      title: "Align slides",
      type: "string",
      fieldset: "behavior",
      initialValue: "start",
      options: {
        list: [
          { title: "Start", value: "start" },
          { title: "Center", value: "center" },
        ],
        layout: "dropdown",
      },
    }),
    defineField({
      name: "showArrows",
      title: "Show arrows",
      type: "boolean",
      fieldset: "behavior",
      initialValue: true,
    }),
    defineField({
      name: "showDots",
      title: "Show dots",
      type: "boolean",
      fieldset: "behavior",
      initialValue: true,
    }),
  ],
  preview: {
    select: { slides: "slides", perView: "slidesPerView.desktop" },
    prepare: ({ slides, perView }) => ({
      title: "Slider",
      subtitle: `${slides?.length ?? 0} slide(s) · ${perView ?? 3} per view`,
    }),
  },
});
