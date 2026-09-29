import { PortableText, type PortableTextComponents } from "@portabletext/react";

/**
 * Renders a text block's rich-text value (Portable Text) — Bold / Italic and
 * links, plus multiple lines.
 *
 * Each block is rendered as a block-level `<span class="rt-block">` (see
 * globals.css) rather than the default `<p>`, so multiple lines stack while the
 * content stays valid *inside* the parent's semantic `<h*>`/`<p>` and the whole
 * block remains a single draggable overlay target (see clean.ts / RichText's
 * stega-cleaned input).
 */
const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <span className="rt-block">{children}</span>,
  },
  marks: {
    link: ({ value, children }) => {
      const href = (value?.href as string | undefined) || "#";
      const newTab = Boolean(value?.newTab);
      return (
        <a
          href={href}
          {...(newTab
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {children}
        </a>
      );
    },
  },
};

/**
 * Renders rich text. Accepts a legacy plain string too (renders it as-is) so
 * existing content keeps working after the field's type change. The value
 * should already be stega-cleaned by `clean()` so the parent block stays a
 * single draggable target.
 */
export function RichText({ value }: { value: unknown }) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value) || value.length === 0) return null;
  return <PortableText value={value} components={components} />;
}

/** True when a rich-text value (or legacy string) has no visible text. */
export function richTextIsEmpty(value: unknown): boolean {
  if (typeof value === "string") return value.trim() === "";
  if (!Array.isArray(value)) return true;
  return value.every((block) => {
    const b = block as { _type?: string; children?: Array<{ text?: unknown }> };
    if (b?._type !== "block" || !Array.isArray(b.children)) return true;
    return b.children.every(
      (child) => typeof child?.text !== "string" || child.text.trim() === "",
    );
  });
}
