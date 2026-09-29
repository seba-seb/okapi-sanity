# Patches

These are applied automatically on `npm install` via `patch-package` (see the
`postinstall` script in `package.json`).

## `@sanity/visual-editing@5.4.5`

Five unrelated changes:

### 1. Instant Presentation preview — race-condition fix

**File:** `dist/react/index.js` (the `usePresentationQuery` hook)

**Symptom:** In the Presentation tool, edits (typing, etc.) did **not** update
the live preview instantly — the preview only refreshed after the ~1–2s save
round-trip. Oddly, committing one enum field (e.g. a button style) once would
"unlock" instant updates for the rest of the session.

**Root cause:** `usePresentationQuery` subscribes to live query results via a
`loader/query-listen` message, but only sends it once `projectId`, `dataset`,
**and `perspective`** are all set. Its subscription effect depended only on
`[comlink2]`, so it fired the instant the loader comlink connected — which
happens a beat *before* `perspective` is set. It saw `!perspective`, skipped the
subscribe, and then only retried on its 20-second heartbeat. Any event that
re-ran the effect early (a comlink reconnect triggered by committing a field)
made it subscribe with `perspective` finally present → instant from then on.

**Fix:** add `perspective` to that effect's dependency array so it re-subscribes
the moment the perspective arrives:

```diff
- useEffect(t5, t6);            // deps: [comlink2]
+ useEffect(t5, [comlink2, perspective]);
```

**Remove this** once upstream `@sanity/visual-editing` ships a version where the
subscription effect reacts to `perspective`. Track/report upstream if it hasn't
been fixed.

### 2. Overlay labels — show the block's own name

**Files:** `dist/_chunks-es/VisualEditing.js`, `src/ui/ElementOverlay.tsx`

The Presentation hover overlay reads a `data-sanity-title` attribute (stamped by
`editable()` in the front-end) so each block shows its own name ("Heading",
"Card", …) instead of the parent document title.

### 3. Overlay icons — show the block's own icon

**Files:** `dist/_chunks-es/VisualEditing.js`, `src/ui/ElementOverlay.tsx`

**Symptom:** Every block's overlay tag showed the generic document/page icon,
even though the label said "Heading", "Card", etc.

**Root cause:** The overlay resolved its icon from `getType(node)`, and `node`
is encoded (via `editable()`) with the *document* type (`"page"`), whose schema
has no icon — so it fell back to `<DocumentIcon />`.

**Fix:** Resolve the icon from the block's own schema instead. The Studio
serializes each array member's icon onto its `unionOption` (an SVG string via
`renderToString`), and `getField(node).field` resolves to that option for a
block node. So the overlay now prefers `getField(node)?.field?.icon`, falling
back to the document icon and then `<DocumentIcon />`. No front-end change is
needed — it automatically reflects whatever `icon:` each block declares in its
schema.

### 4. Canvas inserts — seed new blocks with their schema defaults

**Files:** `dist/_chunks-es/mutations.js`, `src/util/mutations.ts`

**Symptom:** Inserting a block from the canvas created a bare `{_type, _key}`, so
a new text block arrived with no fields and rendered `null` — invisible on the
canvas.

**Fix:** `getArrayInsertPatches` now seeds the item with the front-end's insert
defaults. The preview publishes a `_type -> () => fields` factory map on
`globalThis.__sanityInsertDefaults` (see `VisualEditingBridge`); the patch calls
the matching factory and deep re-keys nested array items so repeated inserts
never collide on `_key`.

### 5. Overlay drag handle — actually starts a drag

**Files:** `dist/_chunks-es/SharedStateContext.js`, `src/controller.ts`

**Symptom:** Grabbing the drag-handle icon in a block's hover chip and dragging
did nothing. Only dragging the block's body worked — undiscoverable, since the
handle is the visible drag affordance.

**Root cause:** Drag sequences start exclusively in the `mousedown` handler the
controller attaches to the underlying *content element*. The chip (including
its `DragHandleIcon`, class `drag-handle`) renders in the overlay layer — a
different DOM subtree — with **no** pointer handler wired to it, so its
mousedown never reaches the element's listener.

