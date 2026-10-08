// Run: node --experimental-strip-types src/core/editor/ops.check.ts  (also run by verify)
import assert from "node:assert/strict";

import { needsJs } from "../../blocks/meta.ts";
import { canPlace, duplicate, duplicateMany, moveNextTo, insert, insertMany, insertTarget, layers, move, newBlock, nudge, nudgeMany, parentBlock, remove, removeMany, topmost } from "./ops.ts";

const h = (k: string) => ({ _type: "heading", _key: k, text: [] });
const doc = {
  _id: "p",
  sections: [
    { _type: "section", _key: "s1", content: [h("h1"), { _type: "grid", _key: "g1", items: [{ _type: "card", _key: "c1" }] }] },
    { _type: "section", _key: "s2", content: [h("h2")] },
  ],
};
const S1 = 'sections[_key=="s1"]';
const H1 = `${S1}.content[_key=="h1"]`;
const G1 = `${S1}.content[_key=="g1"]`;
const C1 = `${G1}.items[_key=="c1"]`;
const keysOf = (arr: { _key: string }[] | undefined) => (arr ?? []).map((x) => x._key);

// Registry rules
assert.equal(canPlace(doc, "section", "sections"), true);
assert.equal(canPlace(doc, "heading", "sections"), false);
assert.equal(canPlace(doc, "card", `${G1}.items`), true);
assert.equal(canPlace(doc, "heading", `${G1}.items`), false); // grid accepts card/content/image/logo only

// Remove / duplicate are immutable
const removed = remove(doc, H1);
assert.deepEqual(keysOf(removed.sections![0].content as never), ["g1"]);
assert.deepEqual(keysOf(doc.sections[0].content as never), ["h1", "g1"]); // original untouched
const dup = duplicate(doc, C1);
const items = (dup.doc.sections![0].content as never as { items: { _key: string }[] }[])[1].items;
assert.equal(items.length, 2);
assert.notEqual(items[1]._key, "c1"); // re-keyed
assert.equal(dup.path, `${G1}.items[_key=="${items[1]._key}"]`);

// Move across sections; nudge within
const moved = move(doc, H1, 'sections[_key=="s2"].content', 0);
assert.deepEqual(keysOf(moved.doc.sections![1].content as never), ["h1", "h2"]);
assert.equal(moved.path, 'sections[_key=="s2"].content[_key=="h1"]');
assert.throws(() => move(doc, H1, `${G1}.items`, 0)); // heading not allowed in a grid
assert.throws(() => move(doc, G1, `${G1}.items`, 0)); // not into itself
assert.deepEqual(keysOf(nudge(doc, H1, 1).doc.sections![0].content as never), ["g1", "h1"]);
assert.equal(nudge(doc, H1, -1).doc, doc); // already first: no-op

// Insert target: inside a container that accepts it, else after, else climb
assert.deepEqual(insertTarget(doc, G1, "card"), { arrayPath: `${G1}.items`, index: 1 });
assert.deepEqual(insertTarget(doc, C1, "heading"), { arrayPath: `${S1}.content`, index: 2 }); // climbs out of the grid
assert.deepEqual(insertTarget(doc, null, "section"), { arrayPath: "sections", index: 2 });
assert.deepEqual(insertTarget(doc, null, "heading"), { arrayPath: 'sections[_key=="s2"].content', index: 1 });
const sec = newBlock("section");
assert.equal(sec._type, "section");
assert.equal((sec.content as { _type: string }[])[0]._type, "heading");
assert.equal(insert(doc, "sections", 0, sec).doc.sections![0]._key, sec._key);

// Component instances: page top level only, never inside a component
assert.equal(canPlace(doc, "componentRef", "sections"), true);
assert.equal(canPlace({ ...doc, _type: "component" }, "componentRef", "sections"), false);
assert.equal(canPlace(doc, "componentRef", `${S1}.content`), false);
assert.deepEqual(insertTarget(doc, H1, "componentRef"), { arrayPath: "sections", index: 1 }); // climbs to the page level

// Multi-selection
assert.deepEqual(topmost([G1, C1, H1]), [G1, H1]); // the card is inside the selected grid
const rm = removeMany(doc, [H1, C1, G1]);
assert.deepEqual(keysOf(rm.sections![0].content as never), []);
const dm = duplicateMany(doc, [H1, G1]);
assert.deepEqual(keysOf(dm.doc.sections![0].content as never).length, 4);
assert.equal(dm.paths.length, 2);
const three = { sections: [{ _type: "section", _key: "s", content: [h("a"), h("b"), h("c")] }] };
const P = (k: string) => `sections[_key=="s"].content[_key=="${k}"]`;
assert.deepEqual(keysOf(nudgeMany(three, [P("b"), P("c")], -1).doc.sections![0].content as never), ["b", "c", "a"]);
assert.deepEqual(keysOf(nudgeMany(three, [P("a"), P("b")], -1).doc.sections![0].content as never), ["a", "b", "c"]); // blocked at the top, b doesn't leapfrog a
const im = insertMany(three, P("a"), [h("x"), h("y")]);
assert.deepEqual(keysOf(im.doc.sections![0].content as never), ["a", "x", "y", "b", "c"]);

// Canvas drop next to a block
assert.deepEqual(keysOf(moveNextTo(three, P("a"), P("c"), "after").doc.sections![0].content as never), ["b", "c", "a"]);
assert.deepEqual(keysOf(moveNextTo(three, P("c"), P("a"), "before").doc.sections![0].content as never), ["c", "a", "b"]);
assert.deepEqual(keysOf(moveNextTo(doc, H1, 'sections[_key=="s2"].content[_key=="h2"]', "after").doc.sections![1].content as never), ["h2", "h1"]);
assert.throws(() => moveNextTo(doc, H1, C1, "before")); // a heading can't go into the grid

// Islands: a section needs JS only if some block in its tree does
assert.equal(needsJs(doc.sections[0]), false);
assert.equal(needsJs({ _type: "section", content: [{ _type: "grid", items: [{ _type: "logo3d" }] }] }), true);
assert.equal(needsJs([{ _type: "heading", animation: "none" }]), false);
assert.equal(needsJs([{ _type: "heading", animation: "words" }]), true);

// Helpers
assert.equal(parentBlock(C1), G1);
assert.equal(parentBlock(S1), null);
const tree = layers(doc);
assert.equal(tree.length, 2);
assert.equal(tree[0].children[1].children[0].path, C1);
console.log("ops.check: ok");
