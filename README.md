# Okapi

**Sanity as the database + the Okapi Editor** (our own visual editor, a tab
inside the Studio at `/studio#/editor`), added to an Astro project — new or
already started. Pages built in the editor ship as static HTML; only sections
that need JS (slider, 3D) hydrate.

- **Install** into a project, with any coding agent: [`INSTALL.md`](INSTALL.md).
  Tell your agent: *"Cloná seba-seb/okapi-sanity en /tmp/okapi y seguí su
  INSTALL.md para sumar Okapi a este proyecto."*
  Claude Code shortcut: the [`okapi-astro` skill](skills/okapi-astro/SKILL.md)
  (`cp -R skills/okapi-astro ~/.claude/skills/`).
- **Rules** for working in the code: [`AGENTS.md`](AGENTS.md) (`CLAUDE.md` imports it).
- **Docs** for the team: [`site/docs/index.html`](site/docs/index.html) — a "vibe coding" view
  and a technical one.

## This repo

It is also a complete Astro project (example blocks, theme, header/footer),
which is what a new project starts from:

```bash
npm install                       # also applies patches/ (sanity is pinned to 6.3.0)
cp .env.example .env              # fill PUBLIC_SANITY_PROJECT_ID
npm run dev                       # http://localhost:4321 · Studio at /studio
npm run verify                    # unit checks + build + public JS budget
```

`http://localhost:4321` must be a CORS origin (with credentials) of the Sanity project.

**AI chat and privacy:** the editor's chat is optional and off until a key is
set in the hosting. When on, the page being edited and any attached images are
sent to the AI provider chosen in that key (Anthropic, OpenAI, OpenRouter or
Sanity). Use one key per project with a spend limit.
