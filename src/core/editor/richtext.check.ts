// Run by verify. Rich text → canvas HTML never lets content break out of an attribute.
import assert from "node:assert/strict";

import { ptToHtml } from "./richtext.ts";

const evil = `x" onmouseover="alert(1)`;
const html = ptToHtml([
  {
    _type: "block", _key: "b", style: "normal",
    markDefs: [{ _key: evil, _type: "link" }],
    children: [{ _type: "span", _key: "s", text: `<img src=x onerror=alert(1)>`, marks: [evil] }],
  },
]);
assert.ok(!html.includes(`" onmouseover`), html);
assert.ok(!html.includes("<img"), html);
console.log("richtext.check: ok");
