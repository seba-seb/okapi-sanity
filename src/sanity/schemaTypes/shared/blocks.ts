import { defineArrayMember } from "sanity";

/**
 * The full palette of core building blocks that can be dropped into any
 * container (section, grid, slider, card). This is what makes sections
 * composable from scratch in the visual builder.
 */
export function blockMembers() {
  return [
    defineArrayMember({ type: "eyebrow" }),
    defineArrayMember({ type: "heading" }),
    defineArrayMember({ type: "paragraph" }),
    defineArrayMember({ type: "buttonWrapper" }),
    defineArrayMember({ type: "button" }),
    defineArrayMember({ type: "imageBlock" }),
    defineArrayMember({ type: "loopingVideo" }),
    defineArrayMember({ type: "contentWrapper" }),
    defineArrayMember({ type: "card" }),
    defineArrayMember({ type: "slider" }),
    defineArrayMember({ type: "grid" }),
    defineArrayMember({ type: "logo3d" }),
  ];
}

/**
 * Slider slides hold only cards and images — the two blocks meant to be laid
 * out in a repeating track. Keep in sync with the `slider` slot in
 * `editorOps.ts` (which gates the on-canvas insert palette).
 */
export function cardOrImageMembers() {
  return [
    defineArrayMember({ type: "card" }),
    defineArrayMember({ type: "imageBlock" }),
  ];
}

/**
 * Grid cells hold cards and images plus a content wrapper (so a cell can be a
 * small prose stack) and the 3D logo. Keep in sync with the `grid` slot in
 * `editorOps.ts`.
 */
export function gridCellMembers() {
  return [
    defineArrayMember({ type: "card" }),
    defineArrayMember({ type: "contentWrapper" }),
    defineArrayMember({ type: "imageBlock" }),
    defineArrayMember({ type: "logo3d" }),
  ];
}
