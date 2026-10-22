// Run by verify. Rich text → canvas HTML never lets content break out of an attribute.
import assert from "node:assert/strict";

import { ptToHtml } from "./richtext.ts";
import { reKey } from "./paths.ts";
import { mdToPt, ptToMd } from "./text.ts";

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

// Duplicate / paste / Make component (reKey): links keep pointing at their markDef.
const linked = {
  _type: "paragraph", _key: "p",
  text: [{
    _type: "block", _key: "b", style: "normal",
    markDefs: [{ _key: "L", _type: "link", kind: "external", url: "https://a.com" }],
    children: [{ _type: "span", _key: "s", text: "go", marks: ["L", "strong"] }],
  }],
};
const copy = reKey(linked);
assert.notEqual(copy._key, "p");
assert.notEqual(copy.text[0]._key, "b");
assert.deepEqual(copy.text[0].children[0].marks, ["L", "strong"]);
assert.equal(copy.text[0].markDefs[0]._key, "L");

// Chat markdown ⇄ PT: formatting and existing links survive a round trip.
const internal = [{
  _type: "block", _key: "b1", style: "h3",
  markDefs: [{ _key: "in", _type: "link", kind: "internal", page: { _type: "reference", _ref: "about" } }],
  children: [
    { _type: "span", _key: "a", text: "See ", marks: [] },
    { _type: "span", _key: "b", text: "us", marks: ["in"] },
    { _type: "span", _key: "c", text: " now", marks: ["strong"] },
  ],
}];
const md = ptToMd(internal);
assert.equal(md, "See [us](page:about) **now**");
const back = mdToPt("See [us](page:about) **now** and *[docs](https://d.io)* [x](javascript:void)", internal);
assert.equal(back[0]._key, "b1"); // same paragraph
assert.equal(back[0].style, "h3"); // keeps its style
assert.deepEqual(back[0].markDefs[0], internal[0].markDefs[0]); // the internal link is the same markDef
assert.equal(back[0].markDefs[1].url, "https://d.io"); // new links are external
assert.equal(back[0].markDefs.length, 2); // javascript: is not a link
assert.deepEqual(back[0].children.map((c) => [c.text, c.marks]), [
  ["See ", []], ["us", ["in"]], [" ", []], ["now", ["strong"]], [" and ", []], ["docs", ["em", back[0].markDefs[1]._key]], [" ", []], ["x", []],
]);
assert.equal(mdToPt("a\nb", [])[1].style, "normal"); // one block per line

console.log("richtext.check: ok");
