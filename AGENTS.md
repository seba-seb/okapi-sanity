# Remarkable — agent rules

**Remarkable = Sanity as the database + the Remarkable Editor**, our own visual
editor (a Studio tool at `/studio#/editor`), added to an Astro project. Edit
text on the page, drag layers, add/duplicate/delete blocks, style with tokens,
reusable components, drop images, undo. Sanity provides auth, roles, drafts,
history, images and CDN. Pages it renders are **static HTML**; only sections
with motion hydrate.

This file is for any coding agent (Claude Code reads it through `CLAUDE.md`).
Installing Remarkable into a project: **`INSTALL.md`**. Team docs: `docs/index.html`.

## Layout

```
src/core/       The product. Same in every project — don't fork it per project.
  editor/       Remarkable Editor: EditorTool (Studio tool), CanvasApp (iframe),
                FieldControls (schema-driven panel), ops (structural edits),
                paths (GROQ path helpers), protocol (editor ↔ canvas), text
  sanity/       client + loadQuery, dataAttr (editable()), queries, site loader
                (settings/menus/routes), link type schema, structure
  studio/       custom Studio inputs (segmented enums, sliders, responsive numbers)
  render/       PageBuilder, BlockRenderer, Islands.astro + hydrate (public islands), Welcome
  motion/       gsap.ts (the ONE place GSAP is imported + the motion policy),
                ScrollRefresh, useSplit, SplitReveal
  lib/          clean, routes (pageHref/resolveLink), staleChunkReload, types
src/blocks/     The project's blocks. One folder per type: schema.ts + Component.tsx
  meta.ts       THE registry: type names, titles, container slots, canvas flags
  schemas.ts    type → schema     (typed against meta.ts)
  components.tsx type → component (typed against meta.ts)
  defaults.ts   what a block contains when inserted
src/theme/      Per project. tokens.css = the design tokens (edit this first);
                globals.css = Tailwind 4 wiring + the starter's base CSS.
src/chrome/     Header/footer. Per project — restyle or replace.
src/documents/  Document types: page, settings (singleton), navigation (singleton)
src/pages/      Routes. /edit-canvas = the editor's canvas (data-free).
                /lab/[slug] = dev-only stress harness (not built in production).
src/lab/        LabHarness: replays editor mutations + checks (see "Testing motion").
patches/        patch-package fixes for sanity@6.3.0 (Studio form tweaks)
skills/         remarkable-astro: the Claude Code skill that starts a new project
docs/           index.html — the team documentation (keep it in sync with this file)
```

## Rules

- **Core is shared.** A fix in `src/core` belongs to the starter first, then
  gets copied to projects. (When 3+ projects are live, extract core into a
  private package so fixes arrive with `npm update`.)
- **Every URL goes through `pageHref()` / `resolveLink()`** (`core/lib/routes.ts`).
  Links, sitemap, canonicals. Adding i18n later = changing those two functions.
- **Internal links are references, never typed paths.** Use the `link` type
  (buttons, rich text, menus). `rel` is derived — never add it as a field.
- **Blocks get their data as props and stamp `editable(...)` on their root.**
  Never fetch inside a block: the editor canvas renders the same components
  from the document it is sent, and selects blocks by `data-sanity-path`.
- **Animations live inside the React component** (`useGSAP` with a `scope`),
  never in an Astro `<script>` with querySelector: the editor re-renders blocks
  and a script won't see the new nodes. Split text inside a wrapper `key`ed by
  the text, never on the element that carries `data-sanity-path`.
  `core/motion/SplitReveal` already does this — reuse it.
- **Styling: Tailwind 4 utilities built from the tokens** — `bg-bg text-fg
  bg-surface text-muted border-border bg-brand text-brand-contrast`,
  `rounded-main`, `gap-md p-lg` (the t-shirt spacing), `text-h-xl`,
  `px-section-x`, `max-w-page`. Colour utilities read the section's
  `[data-theme]`, so blocks restyle per theme for free. Tailwind's default
  palette is removed on purpose (no `bg-red-500`): add colours to tokens.css
  + the `@theme inline` map. No preflight, so the starter's base CSS is
  untouched; it lives in `@layer components`, so utilities override it.
