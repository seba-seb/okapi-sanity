import { useCallback } from "react";
import { set, unset, type NumberInputProps } from "sanity";
import { Box, Button, Card, Flex, Text } from "@sanity/ui";

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

 */
export function RangeSliderInput(props: NumberInputProps) {
  const { onChange, value, schemaType, elementProps } = props;
  const options = (schemaType.options ?? {}) as SliderOptions;

  const min = options.min ?? 0;
  const max = options.max ?? 100;
  const step = options.step ?? 1;
  const suffix = options.suffix ?? "";
  const allowUnset = options.allowUnset ?? false;
  const unsetLabel = options.unsetLabel ?? "Auto";

  const hasValue = typeof value === "number";
  // The number the control is currently showing (a live drag preview wins).
  const activeNumber = hasValue ? value : null;
  const thumbValue = activeNumber ?? max;

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.currentTarget.value);
      onChange(Number.isNaN(next) ? unset() : set(next));
    },
    [onChange],
  );
  const handleReset = useCallback(() => onChange(unset()), [onChange]);

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
