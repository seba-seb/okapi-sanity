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

### Sobre el proyecto

Preguntá solo lo que no puedas deducir del proyecto:
- **¿Proyecto nuevo o existente?** Si la carpeta actual tiene
  `astro.config.*`, es existente.
- **¿En qué organización de Sanity va?** Si el agente tiene el MCP de Sanity,
  listá las organizaciones. Si no, el usuario crea el proyecto en
  sanity.io/manage y te pasa el **project ID**, que no es secreto.
- **Solo si el proyecto es existente:**
  - ¿La home sale del editor o queda la actual? Por defecto, queda la actual.
  - Las páginas del editor se sirven en `/<slug>` (ver B4).

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
- Acceso de lectura al repo `seba-seb/okapi-sanity` (mientras sea privado)
  (`gh auth status`).

## Camino A — proyecto nuevo

El repo de Okapi ya es un proyecto Astro completo. Incluye bloques de
ejemplo, tema y header/footer que después se reemplazan.

```bash
gh repo clone seba-seb/okapi-sanity <carpeta> -- --depth 1
cd <carpeta> && rm -rf .git && git init -q
npm install
```

Seguí con los **pasos comunes**.

## Camino B — proyecto existente

### B1. Revisar

- **Astro ≥ 7.** Si es más viejo, frená: actualizar Astro es un trabajo aparte
  que el usuario tiene que aprobar.
- **Árbol de git limpio.** Así el usuario ve el diff completo de la
  instalación.
- **Alias `@/*` → `./src/*` en `tsconfig.json`.** Todo Okapi importa con
  `@/`.
  - Si no existe, agregalo.
  - Si existe y apunta a otro lado, frená y preguntá.
- **Tailwind.** Las páginas de Okapi traen su propio CSS: Tailwind 4 sin
  preflight, solo en sus layouts.
  - Si el proyecto usa Tailwind 3, avisá. Conviven, pero hay que revisar que
    la build no mezcle configuraciones.

### B2. Traer Okapi

```bash
rm -rf /tmp/okapi   # una copia vieja daría una versión vieja
gh repo clone seba-seb/okapi-sanity /tmp/okapi -- --depth 1   # --branch <ref> si el usuario pide otra versión
```

Copiá desde `/tmp/okapi` **sin pisar nada que ya exista**. Revisá primero
que ninguna de estas rutas exista en el proyecto. Si alguna existe, resolvela
según la tabla o preguntá.

```bash
R=/tmp/okapi
mkdir -p src/layouts src/pages scripts sanity public
cp -Rn $R/src/core $R/src/blocks $R/src/documents $R/src/theme $R/src/chrome src/
cp -n  $R/src/schema.ts $R/src/okapi.policy.ts src/
cp -n  $R/src/layouts/Base.astro src/layouts/
cp -n  $R/src/pages/edit-canvas.astro "$R/src/pages/[slug].astro" src/pages/
cp -n  $R/sanity.config.ts $R/sanity.cli.ts .
cp -n  $R/scripts/verify.mjs $R/scripts/check-editor-schema.ts $R/scripts/okapi-setup.mjs scripts/
cp -n  $R/src/okapi.config.json $R/src/okapi.policy.ts src/
cp -n  $R/sanity/seed.ndjson sanity/
cp -n  $R/public/placeholder.svg public/
```

| Copiar | Qué es | Obligatorio |
|---|---|---|
| `src/core/` | El producto: editor, render, estilos, Sanity | Sí |
| `src/blocks/` | Registro de bloques y bloques base. Después se borran o se agregan bloques | Sí |
| `src/documents/`, `src/schema.ts` | Documentos de Sanity: page, component, settings, navigation | Sí |
| `src/okapi.policy.ts` | Qué puede hacer cada rol en el editor y el chat | Sí |
| `src/theme/` | `tokens.css` (los nombres que usa el editor) + CSS de los bloques | Sí |
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
(Astro ≥ 7.3).

```jsonc
"dependencies": {
  "@astrojs/react": "^7.0.0", "@portabletext/react": "^6.2.0",
  "@sanity/astro": "^3.5.1", "@sanity/client": "^8.9.0", "@sanity/icons": "^5.2.3",
  "@sanity/image-url": "^2.1.1", "@sanity/ui": "^4.4.9", "@sanity/themer": "0.10.4", "groq": "^6.19.0",
  "react": "^19.2.0", "react-dom": "^19.2.0", "react-is": "^19.2.0",
  "sanity": "^6.19.0", "styled-components": "^6.6.0",
  "tailwindcss": "^4.3.3", "@tailwindcss/vite": "^4.3.3",
  // chat del editor (el adapter se elige solo según el host)
  "@astrojs/vercel": "^11.0.15", "@astrojs/netlify": "^8.2.10",
  // bloques de ejemplo (si se quedan): slider, 3D
  "embla-carousel-react": "^8.6.0", "three": "^0.160.0"
},
"devDependencies": { "vite": "*", "@types/react": "^19.2.0", "@types/react-dom": "^19.2.0", "@types/three": "^0.160.0" },
"engines": { "node": ">=22.12" },
"scripts": { "verify": "node scripts/verify.mjs", "okapi:setup": "node scripts/okapi-setup.mjs" }
```

