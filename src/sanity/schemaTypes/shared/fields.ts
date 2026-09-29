import { defineArrayMember, defineField, type ConditionalProperty } from "sanity";
import { LinkIcon } from "@sanity/icons";

import { RangeSliderInput } from "../../components/RangeSliderInput";
import { ResponsiveNumberInput } from "../../components/ResponsiveNumberInput";
import { ptFromString } from "../../../lib/blockDefaults";

/**
 * A number field rendered as a drag-to-adjust slider.
 * Used for max-width, padding, gap, border-radius, etc.
 */
export function sliderField(opts: {
  name: string;
  title: string;
  description?: string;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  allowUnset?: boolean;
  unsetLabel?: string;
  initialValue?: number;
  group?: string;
  fieldset?: string;
  hidden?: ConditionalProperty;
}) {
  return defineField({
    name: opts.name,
    title: opts.title,
    type: "number",
    description: opts.description,
    group: opts.group,
    fieldset: opts.fieldset,
    hidden: opts.hidden,
    initialValue: opts.initialValue,
    // Custom keys consumed by RangeSliderInput.
    options: {
      min: opts.min,
      max: opts.max,
      step: opts.step ?? 1,
      suffix: opts.suffix ?? "",
      allowUnset: opts.allowUnset ?? false,
      unsetLabel: opts.unsetLabel ?? "Auto",
    } as Record<string, unknown>,
    components: { input: RangeSliderInput },
  });
}

/**
 * The spacing scale (None + `--space-xs` … `--space-3xl`) as a string enum. The
 * config renders enum string fields as hoverable segmented buttons
 * (`PreviewSelect`); the front end maps each value with `spaceVar` in lib/style.
 */
export const SPACING_OPTIONS = [
  { title: "None", value: "none" },
  { title: "XS", value: "xs" },
  { title: "SM", value: "sm" },
  { title: "MD", value: "md" },
  { title: "LG", value: "lg" },
  { title: "XL", value: "xl" },
  { title: "2XL", value: "2xl" },
  { title: "3XL", value: "3xl" },
];

/** A spacing-scale picker (segmented buttons) — see `SPACING_OPTIONS`. */
export function spacingField(opts: {
  name: string;
  title: string;
  description?: string;
  initialValue?: string;
  group?: string;
  fieldset?: string;
}) {
  return defineField({
    name: opts.name,
    title: opts.title,
    type: "string",
    description: opts.description,
    group: opts.group,
    fieldset: opts.fieldset,
    initialValue: opts.initialValue,
    options: { list: SPACING_OPTIONS },
  });
}

/**
 * A responsive object field ({ mobile, tablet, desktop }) rendered as three
 * drag sliders — one per breakpoint. Used for grid columns and slides-per-view.
 */
export function responsiveNumberField(opts: {
  name: string;
  title: string;
  description?: string;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  initialValue?: { mobile: number; tablet: number; desktop: number };
  group?: string;
  fieldset?: string;
}) {
  return defineField({
    name: opts.name,
    title: opts.title,
    type: "object",
    description: opts.description,
    group: opts.group,
    fieldset: opts.fieldset,
    options: {
      min: opts.min,
      max: opts.max,
      step: opts.step ?? 1,
      suffix: opts.suffix ?? "",
    } as Record<string, unknown>,
    components: { input: ResponsiveNumberInput },
    fields: [
      defineField({ name: "mobile", title: "Mobile", type: "number" }),
      defineField({ name: "tablet", title: "Tablet", type: "number" }),
      defineField({ name: "desktop", title: "Desktop", type: "number" }),
    ],
    initialValue: opts.initialValue,
  });
}

/** Shared text-wrap control (balance / pretty / none), rendered as prop buttons. */
export function textWrapField(initialValue: "balance" | "pretty" | "none") {
  return defineField({
    name: "textWrap",
    title: "Text wrap",
    type: "string",
    initialValue,
    description:
      "Balance evens out the line lengths; Pretty avoids leaving a single word on the last line.",
    options: {
      list: [
        { title: "Balance", value: "balance" },
        { title: "Pretty", value: "pretty" },
        { title: "None", value: "none" },
      ],
      layout: "radio",
      direction: "horizontal",
    },
  });
}

/**
 * Inline rich text as Portable Text: Bold / Italic decorators and a Link
 * annotation (URL + open-in-new-tab), plus line breaks / multiple lines. Used
 * for heading and paragraph copy. The block's own size/level/weight/color
 * controls handle appearance, so only the "Normal" style is offered here.
 */
export function richTextField(opts?: {
  name?: string;
  title?: string;
  initialText?: string;
}) {
  return defineField({
    name: opts?.name ?? "text",
    title: opts?.title ?? "Text",
    type: "array",
    of: [
      defineArrayMember({
        type: "block",
        styles: [{ title: "Normal", value: "normal" }],
        lists: [],
        marks: {
          decorators: [
            { title: "Bold", value: "strong" },
            { title: "Italic", value: "em" },
          ],
          annotations: [
            defineArrayMember({
              name: "link",
              type: "object",
              title: "Link",
              icon: LinkIcon,
              fields: [
                defineField({
                  name: "href",
                  title: "URL",
                  type: "string",
                  description:
                    "A URL (https://…), a path (/about), or an anchor (#section).",
                  validation: (rule) => rule.required(),
                }),
                defineField({
                  name: "newTab",
                  title: "Open in new tab",
                  type: "boolean",
                  initialValue: false,
                }),
              ],
            }),
          ],
        },
      }),
    ],
    initialValue: opts?.initialText ? ptFromString(opts.initialText) : undefined,
    validation: (rule) => rule.required(),
  });
}

/** Flattens a Portable Text value (or legacy string) to plain text for previews. */
export function ptToPlain(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((block) => {
      const b = block as { _type?: string; children?: Array<{ text?: unknown }> };
      if (b?._type !== "block" || !Array.isArray(b.children)) return "";
      return b.children
        .map((child) => (typeof child?.text === "string" ? child.text : ""))
        .join("");
    })
    .join(" ")
    .trim();
}

/** Shared alignment dropdown. */
export function alignField(opts?: { name?: string; title?: string }) {
  return defineField({
    name: opts?.name ?? "align",
    title: opts?.title ?? "Alignment",
    type: "string",
    initialValue: "left",
    options: {
      list: [
        { title: "Left", value: "left" },
        { title: "Center", value: "center" },
        { title: "Right", value: "right" },
      ],
      layout: "radio",
      direction: "horizontal",
    },
  });
}
