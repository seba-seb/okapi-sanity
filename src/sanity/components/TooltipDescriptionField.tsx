import type { ReactNode } from "react";
import { FormField, type FieldProps } from "sanity";
import { Box, Flex, Text, Tooltip } from "@sanity/ui";
import { InfoOutlineIcon } from "@sanity/icons";

/**
 * A field wrapper for the compact editing controls (segmented buttons, sliders,
 * dropdowns) that moves the field's `description` out of the paragraph under
 * the label and into a hover tooltip — an info icon beside the title. Keeps
 * Sanity's default validation/presence rendering by reusing `FormField`.
 *
 * Gated in the Studio config to leaf fields that actually have a description;
 * everything else falls through to the default field.
 */
export function TooltipDescriptionField(props: FieldProps) {
  const { title, description } = props;

  // No description to relocate → nothing to do.
  if (!description) return props.renderDefault(props);

  const titleNode = (
    <Flex as="span" align="center" gap={2}>
      {/* Label and icon are both Sanity <Text> at the same size, so they share
          one baseline-corrected line box and `align="center"` lines them up. */}
      <Text as="span" size={1} weight="semibold">
        {title}
      </Text>
      <Tooltip
        content={
          <Box padding={3} style={{ maxWidth: 280 }}>
            <Text size={1}>{description}</Text>
          </Box>
        }
        placement="top"
        fallbackPlacements={["bottom", "right"]}
        portal
      >
        {/* Let <Text> vertically center the icon itself: its `[data-sanity-icon]`
            rule sizes the glyph and applies the cap-height offset. Forcing
            `inline-flex`/`align-items` here (or using a bare <span>) overrides
            that offset, which is what made the icon sit off-center. */}
        <Text as="span" muted size={1} style={{ cursor: "help" }}>
          <InfoOutlineIcon />
        </Text>
      </Tooltip>
    </Flex>
  );

  return (
    <FormField
      // `FormField` merges `HTMLProps`, whose `title` is a plain string, so TS
      // narrows the prop to `string`; it renders `title` as a ReactNode at
      // runtime, so pass our node through. `description` is omitted on purpose —
      // it now lives in the tooltip beside the title.
      title={titleNode as unknown as ReactNode & string}
      inputId={props.inputId}
      validation={props.validation}
      level={props.level}
      path={props.path}
      __unstable_presence={props.presence}
    >
      {props.children}
    </FormField>
  );
}
