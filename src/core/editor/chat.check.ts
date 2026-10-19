// Run: npx sanity exec src/core/editor/chat.check.ts  (also run by verify)
import assert from "node:assert/strict";

import { applyOps, buildInstruction, describePage, parseAnswer, type Catalog } from "./chat.ts";
import { grantFor, mayAdd, type Policy } from "./policy.ts";
import { POLICY } from "../../okapi.policy.ts";
import { availableModels, buildRequest, readResponse } from "./server/models.ts";

const policy: Policy = {
  administrator: { label: "Agency", can: ["text", "images", "style", "settings", "reorder", "structure", "components", "publish", "chat"] },
  editor: { label: "Client", can: ["text", "images", "reorder", "structure", "chat"], blocks: ["heading", "paragraph"] },
  contributor: { label: "Drafts", can: ["text", "reorder", "chat"] },
  default: { label: "Read only", can: [] },
};
const admin = grantFor(["administrator"], policy);
const editor = grantFor(["editor"], policy);
const contributor = grantFor(["contributor"], policy);

// Grants
assert.equal(grantFor(["viewer"], policy).can.size, 0); // unknown role → default
assert.equal(grantFor(["contributor", "editor"], policy).can.has("structure"), true); // union
assert.equal(mayAdd(editor, "heading"), true);
assert.equal(mayAdd(editor, "box"), false); // not in the role's block list
assert.equal(mayAdd(admin, "componentRef"), true);
assert.equal(mayAdd(editor, "componentRef"), false); // needs `components`
assert.ok(grantFor(["administrator"], POLICY).can.has("text")); // the project policy parses (chat may be off for this project)

const catalog: Catalog = {
  section: { title: "Section", fields: { theme: { kind: "settings", control: "choice", title: "Theme", options: ["light", "dark"] } } },
  heading: {
    title: "Heading",
    fields: {
      text: { kind: "text", control: "pt", title: "Text" },
      level: { kind: "settings", control: "choice", title: "Level", options: ["h1", "h2"] },
    },
  },
  paragraph: { title: "Paragraph", fields: { text: { kind: "text", control: "pt", title: "Text" } } },
  button: { title: "Button", fields: { label: { kind: "text", control: "text", title: "Label" }, link: { kind: "text", control: "link", title: "Link" } } },
  imageBlock: { title: "Image", fields: { image: { kind: "images", control: "image", title: "Image" } } },
  box: { title: "Box", fields: {} },
};
const pt = (t: string) => [{ _type: "block", _key: "b", children: [{ _type: "span", _key: "s", text: t }] }];
const doc = {
  _id: "p",
  sections: [
    {
      _type: "section",
      _key: "s1",
      theme: "dark",
      content: [
        { _type: "heading", _key: "h1", text: pt("Hello"), level: "h1" },
        { _type: "button", _key: "b1", label: "Go", link: { _type: "link", kind: "external", url: "https://a.com" } },
      ],
    },
  ],
};
const S1 = 'sections[_key=="s1"]';
const H1 = `${S1}.content[_key=="h1"]`;
const B1 = `${S1}.content[_key=="b1"]`;
const textOf = (d: typeof doc | Record<string, unknown>, i = 0) =>
  (((d as typeof doc).sections[0].content[i] as { text?: { children: { text: string }[] }[] }).text ?? [])
    .map((b) => b.children.map((c) => c.text).join(""))
    .join("\n");

// Contributor: text yes; settings, style, structure no; reorder yes
let r = applyOps(doc, [
  { op: "set", path: H1, field: "text", value: "Hola\nmundo" },
  { op: "set", path: H1, field: "level", value: "h2" },
  { op: "style", path: H1, prop: "padding", value: "lg" },
  { op: "insert", type: "paragraph", after: H1, fields: { text: "x" } },
  { op: "remove", path: H1 },
  { op: "move", path: B1, direction: "up" },
], { catalog, grant: contributor });
assert.equal(r.applied.length, 2);
assert.equal(r.rejected.length, 4);
assert.equal(textOf(r.doc, 1), "Hola\nmundo"); // moved down by the button going up
assert.equal((r.doc.sections![0].content as { _key: string }[])[0]._key, "b1");
assert.equal(textOf(doc), "Hello"); // input untouched

