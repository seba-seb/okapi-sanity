import { useEffect, useState } from "react";
import { useDocumentOperation } from "sanity";

import { RESIZE_CHANNEL, type ResizeMessage } from "../../lib/previewBridge";

/**
 * Studio-side half of the on-canvas resize handle.
 *
 * The preview can't write to the dataset, so when a drag ends it broadcasts the
 * final value over `RESIZE_CHANNEL`. This listener — mounted globally in the
 * Studio layout — applies it through `useDocumentOperation`, the SAME pipeline
 * the form itself uses. That matters: it makes the open field (the range
 * slider) update optimistically, and it creates the draft on demand. A raw
 * `client.patch` write does neither — it lands in the dataset but the open form
 * keeps showing the stale value.
 */

type Pending = {
  id: string;
  fieldPath: string;
  value: number | null;
  /** Bumped per drag so the committer re-runs even for the same field/value. */
  nonce: number;
};

export function CanvasResizeListener() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(RESIZE_CHANNEL);
    let nonce = 0;
    channel.onmessage = (event: MessageEvent<ResizeMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== "commit") return;
      if (!msg.id || !msg.path) return;
      if (msg.value !== null && typeof msg.value !== "number") return;

      nonce += 1;
      setPending({
        id: msg.id,
        fieldPath: `${msg.path}.${msg.field}`,
        value: msg.value,
        nonce,
      });
    };

    return () => channel.close();
  }, []);

  if (!pending) return null;
  // Keyed by document id so the operations hook stays stable per document.
  return <ResizeCommitter key={pending.id} pending={pending} />;
}

/** Applies one committed resize through the document-operations pipeline. */
function ResizeCommitter({ pending }: { pending: Pending }) {
  // Every page block lives on the one "page" document being previewed.
  const { patch } = useDocumentOperation(pending.id, "page");

  useEffect(() => {
    if (pending.value === null) {
      patch.execute([{ unset: [pending.fieldPath] }]);
    } else {
      patch.execute([{ set: { [pending.fieldPath]: pending.value } }]);
    }
    // Re-run only when a new drag commits (nonce changes) — not when `patch`
    // is recreated on unrelated document-store updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.nonce]);

  return null;
}
