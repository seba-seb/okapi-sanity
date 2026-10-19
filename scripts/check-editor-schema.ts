// Run: npx sanity exec scripts/check-editor-schema.ts
// Phase-0 criterion: the schema-generated properties panel covers every field
// of every block (no "unsupported"), recursing into object fields.
import { createSchema, type ObjectSchemaType, type SchemaType } from "sanity";

import { schemaTypes } from "../src/schema";
import { blockMeta, blockTypes } from "../src/blocks/meta";
import { POLICY } from "../src/okapi.policy";
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
// Types a feature switched off (okapi.config.json, e.g. componentRef) aren't in the schema.
const active = blockTypes.filter((t) => schema.get(t));
for (const t of active) visit(schema.get(t) as ObjectSchemaType, t);

// Canvas declarations in meta.ts (`text`, `imageField`) must name real fields.
const wrongFields: string[] = [];
for (const t of active) {
  const fields = new Set(((schema.get(t) as ObjectSchemaType).fields ?? []).map((f) => f.name));
  const m = blockMeta(t);
  for (const f of [...(m?.text ?? []).map((x) => x.field), ...(m?.imageField ? [m.imageField] : [])])
    if (!fields.has(f)) wrongFields.push(`${t}.${f}`);
}

console.log(`${active.length} blocks · controls:`, tally, `· client-visible ${content} / team-only ${design}`);
if (unsupported.length) {
  console.error("UNSUPPORTED:\n  " + unsupported.join("\n  "));
  process.exit(1);
}
if (wrongFields.length) {
  console.error("meta.ts text/imageField names a field the block doesn't have:\n  " + wrongFields.join("\n  "));
  process.exit(1);
}

// Warning only: roles with a `blocks` list don't get new blocks automatically.
for (const [role, rule] of Object.entries(POLICY)) {
  if (!rule.can.includes("structure") || !rule.blocks) continue;
  const missing = active.filter((t) => t !== "componentRef" && !rule.blocks!.includes(t));
  if (missing.length)
    console.warn(`  ⚠ ${rule.label} (${role}) can't add: ${missing.join(", ")} — add them to its \`blocks\` in src/okapi.policy.ts if they should.`);
}
console.log("check-editor-schema: ok");
