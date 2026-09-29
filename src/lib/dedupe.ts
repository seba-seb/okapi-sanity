import type { Block } from "./types";

/**
 * Drops array items whose `_key` was already seen.
 *
 * Guards the render against the brief reconciliation window during an optimistic
 * insert (the Duplicate / Paste shortcuts): the freshly-inserted block and its
 * committed echo can both sit in the array for a frame, which makes React warn
 * about duplicate keys and may drop/duplicate a child. Committed data always has
 * unique keys, so on settled state this is a no-op.
 */
export function dedupeByKey<T extends Pick<Block, "_key">>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item?._key;
    if (typeof key !== "string") return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
