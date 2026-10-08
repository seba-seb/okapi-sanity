---
name: remarkable-astro
description: >
  Arranca un sitio de cliente nuevo desde el starter Remarkable (Astro 7 +
  Sanity 6 + Remarkable Editor) y lo deja andando de punta a punta: repo,
  proyecto de Sanity, CORS, contenido demo, tokens, roles, hosting estático,
  publicar → rebuild y verify. Usar cuando se pida "nuevo proyecto con
  Remarkable", "arrancar un cliente con el starter", "instalar Remarkable",
  o al trabajar en un proyecto que ya tiene `src/core/editor/` (para respetar
  sus reglas). NO usar para agregar Sanity a un Astro que no viene del starter
  (eso es astro-sanity-setup).
---

# Remarkable — proyecto nuevo

Remarkable es nuestro starter para sitios de clientes:
- **Sitio público**: Astro 7 estático. Es HTML puro; solo se hidratan las
  secciones con motion.
- **Remarkable Editor**: nuestro editor visual, una pestaña del Studio de
  Sanity en `/studio#/editor`.
- **Sanity 6**: la base de datos. Aporta login, roles, borradores, historial e
  imágenes.

Repo: `https://github.com/seba-seb/Remarkable-Astro` (privado). Documentación
completa: `docs/index.html` del repo. Reglas para trabajar en el código:
`CLAUDE.md` del repo, que es la fuente de verdad. Si algo de acá la contradice,
gana `CLAUDE.md`.

## Reglas que no se negocian

1. **Nunca un token en el chat ni en un archivo commiteado.**
   - El único lugar para un token es `.env`, que está en `.gitignore`.
   - Si un paso necesita permisos de escritura, el usuario lo corre en **su**
     terminal con **su** login (`npx sanity login`). No crees tokens de
     escritura.
   - Nunca te loguees con las credenciales del usuario.
2. **`src/core/` no se modifica por proyecto.**
   - Un arreglo en core va primero al starter y después se copia a los
     proyectos.
   - Lo de cada proyecto vive en `src/theme/`, `src/chrome/` y `src/blocks/`.
3. **`sanity` queda fijo en `6.3.0`.** `patches/` solo encaja con esa versión.
   - No lo actualices como parte de otra tarea.
   - `npm install` y `npm run verify` fallan solos si la versión se desvía.
4. **Cada bloque que corre JS en el navegador declara `js` en `src/blocks/meta.ts`.**
   - Aplica a hooks, efectos, GSAP, sliders y WebGL.
   - Si no lo declara, en el sitio público se ve pero no se mueve.
5. **Terminás con `npm run verify` en verde.** No se da nada por terminado sin eso.

## Paso 0 — Datos mínimos

Preguntá en una sola tanda, con AskUserQuestion, solo lo que no puedas deducir:
- **Nombre del proyecto**: carpeta y repo, en kebab-case.
- **Organización de Sanity del cliente**:
  - listá las organizaciones con el MCP `list_organizations`;
  - por defecto, la de la agencia.
- **Hosting**: Vercel, Netlify, Cloudflare Pages u otro estático. Se puede
  decidir al final.
- **Dominio final**, si ya existe.

Requisitos de la máquina:
- `node -v` ≥ 22.
- `gh auth status` con acceso al repo privado.
- El MCP de Sanity conectado. Si falta, pedile al usuario que lo conecte.

## Paso 1 — Repo

```bash
gh repo clone seba-seb/Remarkable-Astro <proyecto> -- --depth 1 --branch main
cd <proyecto> && rm -rf .git && git init -q && git add -A && git commit -qm "Start from Remarkable starter"
npm install   # aplica patches/; si falla, NO sigas: la versión de sanity no es 6.3.0
```

- Usá `main` salvo que el usuario indique otro branch o tag del starter.
- Creá el repo del cliente si lo pide:
  `gh repo create <org>/<proyecto> --private --source . --push`.

## Paso 2 — Sanity

Con el MCP de Sanity:
1. `create_project`, con el nombre del cliente y la `organizationId` del paso 0.
2. Asegurá un dataset `production`. Usá `list_datasets` y, si no existe,
   `create_dataset`. Hacelo **público**: el sitio lee en el build sin token.
   - Si el cliente exige un dataset privado, va con un token *Viewer* en
     `SANITY_API_READ_TOKEN`.
   - Ese token lo crea y lo pega el usuario en su `.env`. Vos nunca lo ves.
