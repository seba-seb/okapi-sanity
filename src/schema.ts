import type { SchemaTypeDefinition } from "sanity";

import { page } from "@/documents/page";
import { BLOCK_SCHEMAS } from "@/blocks/schemas";

/** Everything the Studio knows about: documents + the block registry. */
export const schemaTypes: SchemaTypeDefinition[] = [page, ...Object.values(BLOCK_SCHEMAS)];
