# Remarkable

A creative-agency site built with **Astro 7** + **Sanity 6**, designed around
our own visual editor (the **Remarkable Editor**, a tab in the Studio). Instead of rigid, pre-baked page
templates, you compose pages from a set of **core building blocks** and build
highly custom sections from scratch — all visually, with drag controls and
live click-to-edit overlays.

---

## Quick start

```bash
# 1. Install (already done if you're reading this)
npm install

# 2. Point the app at a Sanity project
#    Either run the guided init…
npx sanity@latest init --env
#    …or copy .env.example to .env and fill in the values by hand.
cp .env.example .env

# 3. (Optional) load the demo home page so there's something to see
npx sanity dataset import sanity/seed.ndjson production

# 4. Run it
npm run dev
```

- Site: <http://localhost:3000>
- Studio: <http://localhost:3000/studio>
- Visual editor: the **Editor** tab inside the Studio (`/studio#/editor`).

### Environment variables (`.env`)

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SANITY_PROJECT_ID` | Your Sanity project ID |
| `PUBLIC_SANITY_DATASET` | Usually `production` |
| `PUBLIC_SANITY_API_VERSION` | API date, e.g. `2024-10-01` |
| `SANITY_API_READ_TOKEN` | Optional — only for a private dataset (read at build time) |

Until these are set, the homepage shows a friendly setup screen instead of
crashing.

---

## The building blocks

Every block can be dropped into a **Section** — and the container blocks
(**Grid**, **Slider**, **Card**, **Button Group**) can hold blocks too, so you
can nest and compose freely.

| Block | Key visual controls |
| --- | --- |
| **Eyebrow** | size, color, alignment |
| **Heading** | semantic level (h1–h6) *and* visual size, weight, color, alignment, **drag-to-set max width** |
| **Paragraph** | size, color, alignment, **drag-to-set max width** |
| **Button** | **style dropdown** (primary / secondary / outline / ghost / link), **size dropdown** (sm–xl), link, new-tab, full-width |
| **Button Group** | direction, alignment, wrap, gap slider |
| **Image** | aspect-ratio, fit, corner-radius slider, max-width slider, hotspot |
| **Looping Video** | file upload or URL, poster, aspect-ratio, fit, autoplay, radius + max-width sliders |
| **Card** | variant (surface / elevated / outline / ghost / brand), padding, gap, radius sliders, optional link |
| **Slider** | **slides-per-view per breakpoint** (three drag sliders), gap, loop, arrows, dots |
| **Grid** | **columns per breakpoint** (three drag sliders), column/row gap, vertical alignment |

### Sections & theming

A **Section** is the top-level composable container. It exposes:

- **Theme**: `light` · `dark` · `brand`. The theme sets CSS variables that
  **cascade to every child** — buttons, cards, and text automatically restyle to
  match. (A Card with the *brand* variant re-themes its own subtree too.)
- **Spacing**: drag sliders for **top padding**, **bottom padding**, and the gap
  between blocks.
- **Layout**: container max-width slider, horizontal alignment, full-viewport-
  height mode (great for heroes) with vertical alignment.
- **Background**: optional image with an overlay-opacity slider.

Because theming is driven by CSS custom properties (see
[`globals.css`](src/theme/globals.css)), changing a section's theme is instant and
consistent across all nested blocks.

---

## How the visual editing works

- **Static public site** — every page is prerendered at build time
  (`dist/`, any static host). Publishing does not redeploy on its own: hook a
  Sanity webhook to your host's deploy hook.
- **Remarkable Editor** — a Studio tool: pages + layers, a canvas that renders
  the real site from the draft as you edit it, and a properties panel
  generated from the schema. Double-click text to edit it in place, drag
  layers, drop images, undo. See [`CLAUDE.md`](CLAUDE.md).

## Project structure

See [`CLAUDE.md`](CLAUDE.md): folder layout, how to add or remove a block, the
rules that keep the editor working, and the checklist for starting a new
project from this starter.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `astro check` + `tsc --noEmit` |
| `npm run verify` | Build + the checks that catch silent breakage (add a URL for HTTP checks) |
| `npm run typegen` | Generate `sanity.types.ts` from your schema + queries |
| `node scripts/generate-seed.mjs` | Rebuild the demo `sanity/seed.ndjson` |
