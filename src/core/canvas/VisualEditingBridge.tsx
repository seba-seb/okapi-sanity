"use client";

import { VisualEditing } from "@sanity/visual-editing/react";
import { useCallback, useEffect, useMemo, useState } from "react";

const goBack = () => window.history.back();

import { KeyboardReorder } from "@/core/canvas/KeyboardReorder";
import { INSERT_DEFAULTS } from "@/blocks/defaults";

type NavigateUpdate = { type: "push" | "replace" | "pop"; url: string };

/**
 * Renders `@sanity/visual-editing/react`'s VisualEditing DIRECTLY, instead of
 * `@sanity/astro`'s wrapper.
 *
 * Why: `useOptimistic` reads a module-global "actor" set by VisualEditing. When
 * VisualEditing is code-split into a separate chunk, that global is
 * DUPLICATED across chunks, so the actor VisualEditing populates is invisible
 * to `useOptimistic` and per-keystroke updates silently never arrive. Importing
 * both from the same entry, statically, keeps them in one chunk → one actor.
 *
 * The history adapter maps Presentation navigation onto plain page loads
 * (Astro has no client router). Only renders after mount to stay SSR-safe.
 */
export function VisualEditingBridge() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Expose the block insert defaults to the patched `getArrayInsertPatches` in
  // @sanity/visual-editing, which runs in this same preview window and reads
  // them off globalThis. Upstream inserts a bare {_type,_key}; without this a
  // canvas-inserted text block has no text and renders null. See blockDefaults.
  useEffect(() => {
    (
      globalThis as { __sanityInsertDefaults?: typeof INSERT_DEFAULTS }
    ).__sanityInsertDefaults = INSERT_DEFAULTS;
  }, []);

  // Astro has no client router: navigation is a full page load, and the
  // current URL is just `location`. Presentation asks us to push/replace/pop.
  const history = useMemo(
    () => ({
      subscribe: (navigate: (update: NavigateUpdate) => void) => {
        navigate({ type: "push", url: location.pathname + location.search });
        return () => {};
      },
      update: (update: NavigateUpdate) => {
        if (update.type === "pop") goBack();
        else if (update.type === "replace") location.replace(update.url);
        else location.assign(update.url);
      },
    }),
    [],
  );

  const handleRefresh = useCallback(
    (payload: { source: "manual" | "mutation" }) => {
      if (payload.source === "manual") {
        location.reload();
        return new Promise<void>(() => {});
      }
      // "mutation": the live query stream + optimistic layer already applied
      // it — skip the reload so the preview doesn't flash after each save.
      return false as const;
    },
    [],
  );

  if (!mounted) return null;

  return (
    <>
      <VisualEditing
        history={history as never}
        portal
        refresh={handleRefresh as never}
      />
      {/* Shift+Arrow reordering — shares VisualEditing's optimistic actor by
          being imported from the same static entry (see note above). */}
      <KeyboardReorder />
    </>
  );
}
