#!/usr/bin/env node
/**
 * Okapi setup: keep only what the project uses.
 *
 *   npm run okapi:setup                      asks each question (terminal)
 *   npm run okapi:setup -- --slider=no --logo3d=no \
 *     --components=yes --chat=yes --roles=administrator+editor --demo=yes --dry-run
 *                                            agents: ask the person first, then pass every answer
 *   …same flags with --yes                   apply without the confirmation prompt
 *
 * Blocks you don't want are deleted (folder, registry entries, npm deps), so the
 * site ships less code. Core features (chat, components) are flags in
 * src/okapi.config.json, so core stays the same in every project. Also removes
 * the Okapi repo's own dev tooling (seed generators).
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const BLOCK_GROUPS = {
  slider: { q: "¿Slider / carrusel?", blocks: ["slider"], deps: ["embla-carousel-react"] },
  logo3d: { q: "¿Logo 3D? (suma ~140 KB de three.js solo en las páginas que lo usen)", blocks: ["logo3d"], deps: ["three", "@types/three"] },
};
const FEATURE_QS = {
  components: "¿Componentes reutilizables? (guardar una sección y usarla en varias páginas, como en Webflow)",
  chat: "¿Chat con IA en el editor? (necesita Vercel, Netlify o Cloudflare y una clave de IA)",
};
const ROLES = {
  administrator: "Solo Administrator (la agencia) edita",
  "administrator+editor": "Administrator + Editor (un cliente que edita y publica)",
  "administrator+editor+contributor": "Administrator + Editor + Contributor (alguien que solo deja borradores)",
  keep: "Dejar src/okapi.policy.ts como está",
};
const DEV_TOOLING = ["scripts/generate-seed.mjs"];

// ── Answers ───────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = "yes"] = a.replace(/^--/, "").split("=");
    return [k, v];
  }),
);
const yes = (v) => /^(y|yes|s|si|sí|true|1)$/i.test(v);
const isAnswer = (v) => v !== undefined && /^(y|yes|s|si|sí|true|1|n|no|false|0)$/i.test(v);

async function collect() {
  const keys = [...Object.keys(BLOCK_GROUPS), ...Object.keys(FEATURE_QS)];
  const missing = [...keys.filter((k) => !isAnswer(args[k])), ...(args.roles ? [] : ["roles"]), ...(isAnswer(args.demo) ? [] : ["demo"])];
  if (args.all) for (const k of keys) args[k] ??= "yes";
  const still = missing.filter((k) => !(args.all && keys.includes(k)));
  if (still.length && !process.stdin.isTTY) {
    console.error(`Faltan respuestas: ${still.map((k) => `--${k}`).join(" ")}\nPreguntale a la persona y pasalas (ver INSTALL.md → Paso 0).`);
    process.exit(2);
  }
  if (still.length) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    for (const k of still) {
      if (k === "roles") {
        const opts = Object.entries(ROLES);
        opts.forEach(([, label], i) => console.log(`  ${i + 1}. ${label}`));
        const n = Number(await rl.question("¿Quién va a editar el sitio? [2] ")) || 2;
        args.roles = opts[Math.min(Math.max(n, 1), opts.length) - 1][0];
      } else {
        const q = k === "demo" ? "¿Cargar contenido de ejemplo (una home armada)?" : BLOCK_GROUPS[k]?.q ?? FEATURE_QS[k];
        args[k] = (await rl.question(`${q} [s/n] `)).trim() || "n";
      }
    }
    rl.close();
  }
  if (!ROLES[args.roles]) {
    console.error(`--roles debe ser uno de: ${Object.keys(ROLES).join(", ")}`);
    process.exit(2);
  }
}

// ── File edits (each one idempotent) ─────────────────────────────────────────
const plan = [];
const edits = new Map();
const read = (p) => edits.get(p) ?? readFileSync(p, "utf8");
const write = (p, s) => (read(p) !== s ? edits.set(p, s) : null);
const removed = new Set();

function removeBlock(type) {
  const folder = `src/blocks/${type}`;
  if (existsSync(folder)) plan.push(`borrar ${folder}/`);
  removed.add(type);
  // meta.ts: the entry (one line, or a `type: {` … `},` block) and any `accepts` mention.
  let meta = read("src/blocks/meta.ts");
  meta = meta.replace(new RegExp(`^  ${type}: \\{[^\\n]*\\},\\n`, "m"), "");
  meta = meta.replace(new RegExp(`^  ${type}: \\{\\n[\\s\\S]*?^  \\},\\n`, "m"), "");
  meta = meta.replace(new RegExp(`, "${type}"`, "g"), "").replace(new RegExp(`"${type}", `, "g"), "");
  write("src/blocks/meta.ts", meta);
  write("src/blocks/schemas.ts", read("src/blocks/schemas.ts").replace(new RegExp(`^import \\{ ${type} \\} from "\\./${type}/schema";\\n`, "m"), "").replace(new RegExp(`^  ${type},\\n`, "m"), ""));
  write("src/blocks/components.tsx", read("src/blocks/components.tsx").replace(new RegExp(`^import \\{ \\w+ \\} from "\\./${type}/\\w+";\\n`, "m"), "").replace(new RegExp(`^  ${type}: [^\\n]*,\\n`, "m"), ""));
  write("src/blocks/defaults.ts", read("src/blocks/defaults.ts").replace(new RegExp(`^  ${type}: \\(\\) => [^\\n]*\\n`, "m"), ""));
}

/** Drop removed block types from demo content so the import has no unknown types. */
function filterSeed(types) {
  const strip = (v) =>
    Array.isArray(v) ? v.filter((x) => !(x && typeof x === "object" && types.has(x._type))).map(strip) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, strip(x)])) : v;
  const p = "sanity/seed.ndjson";
  if (!existsSync(p)) return;
  write(p, read(p).trim().split("\n").map((l) => JSON.stringify(strip(JSON.parse(l)))).join("\n") + "\n");
}

