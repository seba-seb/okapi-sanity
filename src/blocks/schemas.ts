import type { SchemaTypeDefinition } from "sanity";
import { CubeIcon } from "@sanity/icons";
import { defineField } from "sanity";

import type { BlockType } from "./meta";
import { section } from "./section/schema";
import { componentRef } from "./componentRef/schema";
import { eyebrow } from "./eyebrow/schema";
import { heading } from "./heading/schema";
import { paragraph } from "./paragraph/schema";
import { button } from "./button/schema";
import { buttonWrapper } from "./buttonWrapper/schema";
import { imageBlock } from "./imageBlock/schema";
import { loopingVideo } from "./loopingVideo/schema";
import { contentWrapper } from "./contentWrapper/schema";
import { card } from "./card/schema";
import { slider } from "./slider/schema";
import { grid } from "./grid/schema";
import { logo3d } from "./logo3d/schema";
import { box } from "./box/schema";

/** Studio side of the registry. Missing a type from meta.ts = type error. */
export const BLOCK_SCHEMAS: Record<BlockType, SchemaTypeDefinition> = {
  section,
  componentRef,
  eyebrow,
  heading,
  paragraph,
  buttonWrapper,
  button,
  imageBlock,
  loopingVideo,
  contentWrapper,
  card,
  slider,
  grid,
  logo3d,
  box,
};

// Every block: a CubeIcon fallback, and the shared `design` field (tokens +
// breakpoints, rendered by core/style/stylesheet) — in its Styles tab if any.
for (const schema of Object.values(BLOCK_SCHEMAS)) {
  const s = schema as { icon?: unknown; fields?: { name: string }[]; groups?: { name: string }[] };
  if (!s.icon) s.icon = CubeIcon;
  // Named `design`, not `style`: Button already has a `style` (primary/outline…).
  if (s.fields && !s.fields.some((f) => f.name === "design")) {
    const group = s.groups?.find((g) => /^styles?$/.test(g.name))?.name;
    s.fields.push(defineField({ name: "design", title: "Style", type: "blockStyle", ...(group ? { group } : {}) }));
  }
}
