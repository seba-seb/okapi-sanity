import { useCallback, useEffect, useMemo, useRef } from "react";
import { set, useFormValue, type StringInputProps } from "sanity";
import { Flex, Button } from "@sanity/ui";

import { PREVIEW_CHANNEL, toBlockTarget, type PreviewMessage } from "@/core/canvas/channels";

type Option = { title: string; value: string };

function normalize(list: unknown): Option[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    if (item && typeof item === "object") {
      const o = item as { title?: unknown; value?: unknown };
      const value = String(o.value ?? "");
      return { title: String(o.title ?? value), value };
    }
    return { title: String(item), value: String(item) };
  });
}

/**
 * A segmented replacement for the default select/radio on enum string fields.
 *
 * Hovering an option PREVIEWS it — broadcast to the preview's PreviewBridge,
 * which swaps the class/style on the rendered block. Nothing is written: no
 * mutation per hover (that queued a network write for every option the pointer
 * crossed, so the click landed late — or the leave-revert raced it and won).
 * Clicking writes once and sends `commit`, so the preview keeps what it shows.
 * Fields without a DOM applier (see previewOverrides.ts) just don't preview
 * on hover; the click still applies them live.
 */
export function PreviewSelect(props: StringInputProps) {
  const { onChange, value, schemaType, readOnly, path } = props;

  const options = normalize((schemaType.options as { list?: unknown })?.list);

  // When the field has no value yet, show its schema `initialValue` as
  // selected — it matches what the front-end renders for an unset value.
  const defaultValue =
    typeof schemaType.initialValue === "string" ? schemaType.initialValue : undefined;
  const active = value ?? defaultValue;

  const target = useMemo(() => toBlockTarget(path), [path]);
  const parent = useFormValue(path.slice(0, -1)) as { _type?: string } | undefined;
  const blockType = parent?._type;

  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(PREVIEW_CHANNEL);
    channel.current = c;
    return () => {
      c.postMessage({ type: "clear" } satisfies PreviewMessage);
      c.close();
      channel.current = null;
    };
  }, []);
  const post = useCallback((m: PreviewMessage) => channel.current?.postMessage(m), []);

  const preview = useCallback(
    (v: string) => {
      if (!target || !blockType || v === active) post({ type: "clear" });
      else post({ type: "preview", path: target.path, blockType, field: target.field, value: v });
    },
    [target, blockType, active, post],
  );
  const clear = useCallback(() => post({ type: "clear" }), [post]);
  const commit = useCallback(
    (v: string) => {
      post({ type: "commit" });
      if (v !== value) onChange(set(v));
    },
    [post, value, onChange],
  );

  if (readOnly || options.length === 0) return props.renderDefault(props);

  return (
    <Flex gap={1} wrap="wrap" onMouseLeave={clear} onBlur={clear}>
      {options.map((o) => {
        const selected = active === o.value;
        return (
          <Button
            key={o.value}
            mode={selected ? "default" : "ghost"}
            tone={selected ? "primary" : "default"}
            text={o.title}
            fontSize={1}
            padding={2}
            radius={2}
            onMouseEnter={() => preview(o.value)}
            onFocus={() => preview(o.value)}
            onClick={() => commit(o.value)}
          />
        );
      })}
    </Flex>
  );
}
