"use client";

import { useEffect, useRef } from "react";
import { useDocuments } from "@sanity/visual-editing/react";
import { at, set as mSet } from "@sanity/mutate";

/**
 * Studio-write half of the 3D-logo canvas controls. The controls live in the
 * three.js scene (see `logo3dScene`): the rotation gizmo (rings) and the grain
 * slider. When an edit ends the scene calls the `persist` hook this component
 * publishes on `globalThis` (mounted only in draft mode) with the fields to
 * write (rotationX/Y/Z, grain). We write them through the same optimistic
 * document store the rest of the canvas editing uses, so it sticks and streams
 * back.
 */
export function CanvasLogo3dEditor() {
  const { getDocument } = useDocuments();
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;

  useEffect(() => {
    const persist = (
      docId: string | undefined,
      path: string | undefined,
      fields: Record<string, number>,
    ) => {
      if (!docId || !path) return;
      const patches = Object.entries(fields).map(([field, value]) =>
        at(`${path}.${field}`, mSet(value)),
      );
      if (!patches.length) return;
      try {
        getDocumentRef.current(docId).patch(patches as never);
      } catch {
        // no optimistic actor / transient store error — ignore
      }
    };

    (globalThis as { __logo3dEditor?: { persist: typeof persist } }).__logo3dEditor =
      { persist };

    return () => {
      delete (globalThis as { __logo3dEditor?: unknown }).__logo3dEditor;
    };
  }, []);

  return null;
}