3. `add_cors_origin` con `http://localhost:4321` y `allowCredentials: true`.
   - Sin esto, `/studio` muestra "Connect this studio to your project".
4. Armá `.env` desde `.env.example`:
   - `PUBLIC_SANITY_PROJECT_ID=<id>`
   - `PUBLIC_SANITY_DATASET=production`
   - `PUBLIC_SANITY_API_VERSION` como está.
   - `PUBLIC_SITE_URL` solo si ya hay dominio. Si no, borrá la línea; vacía no
     sirve.

## Paso 3 — Contenido demo (lo corre el usuario)

Pasale este comando para su terminal. Usa su login, así que no hace falta token:

```bash
npx sanity login && npx sanity dataset import sanity/seed.ndjson production
```

Eso crea la página `home` con los bloques base y los tres temas.

**Opcional**: las páginas de estrés de motion (`/lab-noir`, `/lab-kinetic`,
`/lab-stack`) salen de `scripts/seed-lab.mjs`.
- Necesitan `SANITY_WRITE_TOKEN` en la terminal del usuario.
- Después el usuario revoca ese token en sanity.io/manage.
- Solo sirven para probar motion; no van en el sitio del cliente.

## Paso 4 — Primer arranque

```bash
npm run dev    # http://localhost:4321
```

Usá `preview_start` si existe `.claude/launch.json`. Si no, crealo con
`npm run dev -- --port 4321`.

Comprobá:
- [ ] `/` muestra la home del seed. Si aparece la pantalla de bienvenida
      ("Your visual page builder is ready"), falta `.env` o el import.
- [ ] `/studio` muestra el login de Sanity. El usuario entra; vos no.
- [ ] `/studio#/editor`: el usuario elige "Home" y ve el canvas con la página.

Si algo falla, mirá la tabla de problemas conocidos al final.

## Paso 5 — Hacerlo del cliente

En este orden:
1. **Tokens**: `src/theme/tokens.css`.
   - Colores por tema (`light`, `dark`, `brand`), radios, escala tipográfica,
     espaciado y `--maxw-page`.
   - Un color nuevo va en tokens.css y además en el mapa `@theme inline` de
     `globals.css`. No hay paleta default de Tailwind, a propósito.
2. **Tipografía**: el `@font-face` o Google Fonts va en `Base.astro`, y
   `--font-sans` en tokens.
3. **Header y footer**: `src/chrome/`. Restyleá o reemplazá.
4. **Bloques**:
   - Borrá los que el proyecto no use. Hay que borrar la carpeta, la entrada
     en `meta.ts`, las entradas en `schemas.ts` y `components.tsx`, y los
     `accepts` que lo nombren. El compilador te marca lo que falta.
   - Agregá los propios con "Agregar un bloque" en `CLAUDE.md`. El orden es
     schema + componente → `meta.ts` (con `js` si hace falta) → `schemas.ts`
     → `components.tsx` → `defaults.ts`.
   - Para que el texto se edite sobre la página, agregá el bloque a
     `TEXT_TARGETS` en `CanvasApp.tsx`; para soltar imágenes, a `IMAGE_FIELDS`.
5. **Settings y Navigation**: son singletons en el Studio. Ahí van nombre del
   sitio, descripción SEO, imagen OG, redes y menús.
6. Si el cliente no necesita los bloques de motion, borrarlos ahorra los
   ~138 KB de JS. Sin bloques con `js`, el sitio sale casi sin JS.

Reglas de código que más se rompen (detalle en `CLAUDE.md`):
- **Estilos**: utilities de Tailwind construidas con los tokens (`bg-surface`,
  `text-fg`, `gap-md`, `rounded-main`). No uses colores literales.
- **Animaciones**:
  - Van dentro del componente React (`useGSAP` con `scope`), nunca en un
    `<script>` de Astro.
  - GSAP se importa siempre de `@/core/motion/gsap`.
  - Se pinea un elemento interno, nunca el que lleva `data-sanity-path`.
