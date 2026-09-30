// Run: node --experimental-strip-types src/core/canvas/channels.check.ts
import assert from "node:assert/strict";

import { toBlockTarget } from "./channels.ts";

assert.deepEqual(toBlockTarget(["sections", { _key: "a" }, "content", { _key: "b" }, "size"]), {
  path: 'sections[_key=="a"].content[_key=="b"]',
  field: "size",
});
assert.deepEqual(toBlockTarget(["sections", { _key: "a" }, "theme"]), { path: 'sections[_key=="a"]', field: "theme" });
assert.deepEqual(
  toBlockTarget(["sections", { _key: "s" }, "content", { _key: "h" }, "items", { _key: "c" }, "layout"]),
  { path: 'sections[_key=="s"].content[_key=="h"].items[_key=="c"]', field: "layout" },
);
assert.equal(toBlockTarget(["title"]), null); // top-level document field
assert.equal(toBlockTarget(["sections", 0, "theme"]), null); // index, not key
console.log("channels.check: ok");