// Editor: may add only listed types, fields validated
r = applyOps(doc, [
  { op: "insert", type: "paragraph", after: H1, fields: { text: "New para", nope: 1 } },
  { op: "insert", type: "box", after: H1 },
  { op: "remove", path: B1 },
], { catalog, grant: editor });
assert.deepEqual(r.applied, ["+ Paragraph", "− Button"]);
assert.equal(r.rejected.length, 2); // box not allowed + unknown field
assert.equal(textOf(r.doc, 1), "New para");

// Agency: style tokens and choices validated; links coerced
r = applyOps(doc, [
  { op: "style", path: H1, prop: "padding", value: "lg" },
  { op: "style", path: H1, prop: "padding", value: "13px" },
  { op: "style", path: H1, prop: "textAlign", value: "center", breakpoint: "mobile" },
  { op: "set", path: H1, field: "level", value: "h7" },
  { op: "set", path: B1, field: "link", value: { page: "about" } },
  { op: "set", path: 'sections[_key=="nope"]', field: "theme", value: "light" },
  { op: "set", path: `${S1}.__component.sections[_key=="x"]`, field: "text", value: "x" },
  { op: "set", path: S1, field: "theme", value: "light" },
], { catalog, grant: admin, pages: [{ id: "about", slug: "about" }] });
const h = r.doc.sections![0].content as Record<string, unknown>[];
assert.deepEqual(h[0].design, { base: { padding: "lg" }, mobile: { textAlign: "center" } });
assert.deepEqual(h[1].link, { _type: "link", kind: "internal", page: { _type: "reference", _ref: "about" }, url: undefined });
assert.equal(r.doc.sections![0].theme, "light");
assert.equal(r.applied.length, 4);
assert.equal(r.rejected.length, 4); // bad token, bad choice, missing block, component inner
assert.equal(applyOps(doc, [{ op: "set", path: B1, field: "link", value: { page: "ghost" } }], { catalog, grant: admin, pages: [] }).rejected.length, 1);

// The model only sees what the role may change
assert.ok(describePage(doc, catalog, admin).includes('level: "h1"'));
assert.ok(!describePage(doc, catalog, contributor).includes("level"));
assert.ok(describePage(doc, catalog, contributor).includes('text: "Hello"'));
const ins = buildInstruction({ doc, catalog, grant: contributor, selection: [H1], pages: [], history: [], request: "x" });
assert.ok(ins.includes("STYLE: not allowed"));
assert.ok(ins.includes("BLOCKS YOU MAY ADD: none"));
assert.ok(ins.includes(`SELECTED in the editor`) && ins.includes(H1));
assert.ok(/JSON/.test(ins)); // Agent Actions prompt requires the word in json mode

// Attached images: placed only with the images permission and a known attachment id
const IMG = { _type: "image", asset: { _type: "reference", _ref: "image-abc-10x10-png" } };
r = applyOps(doc, [{ op: "insert", type: "imageBlock", after: H1, fields: { image: { image: "img1" } } }], { catalog, grant: admin, images: { img1: IMG } });
assert.deepEqual((r.doc.sections![0].content as Record<string, unknown>[])[1].image, IMG);
r = applyOps(doc, [{ op: "insert", type: "imageBlock", after: H1, fields: { image: { image: "img9" } } }], { catalog, grant: admin, images: { img1: IMG } });
assert.equal(r.rejected.length, 1); // unknown attachment: block inserted, image rejected
const noImages = grantFor(["x"], { ...policy, x: { label: "x", can: ["text", "structure", "chat"] } });
r = applyOps(doc, [{ op: "insert", type: "imageBlock", after: H1, fields: { image: { image: "img1" } } }], { catalog, grant: noImages, images: { img1: IMG } });
assert.ok(r.rejected.some((x) => x.includes("images")));
const withImg = buildInstruction({ doc, catalog, grant: admin, selection: [], pages: [], history: [], request: "x", images: [{ id: "img1", name: "hero.jpg" }] });
assert.ok(withImg.includes('img1 ("hero.jpg")') && withImg.includes('{"image":"<id>"}'));
assert.ok(buildInstruction({ doc, catalog, grant: contributor, selection: [], pages: [], history: [], request: "x", images: [{ id: "img1", name: "a" }] }).includes("only as reference"));

