"use client";

import { useRef } from "react";
import { useOptimistic, usePresentationQuery } from "@sanity/visual-editing/react";

import { keyed } from "@/sanity/dataAttr";
import { dedupeByKey } from "@/lib/dedupe";
import type { Page } from "@/lib/types";

import { Section } from "./Section";

/** Normalizes a Sanity id: strips `drafts.` and `versions.<release>.` prefixes. */
function baseIdOf(id: string | undefined): string {
  return (id ?? "").replace(/^drafts\./, "").replace(/^versions\.[^.]+\./, "");
}

export function PageBuilder({
  page,
  query,
  params,
}: {
  page: Page;
  query: string;
  params: Record<string, unknown>;
}) {
  const baseId = baseIdOf(page._id);

  // 1) Live query results from the Studio — reflects form edits (typing) as they
  //    happen, streamed over postMessage. Null on the published site.
  //    `stega: false` on purpose: stega-encoded text makes visual-editing draw a
  //    separate click-to-edit overlay box around every heading / paragraph /
  //    label, nested inside the block. We don't want those — each block already
  //    has its own overlay via `editable()`. Text still updates live through this
  //    query stream (+ `useOptimistic` below), just without the per-word boxes.
  const live = usePresentationQuery({ query, params, stega: false });

  // Keep the last non-null live result so a transient null doesn't flash the
  // stale server `page` mid-edit.
  const lastLive = useRef<Page | null>(null);
  if (live.data) lastLive.current = live.data as Page;
  const base = (lastLive.current ?? page) as Page;

  // 2) Optimistic layer — preview-initiated mutations (Insert / Duplicate /
  //    Remove / Move from the overlay context menu) are applied locally the
  //    instant they happen, instead of waiting for the Content Lake round-trip.
  const data = useOptimistic<Page, Page>(base, (state, action) => {
    const matches =
      baseIdOf(action.id) === baseId || baseIdOf(action.originalId) === baseId;
    if (matches && action.document) {
      return action.document as Page;
    }
    return state;
  });

  const ctx = { documentId: baseId, documentType: "page" };
  const sections = data?.sections;

  if (!sections?.length) return null;

  return (
    <main>
      {dedupeByKey(sections).map((section) => (
        <Section
          key={section._key}
          section={section}
          path={keyed("sections", section._key)}
          ctx={ctx}
        />
      ))}
    </main>
  );
}
