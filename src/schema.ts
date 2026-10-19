import type { SchemaTypeDefinition } from "sanity";

import { link, navItem } from "@/core/sanity/schema/link";
import { page } from "@/documents/page";
import { settings } from "@/documents/settings";
import { navigation } from "@/documents/navigation";
import { component } from "@/documents/component";
import { BLOCK_SCHEMAS } from "@/blocks/schemas";
import { blockStyle, styleProps } from "@/core/style/schema";
import { FEATURES } from "@/core/config";

/** Singletons: one fixed document each, no create/delete/duplicate. */
export const SINGLETONS = ["settings", "navigation"] as const;

/** Everything the Studio knows about: documents, shared types, blocks. */
export const schemaTypes: SchemaTypeDefinition[] = [
  page,
  settings,
  navigation,
  ...(FEATURES.components ? [component] : []),
  link,
  navItem,
  blockStyle,
  styleProps,
  // okapi.config.json → features.components: off = no library, no instances.
  ...Object.entries(BLOCK_SCHEMAS)
    .filter(([type]) => FEATURES.components || type !== "componentRef")
    .map(([, schema]) => schema),
];
