# remarkable-astro — starter

Base for client sites: **Astro 7 + React islands + Sanity 6**, with a visual
page builder edited from the Studio's Presentation tool (click-to-edit, ⌘E
insert, drag/keyboard reorder, on-canvas resizers, live text while typing).
The public site is **static**; only `/preview/*` and `/api/draft-mode/*` run
on a server.

## Layout

```
src/core/       Infrastructure. Same in every project — don't fork it per project.
  sanity/       client + loadQuery, draft-mode lock, dataAttr, presentation resolve,
                queries, site loader (settings/menus/routes), link type schema
  canvas/       everything mounted in the preview: VisualEditing bridge + tools
  studio/       custom Studio inputs + listeners (preview → Studio writes)
  render/       PageBuilder, BlockRenderer, useLiveQuery, Welcome
  lib/          clean (stega), routes (pageHref/resolveLink), types
  motion/       gsap.ts (the ONE place GSAP is imported + the motion policy),
                ScrollRefresh, useSplit, SplitReveal
src/blocks/     The project's blocks. One folder per type: schema.ts + Component.tsx
  meta.ts       THE registry: type names, titles, container slots, canvas flags
  schemas.ts    type → schema     (typed against meta.ts)
  components.tsx type → component (typed against meta.ts) + block canvas tools
  defaults.ts   what a block contains when inserted from the canvas
src/theme/      Per project. tokens.css = the design tokens (edit this first);
                globals.css = Tailwind 4 wiring + the starter's base CSS.
src/chrome/     Header/footer. Per project — restyle or replace.
src/documents/  Document types: page, settings (singleton), navigation (singleton)
src/pages/      Routes. /preview/[...slug] mirrors the public routes.
                /lab/[slug] = dev-only stress harness (not built in production).
src/lab/        LabHarness: replays editor mutations + checks (see "Testing motion").
patches/        patch-package fixes for sanity@6.3.0 + @sanity/visual-editing@5.4.5
```

## Rules

- **Core is shared.** A fix in `src/core` belongs to the starter first, then
  gets copied to projects. (When 3+ projects are live, extract core into a
  private package so fixes arrive with `npm update`.)
- **Every URL goes through `pageHref()` / `resolveLink()`** (`core/lib/routes.ts`).
  Links, sitemap, canonicals. Adding i18n later = changing those two functions.
- **Internal links are references, never typed paths.** Use the `link` type
  (buttons, rich text, menus). `rel` is derived — never add it as a field.
- **Stega:** anything from Sanity used as *data* (class names, style values,
  tag names, `===` comparisons, `href`/`src`, `alt`, `<head>`) goes through
  `clean()`. Leaf text is cleaned too (see `core/lib/clean.ts` for why).
- **Blocks get their data as props.** Never fetch inside a block — the preview
  swaps in draft data from the top (`PageBuilder`); a block that fetches
  can't be previewed.
