# Instalar Okapi en un proyecto Astro

Guía para **cualquier agente de código** (Claude Code, Codex, Cursor u otro):
seguila paso a paso, en orden. Al terminar, el proyecto tiene:

- **Sanity como base de datos**: login, roles, borradores, historial,
  imágenes y CDN.
- **El Okapi Editor** en `/studio#/editor`: edición visual sobre la
  página real, con bloques, estilos por tokens y componentes.
- **Páginas armadas en el editor**, servidas como HTML estático. Solo
  hidratan las secciones que necesitan JS (slider, 3D).

Hay dos caminos: **A** para un proyecto nuevo y **B** para un proyecto Astro
que ya existe. Los dos terminan en los pasos comunes.

## Reglas para el agente

1. **Nunca pidas, muestres ni escribas tokens o contraseñas.**
   - El único archivo con secretos es `.env`, que no se commitea.
   - Lo que requiere la cuenta del usuario lo corre el usuario en su terminal.
     Pasale el comando exacto.
   - No te loguees con sus credenciales.
   - La URL de un *deploy hook* también es un secreto.
2. **No modifiques `src/core/`.** Es el producto y es igual en todos los
   proyectos. Si algo de core no encaja, avisá al usuario: el arreglo va al
   repo de Okapi.
3. **Sanity va en su versión actual** (`sanity` ≥ 6.19, `@sanity/client` 8,
   `@sanity/ui` 4, `@sanity/icons` 5). Si el proyecto ya tiene versiones más
   nuevas, se respetan. Si tiene más viejas, subilas dentro de la misma
   versión mayor y avisá; no bajes nada.
4. **No pises archivos del proyecto.** Si una ruta que tenés que copiar ya
   existe, frená y preguntá.
5. **Publicar es salir en vivo.** No publiques, despubliques ni importes
   contenido sin un sí explícito del usuario para esa acción.
6. **Confirmá antes de crear algo en sus cuentas** (proyecto, dataset, CORS,
   usuarios): decí qué vas a crear y dónde, y esperá el sí.
7. **Terminás con `npm run verify` en verde.**

## Paso 0 — Preguntas

**No instales nada antes de tener estas respuestas.** Okapi trae varios
módulos y el proyecto tiene que quedar solo con los que la persona quiere.
Preguntá todo en una sola tanda; si tu herramienta tiene un selector de
opciones, usalo. No elijas por la persona: si dice "no sé", explicale en una
línea qué hace cada opción y recomendá.

### Proyecto existente: analizar y avisar antes de preguntar

Si la carpeta tiene `astro.config.*`, el proyecto ya existe. Antes de
cualquier pregunta, revisá `package.json`, `astro.config.*` (y lo que
configuran sus integraciones), `tsconfig.json`, `src/pages/` (carpetas
incluidas), `src/layouts/` y el CSS global, y mostrale a la persona qué
encontraste. No cambies nada todavía.

| Qué mirar | Si encontrás | Nivel | Qué decir |
|---|---|---|---|
| `astro` | versión < 7.3 | 🛑 | Okapi necesita Astro 7.3. Actualizar Astro es un trabajo aparte que la persona tiene que aprobar |
| Integraciones de UI | `@astrojs/preact` o `@astrojs/solid-js` | 🛑 | Okapi necesita React y pone el JSX del `tsconfig` en React: los componentes del proyecto dejan de compilar. Se puede convivir separando cada JSX por carpeta, pero es un trabajo aparte |
| | `@astrojs/vue` o `@astrojs/svelte` | ⚠️ | Conviven: Okapi suma React solo para sus bloques. Los componentes del proyecto no sirven como bloques sin pasarlos a React |
| `tailwindcss` | versión 3, `@astrojs/tailwind` o `tailwind.config.*` | 🛑 | Okapi usa Tailwind 4 y un proyecto no puede tener dos versiones del mismo paquete. Primero hay que migrar el proyecto a Tailwind 4 (trabajo aparte) |
| | versión 4 | ✅ | Se comparte; no se agrega el plugin dos veces (B3) |
| | tokens estilo shadcn en `:root` (`--muted`, `--border`, `--radius`), `@utility btn`, DaisyUI | ✅ | Conviven: todo lo que Okapi define lleva prefijo (vars `--ok-*`, clases `ok-btn`/`ok-card`…, utilities `text-ok-muted`/`bg-ok-bg`…), así que los nombres no chocan. Si el CSS del proyecto entra en las páginas del editor, su CSS base sí aplica: se revisa en B4 |
| | no tiene (CSS, SCSS, CSS modules…) | ✅ | Conviven: el Tailwind de Okapi va sin preflight y solo en sus layouts, y las páginas del proyecto no cambian. Para que las páginas del editor se vean como el sitio, colores, espaciados y fuentes se pasan a `tokens.css` (B6) |
| Sanity | `@sanity/astro`, `sanity.config.*` o una ruta `/studio` | 🛑 | Okapi trae su propio Studio en `/studio` y su schema. Hay que decidir si reemplaza la integración actual o va en otro proyecto de Sanity; no se mezclan solas |
| Otro CMS | Decap, Tina, Keystatic, Storyblok… | ⚠️ | Conviven, pero hay que acordar qué edita cada uno |
| Idiomas | `i18n` en `astro.config`, `locales` de Starlight, rutas `[lang]` | ⚠️ | Las páginas del editor salen en un solo idioma, en `/<slug>`, con `<html lang="en">`. Traducirlas es un cambio en core que hoy no existe. Cada locale (`es`) va a `reservedSlugs` (B4): si el locale no tiene página de índice, una página del editor con ese slug lo ocuparía y verify no lo detecta |
| Rutas dinámicas en la raíz de `src/pages` | `[slug].astro` | ⚠️ | Choca con el de Okapi: las páginas del editor van en `/p/<slug>` (B4) |
| | `[...algo]` como archivo **o carpeta** (`[...blog]/`), o inyectado por una integración (Starlight inyecta `[...slug]`) | ⚠️ | El `[slug]` de Okapi le **gana** a esas rutas: una página del editor con el slug de un post o de una carpeta de docs reemplaza la del proyecto sin avisar. Se resuelve con `reservedSlugs` o con `/p/<slug>` (B4) |
| `trailingSlash: "always"` | en el config o puesto por una integración | ✅ | La integración `okapi()` le pasa el valor final a core (`sitePath()`): `/studio/`, `/edit-canvas/`, `/api/editor-chat/`, links, canonicals y sitemap salen con barra. Si se cambia con el dev prendido, reiniciarlo (B3) |
| Starlight | `@astrojs/starlight` | ⚠️ | Trae su propio sitemap, idiomas y `[...slug]`: ver las filas de idiomas y rutas, y "Sitemap y robots" en B3 |
| `<ClientRouter />` | en el layout | ✅ | Las islas de Okapi vuelven a hidratar en cada navegación. Para tener transiciones también en las páginas del editor, sumalo a su layout (B4) |
| `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` | otro gestor | ✅ | Se usa ese en todos los comandos de esta guía. Con pnpm, `okapi:setup` escribe un `.npmrc` para que el Studio no se quede en blanco |

