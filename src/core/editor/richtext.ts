/**
 * Portable Text ⇄ editable HTML, for in-place rich text editing on the canvas.
 * Supports what the starter's rich text fields allow: decorators `strong` /
 * `em`, and `link` annotations. Existing links keep their markDef (their
 * internal/external target) through `data-def`; links created in the canvas
 * become external links.
 */
import { randomKey } from "./paths";

type Span = { _type: "span"; _key: string; text: string; marks: string[] };
type MarkDef = { _key: string; _type: string; [k: string]: unknown };
export type PTBlock = { _type: "block"; _key: string; style: string; markDefs: MarkDef[]; children: Span[] };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** PT → HTML for a contenteditable element (one <div> per block). */
export function ptToHtml(value: unknown): string {
  const blocks = (Array.isArray(value) ? value : []) as PTBlock[];
  if (!blocks.length) return "<div><br></div>";
  return blocks
    .map((b) => {
      const defs = new Map((b.markDefs ?? []).map((d) => [d._key, d]));
      const inner = (b.children ?? [])
        .map((c) => {
          let html = esc(c.text ?? "");
          for (const m of c.marks ?? []) {
            if (m === "strong") html = `<strong>${html}</strong>`;
            else if (m === "em") html = `<em>${html}</em>`;
            else if (defs.has(m)) html = `<a data-def="${esc(m)}" href="#">${html}</a>`;
          }
          return html;
        })
        .join("");
      return `<div>${inner || "<br>"}</div>`;
    })
    .join("");
}

/** HTML of a contenteditable element → PT, reusing the markDefs it came from. */
export function htmlToPt(root: HTMLElement, previous: unknown): PTBlock[] {
  const oldDefs = new Map<string, MarkDef>();
  for (const b of (Array.isArray(previous) ? previous : []) as PTBlock[]) for (const d of b.markDefs ?? []) oldDefs.set(d._key, d);

  const blocks: PTBlock[] = [];
  const newBlock = (): PTBlock => ({ _type: "block", _key: randomKey(), style: "normal", markDefs: [], children: [] });
  let cur = newBlock();

  const inline = (node: Node, marks: string[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? "";
      if (text) cur.children.push({ _type: "span", _key: randomKey(), text, marks: [...marks] });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    if (tag === "BR") return;
    let next = marks;
    if (tag === "B" || tag === "STRONG") next = [...next, "strong"];
    else if (tag === "I" || tag === "EM") next = [...next, "em"];
    else if (tag === "A") {
      const existing = node.getAttribute("data-def");
      const def = existing ? oldDefs.get(existing) : undefined;
      const key = def ? def._key : randomKey();
      if (!cur.markDefs.some((d) => d._key === key)) {
        cur.markDefs.push(def ?? { _key: key, _type: "link", kind: "external", url: node.getAttribute("href") ?? "" });
      }
      next = [...next, key];
    }
    node.childNodes.forEach((c) => inline(c, next));
  };

  const pushCur = () => {
    blocks.push(cur);
    cur = newBlock();
  };
  for (const node of [...root.childNodes]) {
    const isBlock = node instanceof HTMLElement && /^(DIV|P)$/.test(node.tagName);
    if (isBlock) {
      if (cur.children.length) pushCur();
      node.childNodes.forEach((c) => inline(c, []));
      pushCur();
    } else inline(node, []);
  }
  if (cur.children.length || !blocks.length) pushCur();

  // Normalize: merge neighbours with identical marks, keep marks ordered, no empty blocks' spans.
  for (const b of blocks) {
    const merged: Span[] = [];
    for (const s of b.children) {
      s.marks = [...new Set(s.marks)].sort();
      const prev = merged.at(-1);
      if (prev && prev.marks.join() === s.marks.join()) prev.text += s.text;
      else merged.push(s);
    }
    b.children = merged.length ? merged : [{ _type: "span", _key: randomKey(), text: "", marks: [] }];
    const used = new Set(b.children.flatMap((c) => c.marks));
    b.markDefs = b.markDefs.filter((d) => used.has(d._key));
  }
  return blocks;
}

/** Plain text of PT (for messages/logs). */
export const ptPlain = (pt: PTBlock[]) => pt.map((b) => b.children.map((c) => c.text).join("")).join("\n");
