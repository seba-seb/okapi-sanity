// Run: npx sanity exec scripts/check-editor-schema.ts
// Phase-0 criterion: the schema-generated properties panel covers every field
// of every block (no "unsupported"), recursing into object fields.
import { createSchema, type ObjectSchemaType, type SchemaType } from "sanity";

import { schemaTypes } from "../src/schema";
import { blockTypes } from "../src/blocks/meta";
import { controlKind, isContent } from "../src/core/editor/FieldControls";

const schema = createSchema({ name: "check", types: schemaTypes });
const tally: Record<string, number> = {};
const unsupported: string[] = [];
let content = 0;
let design = 0;

function visit(type: ObjectSchemaType, path: string) {
  for (const f of type.fields as { name: string; type: SchemaType }[]) {
    const kind = controlKind(f.type);
    tally[kind] = (tally[kind] ?? 0) + 1;
    if (kind === "unsupported") unsupported.push(`${path}.${f.name} (${f.type.name})`);
    if (kind === "object") visit(f.type as ObjectSchemaType, `${path}.${f.name}`);
    else if (kind !== "structure") isContent(f.type) ? content++ : design++;
  }
}
for (const t of blockTypes) visit(schema.get(t) as ObjectSchemaType, t);

console.log(`${blockTypes.length} blocks · controls:`, tally, `· client-visible ${content} / team-only ${design}`);
if (unsupported.length) {
  console.error("UNSUPPORTED:\n  " + unsupported.join("\n  "));
  process.exit(1);
}
console.log("check-editor-schema: ok");
