import { randomKey } from "@/core/editor/paths";

/** Plain text of a Portable Text value, or null if it has marks/links/styles we'd lose. */
export function ptToPlainIfSimple(v: unknown): string | null {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (!Array.isArray(v)) return null;
  const lines: string[] = [];
  for (const b of v as { _type?: string; style?: string; markDefs?: unknown[]; children?: { text?: string; marks?: string[] }[] }[]) {
    if (b._type !== "block" || (b.style && b.style !== "normal") || b.markDefs?.length) return null;
    if (b.children?.some((c) => c.marks?.length)) return null;
    lines.push((b.children ?? []).map((c) => c.text ?? "").join(""));
  }
  return lines.join("\n");
}

/** One Portable Text block per line. */
export function plainToPt(text: string) {
  return text.split("\n").map((line) => ({
    _type: "block",
    _key: randomKey(),
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: randomKey(), text: line, marks: [] }],
  }));
}

type MdDef = { _key: string; _type: string; kind?: string; url?: string; page?: { _ref?: string } };
type MdBlock = { _key?: string; style?: string; markDefs?: MdDef[]; children?: { text?: string; marks?: string[] }[] };
const linkTarget = (d: MdDef) => (d.kind === "internal" ? `page:${d.page?._ref ?? ""}` : (d.url ?? ""));

/**
 * Portable Text → the markdown the chat reads and writes: **bold**, *italic*,
 * [text](https://…) and [text](page:<id>), one line per paragraph.
 */
export function ptToMd(v: unknown): string {
  if (typeof v === "string") return v;
  if (!Array.isArray(v)) return "";
  return (v as MdBlock[])
    .map((b) => {
      const defs = new Map((b.markDefs ?? []).map((d) => [d._key, d]));
      return (b.children ?? [])
        .map((c) => {
          const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(c.text ?? "")!;
          if (!core) return lead + trail;
          let s = core; // spaces stay outside the markers: "** now**" isn't bold in markdown
          const marks = c.marks ?? [];
          if (marks.includes("em")) s = `*${s}*`;
          if (marks.includes("strong")) s = `**${s}**`;
          for (const m of marks) if (defs.has(m)) s = `[${s}](${linkTarget(defs.get(m)!)})`;
          return lead + s + trail;
        })
        .join("");
    })
    .join("\n");
}

/**
 * The chat's markdown → Portable Text. Links that point where an existing one
 * did keep its markDef (so internal links survive); new links must be
 * external. Each paragraph keeps the style and key of the one it replaces.
 */
export function mdToPt(md: string, previous: unknown) {
  const prev = (Array.isArray(previous) ? previous : []) as MdBlock[];
  const oldDefs = new Map(prev.flatMap((b) => b.markDefs ?? []).map((d) => [linkTarget(d), d]));
  const RE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/;
  return md.split("\n").map((line, i) => {
    const markDefs: MdDef[] = [];
    const children: { _type: "span"; _key: string; text: string; marks: string[] }[] = [];
    const linkKey = (target: string) => {
      const def = oldDefs.get(target) ?? (/^(https?:|mailto:|tel:|#)/.test(target) ? { _key: randomKey(), _type: "link", kind: "external", url: target } : null);
      if (def && !markDefs.includes(def)) markDefs.push(def);
      return def?._key ?? null;
    };
    const inline = (s: string, marks: string[]) => {
      while (s) {
        const m = RE.exec(s);
        if (!m) {
          children.push({ _type: "span", _key: randomKey(), text: s, marks });
          return;
        }
        if (m.index) children.push({ _type: "span", _key: randomKey(), text: s.slice(0, m.index), marks });
        if (m[1] !== undefined) inline(m[1], [...marks, "strong"]);
        else if (m[2] !== undefined) inline(m[2], [...marks, "em"]);
        else {
          const key = linkKey(m[4]);
          inline(m[3], key ? [...marks, key] : marks);
        }
        s = s.slice(m.index + m[0].length);
      }
    };
    inline(line, []);
    if (!children.length) children.push({ _type: "span", _key: randomKey(), text: "", marks: [] });
    return { _type: "block", _key: prev[i]?._key ?? randomKey(), style: prev[i]?.style ?? "normal", markDefs, children };
  });
}
