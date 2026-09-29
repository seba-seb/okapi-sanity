import { at, insert as mInsert, set as mSet } from "@sanity/mutate";

import { INSERT_DEFAULTS } from "./blockDefaults";
import { reKey, randomKey, type Slot } from "./editorOps";
import type { Block } from "./types";

/**
 * Shared building blocks for canvas inserts (the ⌘E palette and the on-canvas
 * "+" both use these), so a block created either way gets the same defaults.
 */

/** A fresh block of `type` with its canvas insert defaults and a unique key. */
export function buildBlock(type: string): Block {
  return {
    ...(reKey(INSERT_DEFAULTS[type]?.() ?? {}) as Record<string, unknown>),
    _type: type,
    _key: randomKey(),
  } as Block;
}

/**
 * Slot-specific tweaks applied as a block is inserted — e.g. the 2nd+ button
 * added to a group defaults to "outline" (the first stays "primary").
 */
export function applySlotDefaults(block: Block, slot: Slot, siblings: Block[]): void {
  if (block._type === "button" && slot.field === "buttons" && siblings.length) {
    (block as Record<string, unknown>).style = "outline";
  }
}

/** A patch appending `block` into a container's slot array (seeds it if empty). */
export function appendIntoSlot(slotPath: string, siblings: Block[], block: Block) {
  return siblings.length
    ? at(slotPath, mInsert([block], "after", {
        _key: siblings[siblings.length - 1]._key,
      }))
    : at(slotPath, mSet([block]));
}