Siempre, aunque todo dé ✅, aclará: **las páginas que ya existen siguen en
código.** El editor maneja las páginas nuevas que se armen ahí. Para editar
una sección que ya existe hay que pasarla a bloque ("Hacer editable algo que
el proyecto ya tiene"), y eso es trabajo de desarrollo.

Mostrá el resultado así:

```
Okapi en <proyecto>
✅ Astro 7.3 · sin Tailwind (conviven) · pnpm
⚠️ i18n: las páginas del editor van a salir en un solo idioma
🛑 Tailwind 3: hay que migrar a Tailwind 4 antes
Las páginas actuales siguen en código; el editor maneja las nuevas.
Recomendación: …
```

- **Algún 🛑:** no instales. Ofrecé dos caminos y recomendá uno: resolverlo
  primero (trabajo aparte, con su OK) o arrancar un proyecto nuevo con el
  camino A y traer el diseño.
- **Algún ⚠️:** seguí solo si la persona confirma que lo entiende.
- **Todo ✅:** seguí con las preguntas.

### Sobre el proyecto

Preguntá solo lo que no puedas deducir del proyecto:
- **¿Proyecto nuevo o existente?** Si la carpeta actual tiene
  `astro.config.*`, es existente.
- **¿En qué organización de Sanity va?** Si el agente tiene el MCP de Sanity,
  listá las organizaciones. Si no, el usuario crea el proyecto en
  sanity.io/manage y te pasa el **project ID**, que no es secreto.
- **Solo si el proyecto es existente:**
  - ¿La home sale del editor o queda la actual? Por defecto, queda la actual.
    Tercera opción: mover la home actual a otra ruta (por ejemplo
    `src/pages/index.astro` → `src/pages/inicio.astro`) y que `/` salga del
    editor. Si elige esa, revisá los links internos que apuntaban a `/`.
  - Las páginas del editor se sirven en `/<slug>`. Si el proyecto tiene
    rutas dinámicas en la raíz: `/<slug>` con `reservedSlugs`, o `/p/<slug>`
    (obligatorio si ya tiene un `[slug].astro`). Ver B4.

### Qué instalar

Cada respuesta es un flag de `npm run okapi:setup` (paso común 0):

| Pregunta | Flag | Si dice que no |
|---|---|---|
| ¿Slider / carrusel? | `--slider` | Se borra el bloque y `embla-carousel-react` |
| ¿Logo 3D? (suma ~140 KB, solo en las páginas que lo usan) | `--logo3d` | Se borra el bloque y `three` |
| ¿Componentes reutilizables? Guardar una sección y usarla en varias páginas, como en Webflow | `--components` | Se apagan en el editor y en Sanity (se pueden prender después) |
| ¿Chat con IA en el editor? Necesita Vercel, Netlify o Cloudflare y una clave de IA del cliente | `--chat` | El sitio queda 100% estático, sin adaptador ni función de servidor |
| ¿Quién va a editar? Solo **Administrator** (la agencia) · además **Editor** (un cliente que publica) · además **Contributor** (alguien que solo deja borradores). Son los mismos nombres de roles que en Sanity | `--roles=administrator` · `administrator+editor` · `administrator+editor+contributor` | Arma `src/okapi.policy.ts` con esos roles |
| ¿Contenido de ejemplo? Una home armada para ver el editor andando | `--demo` | No se importa nada; la primera página se crea en el editor |

Recomendación si la persona no sabe: slider **sí**, logo 3D **no**,
componentes **sí**, chat **sí** si el hosting es Vercel o Netlify, roles
`administrator+editor`, ejemplo **sí**.

Okapi no trae animaciones. Si el proyecto ya anima (GSAP, Motion, CSS), sigue
con lo suyo; si las quiere, se agregan en el código del proyecto, no en Okapi.

Necesitás:
- Node ≥ 22.12 y el gestor de paquetes que ya use el proyecto (npm, pnpm o
  yarn). En un proyecto nuevo, npm.
- `git`.

## Camino A — proyecto nuevo

El repo de Okapi ya es un proyecto Astro completo. Incluye bloques de
ejemplo, tema y header/footer que después se reemplazan.

```bash
git clone --depth 1 https://github.com/seba-seb/okapi-sanity <carpeta>
cd <carpeta> && rm -rf .git && git init -q
npm install
```

Seguí con los **pasos comunes**.

## Camino B — proyecto existente

### B1. Revisar

El análisis del Paso 0 ya está hecho: no hay ningún 🛑 y la persona aceptó los ⚠️.

- **Árbol de git limpio.** Así el usuario ve el diff completo de la
  instalación. Si el proyecto no es un repo, proponé `git init` y un commit
  base con todo lo actual, y hacelo solo con su OK.
- **Alias `@/*` → `./src/*` en `tsconfig.json`.** Todo Okapi importa con
  `@/`.
  - Si no existe, agregalo.
  - Si existe y apunta a otro lado, frená y preguntá.

### B2. Traer Okapi

Una carpeta temporal propia, así dos instalaciones en paralelo no se pisan.
Usá el mismo `$R` en el resto de la guía:

```bash
R="$(mktemp -d)/okapi"
git clone --depth 1 https://github.com/seba-seb/okapi-sanity "$R"   # --branch <ref> si el usuario pide otra versión
```

Copiá desde `$R` **sin pisar nada que ya exista**. `cp -n` saltea en
silencio lo que ya está, así que primero listá los choques:

```bash
for p in src/core src/blocks src/documents src/theme src/chrome src/schema.ts \
  src/okapi.config.json src/okapi.policy.ts src/layouts/Base.astro \
  src/pages/edit-canvas.astro "src/pages/[slug].astro" "src/pages/p/[slug].astro" \
  src/pages/index.astro src/pages/sitemap.xml.ts src/pages/robots.txt.ts \
  sanity.config.ts sanity.cli.ts sanity/seed.ndjson public/placeholder.svg \
  scripts/verify.mjs scripts/check-editor-schema.ts scripts/okapi-setup.mjs \
  .env.example AGENTS.md CLAUDE.md; do
  if [ -e "$p" ]; then echo "YA EXISTE: $p"; fi
done
```

- `src/layouts/Base.astro` existe → copiá el nuestro como `OkapiBase.astro`
  (`cp $R/src/layouts/Base.astro src/layouts/OkapiBase.astro`) y cambiá el
  import en `[slug].astro` e `index.astro`.
- `src/pages/[slug].astro` existe → el nuestro va en `src/pages/p/[slug].astro`
  (B4).
- Cualquier otro → frená y preguntá.

```bash
mkdir -p src/layouts src/pages scripts sanity public
cp -Rn $R/src/core $R/src/blocks $R/src/documents $R/src/theme $R/src/chrome src/
cp -n  $R/src/schema.ts $R/src/okapi.config.json $R/src/okapi.policy.ts src/
cp -n  $R/src/layouts/Base.astro src/layouts/
cp -n  $R/src/pages/edit-canvas.astro "$R/src/pages/[slug].astro" src/pages/
cp -n  $R/sanity.config.ts $R/sanity.cli.ts .
cp -n  $R/scripts/verify.mjs $R/scripts/check-editor-schema.ts $R/scripts/okapi-setup.mjs scripts/
cp -n  $R/sanity/seed.ndjson sanity/
cp -n  $R/public/placeholder.svg public/
# Según la tabla de abajo:
# cp -n $R/src/pages/index.astro src/pages/                         # solo si la home sale del editor
# cp -n $R/src/pages/sitemap.xml.ts $R/src/pages/robots.txt.ts src/pages/   # ver "Sitemap y robots" (B3)
# cp -n $R/AGENTS.md $R/CLAUDE.md .                            # ver B5 si ya existen
```

**`.env.example`:** sumá al del proyecto (o creálo) las líneas de
`$R/.env.example`. Ahí están documentadas las variables del chat
(`ANTHROPIC_API_KEY`, `AI_MODELS`…); cuando se borra `$R`, es la única
referencia que queda.

| Copiar | Qué es | Obligatorio |
|---|---|---|
| `src/core/` | El producto: editor, render, estilos, Sanity | Sí |
| `src/blocks/` | Registro de bloques y bloques base. Después se borran o se agregan bloques | Sí |
| `src/documents/`, `src/schema.ts` | Documentos de Sanity: page, component, settings, navigation | Sí |
| `src/okapi.policy.ts` | Qué puede hacer cada rol en el editor y el chat | Sí |
| `src/okapi.config.json` | Módulos activos (chat, componentes), dónde van las páginas (`pagesBase`) y los slugs del proyecto (`reservedSlugs`); los módulos los escribe `okapi:setup` | Sí |
| `src/theme/` | `tokens.css` (los nombres que usa el editor), CSS de los bloques y `Head.astro` (fuentes y CSS del proyecto, B4) | Sí |
| `src/layouts/Base.astro` | Layout de las páginas de Okapi: SEO, header y footer, `<Islands />` | Sí (ver B4) |
| `src/chrome/` | Header y footer que leen Navigation | Sí, salvo que reemplaces `SiteHeader`/`SiteFooter` en el layout (B4) |
| `src/pages/edit-canvas.astro` | El canvas del editor | Sí |
| `src/pages/[slug].astro` | Páginas del editor por slug | Sí |
| `src/pages/index.astro` | Home desde el editor | Solo si la home sale del editor |
| `src/pages/sitemap.xml.ts`, `robots.txt.ts` | SEO | Ver "Sitemap y robots" en B3 |
| `sanity.config.ts`, `sanity.cli.ts` | Config del Studio | Sí |
| `scripts/verify.mjs`, `scripts/check-editor-schema.ts` | Chequeos | Sí |
| `sanity/seed.ndjson` | Página demo | Opcional |
| `public/placeholder.svg` | Imagen por defecto de los bloques nuevos | Sí: sin ella, insertar una imagen muestra un ícono roto |
| `AGENTS.md` | Reglas para agentes | Sí (ver B5) |
| `INSTALL.md`, `docs/` | Esta guía y la documentación | Opcional |

### B3. Configuración

**`package.json`**: sumá sin bajar versiones que el proyecto ya tenga
(Astro ≥ 7.3). Lo que el proyecto ya tiene en una versión igual o más nueva
(`typescript`, `engines.node`), queda como está.

```jsonc
"dependencies": {
  "@astrojs/react": "^7.0.0", "@portabletext/react": "^6.2.0",
  "@sanity/astro": "^3.5.1", "@sanity/client": "^8.9.0", "@sanity/icons": "^5.2.3",
  "@sanity/image-url": "^2.1.1", "@sanity/ui": "^4.4.9", "@sanity/themer": "0.10.4", "groq": "^6.19.0",
  "react": "^19.2.0", "react-dom": "^19.2.0", "react-is": "^19.2.0",
  "sanity": "^6.19.0", "styled-components": "^6.6.0",
  "tailwindcss": "^4.3.3", "@tailwindcss/vite": "^4.3.3",
  // chat del editor, solo con okapiAdapter() (sin adapter propio)
  "@astrojs/vercel": "^11.0.15", "@astrojs/netlify": "^8.2.10",
  // bloques de ejemplo (si se quedan): slider, 3D
  "embla-carousel-react": "^8.6.0", "three": "^0.160.0"
},
"devDependencies": { "vite": "*", "@astrojs/check": "^0.9.10", "typescript": "^5.7 || ^6", "@types/react": "^19.2.0", "@types/react-dom": "^19.2.0", "@types/three": "^0.160.0" },
"engines": { "node": ">=22.12" },
"scripts": { "verify": "node scripts/verify.mjs", "typecheck": "astro check && node node_modules/typescript/bin/tsc --noEmit", "okapi:setup": "node scripts/okapi-setup.mjs" }
```

- `vite` va explícito porque `astro.config` importa `loadEnv` de `vite`.
- `typecheck` llama al `tsc` del proyecto por su ruta: el `tsc` de
  `node_modules/.bin` puede ser otra versión, que llega con `sanity`.
- `typescript` hasta la 6: `astro check` todavía no corre con TypeScript 7.

**`astro.config.*`** (`.mjs` o `.ts`): lo de Okapi está en
`src/core/astro/okapi.ts` (tipado, ya copiado con `src/core/`). En el config
del proyecto solo se importa y se suma, sin pegar código:

```js
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { okapi, okapiAdapter, okapiSanity, okapiSite } from "./src/core/astro/okapi";

const adapter = await okapiAdapter(); // o el adapter que ya usaba el proyecto

export default defineConfig({
  site: okapiSite(),                  // solo si el proyecto no define uno
  adapter,
  integrations: [okapi({ adapter }), okapiSanity(), react() /* , las del proyecto */],
  vite: { plugins: [tailwindcss()] }, // solo si el proyecto no usa Tailwind 4
});
```

- **`okapi({ adapter })`** crea la ruta `/api/editor-chat` del chat (en dev,
  o con un adapter), le pasa a core el `trailingSlash` final del proyecto
  (aunque lo ponga otra integración), y suma el CDN de imágenes de Sanity,
  `optimizeDeps` y una caché de Vite propia para el build. Se fusiona con lo
  del proyecto: las listas se suman. Va siempre, aunque el chat esté apagado.
- **`okapiAdapter()`** elige Vercel, Netlify o Cloudflare según dónde corre el
  build. Si el proyecto ya tiene un `adapter`, dejá el suyo y pasáselo:
  `okapi({ adapter: vercel() })`. Si ya tiene una ruta `/api/editor-chat`,
  frená y preguntá.
- **`okapiSanity()`** es el Studio en `/studio`, con el `.env` del proyecto.
- **`react()`**: si el proyecto ya lo tiene, no lo sumes de nuevo.
- **`site`:** si el proyecto ya define uno (en el config o desde una
  integración propia, como AstroWind), dejá el suyo y no uses `okapiSite()`.
- **`image.service: passthroughImageService()`** solo si el proyecto no usa
  `astro:assets`. Si lo usa, dejá su servicio.
- **`output`:** dejá la del proyecto. Las páginas de Okapi exportan
  `prerender = true`, así que son estáticas igual.

**`tsconfig.json`**: `"jsx": "react-jsx"`, `"jsxImportSource": "react"` y el
alias `@/*` (B1).

**Sitemap y robots.** En este orden; `verify` falla si `/studio` o
`/edit-canvas` quedan en el sitemap.
- **Si tiene `public/robots.txt` (o una integración que lo escribe):** no
  copies `robots.txt.ts`; sumale `Disallow: /studio` y `Disallow: /edit-canvas`.
- **Si usa Starlight:** Starlight agrega `@astrojs/sitemap` por dentro, sin
  `filter`. Sumá `@astrojs/sitemap` como dependencia, agregalo a
  `integrations` con el `filter` de abajo y con el mismo `i18n` que los
  `locales` de Starlight (si no, se pierden los links entre idiomas). Después
  seguí también los pasos de "Si usa `@astrojs/sitemap`" (`robots.txt.ts` y el
  `<link rel="sitemap">` a `/sitemap-index.xml`).
- **Si no tiene sitemap ni robots:** copiá `sitemap.xml.ts` y `robots.txt.ts`.
- **Si usa `@astrojs/sitemap`:**
  - No copies `sitemap.xml.ts`.
  - Agregale
    `filter: (p) => !/\/(edit-canvas|studio)(\/|$)/.test(new URL(p).pathname)`.
  - Copiá `robots.txt.ts` y cambiá `/sitemap.xml` por `/sitemap-index.xml`,
    ahí y en el `<link rel="sitemap">` de `Base.astro`.
  - Avisá al usuario: con esa integración, las páginas marcadas `noindex` en
    Sanity igual entran al sitemap.

**Barra final**
- No se toca el `trailingSlash` del proyecto. `okapi()` se lo pasa a core y
  todas las rutas de Okapi pasan por `sitePath()` (`core/sanity/env.ts`):
  con `"always"`, `/studio/`, `/edit-canvas/`, `/api/editor-chat/` y
  `pageHref()` (links, canonicals, sitemap) llevan barra, igual que las URLs
  de `@astrojs/sitemap`. Con `"never"` o `"ignore"`, sin barra.
- Si el valor cambia con `npm run dev` prendido, reinicialo: hasta entonces el
  chat avisa "answered 404 in npm run dev".
- Una ruta nueva que arme core va con `sitePath("/…")`, nunca con la barra a mano.

### B4. Rutas y layout

- **Cómo se reparten las rutas:**
  - `[slug].astro` genera una página por cada documento `page` de Sanity,
    excepto `home`, y solo en un nivel (`/<slug>`).
  - Si la home queda la del proyecto, la página `home` de Sanity no se sirve
    en ningún lado. Los links de Okapi a "home" (logo, menú) van a `/`,
    la home del proyecto.
- **Rutas que chocan.** Astro decide por prioridad, no por quién llegó primero:
  - Una ruta **estática** del proyecto (`/pricing`) le gana a una página del
    editor con el mismo slug. La página del editor no se ve (verify avisa).
  - El `[slug]` de Okapi le **gana** a las rutas `[...algo]` del proyecto
    (un blog, las docs de Starlight). Una página del editor con ese slug
    reemplaza la del proyecto en el próximo build, y quien publica no se
    entera. `verify` falla si pasa.
  - Para evitarlo, en `src/okapi.config.json`:
    - **`reservedSlugs`:** los slugs que ya usa el proyecto (`"blog"`, cada
      carpeta de docs, cada locale como `"es"`, el slug de cada post si el blog
      vive en `/<slug>`). El Studio no deja crearlos y `[slug].astro` los
      saltea. Si el proyecto suma rutas después, hay que sumarlas acá.
    - **o `pagesBase: "/p"`:** las páginas del editor salen en `/p/<slug>` y
      no chocan con nada. Mové `src/pages/[slug].astro` a
      `src/pages/p/[slug].astro`. **Obligatorio si el proyecto ya tiene un
      `[slug].astro`.** No hay que tocar core.
- **Layout:** las páginas del editor usan `Base.astro` (u `OkapiBase.astro`, B2).
  - Cualquier layout que renderice `<PageBuilder islands … />` tiene que
    incluir `<Islands />` (de `@/core/render/Islands.astro`) al final del
    `<body>`, e importar `@/theme/globals.css`.
  - **`src/theme/Head.astro`** va en el `<head>` del layout **y** del canvas
    del editor (`edit-canvas.astro`). Lo que pongas ahí se ve igual en el sitio
    y en el editor:
    - las fuentes del proyecto (los `<link>`, el `@font-face` o el `<Font>` de
      Astro), asignadas en `--ok-font-sans` de `tokens.css` con un fallback
      (`var(--font-inter, system-ui)`);
    - el favicon del proyecto;
    - el CSS del proyecto, si hace falta (abajo).
  - **El CSS del proyecto entra siempre en la capa `project`.** Creá
    `src/theme/project.css` con `@import "../styles/global.css" layer(project);`
    (la ruta del CSS del proyecto) e importalo en `Head.astro`
    (`import "./project.css";`). Así:
    - le gana a los estilos base de Okapi (`body`, `a`, `img`), que están en
      la capa `base`;
    - los componentes de Okapi (`ok-btn`, `ok-section`…) le ganan a él, aunque
      tenga reglas como `a { color: … }`.

    Importado sin capa, cualquier regla del proyecto le gana a todo Okapi, sin
    importar la especificidad: los botones cambian de color.
  - **Header y footer del proyecto (opcional):** si los querés en las páginas
    del editor, reemplazá `SiteHeader` y `SiteFooter` en el layout por los del
    proyecto. Traé también lo que necesitan:
    - su CSS, en la capa `project` (arriba);
    - los scripts del `<head>` que cambian la página (modo oscuro, estilos de
      tema): en el layout, no en `Head.astro`, porque el canvas no los necesita;
    - las clases del `<body>` y lo que el layout del proyecto pone al final del
      `<body>`.

    Lo de SEO no: lo pone Okapi. Listale a la persona qué trajiste.
  - **Después de traer el CSS** (más si es Tailwind con tokens shadcn,
    `@utility btn` o DaisyUI): revisá en una página del editor y en el canvas
    que los botones de Okapi tengan fondo y que el texto `muted` se lea en
    secciones claras y oscuras. Si algo se pisa, avisá.
  - **`<ClientRouter />`:** si el proyecto lo usa y querés transiciones
    también entre sus páginas y las del editor, sumalo al `<head>` del layout
    (no a `Head.astro`: el canvas no lo necesita). Sin él, pasar a una página
    del editor recarga la página completa, que también anda.
  - `<html lang="en">` es fijo en el layout: cambialo al idioma del sitio.

### B5. Reglas para agentes

- **Si el proyecto no tiene `AGENTS.md`:** copiá el nuestro.
- **Si ya tiene uno** (los templates de Astro 7 lo traen): agregá al final
  una sección `## Okapi` con el contenido del nuestro. No reemplaces el suyo.
  - Sacale el título `#` al nuestro y bajá cada encabezado un nivel
    (`##` → `###`). Solo los encabezados: el árbol de *Layout* tiene una
    línea con `#` dentro de un bloque de código, que no se toca.
  - Nuestro texto menciona `INSTALL.md`, el comando `generate-seed` y, en
    *Layout*, `skills/`, que no existen en un proyecto instalado. Sacá esas líneas o reemplazalas por el
    link al repo de Okapi.
  - Agregá arriba de la sección: "Estas reglas aplican a `src/core`,
    `src/blocks`, `src/theme` y `src/chrome`". Así no chocan con las reglas
    del proyecto (otro alias, otra paleta de Tailwind).
- **`CLAUDE.md`:**
  - Si no existe, creálo con una sola línea: `@AGENTS.md`.
  - Si existe y no contiene `@AGENTS.md`, agregale esa línea.
  - Si es un symlink a `AGENTS.md`, no lo toques.

### B6. Diseño

`src/theme/tokens.css` define los nombres que ofrece el panel de estilo del
editor:
- **colores:** `--ok-bg --ok-surface --ok-surface-2 --ok-fg --ok-muted --ok-brand --ok-brand-contrast --ok-border`, por tema;
- **espaciado:** `--ok-space-xs … --ok-space-3xl`;
- **radios:** `--ok-radius-*`;
- **ancho de página:** `--ok-maxw-page`;
- **escala de títulos:** `--ok-h-*`;
- **fuente:** `--ok-font-sans`.

Todos llevan el prefijo `--ok-` para no chocar con los del proyecto (shadcn
también define `--muted`, `--border`, `--radius`). Si el proyecto ya tiene sus
tokens, apuntalos: `--ok-brand: var(--primary);`.

Asigná ahí los valores del diseño del proyecto: **los nombres no se cambian;
los valores, sí.** Así el editor ofrece la paleta del proyecto.

El Studio se llama "Okapi": cambiale el `title` en `sanity.config.ts` por el
nombre del sitio.

Si el sitio cambia a modo oscuro con una clase (`.dark` en `<html>`), las
secciones de Okapi no la siguen: cada una tiene su `data-ok-theme`. Si hace falta,
mapealo en `tokens.css` (`.dark [data-ok-theme="light"] { … }`) y avisá.

## Pasos comunes

### 0. Dejar solo lo elegido

Con las respuestas del Paso 0. Primero el plan, sin cambiar nada:

```bash
npm run okapi:setup -- --slider=yes --logo3d=no --components=yes \
  --chat=yes --roles=administrator+editor --demo=yes --dry-run
```

Mostrale a la persona la lista que imprime (qué se borra, qué dependencias se
van, qué roles quedan). Si está de acuerdo, corré lo mismo cambiando
`--dry-run` por `--yes`. El script borra los bloques y sus dependencias,
escribe `src/okapi.config.json` y `src/okapi.policy.ts`, saca las herramientas
internas del repo de Okapi y corre el install del gestor del proyecto (con
pnpm, antes escribe el `.npmrc` e instala sin pedir confirmación). Si el
install no deja `node_modules/sanity`, falla.

- Si falta alguna respuesta, el script no hace nada y dice cuál falta.
- En una terminal, `npm run okapi:setup` sin flags hace las preguntas solo.
- Después se pueden prender o apagar `chat` y `components` a mano en
  `src/okapi.config.json`. Un bloque borrado se vuelve a sumar copiándolo del
  repo de Okapi (ver "Add a block" en `AGENTS.md`).

### 1. Sanity

Con el MCP de Sanity, o pidiéndole al usuario que lo haga en sanity.io/manage:
1. **Proyecto:** creá el proyecto, o usá el que te pasó el usuario.
   - **Ojo con el MCP:** `create_project` devuelve tokens de lectura y
     escritura en texto plano, dentro de tu contexto. Eso choca con la regla 1.
     Lo recomendado es que el usuario cree el proyecto a mano y te pase el
     project ID. Si igual lo creás con el MCP, no muestres ni uses esos tokens
     y pedile al usuario que los revoque en sanity.io/manage → API → Tokens.
2. **Dataset:** `production`, **público**. El sitio lee en el build sin token.
3. **CORS:** origen `http://localhost:4321` **con credenciales**. Sin esto,
   `/studio` muestra "Connect this studio to your project". Cada puerto o
   dominio es un origen distinto.
4. **`.env`:** armalo desde `$R/.env.example`.
   - `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET=production` y
     `PUBLIC_SANITY_API_VERSION`.
   - `PUBLIC_SITE_URL` solo si hay dominio. Vacía no sirve: borrala.
   - Si `.env` no está en `.gitignore`, agregalo.

### 2. Instalar y arrancar

```bash
npm run dev -- --port 4321
```

`okapi:setup` ya instaló las dependencias; si lo corriste con `--no-install`,
antes corré `npm install`. El 4321 es el puerto de esta guía: si el proyecto usa
otro, usá ese y sumalo al CORS (paso 1).

Mirá en qué puerto arrancó de verdad: si el 4321 estaba ocupado, Astro usa
otro y el Studio no conecta (CORS). Pedile al usuario que libere el 4321, o
pedí OK para sumar ese origen al CORS.

### 3. Contenido demo (solo con `--demo`)

```bash
npx sanity login && npx sanity dataset import sanity/seed.ndjson production
```

Usa la sesión del usuario; no hace falta token. `npx sanity login` lo corre el
usuario. El import publica contenido, así que pedí un sí explícito. Con ese sí
y la sesión de la CLI ya iniciada, lo podés correr vos. En un proyecto
existente es opcional: también se puede crear la primera página desde el
editor.

El demo es una sola página, `home`. **Si la home queda la del proyecto, el demo
no se ve en ningún lado** (la `home` de Sanity no se sirve): para ver el
editor andando en el sitio, hay que crear y publicar otra página en el editor.
Decíselo antes de importar.

### 4. Comprobar

- [ ] `/studio` muestra el login de Sanity. Entra el usuario.
- [ ] `/studio#/editor` lista las páginas y el canvas muestra la elegida.
- [ ] La página se ve en el sitio: en `/<slug>` (o `/p/<slug>`), o en `/`
      si la home sale del editor.
- [ ] `npm run verify` en verde.
  - En un proyecto existente, el chequeo que importa es "Okapi rendered
    a page".
  - Sin ninguna página que el sitio sirva (nada publicado, o solo `home` con
    la home del proyecto), ese chequeo queda como aviso (⚠), no como error.
    La instalación cierra igual. El usuario crea y publica la primera página
    cuando quiera; publicar sale en vivo.
  - "no editor page replaces a project route" en rojo: una página del editor
    tapa una ruta del proyecto. Sumá ese slug a `reservedSlugs` (B4).
  - `npm run verify -- http://localhost:4321` se puede correr con el dev
    server prendido: el build usa su propia caché de Vite.
  - El de la pantalla de bienvenida pasa siempre si la home es del proyecto.

### 5. Roles

Okapi usa **los mismos nombres de rol que Sanity**. El rol se asigna en Sanity
al invitar (sanity.io/manage → el proyecto → **Members** → **Invite**, o
`npx sanity users invite <email> --role <rol>`, que corre el usuario) y
`src/okapi.policy.ts` define qué ve cada rol en el editor:

| Rol de Sanity | Plan de Sanity | En el editor (por defecto) |
|---|---|---|
| `administrator` | Todos | Todo (la agencia) |
| `editor` | Growth o superior | Textos, imágenes, reordenar, algunos bloques, publicar, chat |
| `contributor` | Growth o superior | Textos, imágenes, reordenar; sin publicar ni chat |
| `viewer` y cualquier otro | Todos | Solo mirar |

- **Plan gratis:** solo hay `administrator` y `viewer`, así que un cliente que
  edite tiene que ser `administrator` y ve todo. Avisale al usuario: para
  separar agencia y cliente hace falta el plan Growth.
- Un administrator puede previsualizar cualquier rol con **View as** en el
  editor; no cambia el rol real de nadie.

### 6. Producción

- **Build:** `npm run build`. Las páginas de Okapi son estáticas.
- **Variables en el host:** las de `.env`, sin secretos salvo
  `SANITY_API_READ_TOKEN` si el dataset es privado.
- **Chat del editor:** en el hosting, la clave por proveedor
  (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` y/o `OPENROUTER_API_KEY`) y
  `AI_MODELS` con los modelos que el chat puede elegir (ver `.env.example`).
  - **Una clave por proyecto, con su propio tope de gasto mensual**, que lo
    pone el usuario en el proveedor. En Anthropic, un *workspace* por
    proyecto; en OpenAI, un *project* con *budget*; en OpenRouter, una clave
    con *credit limit*. Así un sitio no consume el presupuesto de otro y se ve
    el gasto de cada uno.
  - Sin `AI_MODELS`, el chat ofrece todos los modelos, incluidos los caros.
  - **Privacidad:** el chat manda el contenido de la página y las imágenes
    adjuntas al proveedor elegido. Avisale al usuario; si el sitio maneja
    datos personales, que lo revise antes de cargar la clave. Sin clave, no
    hay chat.
  - Funciona en Vercel y Netlify sin tocar nada; en Cloudflare Pages,
    `npm i @astrojs/cloudflare wrangler`. En Cloudflare **Workers** (un
    `wrangler.jsonc` con `assets`) no se detecta solo: `OKAPI_ADAPTER=cloudflare`.
    En otro hosting el sitio anda igual pero el chat queda deshabilitado.
  - Si el proyecto usa `astro:assets` (con `sharp`), la función del chat lo
    lleva adentro y pesa bastante más (~25 MB en Vercel). Anda igual; avisalo.
- **CORS:** el dominio de producción, con credenciales.
- **Publicar = rebuild** (lo configura el usuario, la URL del hook es
  secreta):
  1. Crea un *deploy hook* en el host.
  2. En sanity.io/manage → API → Webhooks, crea un webhook que se dispare en
     *create*, *update* y *delete*, con filtro
     `_type in ["page","settings","navigation","component"]`, que llame a ese
     hook. Sin *delete*, despublicar no saca la página.
  - Sin esto, publicar no cambia el sitio hasta el próximo build manual.
  - Si Sanity no responde durante el build, el build falla y el sitio en vivo
    queda como estaba.
- **Después del deploy:** `npm run verify -- https://<dominio>`.

### 7. Cierre

Reportá al usuario:
- qué se copió y qué se cambió del proyecto;
- el ID del proyecto de Sanity;
- qué le toca a él: importar el contenido demo, invitar usuarios y
  configurar el webhook;
- el resultado de verify.

Pedile el **smoke test logueado** (`AGENTS.md` → "Editor smoke test").

## Hacer editable algo que el proyecto ya tiene

Para pasar un componente existente (hero, testimonios, pricing…) a bloque
del editor:

1. `src/blocks/<tipo>/schema.ts`: los campos que hoy son props o texto fijo.
2. `src/blocks/<tipo>/<Tipo>.tsx`: el componente del proyecto adaptado.
   - Recibe `{ block, path, ctx }` y lee todo de `block`.
   - Pone `{...editable(ctx.documentId, ctx.documentType, path, block._type)}`
     en su raíz.
   - Nunca hace fetch.
   - Si era `.astro`, pasalo a `.tsx`. Lo que solo existe en `.astro` no
     entra en un bloque: `astro-icon` (copiá los SVG que use a un archivo del
     bloque, no el set entero) y `<Image>`/`<Picture>` de `astro:assets` (las
     imágenes de un bloque vienen de Sanity, con `urlForImage`).
3. Registrá el bloque en `src/blocks/meta.ts`, `schemas.ts` y `components.tsx`.
   - Usá `js: true` si corre algo en el navegador: hooks, efectos,
     animaciones, carruseles.
4. Opcional:
   - contenido inicial en `defaults.ts`;
   - texto editable sobre la página: `text` en la entrada de `meta.ts`
     (`[{ sel: ".faq__q", field: "question", kind: "string" }]`; sin `sel`,
     el bloque entero);
   - soltar imágenes: `imageField` en `meta.ts`.
   - Todo se declara en `meta.ts`: `src/core/` no se toca.
5. `npm run verify` falla si un campo no tiene control en el editor, o si
   `text`/`imageField` nombran un campo que el bloque no tiene. Avisa (sin
   fallar) si un rol con lista `blocks` en `okapi.policy.ts` no puede
   agregar el bloque nuevo.
   - **Listas** (FAQ, stats, logos): un campo de tipo array de objetos no
     tiene control en el panel. Se hace con un bloque contenedor y un bloque
     hijo (`faq` con `slot: { field: "items", accepts: ["faqItem"] }`), y así
     se editan desde capas.

Reglas completas para bloques, animaciones y estilos: `AGENTS.md`.

## Actualizar un proyecto que ya tiene Okapi

Traé la versión nueva igual que en B2 (`R="$(mktemp -d)/okapi"` y el clone) y
reemplazá **`src/core/`** entero: es igual en todos los proyectos. El resto es
del proyecto: se actualiza a mano, mirando el diff de la versión nueva.

### Nombres con prefijo `ok-` (octubre 2026)

Todo lo que Okapi define en CSS empieza con `ok-`, para no chocar con el CSS
del proyecto. Si el proyecto se instaló antes, renombrá en sus archivos
(`src/theme/`, sus bloques propios, `src/chrome/`, su layout de Okapi):

| Antes | Ahora |
|---|---|
| Variables: `--bg`, `--muted`, `--space-md`, `--radius-main`, `--h-xl`, `--maxw-page`… | `--ok-bg`, `--ok-muted`, `--ok-space-md`, `--ok-radius-main`, `--ok-h-xl`, `--ok-maxw-page`… (todas: `--x` → `--ok-x`) |
| Clases: `.btn`, `.section`, `.card`, `.site-header`… | `.ok-btn`, `.ok-section`, `.ok-card`, `.ok-site-header`… |
| Utilities de tokens: `bg-bg`, `text-muted`, `border-border`, `gap-md`, `p-lg` | `bg-ok-bg`, `text-ok-muted`, `border-ok-border`, `gap-ok-md`, `p-ok-lg` |
| `rounded-main`, `text-h-xl`, `px-section-x`, `max-w-page`, `shadow-theme` | `rounded-ok-main`, `text-ok-h-xl`, `px-ok-section`, `max-w-ok-page`, `shadow-ok` |
| Atributo `data-theme="dark"` y `[data-theme=…]` en el CSS | `data-ok-theme="dark"` y `[data-ok-theme=…]` |

1. `astro.config`: si tiene el bloque de Okapi pegado a mano (`resolveAdapter`,
   `editorChat`, `optimizeDeps`), reemplazalo por los imports de
   `src/core/astro/okapi.ts` (B3).
2. Copiá `src/theme/globals.css` de la versión nueva. Si el proyecto le había
   agregado reglas, pasalas renombradas.
3. En `src/theme/tokens.css`, renombrá cada variable y cada `[data-theme`. Los
   valores quedan como estaban.
4. En los bloques y el chrome del proyecto, buscá las clases y utilities de la
   tabla (`grep -rnE "data-theme|var\(--(bg|fg|muted|border|brand|surface|space|radius|h)-?" src/blocks src/chrome src/layouts`).
5. El contenido de Sanity no cambia: guarda claves de tokens (`md`, `brand`),
   no nombres de CSS.
6. `npm run typecheck` y `npm run verify`. Verify falla si queda en el CSS de
   Okapi algún nombre sin `ok-`. Después mirá una página del editor y el canvas.

## Problemas conocidos

| Síntoma | Arreglo |
|---|---|
| "Connect this studio to your project" | Falta ese origen exacto (puerto o dominio) en CORS, con credenciales |
| Studio o canvas en blanco + `504 (Outdated Optimize Dep)` | Pará el server, `rm -rf node_modules/.vite`, arrancá y recargá con ⌘⇧R. Revisá que `okapi()` esté en `integrations` (trae `optimizeDeps`) |
| `@vitejs/plugin-react can't detect preamble` | El layout no incluye `<Islands />` |
| Un bloque se ve pero no se anima | Le falta `js` en `meta.ts` |
| La home muestra "Your visual page builder is ready" | Falta `.env` o no hay página `home` en Sanity |
| Publiqué y el sitio no cambió | Falta el webhook al deploy hook, o el build todavía no terminó |
| `astro check does not currently support TypeScript 7.0` | `typescript` quedó en la 7: `npm i -D typescript@^6` (B3) |
| `_jsxDEV is not a function` en dev, las islas no hidratan | Un build pisó la caché del dev server: falta `okapi()` en las integraciones (B3). Pará el server, `rm -rf node_modules/.vite`, arrancá |
| `Unable to render SiteHeader` / página del editor en blanco, con Vue o Svelte en el proyecto | Un componente de `src/chrome` (o uno propio que renderiza una `.astro`) devuelve `null`: que devuelva `<></>` |
| Botones de Okapi sin fondo o texto `muted` invisible | Un nombre sin el prefijo `ok-` en `globals.css`/`tokens.css` o en un bloque (`.btn`, `--muted`, `text-muted`): el CSS del proyecto lo pisa. Ver B4 |
