"use client";

import { useEffect } from "react";

import { PREVIEW_CHANNEL, type PreviewMessage } from "@/lib/previewBridge";
import { applyPreview } from "@/lib/previewOverrides";

/**
 * Listens for hover-preview messages from the Studio's `PreviewSelect` input
 * and applies them to the live page, reverting when the hover ends. Renders
 * nothing; only mounted inside the Presentation preview (draft mode).
 */
export function PreviewBridge() {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(PREVIEW_CHANNEL);
    let revert: (() => void) | null = null;

    const clear = () => {
      if (revert) {
        try {
          revert();
        } catch {
          // element already gone (e.g. live update re-rendered it) — ignore
        }
        revert = null;
      }
    };

    channel.onmessage = (event: MessageEvent<PreviewMessage>) => {
      const msg = event.data;
      if (!msg) return;

      // Always drop the previous preview first.
      clear();
      if (msg.type !== "preview") return;

      const el = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sanity-path]"),
      ).find((node) => node.getAttribute("data-sanity-path") === msg.path);
      if (!el) return;

      revert = applyPreview(el, msg.blockType, msg.field, msg.value);
    };

    return () => {
      clear();
      channel.close();
    };
  }, []);

  return null;
}
