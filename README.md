# Remarkable

Starter for client sites: **Astro 7 (static) + Sanity 6 + the Remarkable Editor**,
our own visual editor, a tab inside the Studio (`/studio#/editor`).

- **Docs:** [`docs/index.html`](docs/index.html) — what it is, how it's built, how to use it.
- **Rules for working in the code:** [`CLAUDE.md`](CLAUDE.md) (source of truth).
- **New project:** the `remarkable-astro` Claude Code skill in [`skills/`](skills/remarkable-astro/SKILL.md).
  Install it once: `cp -R skills/remarkable-astro ~/.claude/skills/`, then ask Claude
  for "un proyecto nuevo con Remarkable".

## Quick start

```bash
npm install                       # also applies patches/ (sanity is pinned to 6.3.0)
cp .env.example .env              # fill PUBLIC_SANITY_PROJECT_ID
npx sanity login && npx sanity dataset import sanity/seed.ndjson production   # demo home
npm run dev                       # http://localhost:4321 · Studio at /studio
npm run verify                    # unit checks + build + public JS budget
```

`http://localhost:4321` must be a CORS origin (with credentials) of the Sanity project.
