/**
 * Selects a canvas element by its `_key`.
 *
 * An optimistic mutation takes a frame or two to paint, so we poll for the
 * element (matching the tail of its `data-sanity-path`), then replay a
 * hover→click on it — the same gesture a manual click makes. That shows Sanity's
 * overlay ring and points every selection tracker (shortcuts, reorder, the
 * insert palette) at the element. DOM-only; imported by preview client
 * components.
 *
 * The synthetic hover pushes the element onto the overlay controller's internal
 * hover stack (its `mouseenter` handler does `hoverStack.push`), but because the
 * real cursor never entered the element, the browser never fires the matching
 * `mouseleave`. Left as-is that phantom entry stays pinned to the top of the
 * stack, so `getHoveredElement()` keeps returning the freshly-inserted block and
 * hovering its parent no longer shows the parent outline. We fire a matching
 * `mouseleave` right after the click to pop it back off — selection is tracked
 * separately from hover (it rides `element/click`), so the block stays selected.
 */
export function selectElementByKey(key: string): void {
  const suffix = `[_key=="${key}"]`;
  let tries = 0;

  const tick = () => {
    const el = Array.from(
      document.querySelectorAll<HTMLElement>("[data-sanity-path]"),
    ).find((n) => n.getAttribute("data-sanity-path")?.endsWith(suffix));

    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const rect = el.getBoundingClientRect();
      const base: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + Math.min(rect.width / 2, 40),
        clientY: rect.top + Math.min(rect.height / 2, 20),
      };
      // Prime Sanity's hover state, then click — its overlay only selects the
      // element it considers hovered.
      el.dispatchEvent(new MouseEvent("mouseover", base));
      el.dispatchEvent(new MouseEvent("mouseenter", { ...base, bubbles: false }));
      el.dispatchEvent(new MouseEvent("mousemove", base));
      el.dispatchEvent(new MouseEvent("mousedown", base));
      el.dispatchEvent(new MouseEvent("mouseup", base));
      el.dispatchEvent(new MouseEvent("click", base));
      // Pop the phantom hover the events above pushed onto the overlay's hover
      // stack (see the note above), so hovering the parent works afterwards.
      // The click has already registered the selection at this point.
      el.dispatchEvent(new MouseEvent("mouseleave", base));
      return;
    }
    if (tries++ < 40) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}
