// Run: npx sanity exec src/core/style/stylesheet.check.ts  (also run by verify)
import assert from "node:assert/strict";

import { collectStyles, stylesheet } from "./stylesheet.ts";

const doc = {
  sections: [
    {
      _key: "s1",
      design: { base: { background: "surface", padding: "lg" } },
      content: [
        { _key: "h1", design: { base: { marginBottom: "md", textAlign: "center" }, mobile: { hide: true } } },
        { _key: "p1" }, // no style → no rule
      ],
    },
  ],
};

assert.deepEqual(collectStyles(doc).map(([k]) => k), ["s1", "h1"]);
const css = stylesheet(doc);
assert.match(css, /\[data-b="s1"\]\[data-b\]\{padding:var\(--ok-space-lg\)!important;background:var\(--ok-surface\)!important\}/);
assert.match(css, /\[data-b="h1"\]\[data-b\]\{margin-bottom:var\(--ok-space-md\)!important;text-align:center!important\}/);
assert.match(css, /@media \(max-width: 767px\)\{\[data-b="h1"\]\[data-b\]\{display:none!important\}\}/);
assert.doesNotMatch(css, /p1/);
assert.doesNotMatch(css, /max-width: 1023px/); // no tablet rules → no empty media block
assert.equal(stylesheet({ sections: [] }), "");
// "none" means zero, not a missing var
assert.match(stylesheet({ a: { _key: "x", design: { base: { marginTop: "none", radius: "none" } } } }), /margin-top:0!important;border-radius:0!important/);
// A key can't break out of the selector
assert.doesNotMatch(stylesheet({ a: { _key: 'x"]{}*{color:red', design: { base: { padding: "sm" } } } }), /"\]\{\}\*/);
console.log("stylesheet.check: ok");
