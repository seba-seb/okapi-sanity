/**
 * The project's Okapi choices (src/okapi.config.json, written by
 * `npm run okapi:setup`). Core features read these flags instead of being
 * removed, so core stays identical in every project.
 */
import raw from "@/okapi.config.json";

type Raw = { features?: { chat?: boolean; components?: boolean } };
const f = (raw as Raw).features ?? {};

export const FEATURES = {
  /** ✦ Chat tab + /api/editor-chat (needs a host that runs functions + an AI key). */
  chat: f.chat !== false,
  /** Reusable library components (`component` documents + `componentRef` instances). */
  components: f.components !== false,
} as const;
