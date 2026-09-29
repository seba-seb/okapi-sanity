import { defineField, defineType } from "sanity";
import { CubeIcon } from "@sanity/icons";

import { LOGO3D_PRESETS } from "../../../lib/logo3dPresets";
import { CH_MAX_WIDTH } from "../../../lib/maxWidth";
import { sliderField } from "../shared/fields";
import { LogoShapeInput } from "../../components/LogoShapeInput";
import { LogoColorInput } from "../../components/LogoColorInput";

/**
 * A spinning, dithered 3D extrusion of an SVG logo (three.js). Pick one of the
 * built-in marks or paste your own SVG. Rendered by the front-end `Logo3d`
 * component, which lazy-loads three.js only when the block is on the page.
 */
export const logo3d = defineType({
  name: "logo3d",
  title: "3D Logo",
  type: "object",
  icon: CubeIcon,
  fields: [
    defineField({
      name: "preset",
      title: "Shape",
      type: "string",
      initialValue: LOGO3D_PRESETS[0].key,
      components: { input: LogoShapeInput },
      options: {
        list: [
          ...LOGO3D_PRESETS.map((p) => ({ title: p.title, value: p.key })),
          { title: "Custom (paste SVG)", value: "custom" },
        ],
      },
    }),
    defineField({
      name: "customSvg",
      title: "Custom SVG",
      type: "text",
      rows: 6,
      description:
        "Paste SVG markup with one or more filled <path> elements. Simple, solid shapes extrude best.",
      hidden: ({ parent }) => parent?.preset !== "custom",
      validation: (rule) =>
        rule.custom((value, ctx) => {
          const parent = ctx.parent as { preset?: string } | undefined;
          if (parent?.preset !== "custom") return true;
          if (!value || !/<path[\s>]/.test(value)) {
            return "Paste SVG markup containing at least one <path>.";
          }
          return true;
        }),
    }),
    defineField({
      name: "color",
      title: "Color",
      type: "string",
      initialValue: "primary",
      components: { input: LogoColorInput },
      description:
        "Primary is the brand color (white in Brand theme); Secondary matches the text color.",
      options: {
        list: [
          { title: "Primary", value: "primary" },
          { title: "Secondary", value: "secondary" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    sliderField({
      name: "maxWidth",
      title: "Max width",
      description:
        "Constrain the width; drag the handle on the canvas too. Auto = full width.",
      min: CH_MAX_WIDTH.logo3d.min,
      max: CH_MAX_WIDTH.logo3d.max,
      step: CH_MAX_WIDTH.logo3d.step,
      suffix: "rem",
      allowUnset: true,
      unsetLabel: "Auto",
      initialValue: 35,
    }),
    // Starting orientation (degrees), set on the canvas by the rotation gizmo —
    // hover the logo and drag a ring. Hidden here because the gizmo is the UI.
    defineField({ name: "rotationX", title: "Rotation X", type: "number", hidden: true }),
    defineField({ name: "rotationY", title: "Rotation Y", type: "number", hidden: true }),
    defineField({ name: "rotationZ", title: "Rotation Z", type: "number", hidden: true }),
    // Dither block-size multiplier (1 = default grain), set on the canvas by the
    // hover slider — hidden here because the slider is the UI.
    defineField({ name: "grain", title: "Grain", type: "number", hidden: true }),
  ],
  preview: {
    select: { preset: "preset" },
    prepare: ({ preset }) => ({
      title: "3D Logo",
      subtitle:
        preset === "custom"
          ? "Custom SVG"
          : (LOGO3D_PRESETS.find((p) => p.key === preset)?.title ?? "Logo"),
    }),
  },
});
