import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { set, unset, type NumberInputProps } from "sanity";
import { Box, Button, Card, Flex, Text } from "@sanity/ui";

import {
  RESIZE_CHANNEL,
  groqPath,
  type ResizeMessage,
} from "@/lib/previewBridge";

type SliderOptions = {
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  /** When true, an empty value is allowed and shown as "Full / Auto". */
  allowUnset?: boolean;
  unsetLabel?: string;
};

/**
 * A drag-to-adjust range slider for number fields.
 * Reads `min`, `max`, `step`, `suffix` from the field's `options`.
 *
 * For the `maxWidth` field it stays in sync with the **on-canvas resize handle**
 * in BOTH directions: dragging this slider previews live on the canvas, and
 * dragging the handle on the canvas moves this slider live. Either way the draft
 * is written only on release — Sanity throttles rapid patches, so writing every
 * frame would make the other side lag until you let go.
 */
export function RangeSliderInput(props: NumberInputProps) {
  const { onChange, value, schemaType, elementProps, path } = props;
  const options = (schemaType.options ?? {}) as SliderOptions;

  const min = options.min ?? 0;
  const max = options.max ?? 100;
  const step = options.step ?? 1;
  const suffix = options.suffix ?? "";
  const allowUnset = options.allowUnset ?? false;
  const unsetLabel = options.unsetLabel ?? "Auto";

  // Live canvas sync only applies to the resizable `maxWidth` field, which the
  // front-end knows how to render (`el.style.maxWidth`).
  const isLive = schemaType.name === "maxWidth";
  const blockPath = useMemo(() => groqPath(path.slice(0, -1)), [path]);

  // While dragging (here OR on the canvas), `dragValue` drives the thumb +
  // readout without writing the draft each frame. `undefined` = no active drag
  // (show the committed `value`); a number = live width; `null` = live "Auto".
  const [dragValue, setDragValue] = useState<number | null | undefined>(
    undefined,
  );
  const dragValueRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    // The release commit (or any external edit) lands in `value` and hands
    // control back to Sanity.
    setDragValue(undefined);
    dragValueRef.current = undefined;
  }, [value]);

  const channelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (!isLive || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(RESIZE_CHANNEL);
    channelRef.current = channel;
    // The on-canvas handle broadcasts `preview` while it drags — mirror those
    // onto the thumb + readout so this slider tracks the canvas in real time. (A
    // channel never receives its own posts, so `broadcast` below can't echo back
    // into here.) On release the canvas sends `commit`, the Studio patches the
    // draft, `value` updates, and the effect above clears `dragValue`.
    channel.onmessage = (event: MessageEvent<ResizeMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== "preview") return;
      if (msg.field !== schemaType.name || msg.path !== blockPath) return;
      dragValueRef.current = msg.value;
      setDragValue(msg.value);
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [isLive, blockPath, schemaType.name]);

  const broadcast = useCallback(
    (next: number | null) => {
      channelRef.current?.postMessage({
        type: "preview",
        path: blockPath,
        field: schemaType.name,
        value: next,
      } satisfies ResizeMessage);
    },
    [blockPath, schemaType.name],
  );

  const hasValue = typeof value === "number";
  // The number the control is currently showing (a live drag preview wins).
  const activeNumber =
    dragValue !== undefined ? dragValue : hasValue ? value : null;
  const thumbValue = activeNumber ?? max;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.currentTarget.value);
      if (Number.isNaN(next)) {
        onChange(unset());
        return;
      }
      if (isLive) {
        // Preview only — the draft is written on release (see `commit`).
        dragValueRef.current = next;
        setDragValue(next);
        broadcast(next);
      } else {
        onChange(set(next));
      }
    },
    [isLive, broadcast, onChange],
  );

  const commit = useCallback(() => {
    if (!isLive) return;
    const next = dragValueRef.current;
    if (typeof next === "number") onChange(set(next));
  }, [isLive, onChange]);

  // Write the draft when the drag ends. A one-shot `window` pointerup fires on
  // release wherever the pointer is (the thumb can slip off mid-drag, so an
  // input-level `pointerup` is unreliable); `keyUp` covers keyboard steps.
  const onPointerDown = useCallback(() => {
    if (!isLive) return;
    const onUp = () => {
      window.removeEventListener("pointerup", onUp);
      commit();
    };
    window.addEventListener("pointerup", onUp);
  }, [isLive, commit]);

  const handleReset = useCallback(() => {
    if (isLive) {
      dragValueRef.current = undefined;
      setDragValue(undefined);
      broadcast(null);
    }
    onChange(unset());
  }, [isLive, broadcast, onChange]);

  return (
    <Card padding={3} radius={2} border tone="transparent">
      <Flex align="center" justify="space-between" gap={3}>
        <Text size={1} weight="semibold" muted>
          {activeNumber !== null ? (
            <>
              {activeNumber}
              {suffix}
            </>
          ) : (
            unsetLabel
          )}
        </Text>
        {allowUnset && activeNumber !== null ? (
          <Button
            mode="bleed"
            fontSize={1}
            padding={2}
            text={unsetLabel}
            onClick={handleReset}
          />
        ) : null}
      </Flex>
      <Box marginTop={3}>
        <input
          {...(elementProps as React.InputHTMLAttributes<HTMLInputElement>)}
          type="range"
          min={min}
          max={max}
          step={step}
          value={thumbValue}
          onChange={handleChange}
          onPointerDown={onPointerDown}
          onKeyUp={commit}
          style={{ width: "100%", accentColor: "var(--card-focus-ring-color)" }}
        />
        <Flex justify="space-between" marginTop={1}>
          <Text size={0} muted>
            {min}
            {suffix}
          </Text>
          <Text size={0} muted>
            {max}
            {suffix}
          </Text>
        </Flex>
      </Box>
    </Card>
  );
}