- **Datos**:
  - Los bloques reciben todo por props; nunca hacen fetch.
  - Llevan `{...editable(...)}` en su raíz.
- **Links**: todos pasan por `resolveLink()` y `pageHref()`. Los internos son
  referencias, no paths escritos a mano.

## Paso 6 — Roles

- **Equipo** = rol `administrator` en Sanity. Ve estilos, estructura y
  componentes.
- **Cliente** = invitalo con `npx sanity users invite <email> --role editor`
  (publica solo) o `--role contributor` (solo borradores; publica alguien del
  equipo).
  - El editor le muestra la vista de cliente: campos de contenido y reordenar.
  - Los roles disponibles dependen del plan de Sanity. Probá con un usuario
    real antes de entregar.

## Paso 7 — Hosting y publicación

El sitio es **100% estático** (`dist/`). En el host:
- **Build**: `npm run build`. **Output**: `dist`. **Node**: 22.
- **Variables**: `PUBLIC_SANITY_PROJECT_ID`, `PUBLIC_SANITY_DATASET`,
  `PUBLIC_SANITY_API_VERSION`, y `PUBLIC_SITE_URL` con el dominio final.
  - Vercel, Netlify y Cloudflare toman la URL del deploy si falta.
  - `SANITY_API_READ_TOKEN` solo va si el dataset es privado.
- **CORS del dominio**: `add_cors_origin` con `https://<dominio>` y
  `allowCredentials: true`. Repetilo para cada dominio de preview donde se
  vaya a abrir `/studio`.
- **Publicar = rebuild**: publicar en el editor no cambia el sitio hasta el
  próximo build. Hay que conectarlos:
  1. Creá el *deploy hook* en el host y copiá la URL.
  2. En sanity.io/manage → API → Webhooks, creá un webhook *on publish* con
     filtro `_type in ["page","settings","navigation","component"]`,
     apuntando a esa URL.
  - Esto lo hace el usuario en los paneles. Vos le pasás los valores exactos.

## Paso 8 — Cierre

```bash
npm run verify                      # unit checks + build + presupuesto de JS
npm run verify -- https://<dominio> # después del deploy: / , /studio , /edit-canvas
```

Pedile al usuario el **smoke test logueado** de `CLAUDE.md` (sección
"Editor smoke test"): guardar, formato, capas, imagen, componentes, publicar
y rol cliente. Vos no podés probar esos flujos porque requieren su login.

Reportá en una lista corta: URL local, ID del proyecto de Sanity, qué quedó
hecho, qué le toca al usuario (import, webhook, invitaciones, smoke test) y el
resultado de verify.

## Problemas conocidos

| Síntoma | Causa | Arreglo |
|---|---|---|
| `/studio` → "Connect this studio to your project" | El origen (puerto o dominio) no está en CORS | `add_cors_origin` con ese origen exacto y credenciales. En local es **4321**: otro puerto requiere su propio CORS |
| Studio o canvas en blanco + `504 (Outdated Optimize Dep)` | Vite re-optimizó dependencias con la pestaña abierta | Pará el server, `rm -rf node_modules/.vite`, `npm run dev`, ⌘⇧R. Las dependencias nuevas de cliente van en `vite.optimizeDeps.include` |
| Studio en blanco justo después del login | Pestaña vieja pidiendo chunks de un server o deploy anterior | `staleChunkReload` recarga una vez sola. Si persiste, ⌘⇧R |
| Studio en blanco solo en Brave | Shields | Ya está resuelto con `basePath: "/"` y hash routing. Si vuelve, bajá Shields para localhost |
| Home muestra la pantalla de bienvenida | Falta `.env` o el import | Pasos 2 y 3 |
| Un bloque se ve pero no se anima en el sitio | Le falta `js` en `meta.ts` | Agregalo |
| `npm install` falla en patch-package | `sanity` ≠ 6.3.0 | Volvé a 6.3.0 (`overrides` en package.json). Actualizar Sanity es un trabajo aparte: rehacer `patches/` según su README |
| `@vitejs/plugin-react can't detect preamble` en dev | Falta el preámbulo de React en `Base.astro` | Ya está en el starter. No lo borres |
| Cambié `.env` y "no pasa nada" | El dev server se reinicia solo y la pestaña quedó vieja | Recargá |
