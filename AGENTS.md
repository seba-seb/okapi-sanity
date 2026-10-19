# Okapi — agent rules

**Okapi = Sanity as the database + the Okapi Editor**, our own visual
editor (a Studio tool at `/studio#/editor`), added to an Astro project. Edit
text on the page, drag layers, add/duplicate/delete blocks, style with tokens,
reusable components, drop images, undo. Sanity provides auth, roles, drafts,
history, images and CDN. Pages it renders are **static HTML**; only sections
that need JS (slider, 3D) hydrate.

This file is for any coding agent (Claude Code reads it through `CLAUDE.md`).
Installing Okapi into a project: **`INSTALL.md`**. Team docs: `site/docs/index.html`.

## Layout

```
src/core/       The product. Same in every project — don't fork it per project.
  editor/       Okapi Editor: EditorTool (Studio tool), CanvasApp (iframe),
                FieldControls (schema-driven panel), ops (structural edits),
                paths (GROQ path helpers), protocol (editor ↔ canvas), text
  sanity/       client + loadQuery, dataAttr (editable()), queries, site loader
                (settings/menus/routes), link type schema, structure
  studio/       custom Studio inputs (segmented enums, sliders, responsive numbers)
  render/       PageBuilder, BlockRenderer, Islands.astro + hydrate (public islands), Welcome
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
skills/         okapi-astro: the Claude Code skill that starts a new project
site/           the public site: landing + docs in English (site/) and Spanish (site/es/); keep both docs in sync with this file
brand/          the Okapi mark (SVG) and brand notes
```

## What a project uses (`npm run okapi:setup`)

At install time the agent asks which modules the person wants (INSTALL.md →
Paso 0) and runs `scripts/okapi-setup.mjs` with the answers (`--dry-run` first,
then `--yes`). **Optional blocks** (slider, logo3d) are deleted with
their deps; **core features** are flags in `src/okapi.config.json`
(`features.chat`, `features.components`), read through `core/config.ts`
(`FEATURES`): chat off = no host adapter, no `/api/editor-chat`, no Chat tab;
components off = no `component` document, no `componentRef`, no Make
component. It also writes `src/okapi.policy.ts` from a roles preset and removes
the Okapi repo's own tooling (seed generators). It refuses to run in the
Okapi repo itself. Checks (ops/chat/schema) pass with any combination.

## Rules

- **Publishing is going live** (a webhook rebuilds the site). Never publish,
  unpublish, delete or import content without the user's explicit yes for
  that action — not from a script, not through an MCP. Test on drafts.
- **Ask before creating anything in the user's accounts** (Sanity projects,
  datasets, CORS origins, users, tokens, webhooks). Tokens and deploy-hook
  URLs are secrets: never ask for, print or write them.
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
- **Okapi ships no animation library.** If the project already animates (GSAP,
  Motion, CSS…), it keeps doing so under its own licence; Okapi adds no
  animation fields or editor controls. Animate inside the React component
  (effect with cleanup, declare `js` in `meta.ts`), never in an Astro
  `<script>` with querySelector: the editor re-renders blocks and a script
  won't see the new nodes. Never rewrite the DOM of the element that carries
  `data-sanity-path` (split text inside an inner wrapper keyed by the text).
  The editor canvas doesn't need to play animations.
- **Styling: Tailwind 4 utilities built from the tokens** — `bg-bg text-fg
  bg-surface text-muted border-border bg-brand text-brand-contrast`,
  `rounded-main`, `gap-md p-lg` (the t-shirt spacing), `text-h-xl`,
  `px-section-x`, `max-w-page`. Colour utilities read the section's
  `[data-theme]`, so blocks restyle per theme for free. Tailwind's default
  palette is removed on purpose (no `bg-red-500`): add colours to tokens.css
  + the `@theme inline` map. No preflight, so the starter's base CSS is
  untouched; it lives in `@layer components`, so utilities override it.
