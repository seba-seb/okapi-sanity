/**
 * The design-token vocabulary the Style panel offers. Values map to the CSS
 * variables in src/theme/tokens.css (`--ok-*`) — a project that renames a token changes
 * it here once. Pure data (no sanity/React): used by the schema AND the
 * stylesheet generator.
 */
export const SPACE = ["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"] as const;
export const COLORS = ["bg", "surface", "surface-2", "fg", "muted", "brand", "brand-contrast", "border"] as const;
export const RADII = ["none", "sm", "md", "lg", "main", "pill"] as const;
export const WIDTHS = { none: "none", prose: "65ch", narrow: "40rem", page: "var(--ok-maxw-page)", full: "100%" } as const;
export const ALIGN = ["left", "center", "right"] as const;

export const BREAKPOINTS = {
  base: null,
  tablet: "(max-width: 1023px)",
  mobile: "(max-width: 767px)",
} as const;

export const space = (v: string) => (v === "none" ? "0" : `var(--ok-space-${v})`);
export const color = (v: string) => `var(--ok-${v})`;
export const radius = (v: string) => (v === "none" ? "0" : `var(--ok-radius-${v})`);