function policyFile(roles, f, blocks) {
  const can = (list) => list.filter((p) => (p !== "chat" || f.chat) && (p !== "components" || f.components)).map((p) => `"${p}"`).join(", ");
  const clientBlocks = ["section", "eyebrow", "heading", "paragraph", "buttonWrapper", "button", "imageBlock", "card", "contentWrapper", "grid"].filter((b) => blocks.has(b));
  const rows = [
    `  administrator: {\n    label: "Administrator",\n    can: [${can(["text", "images", "style", "settings", "reorder", "structure", "components", "publish", "chat"])}],\n  },`,
  ];
  if (roles !== "administrator")
    rows.push(`  editor: {\n    label: "Editor",\n    can: [${can(["text", "images", "reorder", "structure", "publish", "chat"])}],\n    blocks: [${clientBlocks.map((b) => `"${b}"`).join(", ")}],\n  },`);
  if (roles === "administrator+editor+contributor") rows.push(`  contributor: {\n    label: "Contributor",\n    can: [${can(["text", "images", "reorder"])}],\n  },`); // no chat by default: drafts-only people don't spend the key
  rows.push(`  default: {\n    label: "Viewer",\n    can: [],\n  },`);
  const head = read("src/okapi.policy.ts").split("export const POLICY")[0];
  return `${head}export const POLICY: Policy = {\n${rows.join("\n")}\n};\n`;
}

// ── Run ──────────────────────────────────────────────────────────────────────
if (!existsSync("src/okapi.config.json") || !existsSync("src/blocks/meta.ts")) {
  console.error("Corré esto en la raíz de un proyecto con Okapi (falta src/okapi.config.json o src/blocks/meta.ts).");
  process.exit(1);
}
let origin = "";
try {
  origin = execSync("git remote get-url origin", { stdio: ["ignore", "pipe", "ignore"] }).toString();
} catch {}
if (/okapi-sanity|Remarkable-Astro/i.test(origin) && !args.force) {
  console.error("Este es el repo de Okapi: el setup se corre en el proyecto del cliente, no acá (--force para ignorar).");
  process.exit(1);
}

await collect();
const keepGroup = Object.fromEntries(Object.keys(BLOCK_GROUPS).map((k) => [k, yes(args[k])]));
const features = { chat: yes(args.chat), components: yes(args.components) };

const deps = [];
for (const [k, g] of Object.entries(BLOCK_GROUPS)) {
  if (keepGroup[k]) continue;
  g.blocks.forEach(removeBlock);
  deps.push(...g.deps);
}
if (!features.components) plan.push("apagar componentes (features.components = false)");
if (!features.chat) {
  plan.push("apagar el chat (features.chat = false): sin adaptador de hosting ni función de servidor");
  deps.push("@astrojs/vercel", "@astrojs/netlify");
}
for (const p of DEV_TOOLING) if (existsSync(p)) plan.push(`borrar ${p} (herramientas del repo de Okapi)`);

const demo = yes(args.demo);
if (!demo && existsSync("sanity/seed.ndjson")) plan.push("borrar sanity/seed.ndjson (sin contenido de ejemplo)");
else filterSeed(new Set([...removed, ...(features.components ? [] : ["componentRef"])]));

const cfg = JSON.parse(read("src/okapi.config.json"));
cfg.features = features;
cfg.blocks = keepGroup;
write("src/okapi.config.json", JSON.stringify(cfg, null, 2) + "\n");

if (args.roles !== "keep") {
  const remaining = new Set([...read("src/blocks/meta.ts").matchAll(/^  (\w+): \{/gm)].map((m) => m[1]));
  write("src/okapi.policy.ts", policyFile(args.roles, features, remaining));
  plan.push(`permisos: ${ROLES[args.roles]}`);
}

const pkg = JSON.parse(read("package.json"));
const gone = deps.filter((d) => pkg.dependencies?.[d] || pkg.devDependencies?.[d]);
for (const d of gone) delete pkg.dependencies?.[d], delete pkg.devDependencies?.[d];
if (gone.length) {
  write("package.json", JSON.stringify(pkg, null, 2) + "\n");
  // …and from Vite's pre-bundle list, or it warns about packages that aren't there.
  let cfgFile = read("astro.config.mjs");
  for (const d of gone) cfgFile = cfgFile.replace(new RegExp(`^\\s*"${d.replace("/", "\\/")}",\\n`, "m"), "");
  write("astro.config.mjs", cfgFile);
  plan.push(`quitar dependencias: ${gone.join(", ")}`);
}
for (const p of edits.keys()) plan.push(`editar ${p}`);

console.log(`\nOkapi setup\n${[...new Set(plan)].map((l) => `  · ${l}`).join("\n") || "  · nada que cambiar"}\n`);
if (args["dry-run"]) process.exit(0);
if (!args.yes) {
  if (!process.stdin.isTTY) {
    console.error("Revisá el plan con la persona y volvé a correr con --yes.");
    process.exit(2);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ok = yes((await rl.question("¿Aplicar? [s/n] ")).trim());
  rl.close();
  if (!ok) process.exit(0);
}

for (const [p, s] of edits) writeFileSync(p, s);
for (const t of removed) rmSync(`src/blocks/${t}`, { recursive: true, force: true });
for (const p of DEV_TOOLING) rmSync(p, { recursive: true, force: true });
if (!demo) rmSync("sanity/seed.ndjson", { force: true });
if (gone.length && !args["no-install"]) execSync("npm install --no-audit --no-fund", { stdio: "inherit" });
console.log("\nListo. Siguiente: npm run verify");
