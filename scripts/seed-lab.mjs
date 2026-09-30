// Stress-test pages for the motion blocks: three deliberately different
// "creative sites" (lab-noir, lab-kinetic, lab-stack). Published directly.
//
//   SANITY_WRITE_TOKEN=… node scripts/seed-lab.mjs
//
// Re-running replaces the three documents (drafts of them are discarded).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@sanity/client";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const token = process.env.SANITY_WRITE_TOKEN;
if (!token) throw new Error("Set SANITY_WRITE_TOKEN (a token with write access).");
const client = createClient({
  projectId: env.PUBLIC_SANITY_PROJECT_ID,
  dataset: env.PUBLIC_SANITY_DATASET || "production",
  apiVersion: "2024-10-01",
  token,
  useCdn: false,
});

const k = () => randomUUID().replace(/-/g, "").slice(0, 12);
const key = (o) => ({ _key: k(), ...o });
const pt = (text) => [
  { _type: "block", _key: k(), style: "normal", markDefs: [], children: [{ _type: "span", _key: k(), text, marks: [] }] },
];

// ── Blocks ────────────────────────────────────────────────────────────────
const eyebrow = (text) => key({ _type: "eyebrow", text, size: "sm", color: "brand" });
const heading = (text, o = {}) => key({ _type: "heading", text: pt(text), level: "h2", size: "2xl", animation: "words", ...o });
const paragraph = (text, o = {}) => key({ _type: "paragraph", text: pt(text), size: "lg", color: "muted", ...o });
const card = (heading, body, layout = "simple") => key({ _type: "card", layout, heading, body });
const image = (o = {}) => key({ _type: "imageBlock", aspectRatio: "4/3", objectFit: "cover", radius: "main", ...o });
const content = (...blocks) => key({ _type: "contentWrapper", content: blocks });
const hscroll = (headingText, items, panelWidth = 45) => key({ _type: "horizontalScroll", heading: headingText, items, panelWidth });
const stack = (items) => key({ _type: "stackCards", items });
const marquee = (items, o = {}) => key({ _type: "marquee", items, separator: "✦", direction: "left", duration: 24, ...o });
const scrub = (text, size = "xl") => key({ _type: "textScrub", text, size });
const big = (text, effect = "rise") => key({ _type: "bigType", text, effect });
const parallax = (o = {}) => key({ _type: "parallaxMedia", height: 80, strength: 15, reveal: true, ...o });
const grid = (items) => key({ _type: "grid", items, columns: { mobile: 1, tablet: 2, desktop: 3 } });
const slider = (slides) => key({ _type: "slider", slides });

const section = (theme, content, o = {}) =>
  key({ _type: "section", theme, paddingTop: "large", paddingBottom: "large", gap: "lg", contentAlign: "start", content, ...o });

const lorem = [
  "We build brands, products and campaigns for teams who would rather be remembered than merely seen.",
  "Every project starts with a question nobody has asked yet, and ends with an answer that feels obvious in hindsight.",
  "Strategy, identity, motion and code live in the same room here, so ideas never get lost in translation between disciplines.",
  "We measure success in the moments people stop scrolling, lean in, and send the link to someone they like.",
];
const long = (n) => Array.from({ length: n }, (_, i) => lorem[i % lorem.length]).join(" ");
const work = ["Aurora Bank", "Kilo Studio", "Northwind", "Parallel Labs", "Solstice", "Tidal Records", "Vantage", "Wren & Co"];

