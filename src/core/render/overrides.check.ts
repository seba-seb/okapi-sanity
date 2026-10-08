// Run: npx sanity exec src/core/render/overrides.check.ts  (also run by verify)
import assert from "node:assert/strict";

import { applyOverrides, splitInstancePath } from "./overrides.ts";

const sections = [{ _key: "s", content: [{ _key: "h", text: "Master" }, { _key: "c", heading: "Card", image: { a: 1 } }] }];
const out = applyOverrides(sections, [
  { target: "h.text", rich: [{ _type: "block" }] },
  { target: "c.heading", text: "Instance card" },
  { target: "c.image", image: { a: 2 } },
  { target: "missing.text", text: "ignored" },
]);
assert.deepEqual(out[0].content[0].text, [{ _type: "block" }]);
assert.equal(out[0].content[1].heading, "Instance card");
assert.deepEqual(out[0].content[1].image, { a: 2 });
assert.equal(sections[0].content[1].heading, "Card"); // master untouched
assert.equal(applyOverrides(sections, undefined), sections);
assert.deepEqual(splitInstancePath('sections[_key=="i1"].__component.sections[_key=="s"].content[_key=="h"]'), { instancePath: 'sections[_key=="i1"]', blockKey: "h" });
assert.equal(splitInstancePath('sections[_key=="s"].content[_key=="h"]'), null);
console.log("overrides.check: ok");