- **Public pages are plain HTML; only sections that need JS hydrate.** A block
  with `js` in `meta.ts` (motion, slider, WebGL — or a predicate, e.g. Heading
  only when `animation` is set) turns its top-level section into an island
  (`PageBuilder islands` → `[data-island]` → `core/render/hydrate.tsx`, loaded
  by `<Islands />` — put it in every layout that renders PageBuilder). A page without such blocks ships
  ~1 KB of JS. **A block with hooks/effects/handlers MUST declare `js`**, or it
  renders but never runs on the public site. The editor canvas is unaffected.
- **Design assets don't go in the CMS** (logos, textures): they're code.
- Pinned: `sanity@6.3.0` (override in package.json). Upgrading means
  re-making `patches/` — see its README. `npm install` fails if the patch
  doesn't apply, and verify fails if the installed version has no patch.

## Remarkable Editor

Studio tool at `/studio#/editor` (the Studio's landing tool):
**pages + layers | canvas | properties**. `src/core/editor/`:
- `EditorTool.tsx` — reads the page with `useEditState` (local edits applied
  at once) and writes with `useDocumentOperation(...).patch` / `.publish` (the
  Studio's own document store, no extra SDK). What each person may do comes
  from `src/remarkable.policy.ts` (below); admins can "View as" any role.
- `CanvasApp.tsx` + `src/pages/edit-canvas.astro` — the canvas iframe: the real
  PageBuilder rendering whatever the editor posts (`protocol.ts`, same-origin
  postMessage). It fetches nothing, so the route exposes no drafts. Own
  hover/selection overlay; clicks select, never navigate.
- `FieldControls.tsx` — the properties panel, generated from the compiled
  Studio schema (`controlKind`). `scripts/check-editor-schema.ts` (run by
  verify) fails if any block field has no control. Content vs design:
  `isContent` (text, rich text, links, images, references = client-visible).
- `ops.ts` — pure structural edits (insert/move/remove/duplicate/insertTarget,
  validated against `meta.ts`); `ops.check.ts` runs in verify.

What it does: double-click text to edit it in place (headings, paragraphs,
eyebrows, button labels, card title/body, Big Type, Scroll Text — the canvas
holds incoming renders while you type and restores React's exact DOM after, so
no caret jumps); layers tree with drag (before/after/inside); + Add, duplicate,
delete, move, copy/paste between pages; undo/redo (typing coalesced); drop an
image file on any image block/card/parallax/section or upload from the panel;
device widths. Client view: content fields + reorder only.
Rich text edits in place too: a floating bar (B, I, Link, Unlink; ⌘B ⌘I ⌘K) —
`core/editor/richtext.ts` maps PT ⇄ editable HTML, keeping existing link
targets (internal/external) via their markDef key; new links are external.
**Multi-select**: shift/⌘-click blocks (canvas or layers); delete, duplicate,
copy/paste and ▲▼ apply to all of them.
**Drag on the canvas**: the selected block shows a ⠿ grip — drag it; a blue
line shows where it lands (before/after the block under the pointer,
horizontal inside rows/grids). Validated like any move (`moveNextTo`).
**▶ Play** remounts the canvas once with decorative motion on (the canvas
keeps it still while you edit); a block you edit afterwards goes still again.

### Permissions and the AI chat

- **`src/remarkable.policy.ts` (per project, the agency decides):** Sanity role →
  permissions (`text images style settings reorder structure components
  publish chat`) + optional `blocks` a role may add. It gates the panel
  fields (`FieldControls.fieldKind`), the actions, canvas edits, publish and
  the chat. Pure logic in `core/editor/policy.ts`. This shapes the editor; the
  hard boundary is still the Sanity role (what the API lets them write).
- **✦ Chat** (tab in the right column): the browser part
  (`core/editor/EditorChat.tsx`) sends the request with the person's Sanity
  session token to the site's own server route **`/api/editor-chat`**
  (`core/editor/server/chatRoute.ts`). The route checks the token with Sanity
  (`/users/me` → roles), computes the grant from the policy, reads the page from
  Sanity with that session, asks the model with the **project's key from the
  host's env** (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY`;
  `AI_MODELS` = allow-list "provider:model, …" for the chat's model picker,
  first = default; shorthand `AI_PROVIDER` + `AI_API_KEY`; `server/models.ts`) and returns JSON ops (`set`, `style`,
  `insert`, `remove`, `duplicate`, `move`). The editor re-validates them
  (`chat.ts applyOps`: grant + registry + schema) and applies them as ONE undo
  step, saved as a draft with the person's own session. Never publishes. The
  key never reaches the browser. The Studio uses `auth.loginMethod: "token"` so
  the session token can be sent. Rate limit per user (in memory) — the real
  ceiling is the spend limit on the provider account.
- **Hosting:** `astro.config` picks the adapter from where the build runs
  (Vercel / Netlify built in; Cloudflare Pages needs `npm i @astrojs/cloudflare
  wrangler`) and only then injects `/api/editor-chat`; pages stay prerendered.
  Any other host = plain static output and the chat shows "not available".
  `REMARKABLE_ADAPTER` overrides. In `npm run dev` the route always exists.
- Not yet: images, references, text inside component instances, rich-text
  formatting (the chat writes plain paragraphs). `chat.check.ts` runs in verify.

### Compose & style (phase 2)
- **Style panel** (`design` field on every block, added in `blocks/schemas.ts`):
  margin, padding, background, text color, radius, max width, text align,
  hide — tokens only (`core/style/tokens.ts`) — for all screens / tablet /
  mobile. `core/style/stylesheet.ts` renders one scoped stylesheet per page
  (`[data-b=key][data-b]`, desktop-first `@media`, `!important` because the
  panel is authoritative). Named `design` because Button already has `style`.
- **Box** block: free layout container (stack / row / grid, token gaps,
  align/justify/wrap); nests; grids collapse to 2 columns on tablet and 1 on
  mobile, rows stack on mobile.
- **Components** (`documents/component.ts` + `componentRef` instances): a
  library of reusable sections. Editing a component updates every instance;
  instances only live at a page's top level (no nesting). In the editor:
  components appear in the document picker, in + Add, and as actions —
  *Make component* (section → library + instance), *Edit component*,
  *Detach* (editable copy). The canvas selects an instance as one block.
  The site loads the library in `loadSite()`; instances' block styles are
  included in the page stylesheet.
- **Instance overrides** (like Webflow component props): double-click text or
  drop an image *inside* an instance on the canvas → stored on that instance
  as `overrides` (`target` = "<blockKey>.<field>"), applied at render
  (`core/render/overrides.ts`); the master is untouched. The panel lists them
  with Reset. Inner blocks carry synthetic paths (`….__component.…`) — that
  marker is what routes an edit to an override.

## Motion blocks

Horizontal Scroll (pinned), Stacked Cards (sticky + scrub), Marquee (loop +
scroll velocity), Scroll Text (words light up), Big Type (chars), Parallax
Media, plus the Heading `animation` field. Policy (`core/motion/gsap.ts`):

| Kind | Examples | Public | Editor canvas | Reduced motion |
|---|---|---|---|---|
| Layout | pin, horizontal scroll, sticky scrub, parallax | ✓ | ✓ (you must reach the content) | native fallback |
| Decorative | text splits, entrances, marquee loop, clip reveals | ✓ | ✗ (would replay / re-split per keystroke) | ✗ |

Rules for new motion blocks:
- Import GSAP from `@/core/motion/gsap`, never from `"gsap"`.
- `useGSAP` with `scope`; if the block has children, pass
  `dependencies: [childKeys], revertOnUpdate: true` so inserts/removes rebuild it.
- Pin an INNER element, never the one with `data-sanity-path` (React owns the
  outer node; GSAP's pin-spacer goes between them).
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

## Editor smoke test (logged in, before handing a site to a client)

Automated checks cover the canvas side only; these need a real login, in
`/studio#/editor` on a throwaway page:
1. Click a heading, type on the page → "Saved" draft; reload → text is still there.
2. Bold/italic/link in a paragraph; insert, duplicate, delete, drag a layer; undo/redo.
3. Drop an image on an Image block → uploads and shows.
4. Make component from a section → edit text on an instance → only that
   instance changes; Reset override; Edit component → all instances change.
5. Publish → `npm run build` → the change is on the static page.
6. Log in as a client-role user (or "View as") → only what `remarkable.policy.ts`
   allows is visible; the chat refuses the rest.
7. ✦ Chat: "make the selected heading shorter" → applied, Undo reverts it.

## Add a block

1. `src/blocks/<type>/schema.ts` (`defineType`, icon from `@sanity/icons`) and
   `src/blocks/<type>/<Type>.tsx` (receives `{ block, path, ctx }`; put
   `{...editable(ctx.documentId, ctx.documentType, path, block._type)}` on its root).
2. Add `<type>: { title, slot?, margin?, js? }` to `blocks/meta.ts` (`js` if it
   runs anything in the browser — see Rules).
3. Register it in `blocks/schemas.ts` and `blocks/components.tsx` — the
   compiler errors until you do.
4. Optional: insert defaults in `blocks/defaults.ts`; inline-editable text in
   `TEXT_TARGETS` (`core/editor/CanvasApp.tsx`); image drop in `IMAGE_FIELDS`.

Remove a block: delete its folder, its `meta.ts` entry and the two map entries,
and any `accepts` that names it (the compiler points at them).

## New project / adding Remarkable to an existing Astro project

Follow `INSTALL.md` (any agent). Claude Code users can install the
`remarkable-astro` skill (`skills/`), which runs the same guide.

## Commands

- `npm run dev` — site on :4321, Studio + editor at `/studio` (hash routing:
  `#/editor`, `#/structure`). `astro dev` may daemonize: stop with
  `npx astro dev stop`.
- `npm run typecheck` · `npm run verify [-- <url>]` (also checks the public JS
  budget: no visual-editing runtime, home ≤ 250 KB gzip)
- `node scripts/generate-seed.mjs` — regenerate `sanity/seed.ndjson`.

## Gotchas already paid for

- Build fetches skip the Sanity CDN on purpose: a publish-triggered rebuild
  could otherwise read a stale cached response.
- `.env` edits restart the dev server; an empty `PUBLIC_SITE_URL` counts as unset.
- macOS is case-insensitive: don't put `Foo.tsx` and `foo.ts` in one folder.
- Blank Studio / canvas + `504 (Outdated Optimize Dep)` + "Failed to fetch
  dynamically imported module" = Vite re-optimized deps while the tab was
  open (any astro.config or lockfile change does it). Fix: stop the server,
  `rm -rf node_modules/.vite`, `npm run dev`, then hard-reload the tab
  (⌘⇧R). New client deps belong in `vite.optimizeDeps.include`.
- A tab opened before a dev restart (or a deploy) requests lazy chunks by old
  hashes → 504/404 → blank Studio right after sign-in. `core/lib/staleChunkReload`
  (installed in sanity.config.ts and the editor canvas) reloads once; a second
  failure within 15s is left alone, so a real broken module can't loop.
- Sanity UI fonts only its own components: plain HTML in custom tools inherits
  the root, which `sanity.config.ts` sets to Sanity's sans stack.
