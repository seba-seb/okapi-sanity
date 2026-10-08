# Patches

These are applied automatically on `npm install` via `patch-package` (see the
`postinstall` script in `package.json`).

## `sanity@6.3.0`

**File:** `lib/_chunks-es/index2.js`

### A. Nested Presentation paths — `PostMessageSchema.js` (inert: the Presentation tool was removed; harmless to keep)

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

### E. Overlay icon for blocks in single-type arrays — `PostMessageSchema.js` (inert, same reason)

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
