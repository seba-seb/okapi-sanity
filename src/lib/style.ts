import type { ResponsiveNumber } from "./types";

/** Maps a horizontal-alignment token to a flexbox `align-items` value. */
export function alignItems(token?: string): string {
  switch (token) {
    case "center":
      return "center";
    case "end":
    case "right":
      return "flex-end";
    case "stretch":
      return "stretch";
    default:
      return "flex-start";
  }
}

/** Maps a token to a flexbox `justify-content` value (main axis). */
export function justifyContent(token?: string): string {
  switch (token) {
    case "center":
      return "center";
    case "end":
      return "flex-end";
    case "between":
      return "space-between";
    case "around":
      return "space-around";
    default:
      return "flex-start";
  }
}

/**
 * Normalizes a horizontal-alignment token to a CSS box-alignment keyword
 * (start | center | end | stretch), accepting legacy left/right. Used for the
 * `--alignment` custom property the Section sets, which feeds `align-items`,
 * `justify-content`, and `text-align` alike — so the value must be valid for
 * all three (ruling out left/right, which `align-items` rejects).
 */
export function alignToken(token?: string): "start" | "center" | "end" | "stretch" {
  switch (token) {
    case "center":
      return "center";
    case "end":
    case "right":
      return "end";
    case "stretch":
      return "stretch";
    default:
      return "start"; // "start", legacy "left", or unset
  }
}

/** Maps an alignment token to a `text-align` value. */
export function textAlign(token?: string): "left" | "center" | "right" {
  if (token === "center") return "center";
  if (token === "end" || token === "right") return "right";
  return "left";
}

/**
 * Maps a text-wrap token to a CSS `text-wrap` value. "none" = normal wrapping.
 * Callers pass the per-block default (`c.textWrap ?? "balance" | "pretty"`).
 */
export function wrapStyle(token: string): "balance" | "pretty" | "wrap" {
  if (token === "pretty") return "pretty";
  if (token === "none") return "wrap";
  return "balance";
}

/** Turns a px number into a CSS length, falling back to `undefined`. */
export function px(value?: number): string | undefined {
  return typeof value === "number" ? `${value}px` : undefined;
}

/**
 * Maps a spacing-scale token ("none" | "xs" … "3xl") to a CSS length. "none" is
 * 0; every other token reads the `--space-*` custom property. A legacy numeric
 * value (from the old px sliders) still renders as `px` so existing content
 * keeps its spacing until it's re-picked.
 */
export function spaceVar(value?: string | number): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return `${value}px`;
  if (value === "none") return "0";
  return `var(--space-${value})`;
}

/** Turns a ch number into a CSS length, falling back to `undefined`. */
export function ch(value?: number): string | undefined {
  return typeof value === "number" ? `${value}ch` : undefined;
}

/** Turns a rem number into a CSS length, falling back to `undefined`. */
export function rem(value?: number): string | undefined {
  return typeof value === "number" ? `${value}rem` : undefined;
}

/** Spreads a ResponsiveNumber into CSS custom properties. */
export function responsiveVars(
  prefix: string,
  value: ResponsiveNumber | undefined,
  fallback: { mobile: number; tablet: number; desktop: number },
): Record<string, string> {
  return {
    [`--${prefix}-mobile`]: String(value?.mobile ?? fallback.mobile),
    [`--${prefix}-tablet`]: String(value?.tablet ?? value?.mobile ?? fallback.tablet),
    [`--${prefix}-desktop`]: String(
      value?.desktop ?? value?.tablet ?? value?.mobile ?? fallback.desktop,
    ),
  };
}
