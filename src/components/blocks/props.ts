import type { Block, RenderContext } from "@/lib/types";

/** Every block component receives its data, its GROQ path, and doc context. */
export type BlockProps<T extends Block = Block> = {
  block: T;
  /** GROQ path to this block, e.g. sections[_key=="a"].content[_key=="b"] */
  path: string;
  ctx: RenderContext;
};
