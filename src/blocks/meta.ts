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
};

export const BLOCKS = {
  section: { title: "Section", slot: { field: "content" }, topLevel: true },
  componentRef: { title: "Component", topLevel: true },
  eyebrow: { title: "Eyebrow", margin: true },
  heading: { title: "Heading", margin: true },
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
  slider: { title: "Slider", slot: { field: "slides", accepts: ["card", "imageBlock"] } },
  grid: {
    title: "Grid",
    slot: { field: "items", accepts: ["card", "contentWrapper", "imageBlock", "logo3d"] },
  },
  logo3d: { title: "3D Logo" },
  box: { title: "Box", slot: { field: "items" } },
  // Creative / motion blocks
  horizontalScroll: {
    title: "Horizontal Scroll",
    slot: { field: "items", accepts: ["card", "imageBlock", "contentWrapper"] },
  },
  stackCards: { title: "Stacked Cards", slot: { field: "items", accepts: ["card"] } },
  marquee: { title: "Marquee" },
  textScrub: { title: "Scroll Text" },
  bigType: { title: "Big Type" },
  parallaxMedia: { title: "Parallax Media" },
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
