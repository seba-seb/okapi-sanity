import type { ArrayOfObjectsInputProps } from "sanity";

/**
 * Custom input for a Button Group's `buttons` array.
 *
 * When a button is added to a group that ALREADY has one, the new button
 * defaults to the "outline" style (the first stays "primary") — the common
 * primary + secondary CTA pattern. Sanity's static `initialValue` can't express
 * this (it has no view of sibling count), so we intercept the add here.
 *
 * We stamp `style: "outline"` onto the item as it's inserted. Sanity resolves an
 * added item as `deepAssign(resolvedInitialValue, insertedItem)` — the inserted
 * item wins — so this survives the button type's own `initialValue` (primary).
 */
export function ButtonsArrayInput(props: ArrayOfObjectsInputProps) {
  const hasButtons = (props.value?.length ?? 0) >= 1;

  const outline = <T,>(item: T): T =>
    hasButtons ? ({ ...item, style: "outline" } as T) : item;

  const onItemAppend: typeof props.onItemAppend = (item) =>
    props.onItemAppend(outline(item));

  const onInsert: typeof props.onInsert = (event) =>
    props.onInsert(hasButtons ? { ...event, items: event.items.map(outline) } : event);

  return props.renderDefault({ ...props, onItemAppend, onInsert });
}