**Fix:** A capture-phase `mousedown` listener on the overlay root forwards
events originating on `.drag-handle` to the currently hovered element (the
hover stack keeps the element on top while the pointer is over its own chip).
The element's existing handler then runs with all its guards (drag-disable
attribute, optimistic actor readiness, array path, sibling drag group), and the
user's real mouse movements drive the rest of the sequence. Sets a
`globalThis.__sanityChipDragPatched` marker so a served bundle can be checked
for the patch. Reported upstream as
[sanity-io/visual-editing#3494](https://github.com/sanity-io/visual-editing/issues/3494)
— remove this patch when that issue is fixed.

## `sanity@6.3.0`

**File:** `lib/_chunks-es/index2.js`

### A. Nested Presentation paths — `PostMessageSchema.js`

Insert `[0]` after **every** `[_key==…]` filter (not just at the end) so nested
GROQ paths resolve; without it nested blocks show "Unknown type" in Presentation.

### B. Portable Text toolbar — don't collapse Bold/Italic/Link into a `…` menu

**Symptom:** In the narrow Presentation form panel, the rich-text toolbar
collapsed **all** actions (Bold / Italic / Link) into a single `…` overflow
menu.

**Root cause:** `InnerToolbar` computes
`collapsed = collapsible && rootElementRect.width < 400`. When `collapsed`, the
whole `ActionMenu` renders as an overflow menu (buttons are removed from the DOM,
so CSS can't help). The panel is < 400px, so everything collapsed.

**Fix:** lower the threshold `< 400` → `< 120`. Above the threshold the toolbar
uses the width-aware `AutoCollapseMenu`, which shows the buttons inline and only
overflows what genuinely doesn't fit — and our three actions always fit. (Our
blocks declare a single `Normal` style, so the block-style `<select>` is already
hidden via `blockStyles.length > 1`.) Global to all PTE toolbars in the Studio;
we only use PT in heading/paragraph.

### C. Portable Text editor — grow to content with a max height

**Symptom:** The editor was a fixed `19em` box that scrolled internally, instead
of sizing to its content.

**Fix:** In the `Root$i` styled component (`data-testid="pt-editor"`,
non-fullscreen): `height: 19em` → `height: auto` and add `max-height: 24em`
(keeps `min-height: 5em`). Then the `EditableCard` gets `flex: 1 1 auto` +
`min-height: 0` (it was `flex: 1` = basis `0%`, which wouldn't grow the parent
with content and wouldn't shrink to scroll). Result: the field grows with its
content from 5em, caps at 24em, then the inner `Scroller` scrolls. Fullscreen
(`height: 100%`) is untouched. Tune `24em` to taste. Global to all PTE editors.

### D. Object form fields — tighter vertical spacing

**Symptom:** Large vertical gaps between fields in a block's form (Text →
Semantic level → Visual size → …).

**Root cause:** `ObjectInput` stacks its fields (a flattened Fragment, so each
field is a direct child) in `RootStack$1` with `space={6}` (~33px gap).

**Fix:** `space: 6` → `space: 4` (~17px). Tune `4` (try `3` for tighter). Global
to every object/document form in the Studio.

### E. Overlay icon for blocks in single-type arrays — `PostMessageSchema.js`

**Symptom:** A block nested in a single-type array — a `button` inside
`buttonWrapper.buttons` (`of: [button]`) — showed the generic document (page)
icon in its Presentation overlay tag, while blocks in the section's `content`
union showed their own icons.

**Root cause:** `createArray` serializes each array member as a `unionOption`
carrying `icon: extractIcon(item)`. For a **union** (multi-type) array it keeps
those. For a **single-type** array it re-wraps `of[0]` as an `arrayItem` but only
copies `name/title/value` — **dropping `icon`**. So `getField(node).field.icon`
is undefined and the overlay falls back to the document icon.

**Fix:** also copy `icon` onto the single-type `arrayItem`. No resolver/overlay
change needed — the overlay already reads `getField(node)?.field?.icon`.
