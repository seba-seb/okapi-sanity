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
- **It asks before it installs.** The agent asks which modules you want (slider,
  3D logo, reusable components, AI chat, who edits, example content) and runs
  `npm run okapi:setup` with the answers: it keeps only those and records them in
  `src/okapi.config.json`. Okapi ships no animation library; projects that
  already animate keep their own.
- **Rules** for working in the code: [`AGENTS.md`](AGENTS.md) (`CLAUDE.md` imports it).
- **Docs**: in the [okapi-site](https://github.com/seba-seb/okapi-site) repo — `docs/` (English) and
  `es/docs/` (Spanish), each with a
  "vibe coding" view and a technical one.

## This repo

It is also a complete Astro project (example blocks, theme, header/footer),
which is what a new project starts from:

```bash
npm install
cp .env.example .env              # fill PUBLIC_SANITY_PROJECT_ID
npm run dev                       # http://localhost:4321 · Studio at /studio
npm run verify                    # unit checks + build + public JS budget
```

`http://localhost:4321` must be a CORS origin (with credentials) of the Sanity project.

**AI chat and privacy:** the editor's chat is optional and off until a key is
set in the hosting. When on, the page being edited and any attached images are
sent to the AI provider chosen in that key (Anthropic, OpenAI, OpenRouter or
Sanity). Use one key per project with a spend limit.

## Credits & license

Okapi started as a port of [Remarkable](https://github.com/flowtricks/remarkable)
by [Timothy Ricks](https://www.timothyricks.com/) — a Sanity + Next.js visual page
builder he shared with the community. Thanks, Timothy.

MIT — see [LICENSE](LICENSE).
