import { randomKey } from "@/core/canvas/editorOps";

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
