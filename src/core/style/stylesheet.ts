import { BREAKPOINTS, WIDTHS, color, radius, space } from "./tokens";

/** One breakpoint's worth of style choices (all optional). */
export type StyleProps = {
  marginTop?: string;
  marginBottom?: string;
  padding?: string;
  background?: string;
  color?: string;
  radius?: string;
  maxWidth?: keyof typeof WIDTHS;
  textAlign?: string;
  hide?: boolean;
};
export type BlockStyle = { base?: StyleProps; tablet?: StyleProps; mobile?: StyleProps };

function declarations(p: StyleProps | undefined): string {
  if (!p) return "";
  const d: string[] = [];
  if (p.marginTop) d.push(`margin-top:${space(p.marginTop)}`);
  if (p.marginBottom) d.push(`margin-bottom:${space(p.marginBottom)}`);
  if (p.padding) d.push(`padding:${space(p.padding)}`);
  if (p.background) d.push(`background:${color(p.background)}`);
  if (p.color) d.push(`color:${color(p.color)}`);
  if (p.radius) d.push(`border-radius:${radius(p.radius)}`);
  if (p.maxWidth && p.maxWidth in WIDTHS) d.push(`max-width:${WIDTHS[p.maxWidth]}`);
  if (p.textAlign) d.push(`text-align:${p.textAlign}`);
  if (p.hide) d.push("display:none");
  // !important: the Style panel is authoritative over a block's own defaults
  // (inline styles, the container's margin reset) — that's what it's for.
  return d.map((x) => `${x}!important`).join(";");
}

/** Every block in a document that carries a `design` object, keyed by _key. */
export function collectStyles(root: unknown, out: [string, BlockStyle][] = []): [string, BlockStyle][] {
  if (Array.isArray(root)) root.forEach((x) => collectStyles(x, out));
  else if (root && typeof root === "object") {
    const o = root as { _key?: string; design?: BlockStyle };
    if (o._key && o.design) out.push([o._key, o.design]);
    for (const [k, v] of Object.entries(root)) if (k !== "design" && v && typeof v === "object") collectStyles(v, out);
  }
  return out;
}

/** CSS for a page: one rule per styled block, desktop-first breakpoint overrides. */
export function stylesheet(root: unknown): string {
  const rules: Record<keyof typeof BREAKPOINTS, string[]> = { base: [], tablet: [], mobile: [] };
  for (const [key, style] of collectStyles(root)) {
    // Doubled attribute = specificity (0,2,0): beats `.ok-section__container > *`.
    const sel = `[data-b="${key.replace(/"/g, "")}"][data-b]`;
    for (const bp of Object.keys(BREAKPOINTS) as (keyof typeof BREAKPOINTS)[]) {
      const decl = declarations(style[bp]);
      if (decl) rules[bp].push(`${sel}{${decl}}`);
    }
  }
  return (Object.keys(BREAKPOINTS) as (keyof typeof BREAKPOINTS)[])
    .filter((bp) => rules[bp].length)
    .map((bp) => (BREAKPOINTS[bp] ? `@media ${BREAKPOINTS[bp]}{${rules[bp].join("")}}` : rules[bp].join("")))
    .join("");
}