`vite` va explícito porque `astro.config` importa `loadEnv` de `vite`.

**`astro.config.*`**: integrá lo que trae `/tmp/okapi/astro.config.mjs`.
Copiá los bloques tal cual: cada línea tiene su razón documentada en ese archivo.
- La lectura de `.env` con `loadEnv`.
- La integración `sanity({ …, useCdn: false, studioBasePath: "/studio", studioRouterHistory: "hash" })`.
- `react()`.
- `vite.plugins: [tailwindcss()]`.
- `image.remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }]`.
- `resolveAdapter()`, la const `adapter` y la integración `editorChat`: crean
  la ruta `/api/editor-chat` del chat. Si el proyecto ya tiene un `adapter`,
  dejá el suyo y asignalo a esa const.
- `image.service: passthroughImageService()` solo si el proyecto no usa
  `astro:assets`. Si lo usa, dejá su servicio.
- `vite.optimizeDeps` completo (`entries` + `include`). Sin eso, el Studio
  queda en blanco en dev.
- `site`: si el proyecto ya define uno, dejá el suyo. Si no, copiá
  `resolveSite()`.
- `output`: dejá la del proyecto. Las páginas de Okapi exportan
  `prerender = true`, así que son estáticas igual.

**`tsconfig.json`**: `"jsx": "react-jsx"`, `"jsxImportSource": "react"` y el
alias `@/*` (B1).

**Sitemap y robots**
- **Si el proyecto no tiene ninguno de los dos:** copiá `sitemap.xml.ts` y
  `robots.txt.ts`.
- **Si usa `@astrojs/sitemap`:**
  - No copies `sitemap.xml.ts`.
  - Agregale
    `filter: (p) => !/\/(edit-canvas|studio)(\/|$)/.test(new URL(p).pathname)`.
  - Copiá `robots.txt.ts` y cambiá `/sitemap.xml` por `/sitemap-index.xml`,
    ahí y en el `<link rel="sitemap">` de `Base.astro`.
  - Avisá al usuario: con esa integración, las páginas marcadas `noindex` en
    Sanity igual entran al sitemap.
- **Si ya tiene un `robots.txt` propio:** sumale
  `Disallow: /studio` y `Disallow: /edit-canvas`.

**Barra final**
- Si el proyecto usa `trailingSlash: "always"` o `build.format: "directory"`
  con links con barra, avisá al usuario.
- Los canonicals y links de Okapi salen sin barra final. Ajustarlo es
  un cambio en core: va al repo de Okapi, no al proyecto.

### B4. Rutas y layout

- **Cómo se reparten las rutas:**
  - `[slug].astro` genera una página por cada documento `page` de Sanity,
    excepto `home`, y solo en un nivel (`/<slug>`).
  - Si un slug coincide con una ruta del proyecto, Astro sirve la del
    proyecto. No hay otro filtro.
  - Si la home queda la del proyecto, la página `home` de Sanity no se sirve
    en ningún lado. Los links de Okapi a "home" (logo, menú) van a `/`,
    la home del proyecto.
- **Rutas que chocan:**
  - Si el proyecto ya tiene una ruta con el mismo slug que una página de
    Sanity, gana la ruta del proyecto.
  - Si ya tiene un `[slug].astro`, frená y preguntá dónde montar las páginas
    del editor. Por ejemplo, en `src/pages/p/[slug].astro`: hay que ajustar
    `pageHref()` en `src/core/lib/routes.ts`. Es el único cambio en core que
    se permite, y avisalo.
- **Layout:** las páginas del editor usan `Base.astro`.
  - Si el proyecto ya tiene `src/layouts/Base.astro`, copiá el nuestro como
    `OkapiBase.astro` y actualizá los imports en las páginas copiadas.
  - Para usar el header y footer del proyecto, reemplazá `SiteHeader` y
    `SiteFooter` en ese layout por los del proyecto.
  - Cualquier layout que renderice `<PageBuilder islands … />` tiene que
    incluir `<Islands />` (de `@/core/render/Islands.astro`) al final del
    `<body>`.
  - Ese layout importa `@/theme/globals.css`.

### B5. Reglas para agentes

- **Si el proyecto no tiene `AGENTS.md`:** copiá el nuestro.
- **Si ya tiene uno:** agregá al final una sección `## Okapi` con el
  contenido del nuestro. No reemplaces el suyo.
  - Sacale el título `#` al nuestro y bajá cada encabezado un nivel
    (`##` → `###`).
  - Nuestro texto menciona `INSTALL.md` y `site/docs/index.html`. Copialos o
    reemplazá esas menciones por el link al repo de Okapi.