const pages = [
  {
    _id: "lab-noir",
    title: "Lab — Noir",
    metaTitle: "Noir · a dark editorial stress test",
    sections: [
      section("dark", [eyebrow("Studio Noir"), heading("We make things people remember.", { level: "h1", size: "4xl", animation: "lines" }), paragraph(lorem[0])], { fullHeight: true, contentAlign: "center" }),
      section("dark", [hscroll("Selected work", work.slice(0, 6).map((w, i) => card(w, lorem[i % 4], i % 2 ? "imageBackground" : "simple")), 40)], { paddingTop: "none", paddingBottom: "none" }),
      section("brand", [marquee(["Identity", "Motion", "Interfaces", "Campaigns", "Sound"])], { paddingTop: "medium", paddingBottom: "medium" }),
      section("dark", [scrub(long(3), "2xl")]),
      section("dark", [hscroll("Process", [content(eyebrow("01"), heading("Listen", { animation: "none" }), paragraph(lorem[1])), content(eyebrow("02"), heading("Frame", { animation: "none" }), paragraph(lorem[2])), content(eyebrow("03"), heading("Make", { animation: "none" }), paragraph(lorem[3])), content(eyebrow("04"), heading("Ship", { animation: "none" }), paragraph(lorem[0]))], 70)], { paddingTop: "none", paddingBottom: "none" }),
      section("light", [heading("Capabilities"), grid(["Brand", "Product", "Motion", "Web", "Content", "Research"].map((t, i) => card(t, lorem[i % 4])))]),
      section("dark", [big("NOIR", "wave")], { fullHeight: true, contentAlign: "center" }),
    ],
  },
  {
    _id: "lab-kinetic",
    title: "Lab — Kinetic",
    metaTitle: "Kinetic · a text-heavy stress test",
    sections: [
      section("light", [big("Kinetic", "rise")], { fullHeight: true, contentAlign: "center" }),
      section("light", [marquee(["Read", "Scroll", "Repeat", "Typography", "Rhythm"], { outline: true, direction: "right", duration: 30 })], { paddingTop: "none", paddingBottom: "none" }),
      section("light", [scrub(long(4), "2xl")]),
      ...[1, 2, 3, 4].map((n) =>
        section(n % 2 ? "light" : "dark", [eyebrow(`Chapter ${n}`), heading(lorem[n % 4], { size: "3xl", animation: n % 2 ? "words" : "lines" }), paragraph(long(3)), paragraph(long(2)), paragraph(long(4))]),
      ),
      section("dark", [scrub(long(2), "3xl")]),
      section("brand", [marquee(["Slow", "down", "and", "read", "this"], { duration: 16 })], { paddingTop: "medium", paddingBottom: "medium" }),
      section("light", [big("The end", "spread")], { fullHeight: true, contentAlign: "center" }),
    ],
  },
  {
    _id: "lab-stack",
    title: "Lab — Stack",
    metaTitle: "Stack · parallax and sticky stress test",
    sections: [
      section("light", [eyebrow("Stack"), heading("Layers on layers.", { level: "h1", size: "4xl", animation: "lines" })], { paddingTop: "pageTop" }),
      section("light", [parallax({ height: 90, caption: "Parallax, 15%" })], { paddingTop: "none" }),
      section("dark", [heading("How we work"), stack(["Discover", "Define", "Design", "Develop", "Deliver"].map((t, i) => card(t, long(1 + (i % 2)), "imageTop")))]),
      section("light", [parallax({ height: 60, strength: 30, reveal: false, caption: "Parallax, 30%, no reveal" })]),
      section("brand", [hscroll("Gallery", Array.from({ length: 8 }, () => image()), 30)], { paddingTop: "none", paddingBottom: "none" }),
      section("light", [heading("Also in the toolbox"), slider(work.slice(0, 5).map((w) => card(w, lorem[1], "imageTop")))]),
      section("dark", [parallax({ height: 100, strength: 20, caption: "Full height" })], { paddingTop: "none", paddingBottom: "none" }),
    ],
  },
];

const tx = client.transaction();
for (const p of pages) {
  tx.createOrReplace({ _type: "page", slug: { _type: "slug", current: p._id }, noindex: true, ...p });
  tx.delete(`drafts.${p._id}`);
}
await tx.commit();
console.log("Seeded:", pages.map((p) => `/${p._id}`).join("  "));
