---
name: okapi-astro
description: >
  Suma Okapi (Sanity como base de datos + el Okapi Editor, nuestro
  editor visual) a un proyecto Astro, nuevo o ya empezado, siguiendo el
  INSTALL.md del repo. Usar cuando se pida "sumá Okapi", "instalá el
  editor", "proyecto nuevo con Okapi", "hacé editable este sitio con
  Okapi", o al trabajar en un proyecto que ya tiene `src/core/editor/`
  (sus reglas están en AGENTS.md). NO usar para integrar Sanity sin el editor
  (eso es astro-sanity-setup).
---

# Okapi

La fuente de verdad es el `INSTALL.md` del repo. Esta skill solo lo trae y lo
sigue, así Claude Code y cualquier otro agente hacen lo mismo.

1. Traé Okapi a una carpeta temporal:
   ```bash
   R="$(mktemp -d)/okapi"
   git clone --depth 1 https://github.com/seba-seb/okapi-sanity "$R"
   ```
   - El branch por defecto es `main`. Si el usuario indica otro branch o tag,
     agregá `--branch <ref>`.
   - Una carpeta temporal nueva cada vez: nunca una copia vieja, y dos
     instalaciones en paralelo no se pisan. Usá el mismo `$R` en toda la guía.
2. Leé `$R/INSTALL.md` completo y seguilo en orden. **Si el proyecto
   ya existe, primero analizalo y mostrá los riesgos** (Paso 0, "Proyecto
   existente"); con algún 🛑 no instalás. **Después, las preguntas del Paso 0** (incluidas las de "Qué instalar"), hacelas todas
   juntas con AskUserQuestion y no instales nada hasta tener las respuestas:
   - **Camino A** si la carpeta actual no tiene `astro.config.*`.
   - **Camino B** si es un proyecto Astro existente.
   - En los dos casos, después van los **pasos comunes**.
3. Para trabajar en el proyecto después de instalar, las reglas están en el
   `AGENTS.md` que la guía deja en el proyecto.

Lo que nunca se hace, aunque la guía no esté a mano:
- **Tokens:** no los pedís, no los mostrás y no los escribís. Lo que requiere
  la cuenta del usuario lo corre el usuario.
- **`src/core/`:** no se modifica por proyecto.
- **Sanity:** versión actual; si el proyecto tiene una más vieja, se sube dentro de la misma mayor, nunca se baja.
- **Archivos del proyecto:** no los pisás. Si una ruta ya existe, frenás y
  preguntás.
- **Publicar:** es salir en vivo. No publicás, despublicás ni importás
  contenido sin un sí explícito.
- **Cierre:** no se da por terminado sin `npm run verify` en verde.
