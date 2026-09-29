import { useCallback } from "react";
import { set, type StringInputProps } from "sanity";
import { Card, Flex, Text } from "@sanity/ui";

import { LOGO3D_PRESETS } from "../../lib/logo3dPresets";

/**
 * Shape picker for the 3D Logo: each preset button shows the actual SVG mark,
 * plus a "Custom" tile for pasted markup. The inline SVGs are forced to
 * `currentColor` so they take the Studio's foreground (and tint on selection).
 */
const ITEMS = [
  ...LOGO3D_PRESETS.map((p) => ({ key: p.key, title: p.title, svg: p.svg })),
  { key: "custom", title: "Custom", svg: null as string | null },
];

export function LogoShapeInput(props: StringInputProps) {
  const { onChange, value, readOnly } = props;
  const write = useCallback((v: string) => onChange(set(v)), [onChange]);

  if (readOnly) return props.renderDefault(props);
  const current = value ?? LOGO3D_PRESETS[0]?.key;

  return (
    <>
      <style>{`.logoShapeThumb svg{width:100%;height:100%;display:block}.logoShapeThumb svg path{fill:currentColor}`}</style>
      <Flex gap={2} wrap="wrap">
        {ITEMS.map((it) => {
          const selected = current === it.key;
          return (
            <Card
              key={it.key}
              as="button"
              type="button"
              onClick={() => write(it.key)}
              padding={2}
              radius={2}
              border
              tone={selected ? "primary" : "default"}
              style={{ cursor: "pointer", width: 78 }}
            >
              <Flex direction="column" align="center" gap={2}>
                <Flex
                  align="center"
                  justify="center"
                  style={{ width: 40, height: 40 }}
                >
                  {it.svg ? (
                    <span
                      className="logoShapeThumb"
                      aria-hidden
                      style={{ width: 34, height: 34, display: "block" }}
                      dangerouslySetInnerHTML={{ __html: it.svg }}
                    />
                  ) : (
                    <Text size={4} muted>
                      +
                    </Text>
                  )}
                </Flex>
                <Text size={0} weight={selected ? "semibold" : "regular"}>
                  {it.title}
                </Text>
              </Flex>
            </Card>
          );
        })}
      </Flex>
    </>
  );
}
