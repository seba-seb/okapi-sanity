# Remarkable

**Sanity as the database + the Remarkable Editor** (our own visual editor, a tab
inside the Studio at `/studio#/editor`), added to an Astro project — new or
already started. Pages built in the editor ship as static HTML; only sections
with motion hydrate.

- **Install** into a project, with any coding agent: [`INSTALL.md`](INSTALL.md).
  Tell your agent: *"Cloná seba-seb/Remarkable-Astro en /tmp/remarkable y seguí su
  INSTALL.md para sumar Remarkable a este proyecto."*
  Claude Code shortcut: the [`remarkable-astro` skill](skills/remarkable-astro/SKILL.md)
  (`cp -R skills/remarkable-astro ~/.claude/skills/`).
- **Rules** for working in the code: [`AGENTS.md`](AGENTS.md) (`CLAUDE.md` imports it).
- **Docs** for the team: [`docs/index.html`](docs/index.html) — a "vibe coding" view
  and a technical one.

## This repo

It is also a complete Astro project (example blocks, theme, header/footer and
the `/lab` motion test bench), which is what a new project starts from:

```bash
npm install                       # also applies patches/ (sanity is pinned to 6.3.0)
cp .env.example .env              # fill PUBLIC_SANITY_PROJECT_ID
npm run dev                       # http://localhost:4321 · Studio at /studio
npm run verify                    # unit checks + build + public JS budget
```

`http://localhost:4321` must be a CORS origin (with credentials) of the Sanity project.
