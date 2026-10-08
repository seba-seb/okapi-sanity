import { set, type StringInputProps } from "sanity";
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
 * A segmented replacement for the default select/radio on enum string fields:
 * every option visible at once, one click to set it.
 */
export function PreviewSelect(props: StringInputProps) {
  const { onChange, value, schemaType, readOnly } = props;
  const options = normalize((schemaType.options as { list?: unknown })?.list);
  // No value yet → show the schema initialValue as selected (what the site renders).
  const defaultValue = typeof schemaType.initialValue === "string" ? schemaType.initialValue : undefined;
  const active = value ?? defaultValue;

  if (readOnly || options.length === 0) return props.renderDefault(props);
  return (
    <Flex gap={1} wrap="wrap">
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
            onClick={() => o.value !== value && onChange(set(o.value))}
          />
        );
      })}
    </Flex>
  );
}
