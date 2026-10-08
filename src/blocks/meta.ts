/**
 * THE block registry — the one list of block types in this project.
 *
 * Pure data (no `sanity`, no React) so the public site, the canvas tools and
 * the Studio can all import it without pulling each other into their bundles.
 * `schemas.ts` and `components.tsx` are typed against it: add a type here and
 * the compiler tells you what else is missing.
 *
 * Adding a block: create `src/blocks/<type>/{schema.ts,Component.tsx}`, add
 * an entry below, then register it in `schemas.ts` and `components.tsx`.
 */
export type BlockMeta = {
  /** Shown in the insert menus and on the Presentation overlay chip. */
  title: string;
  /** Array field children nest into. `accepts` omitted = any general block. */
  slot?: { field: string; accepts?: readonly string[] };
  /** Only placed at the page's top level (not offered inside containers). */
  topLevel?: boolean;
  /** Draggable bottom margin on the canvas (BlockMarginResizer). */
  margin?: boolean;
  /**
   * Needs JS in the browser (motion, carousels, WebGL). The public site ships
   * plain HTML and only hydrates the top-level sections holding such a block.
   */
  js?: true | ((block: Record<string, unknown>) => boolean);
};

export const BLOCKS = {
  section: { title: "Section", slot: { field: "content" }, topLevel: true },
  componentRef: { title: "Component", topLevel: true },
  eyebrow: { title: "Eyebrow", margin: true },
  heading: { title: "Heading", margin: true, js: (b) => !!b.animation && b.animation !== "none" },
  paragraph: { title: "Paragraph", margin: true },
  buttonWrapper: { title: "Button Group", slot: { field: "buttons", accepts: ["button"] } },
  button: { title: "Button" },
  imageBlock: { title: "Image" },
  loopingVideo: { title: "Looping Video" },
  contentWrapper: {
    title: "Content",
    slot: { field: "content", accepts: ["eyebrow", "heading", "paragraph", "buttonWrapper"] },
  },
  card: { title: "Card" },
  slider: { title: "Slider", slot: { field: "slides", accepts: ["card", "imageBlock"] }, js: true },
  grid: {
    title: "Grid",
    slot: { field: "items", accepts: ["card", "contentWrapper", "imageBlock", "logo3d"] },
  },
  logo3d: { title: "3D Logo", js: true },
  box: { title: "Box", slot: { field: "items" } },
  // Creative / motion blocks
  horizontalScroll: {
    title: "Horizontal Scroll",
    slot: { field: "items", accepts: ["card", "imageBlock", "contentWrapper"] },
    js: true,
  },
  stackCards: { title: "Stacked Cards", slot: { field: "items", accepts: ["card"] }, js: true },
  marquee: { title: "Marquee", js: true },
  textScrub: { title: "Scroll Text", js: true },
  bigType: { title: "Big Type", js: true },
  parallaxMedia: { title: "Parallax Media", js: true },
} as const satisfies Record<string, BlockMeta>;

export type BlockType = keyof typeof BLOCKS;
/** Everything except top-level-only types (i.e. what a section can hold). */
export type ContentBlockType = Exclude<BlockType, "section" | "componentRef">;

// Compile-time guard: every `accepts` entry must be a registered type.
type Accepted = {
  [K in BlockType]: (typeof BLOCKS)[K] extends { slot: { accepts: readonly (infer A)[] } } ? A : never;
}[BlockType];
const _acceptsAreRegistered: Accepted extends BlockType ? true : never = true;
void _acceptsAreRegistered;

const meta = BLOCKS as Record<string, BlockMeta>;

export const blockTypes = Object.keys(BLOCKS) as BlockType[];

/** Types a container with no `accepts` restriction offers, in registry order. */
export const generalBlockTypes = blockTypes.filter((t) => !meta[t].topLevel) as ContentBlockType[];

/** Block types allowed inside `container`'s slot, or null for a leaf block. */
export function acceptedTypes(container: string): string[] | null {
  const slot = meta[container]?.slot;
  if (!slot) return null;
  return slot.accepts ? [...slot.accepts] : generalBlockTypes;
}

export function blockMeta(type: string | undefined): BlockMeta | undefined {
  return type ? meta[type] : undefined;
}

/** Does anything in this block tree need JS in the browser? (see `BlockMeta.js`) */
export function needsJs(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(needsJs);
  if (!node || typeof node !== "object") return false;
  const b = node as Record<string, unknown>;
  const js = meta[b._type as string]?.js;
  if (js === true || (js && js(b))) return true;
  return Object.values(b).some((v) => typeof v === "object" && needsJs(v));
}
