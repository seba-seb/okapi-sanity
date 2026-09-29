import { useCallback } from "react";
import { set, setIfMissing, unset, type ObjectInputProps } from "sanity";
import {
  MobileDeviceIcon,
  TabletDeviceIcon,
  DesktopIcon,
} from "@sanity/icons";
import { Box, Card, Flex, Stack, Text } from "@sanity/ui";

type ResponsiveValue = {
  mobile?: number;
  tablet?: number;
  desktop?: number;
};

type ResponsiveOptions = {
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
};

const BREAKPOINTS = [
  { key: "mobile", label: "Mobile", Icon: MobileDeviceIcon },
  { key: "tablet", label: "Tablet", Icon: TabletDeviceIcon },
  { key: "desktop", label: "Desktop", Icon: DesktopIcon },
] as const;

/**
 * A responsive control that renders one drag slider per breakpoint.
 * Reads `min`, `max`, `step`, `suffix` from the field's `options`.
 */
export function ResponsiveNumberInput(props: ObjectInputProps) {
  const { onChange, schemaType } = props;
  const value = props.value as ResponsiveValue | undefined;
  const options = (schemaType.options ?? {}) as ResponsiveOptions;

  const min = options.min ?? 1;
  const max = options.max ?? 6;
  const step = options.step ?? 1;
  const suffix = options.suffix ?? "";

  const handleChange = useCallback(
    (key: string, raw: string) => {
      const next = Number(raw);
      if (Number.isNaN(next)) {
        onChange(unset([key]));
        return;
      }
      onChange([setIfMissing({}), set(next, [key])]);
    },
    [onChange],
  );

  return (
    <Stack space={3}>
      {BREAKPOINTS.map(({ key, label, Icon }) => {
        const current = value?.[key as keyof ResponsiveValue] ?? min;
        return (
          <Card key={key} padding={3} radius={2} border tone="transparent">
            <Flex align="center" gap={3}>
              <Text size={2} muted>
                <Icon />
              </Text>
              <Box flex={1}>
                <Flex align="center" justify="space-between">
                  <Text size={1} weight="semibold" muted>
                    {label}
                  </Text>
                  <Text size={1} weight="semibold">
                    {current}
                    {suffix}
                  </Text>
                </Flex>
                <Box marginTop={2}>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={current}
                    onChange={(e) => handleChange(key, e.currentTarget.value)}
                    style={{
                      width: "100%",
                      accentColor: "var(--card-focus-ring-color)",
                    }}
                  />
                </Box>
              </Box>
            </Flex>
          </Card>
        );
      })}
    </Stack>
  );
}