// Answers
assert.deepEqual(parseAnswer({ reply: "ok", ops: [{ op: "remove" }] }), { reply: "ok", ops: [{ op: "remove" }] });
assert.deepEqual(parseAnswer('Sure! {"reply":"hi","ops":[]} thanks'), { reply: "hi", ops: [] });
assert.deepEqual(parseAnswer("no json here"), { reply: "no json here", ops: [] });
// Server-side model call: the key goes only to the chosen provider, in its own header
const a = buildRequest({ provider: "anthropic", model: "", apiKey: "k1" }, "hi");
assert.equal(a.url, "https://api.anthropic.com/v1/messages");
assert.equal((a.init.headers as Record<string, string>)["x-api-key"], "k1");
assert.equal(JSON.parse(a.init.body as string).model, "claude-sonnet-5-5"); // default model
assert.equal(JSON.parse(a.init.body as string).temperature, undefined); // rejected by current Claude models
const o = buildRequest({ provider: "openai", model: "m", apiKey: "k2" }, "hi");
assert.equal((o.init.headers as Record<string, string>).authorization, "Bearer k2");
assert.equal(JSON.parse(o.init.body as string).response_format.type, "json_object");
assert.ok(buildRequest({ provider: "openrouter", model: "x/y", apiKey: "k3" }, "hi").url.startsWith("https://openrouter.ai/"));
assert.equal(readResponse("anthropic", { content: [{ type: "text", text: '{"reply":"a"}' }] }), '{"reply":"a"}');
assert.equal(readResponse("openai", { choices: [{ message: { content: '{"reply":"b"}' } }] }), '{"reply":"b"}');
assert.deepEqual(parseAnswer(readResponse("anthropic", { content: [{ type: "text", text: '```json\n{"reply":"c","ops":[]}\n```' }] })), { reply: "c", ops: [] });
// Model picker: only providers with a key; AI_MODELS is an allow-list; shorthand still works
const env = (vars: Record<string, string>) => (k: string) => vars[k];
assert.equal(availableModels(env({})).options.length, 0);
let m = availableModels(env({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" }));
assert.equal(m.options[0].id, "anthropic:claude-sonnet-5-5"); // default first
assert.ok(m.options.some((o) => o.provider === "openai") && !m.options.some((o) => o.provider === "openrouter"));
m = availableModels(env({ ANTHROPIC_API_KEY: "a", AI_MODELS: "anthropic:claude-haiku-5-5, openai:gpt-4.1, sanity" }));
assert.deepEqual(m.options.map((o) => o.id), ["anthropic:claude-haiku-5-5", "sanity:"]); // openai has no key
m = availableModels(env({ AI_PROVIDER: "openai", AI_API_KEY: "k", AI_MODEL: "gpt-x" }));
assert.equal(m.options[0].id, "openai:gpt-x");
assert.equal(m.keys.openai, "k");
// Vision: the model gets the pixels in each provider's own format
const vis = [{ mediaType: "image/jpeg", data: "AAAA" }];
const av = JSON.parse(buildRequest({ provider: "anthropic", model: "", apiKey: "k" }, "hi", vis).init.body as string);
assert.deepEqual(av.messages[0].content[0], { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } });
const ov = JSON.parse(buildRequest({ provider: "openai", model: "m", apiKey: "k" }, "hi", vis).init.body as string);
assert.equal(ov.messages[0].content[1].image_url.url, "data:image/jpeg;base64,AAAA");
console.log("chat.check: ok");
