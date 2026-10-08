/** Per-instance overrides of a component: "<blockKey>.<field>" → value. */
export type Override = { _key?: string; target?: string; text?: string; rich?: unknown[]; image?: unknown };

export const OVERRIDE_MARK = ".__component.";

/** The value an override carries, whichever kind it is. */
export const overrideValue = (o: Override) => o.text ?? o.rich ?? o.image;

/** A copy of `sections` with every override applied to its target block. */
export function applyOverrides<T>(sections: T, overrides: Override[] | undefined): T {
  if (!overrides?.length) return sections;
  const byBlock = new Map<string, Override[]>();
  for (const o of overrides) {
    const [key, field] = (o.target ?? "").split(".");
    if (key && field) byBlock.set(key, [...(byBlock.get(key) ?? []), o]);
  }
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== "object") return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = walk(x);
    for (const o of byBlock.get(out._key as string) ?? []) {
      const value = overrideValue(o);
      if (value !== undefined) out[o.target!.split(".")[1]] = value;
    }
    return out;
  };
  return walk(sections) as T;
}

/** For a path inside an instance: the instance path, and the inner block's key. */
export function splitInstancePath(path: string): { instancePath: string; blockKey: string } | null {
  const i = path.indexOf(OVERRIDE_MARK);
  if (i < 0) return null;
  const keys = [...path.matchAll(/\[_key=="([^"]+)"\]/g)];
  return { instancePath: path.slice(0, i), blockKey: keys[keys.length - 1][1] };
}
