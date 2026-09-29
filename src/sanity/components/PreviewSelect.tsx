import { useCallback, useRef } from "react";
import { set, unset, type StringInputProps } from "sanity";
import { Flex, Button } from "@sanity/ui";

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
 * Hovering (or focusing) an option applies it optimistically via `onChange`, so
 * the live Presentation preview and the highlighted button update instantly —
 * this rides the same draft stream that makes typing show up live, so it works
 * for every field (including ones with no bespoke DOM applier, like a heading's
 * semantic level). Leaving the control without clicking reverts to the value
 * you started on; clicking commits.
 */
export function PreviewSelect(props: StringInputProps) {
  const { onChange, value, schemaType, readOnly } = props;

  const options = normalize((schemaType.options as { list?: unknown })?.list);

  // When the field has no value yet (a new or pre-existing section), show its
  // schema `initialValue` as selected so the effective default is visible —
  // it matches what the front-end renders for an unset value.
  const defaultValue =
    typeof schemaType.initialValue === "string"
      ? schemaType.initialValue
      : undefined;
  const active = value ?? defaultValue;

  // The value to restore if the pointer leaves without a click. Captured on
  // enter (before any preview) and updated on commit.
  const originalRef = useRef<string | undefined>(value);

  const write = useCallback(
    (next: string | undefined) => {
      onChange(typeof next === "string" ? set(next) : unset());
    },
    [onChange],
  );

  // Snapshot the committed value the moment the pointer enters, before any
  // hover has previewed anything.
  const handleEnter = useCallback(() => {
    originalRef.current = value;
  }, [value]);

  // Revert whenever the current (previewed) value differs from what we started
  // on. After a commit, `originalRef` holds the committed value, so a later
  // hover-then-leave correctly snaps back to it instead of sticking.
  const handleLeave = useCallback(() => {
    if (value !== originalRef.current) write(originalRef.current);
  }, [value, write]);

  const handleCommit = useCallback(
    (v: string) => {
      originalRef.current = v;
      write(v);
    },
    [write],
  );

  if (readOnly || options.length === 0) return props.renderDefault(props);

  return (
    <Flex
      gap={1}
      wrap="wrap"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
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
            onMouseEnter={() => write(o.value)}
            onFocus={() => write(o.value)}
            onClick={() => handleCommit(o.value)}
          />
        );
      })}
    </Flex>
  );
}
