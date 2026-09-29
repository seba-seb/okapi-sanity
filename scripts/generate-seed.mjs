// Generates a demo "home" page (sanity/seed.ndjson) that exercises the building
// blocks and all three section themes. Import with:
//   npx sanity dataset import sanity/seed.ndjson production
// or apply straight to the "home" doc: node scripts/rebuild-home.mjs
// Re-run to regenerate: node scripts/generate-seed.mjs
//
// Kept in sync with the schema: copy blocks (eyebrow/heading/paragraph/button
// group) live inside a `contentWrapper` for clean margin rhythm; alignment is
// set on the section (contentAlign → --alignment), not per block; cards are the
// structured layout/heading/body composition.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const k = () => randomUUID().replace(/-/g, "").slice(0, 12);
const key = (obj) => ({ _key: k(), ...obj });

// Heading / paragraph copy is Portable Text; wrap a string in one "normal"
// block. `maxWidth` is measured in `ch` (heading 2–30, paragraph 2–70).
const pt = (text) => [
  {
    _type: "block",
    _key: k(),
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: k(), text, marks: [] }],
  },
];

const eyebrow = (text, opts = {}) =>
  key({ _type: "eyebrow", text, size: "sm", color: "brand", ...opts });
const heading = (text, opts = {}) =>
  key({ _type: "heading", text: pt(text), level: "h2", size: "xl", weight: "bold", color: "default", ...opts });
const paragraph = (text, opts = {}) =>
  key({ _type: "paragraph", text: pt(text), size: "md", color: "muted", ...opts });
const button = (label, opts = {}) =>
  key({ _type: "button", label, href: "#", style: "primary", size: "md", ...opts });
const buttonGroup = (buttons, opts = {}) =>
  key({ _type: "buttonWrapper", buttons, direction: "row", wrap: true, gap: 12, ...opts });

// Copy blocks live in a content wrapper — the block margins give the rhythm and
// the wrapper trims the outer edges.
const contentWrapper = (content) => key({ _type: "contentWrapper", content });

// Cards are a fixed composition: layout + heading + body (+ optional image).
const card = (headingText, body, opts = {}) =>
  key({ _type: "card", layout: "simple", heading: headingText, body, ...opts });
const grid = (items, opts = {}) =>
  key({ _type: "grid", items, columns: { mobile: 1, tablet: 2, desktop: 3 }, columnGap: 24, rowGap: 24, alignItems: "stretch", ...opts });
const slider = (slides, opts = {}) =>
  key({ _type: "slider", slides, slidesPerView: { mobile: 1, tablet: 2, desktop: 3 }, gap: 24, loop: true, align: "start", showArrows: true, showDots: true, ...opts });

const section = (opts) =>
  key({
    _type: "section",
    theme: "light",
    paddingTop: "medium",
    paddingBottom: "medium",
    gap: "lg",
    contentAlign: "start",
    fullHeight: false,
    overlayOpacity: 0,
    ...opts,
  });

const page = {
  _id: "home",
  _type: "page",
  title: "Home",
  slug: { _type: "slug", current: "home" },
  metaTitle: "Remarkable — Creative Agency",
  metaDescription: "A full-service creative studio building brands that move.",
  sections: [
    // 1) Hero — dark, full height, centered
    section({
      name: "Hero",
      theme: "dark",
      fullHeight: true,
      verticalAlign: "center",
      contentAlign: "center",
      paddingTop: "large",
      paddingBottom: "large",
      content: [
        contentWrapper([
          eyebrow("Creative Studio"),
          heading("We design awesome brands for creators.", {
            level: "h1",
            size: "4xl",
            maxWidth: 16,
          }),
          paragraph(
            "Remarkable is a full-service creative agency crafting identities, websites, and campaigns for ambitious teams.",
            { size: "lg", maxWidth: 42 },
          ),
          buttonGroup([
            button("Start a project", { style: "primary", size: "lg" }),
            button("See our work", { style: "outline", size: "lg" }),
          ]),
        ]),
      ],
    }),

    // 2) Capabilities — light, grid of cards
    section({
      name: "Capabilities",
      theme: "light",
      content: [
        contentWrapper([
          eyebrow("What we do"),
          heading("Capabilities", { size: "2xl", maxWidth: 24 }),
        ]),
        grid([
          card("Brand Strategy", "Positioning, messaging, and identity systems that stick."),
          card("Web Design", "Fast, accessible sites built to convert and scale."),
          card("Campaigns", "Launches and content that earn attention across channels."),
        ]),
      ],
    }),

    // 3) Testimonials — light, slider of quote cards
    section({
      name: "Testimonials",
      theme: "light",
      content: [
        contentWrapper([
          eyebrow("Kind words"),
          heading("Clients we've helped shine", { size: "xl", maxWidth: 26 }),
        ]),
        slider([
          card("Dana R., Northwind", "“They reimagined our brand and doubled our inbound leads.”"),
          card("Marcus L., Lumen", "“The most thoughtful design partner we've ever worked with.”"),
          card("Priya S., Cadence", "“Fast, sharp, and genuinely fun to collaborate with.”"),
          card("Theo B., Fieldwork", "“Our new site paid for itself in the first month.”"),
        ]),
      ],
    }),

    // 4) CTA — brand theme
    section({
      name: "CTA",
      theme: "brand",
      contentAlign: "center",
      paddingTop: "large",
      paddingBottom: "large",
      content: [
        contentWrapper([
          heading("Let's build something great.", {
            size: "3xl",
            maxWidth: 22,
          }),
          buttonGroup([button("Get in touch", { style: "primary", size: "xl" })]),
        ]),
      ],
    }),
  ],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = `${__dirname}/../sanity/seed.ndjson`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(page) + "\n");
console.log("Wrote", outPath);
