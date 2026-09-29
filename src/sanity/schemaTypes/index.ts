import type { SchemaTypeDefinition } from "sanity";
import { CubeIcon } from "@sanity/icons";

// Documents
import { page } from "./documents/page";

// Section (the top-level composable container)
import { section } from "./section";

// Core building blocks
import { eyebrow } from "./blocks/eyebrow";
import { heading } from "./blocks/heading";
import { paragraph } from "./blocks/paragraph";
import { button } from "./blocks/button";
import { buttonWrapper } from "./blocks/buttonWrapper";
import { imageBlock } from "./blocks/imageBlock";
import { loopingVideo } from "./blocks/loopingVideo";
import { contentWrapper } from "./blocks/contentWrapper";
import { card } from "./blocks/card";
import { slider } from "./blocks/slider";
import { grid } from "./blocks/grid";
import { logo3d } from "./blocks/logo3d";

// Every block is an "element" in the canvas; those that don't declare their
// own `icon` fall back to CubeIcon (shown in the Presentation overlay tag and
// the insert menu). Set a specific `icon:` in a block's schema to override.
const blocks = [
  eyebrow,
  heading,
  paragraph,
  button,
  buttonWrapper,
  imageBlock,
  loopingVideo,
  contentWrapper,
  card,
  slider,
  grid,
  logo3d,
];
for (const block of blocks) {
  const b = block as { icon?: unknown };
  if (!b.icon) b.icon = CubeIcon;
}

export const schemaTypes: SchemaTypeDefinition[] = [
  // Documents
  page,
  // Section
  section,
  // Blocks
  ...blocks,
];
