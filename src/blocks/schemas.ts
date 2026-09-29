import type { SchemaTypeDefinition } from "sanity";
import { CubeIcon } from "@sanity/icons";

import type { BlockType } from "./meta";
import { section } from "./section/schema";
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

/** Studio side of the registry. Missing a type from meta.ts = type error. */
export const BLOCK_SCHEMAS: Record<BlockType, SchemaTypeDefinition> = {
  section,
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
};

// Blocks without their own `icon` fall back to CubeIcon (overlay chip + menus).
for (const schema of Object.values(BLOCK_SCHEMAS)) {
  const s = schema as { icon?: unknown };
  if (!s.icon) s.icon = CubeIcon;
}