- **Animations live inside the React component** (`useGSAP` with a `scope`),
  never in an Astro `<script>` with querySelector: React re-renders blocks in
  the preview and a script won't see the new nodes. Skip entrance animations
  under `/preview`. Split text inside a wrapper `key`ed by the text, never on
  the element that carries `data-sanity`. `core/motion/SplitReveal` already
  does all of this — reuse it (see Heading's `animation` field) rather than
  writing a new split.
- **Styling: Tailwind 4 utilities built from the tokens** — `bg-bg text-fg
  bg-surface text-muted border-border bg-brand text-brand-contrast`,
  `rounded-main`, `gap-md p-lg` (the t-shirt spacing), `text-h-xl`,
  `px-section-x`, `max-w-page`. Colour utilities read the section's
  `[data-theme]`, so blocks restyle per theme for free. Tailwind's default
  palette is removed on purpose (no `bg-red-500`): add colours to tokens.css
  + the `@theme inline` map. No preflight, so the starter's base CSS is
  untouched; it lives in `@layer components`, so utilities override it.
- **Design assets don't go in the CMS** (logos, textures): they're code.
- Pinned: `sanity@6.3.0`, `@sanity/visual-editing@5.4.5` (overrides in
  package.json). Upgrading either means re-making `patches/` — see its README.

## Remarkable Editor (phase 0)

Studio tool at `/studio#/editor` (the Studio's landing tool): pages | canvas |
properties. `src/core/editor/`:
- `EditorTool.tsx` — reads the page with `useEditState` (local edits applied
  at once) and writes with `useDocumentOperation(...).patch` / `.publish` —
  the Studio's own document store, no extra SDK. Team = `administrator` role;
  others get the client view (content fields only). Team can toggle it.
- `CanvasApp.tsx` + `src/pages/edit-canvas.astro` — the canvas iframe: the real
  PageBuilder rendering whatever the editor posts (`protocol.ts`, same-origin
  postMessage). It fetches nothing, so the route exposes no drafts. Own
  hover/selection overlay; clicks select, never navigate. Motion follows the
  editor-preview policy.
- `FieldControls.tsx` — the properties panel, generated from the compiled
  Studio schema (`controlKind`). `scripts/check-editor-schema.ts` (run by
  verify) fails if any block field has no control. Content vs design:
  `isContent` (text, rich text, links, images, references = client-visible).

Next (phase 1): inline text editing on the canvas, layers tree + drag,
insert/duplicate/delete, undo/redo, image drop. See the plan in the session.

## Motion blocks

Horizontal Scroll (pinned), Stacked Cards (sticky + scrub), Marquee (loop +
scroll velocity), Scroll Text (words light up), Big Type (chars), Parallax
Media, plus the Heading `animation` field. Policy (`core/motion/gsap.ts`):

| Kind | Examples | Public | Editor preview | Reduced motion |
|---|---|---|---|---|
| Layout | pin, horizontal scroll, sticky scrub, parallax | ✓ | ✓ (the editor must reach the content) | native fallback |
| Decorative | text splits, entrances, marquee loop, clip reveals | ✓ | ✗ (would replay / re-split per keystroke) | ✗ |

Rules for new motion blocks:
- Import GSAP from `@/core/motion/gsap`, never from `"gsap"`.
- `useGSAP` with `scope`; if the block has children, pass
  `dependencies: [childKeys], revertOnUpdate: true` so inserts/removes rebuild it.
- Pin an INNER element, never the one with `data-sanity` (React owns the outer
  node; GSAP's pin-spacer goes between them).
- Anything whose size can change without the page height changing (a track's
  width) needs its own ResizeObserver → `ScrollTrigger.refresh()`.
  `ScrollRefresh` covers page-height changes.
- Full-bleed: `.section__container > .your-block { margin-inline: calc(50% - 50vw); width: 100vw }`
  (the container resets child margins; match its specificity + 1).
- On-screen-at-load elements get a time-based entrance, not a scrub (it would
  start half-played).

## Testing motion

`npm run dev`, then open `/lab/<slug>` (append `?as-preview` for the editor's
motion policy). The panel replays editor mutations on the real PageBuilder —
typing into every text, inserting/removing items inside pinned bands,
reversing/duplicating/deleting pinned sections, cycling animations and
themes, 25 rapid edits — half of them while scrolled INTO a pin, and checks
after each: React errors, one pin-spacer per band, pin distance = track
travel, no dangling ScrollTriggers, no nested/stuck splits, no horizontal
overflow, edited text rendered. Scripted: `await window.__lab.run()`.
Seed the three test pages with `SANITY_WRITE_TOKEN=… node scripts/seed-lab.mjs`
(/lab-noir, /lab-kinetic, /lab-stack — noindex).

What /lab can't cover: the Presentation overlays themselves (hover boxes,
drag handles) — those need the real Studio. Check them by hand in
`/studio#/presentation` on a lab page.

## Add a block

1. `src/blocks/<type>/schema.ts` (`defineType`, icon from `@sanity/icons`) and
   `src/blocks/<type>/<Type>.tsx` (receives `{ block, path, ctx }`; put
   `{...editable(ctx.documentId, ctx.documentType, path, block._type)}` on its root).
2. Add `<type>: { title, slot?, margin? }` to `blocks/meta.ts`.
3. Register it in `blocks/schemas.ts` and `blocks/components.tsx` — the
   compiler errors until you do.
4. Optional: insert defaults in `blocks/defaults.ts`.

Remove a block: delete its folder, its `meta.ts` entry and the two map entries,
and any `accepts` that names it (the compiler points at them).

## New project from this starter

1. Copy the repo (keep `src/core` untouched), `npm install` (applies patches).
2. Sanity (MCP): `create_project` in the client's org with
   `corsOrigin: http://localhost:4321` → put `projectId` + the **read** token in
   `.env` (see `.env.example`).
3. Seed: `npx sanity dataset import sanity/seed.ndjson --dataset production`
   with `SANITY_AUTH_TOKEN=<write token>`. Then **revoke the write token**.
4. Theme: `src/theme/` tokens; chrome in `src/chrome/`; delete unused blocks,
   add the project's own.
5. Hosting: set the adapter in `astro.config.mjs` (one line), env vars in the
   host panel (`PUBLIC_SANITY_*`, `SANITY_API_READ_TOKEN`, `PUBLIC_SITE_URL`),
   and `npx sanity cors add https://<domain> --credentials` (without
   `--credentials` the preview never opens).
6. Publish → rebuild: Sanity webhook (on publish) → the host's deploy hook.
   Static site: publishing does nothing until the next build.
7. Client access: `npx sanity users invite <email> --role contributor`
   (drafts only, a teammate publishes) or `editor`. Try the role — plan limits vary.
8. `npm run verify` (and `npm run verify -- https://<domain>` after deploy).

## Commands

- `npm run dev` — site on :4321, Studio at `/studio`, visual editor at
  `/studio#/presentation` (hash routing: the workspace is at the root of the hash). `astro dev` daemonizes: stop with `npx astro dev stop`.
- `npm run typecheck` · `npm run verify [-- <url>]`
- `node scripts/generate-seed.mjs` — regenerate `sanity/seed.ndjson`.

## Gotchas already paid for

- Live typing is instant only for the document open in Presentation's form;
  anything else waits for the save round-trip (~1–2 s). Dev mode is slower
  than production.
- Build fetches skip the Sanity CDN on purpose: a publish-triggered rebuild
  could otherwise read a stale cached response.
- `.env` edits restart the dev server; an empty `PUBLIC_SITE_URL` counts as unset.
- macOS is case-insensitive: don't put `Foo.tsx` and `foo.ts` in one folder.
- `/preview` 401 = no draft cookie: open it from the Studio, not directly.
- Blank Studio / preview + `504 (Outdated Optimize Dep)` + "Failed to fetch
  dynamically imported module" = Vite re-optimized deps while the tab was
  open (any astro.config change does it). Fix: `npx astro dev stop`,
  `rm -rf node_modules/.vite`, `npm run dev`, then hard-reload the tab
  (⌘⇧R). New heavy client deps belong in `vite.optimizeDeps.include`.
