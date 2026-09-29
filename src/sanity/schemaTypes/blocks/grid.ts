import { defineField, defineType } from "sanity";
import { ThLargeIcon } from "@sanity/icons";

import { responsiveNumberField, sliderField } from "../shared/fields";
import { gridCellMembers } from "../shared/blocks";
import { defaultCard } from "../../../lib/blockDefaults";

export const grid = defineType({
  name: "grid",
  title: "Grid",
  type: "object",
  icon: ThLargeIcon,
  fields: [
    defineField({
      name: "items",
      title: "Items",
      description: "Each cell is a card, a content wrapper, or an image.",
      type: "array",
      of: gridCellMembers(),
      // Start a new grid with one card already in place.
      initialValue: [defaultCard()],
    }),
    // Responsive: number of columns per breakpoint (drag sliders).
    responsiveNumberField({
      name: "columns",
      title: "Columns",
      description: "Drag to set the column count at each screen size.",
      min: 1,
      max: 6,
      step: 1,
      initialValue: { mobile: 1, tablet: 2, desktop: 2 },
    }),
    sliderField({
      name: "columnGap",
      title: "Column gap",
      min: 0,
      max: 80,
      step: 2,
      suffix: "px",
      initialValue: 24,
    }),
    sliderField({
      name: "rowGap",
      title: "Row gap",
      min: 0,
      max: 80,
      step: 2,
      suffix: "px",
      initialValue: 24,
    }),
    defineField({
      name: "alignItems",
      title: "Vertical alignment",
      type: "string",
      initialValue: "stretch",
      options: {
        list: [
          { title: "Stretch", value: "stretch" },
          { title: "Start", value: "start" },
          { title: "Center", value: "center" },
          { title: "End", value: "end" },
        ],
        layout: "dropdown",
      },
    }),
  ],
  preview: {
    select: { items: "items", cols: "columns.desktop" },
    prepare: ({ items, cols }) => ({
      title: "Grid",
      subtitle: `${items?.length ?? 0} item(s) · ${cols ?? 2} columns`,
    }),
  },
});