- **Public pages are plain HTML; only sections that need JS hydrate.** A block
  with `js` in `meta.ts` (slider, WebGL, a project's own animations — or a
  predicate on the block's fields) turns its top-level section into an island
  (`PageBuilder islands` → `[data-island]` → `core/render/hydrate.tsx`, loaded
  by `<Islands />` — put it in every layout that renders PageBuilder). A page without such blocks ships
  ~1 KB of JS. **A block with hooks/effects/handlers MUST declare `js`**, or it
  renders but never runs on the public site. The editor canvas is unaffected.
- **Design assets don't go in the CMS** (logos, textures): they're code.
- **Sanity stays current** (`sanity` ^6.19, `@sanity/client` 8, `@sanity/ui` 4,
  `@sanity/icons` 5) — no pins, no patches. Import icons from their subpath
  (`@sanity/icons/Cube`) and moved UI pieces from theirs (`@sanity/ui/tooltip`);
  `@sanity/ui` uses `gap`, not `space`. After upgrading, run typecheck + verify
  and open `/studio` and the editor.

## Okapi Editor

Studio tool at `/studio#/editor` (the Studio's landing tool):
**pages + layers | canvas | properties**. `src/core/editor/`:
- `EditorTool.tsx` — reads the page with `useEditState` (local edits applied
  at once) and writes with `useDocumentOperation(...).patch` / `.publish` (the
  Studio's own document store, no extra SDK). What each person may do comes
  from `src/okapi.policy.ts` (below); admins can "View as" any role.
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
eyebrows, button labels, card title/body — the canvas
holds incoming renders while you type and restores React's exact DOM after, so
no caret jumps); layers tree with drag (before/after/inside); + Add, duplicate,
delete, move, copy/paste between pages; undo/redo (typing coalesced); drop an
image file on any image block/card/section or upload from the panel;
device widths. Client view: content fields + reorder only.
Rich text edits in place too: a floating bar (B, I, Link, Unlink; ⌘B ⌘I ⌘K) —
`core/editor/richtext.ts` maps PT ⇄ editable HTML, keeping existing link
targets (internal/external) via their markDef key; new links are external.
**Multi-select**: shift/⌘-click blocks (canvas or layers); delete, duplicate,
copy/paste and ▲▼ apply to all of them.
**Drag on the canvas**: the selected block shows a ⠿ grip — drag it; a blue
line shows where it lands (before/after the block under the pointer,
horizontal inside rows/grids). Validated like any move (`moveNextTo`).

### Permissions and the AI chat

- **`src/okapi.policy.ts` (per project, the agency decides):** Sanity role →
  permissions (`text images style settings reorder structure components
  publish chat`) + optional `blocks` a role may add. It gates the panel
  fields (`FieldControls.fieldKind`), the actions, canvas edits, publish and
  the chat. Pure logic in `core/editor/policy.ts`. **It is not a security
  boundary:** it shapes the editor UI, and the server only checks `chat`.
  Anyone can still write whatever their Sanity role allows from
  `#/structure` or the API — use Sanity roles for real limits.
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
  the session token can be sent. Cost guards: body/catalog size caps,
  `max_tokens` on every provider, no top-tier model unless `AI_MODELS` lists
  it, `contributor` has no chat by default, rate limit per user (in memory).
  The real ceiling is **one key per project with its own monthly spend limit**
  on the provider (Anthropic workspace / OpenAI project budget / OpenRouter key
  limit). Privacy: the page content and attached images go to that provider.
- **Hosting:** `astro.config` picks the adapter from where the build runs
  (Vercel / Netlify built in; Cloudflare Pages needs `npm i @astrojs/cloudflare
  wrangler`) and only then injects `/api/editor-chat`; pages stay prerendered.
  Any other host = plain static output and the chat shows "not available".
  `OKAPI_ADAPTER` overrides. In `npm run dev` the route always exists.
- **Images in the chat** (📎, paste or drop; up to 3 per message): the browser
  uploads the original to Sanity with the person's session (only if their grant
  has `images`) and sends a ≤1024px JPEG copy so the model can see it. The model
  places one with `{"op":"set",…,"value":{"image":"img1"}}` (also inside an
  insert's `fields`); `applyOps` maps the id to the uploaded asset. Without the
  `images` permission they're reference only. Sanity Agent Actions is text-only
  (it gets the ids, not the pixels). Removed attachments stay as unused assets.
- Not yet: references, text inside component instances, rich-text formatting
  (the chat writes plain paragraphs). `chat.check.ts` runs in verify.

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

## Editor smoke test (logged in, before handing a site to a client)

Automated checks cover the canvas side only; these need a real login, in
`/studio#/editor` on a throwaway page:
1. Click a heading, type on the page → "Saved" draft; reload → text is still there.
2. Bold/italic/link in a paragraph; insert, duplicate, delete, drag a layer; undo/redo.
3. Drop an image on an Image block → uploads and shows.
4. Make component from a section → edit text on an instance → only that
   instance changes; Reset override; Edit component → all instances change.
5. Publish (with the user's OK: it goes live) → `npm run build` → the change is on the static page.
6. Log in as a client-role user (or "View as") → only what `okapi.policy.ts`
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

## New project / adding Okapi to an existing Astro project

Follow `INSTALL.md` (any agent). Claude Code users can install the
`okapi-astro` skill (`skills/`), which runs the same guide.

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