- **`CLAUDE.md`:**
  - Si existe y no contiene `@AGENTS.md`, agregale esa línea.
  - Si es un symlink a `AGENTS.md`, no lo toques.

### B6. Diseño

`src/theme/tokens.css` define los nombres que ofrece el panel de estilo del
editor:
- **colores:** `--bg --surface --surface-2 --fg --muted --brand --brand-contrast --border`, por tema;
- **espaciado:** `--space-xs … --space-3xl`;
- **radios:** `--radius-*`;
- **ancho de página:** `--maxw-page`;
- **escala de títulos:** `--h-*`.

Asigná ahí los valores del diseño del proyecto: **los nombres no se cambian;
los valores, sí.** Así el editor ofrece la paleta del proyecto.

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
internas del repo de Okapi y corre `npm install`.

- Si falta alguna respuesta, el script no hace nada y dice cuál falta.
- En una terminal, `npm run okapi:setup` sin flags hace las preguntas solo.
- Después se pueden prender o apagar `chat` y `components` a mano en
  `src/okapi.config.json`. Un bloque borrado se vuelve a sumar copiándolo del
  repo de Okapi (ver "Add a block" en `AGENTS.md`).

### 1. Sanity

Con el MCP de Sanity, o pidiéndole al usuario que lo haga en sanity.io/manage:
1. **Proyecto:** creá el proyecto, o usá el que te pasó el usuario.
2. **Dataset:** `production`, **público**. El sitio lee en el build sin token.
3. **CORS:** origen `http://localhost:4321` **con credenciales**. Sin esto,
   `/studio` muestra "Connect this studio to your project". Cada puerto o
   dominio es un origen distinto.
4. **`.env`:** armalo desde `/tmp/okapi/.env.example`.
   - `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET=production` y
     `PUBLIC_SANITY_API_VERSION`.
   - `PUBLIC_SITE_URL` solo si hay dominio. Vacía no sirve: borrala.
   - Si `.env` no está en `.gitignore`, agregalo.

### 2. Instalar y arrancar

```bash
npm install
npm run dev -- --port 4321
```

### 3. Contenido demo (lo corre el usuario)

```bash
npx sanity login && npx sanity dataset import sanity/seed.ndjson production
```

Usa la sesión del usuario; no hace falta token. En un proyecto existente es
opcional: también se puede crear la primera página desde el editor.

### 4. Comprobar

- [ ] `/studio` muestra el login de Sanity. Entra el usuario.
- [ ] `/studio#/editor` lista las páginas y el canvas muestra la elegida.
- [ ] La página se ve en el sitio: en `/<slug>`, o en `/` si la home sale del
      editor.
- [ ] `npm run verify` en verde.
  - En un proyecto existente, el chequeo que importa es "Okapi rendered
    a page".
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
  - Funciona en Vercel y
  Netlify sin tocar nada; en Cloudflare Pages, `npm i @astrojs/cloudflare
  wrangler`; en otro hosting el sitio anda igual pero el chat queda
  deshabilitado.
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
   - Si era `.astro`, pasalo a `.tsx`.
3. Registrá el bloque en `src/blocks/meta.ts`, `schemas.ts` y `components.tsx`.
   - Usá `js: true` si corre algo en el navegador: hooks, efectos,
     animaciones, carruseles.
4. Opcional:
   - contenido inicial en `defaults.ts`;
   - texto editable sobre la página en `TEXT_TARGETS`
     (`src/core/editor/CanvasApp.tsx`);
   - soltar imágenes en `IMAGE_FIELDS`.
   - **Excepción:** son las únicas tablas de core que se tocan por proyecto.
     Mencionalo.
5. `npm run verify` falla si un campo no tiene control en el editor.

Reglas completas para bloques, animaciones y estilos: `AGENTS.md`.

## Problemas conocidos

| Síntoma | Arreglo |
|---|---|
| "Connect this studio to your project" | Falta ese origen exacto (puerto o dominio) en CORS, con credenciales |
| Studio o canvas en blanco + `504 (Outdated Optimize Dep)` | Pará el server, `rm -rf node_modules/.vite`, arrancá y recargá con ⌘⇧R. Revisá que `optimizeDeps` esté completo |
| `@vitejs/plugin-react can't detect preamble` | El layout no incluye `<Islands />` |
| Un bloque se ve pero no se anima | Le falta `js` en `meta.ts` |
| La home muestra "Your visual page builder is ready" | Falta `.env` o no hay página `home` en Sanity |
| Publiqué y el sitio no cambió | Falta el webhook al deploy hook, o el build todavía no terminó |
