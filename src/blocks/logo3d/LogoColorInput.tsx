import { useCallback } from "react";
import { set, type StringInputProps } from "sanity";
import { Card, Flex, Text } from "@sanity/ui";

/**
 * Segmented control for the 3D Logo's color: Primary / Secondary, each with a
 * swatch (purple / white) so the choice reads at a glance. The rendered color is
 * theme-driven (see `Logo3d`); these swatches just label the two options.
 */
const OPTIONS = [
  { value: "primary", title: "Primary", swatch: "#6d5dfc" },
  { value: "secondary", title: "Secondary", swatch: "#ffffff" },
];

export function LogoColorInput(props: StringInputProps) {
  const { onChange, value, readOnly } = props;
  const write = useCallback((v: string) => onChange(set(v)), [onChange]);

  if (readOnly) return props.renderDefault(props);
  const current = value ?? "primary";

  return (
    <Flex gap={2} wrap="wrap">
      {OPTIONS.map((o) => {
        const selected = current === o.value;
        return (
          <Card
            key={o.value}
            as="button"
            type="button"
            onClick={() => write(o.value)}
            padding={2}
            radius={2}
            border
            tone={selected ? "primary" : "default"}
            style={{ cursor: "pointer" }}
          >
            <Flex align="center" gap={2}>
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: o.swatch,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)",
                  flex: "none",
                }}
              />
              <Text size={1} weight={selected ? "semibold" : "regular"}>
                {o.title}
              </Text>
            </Flex>
          </Card>
        );
      })}
    </Flex>
  );
}
