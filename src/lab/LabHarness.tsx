import { Component, useEffect, useRef, useState, type ReactNode } from "react";

import { PageBuilder } from "@/core/render/PageBuilder";
import { ScrollTrigger } from "@/core/motion/gsap";
import type { Routes } from "@/core/lib/routes";
import type { Components } from "@/core/render/components";
import type { Page } from "@/core/lib/types";

/**
 * DEV-ONLY torture harness (/lab/<slug>). Feeds PageBuilder a changing `page`
 * exactly like Presentation does (a new document object per edit), and after
 * every step checks the things that break silently with scroll-driven motion.
 *
 * Driven by hand (panel) or by script: `await window.__lab.run()`.
 */

type Doc = Page & Record<string, unknown>;
type Node = Record<string, unknown> & { _key?: string; _type?: string };

const k = () => Math.random().toString(36).slice(2, 14);
const clone = <T,>(v: T): T => structuredClone(v);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Visit every object in the document (depth-first). */
function walk(o: unknown, fn: (n: Node, parentArr?: Node[]) => void, parentArr?: Node[]) {
  if (Array.isArray(o)) o.forEach((i) => walk(i, fn, o as Node[]));
  else if (o && typeof o === "object") {
    fn(o as Node, parentArr);
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, fn);
  }
}
const rekey = (o: unknown) => walk(o, (n) => { if (n._key) n._key = k(); });
const sectionsWith = (d: Doc, type: string) =>
  (d.sections ?? []).filter((s) => JSON.stringify(s).includes(`"_type":"${type}"`));

// ── Mutations: what an editor does ────────────────────────────────────────
let stamp = 0;
const MUTATIONS: Record<string, (d: Doc) => void> = {
  "type into every text": (d) => {
    const m = ` ✎${++stamp}`;
    walk(d, (n) => {
      if (n._type === "span" && typeof n.text === "string") n.text += m;
      if (n._type === "card") n.heading = `${n.heading ?? ""}${m}`;
      if ((n._type === "textScrub" || n._type === "bigType") && typeof n.text === "string") n.text += m;
      if (n._type === "marquee" && Array.isArray(n.items)) n.items = [...(n.items as string[]).slice(0, -1), `W${stamp}`];
    });
  },
  "grow a card inside the horizontal scroll": (d) => {
    walk(d, (n) => {
      if (n._type === "horizontalScroll" && Array.isArray(n.items)) {
        const c = (n.items as Node[]).find((i) => i._type === "card");
        if (c) c.body = `${c.body ?? ""} This sentence makes the card taller and the track wider than it was a moment ago.`;
      }
    });
  },
  "insert an item into every horizontal scroll": (d) => {
    walk(d, (n) => {
      if (n._type === "horizontalScroll" && Array.isArray(n.items))
        (n.items as Node[]).splice(1, 0, { _type: "card", _key: k(), layout: "simple", heading: "Inserted", body: "New item." });
    });
  },
  "remove an item from every horizontal scroll": (d) => {
    walk(d, (n) => {
      if (n._type === "horizontalScroll" && Array.isArray(n.items) && (n.items as Node[]).length > 2)
        (n.items as Node[]).splice(0, 1);
    });
  },
  "reverse all sections": (d) => void d.sections?.reverse(),
  "move a pinned section to the top": (d) => {
    const s = sectionsWith(d, "horizontalScroll")[0] ?? sectionsWith(d, "stackCards")[0];
    if (!s || !d.sections) return;
    d.sections.splice(d.sections.indexOf(s), 1);
    d.sections.unshift(s);
  },
  "duplicate a pinned section": (d) => {
    const s = sectionsWith(d, "horizontalScroll")[0] ?? sectionsWith(d, "stackCards")[0];
    if (!s || !d.sections) return;
    const copy = clone(s);
    rekey(copy);
    d.sections.splice(d.sections.indexOf(s) + 1, 0, copy);
  },
  "delete a pinned section": (d) => {
    const s = sectionsWith(d, "horizontalScroll").at(-1) ?? sectionsWith(d, "stackCards").at(-1);
    if (s && d.sections) d.sections.splice(d.sections.indexOf(s), 1);
  },
  "cycle heading animations": (d) => {
    const order = ["none", "words", "lines"];
    walk(d, (n) => {
      if (n._type === "heading") n.animation = order[(order.indexOf(String(n.animation ?? "none")) + 1) % 3];
    });
  },
  "switch every section theme": (d) => {
    const order = ["light", "dark", "brand"];
    d.sections?.forEach((s) => {
      (s as Node).theme = order[(order.indexOf(String((s as Node).theme ?? "light")) + 1) % 3];
    });
  },
  "insert a text block in every section": (d) => {
    d.sections?.forEach((s) => {
      const content = (s as Node).content as Node[] | undefined;
      content?.unshift({ _type: "paragraph", _key: k(), text: [{ _type: "block", _key: k(), style: "normal", markDefs: [], children: [{ _type: "span", _key: k(), text: "Inserted paragraph that pushes everything below it down.", marks: [] }] }], size: "lg" });
    });
  },
};

// ── Checks: what breaks silently ──────────────────────────────────────────
type Check = { name: string; ok: boolean; detail?: string };
function runChecks(lastMarker: string | null): Check[] {
  const out: Check[] = [];
  const hs = [...document.querySelectorAll<HTMLElement>(".hscroll")];
  const spacers = document.querySelectorAll(".pin-spacer");
  const pinned = hs.filter((h) => h.querySelector(".pin-spacer"));
  out.push({ name: "one pin-spacer per horizontal scroll (no orphans)", ok: spacers.length === pinned.length && pinned.length === hs.length, detail: `${spacers.length} spacers / ${hs.length} blocks` });
  const bad = hs.flatMap((h) => {
    const spacer = h.querySelector<HTMLElement>(".pin-spacer");
    const track = h.querySelector<HTMLElement>(".hscroll__track");
    const pin = spacer?.firstElementChild as HTMLElement | null;
    if (!spacer || !track || !pin) return [];
    // Spacer = the pinned element's own height (it can outgrow the viewport
    // when its content grows) + the horizontal travel.
    const expected = pin.offsetHeight + Math.max(0, track.scrollWidth - pin.clientWidth);
    const diff = Math.abs(spacer.offsetHeight - expected);
    return diff > 6 ? [`${spacer.offsetHeight} vs ${expected}`] : [];
  });
  out.push({ name: "pin distance matches the track (re-measured)", ok: bad.length === 0, detail: bad.join(", ") || undefined });
  out.push({ name: "no nested splits", ok: document.querySelectorAll("[data-split] [data-split]").length === 0 });
  out.push({ name: "no stuck hidden splits", ok: [...document.querySelectorAll("[data-split]")].every((e) => getComputedStyle(e).visibility !== "hidden" || e.getBoundingClientRect().top > innerHeight * 3) });
  out.push({ name: "no horizontal page overflow", ok: document.documentElement.scrollWidth <= innerWidth, detail: `${document.documentElement.scrollWidth} / ${innerWidth}` });
  const triggers = ScrollTrigger.getAll().filter((t) => !t.trigger || !document.contains(t.trigger as Element));
  out.push({ name: "no ScrollTriggers left on removed nodes", ok: triggers.length === 0, detail: triggers.length ? `${triggers.length} dangling` : undefined });
  if (lastMarker) out.push({ name: `edited text rendered (${lastMarker})`, ok: document.querySelector("main")!.textContent!.includes(lastMarker) });
  return out;
}

class Boundary extends Component<{ children: ReactNode; onError: (e: Error) => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? (
      <pre style={{ padding: 24, color: "#f55", whiteSpace: "pre-wrap" }}>CRASH: {String(this.state.error.stack)}</pre>
    ) : (
      this.props.children
    );
  }
}

export function LabHarness({ page, routes, components }: { page: Doc; routes: Routes; components?: Components }) {
  const [doc, setDoc] = useState<Doc>(page);
  const docRef = useRef(doc);
  docRef.current = doc;
  const [log, setLog] = useState<string[]>([]);
  const errors = useRef<string[]>([]);

  useEffect(() => {
    const onErr = (e: ErrorEvent) => errors.current.push(e.message);
    const origError = console.error;
    console.error = (...a: unknown[]) => {
      errors.current.push(a.map(String).join(" ").slice(0, 300));
      origError(...a);
    };
    window.addEventListener("error", onErr);

    const apply = async (name: string) => {
      const before = errors.current.length;
      const next = clone(docRef.current);
      MUTATIONS[name](next);
      setDoc(next);
      await wait(700); // React commit + ScrollRefresh (120ms) + track RO (120ms)
      const marker = name === "type into every text" ? `✎${stamp}` : null;
      const checks = runChecks(marker);
      const newErrors = errors.current.slice(before);
      const failed = checks.filter((c) => !c.ok);
      const line = `${failed.length || newErrors.length ? "✗" : "✓"} ${name}${failed.map((c) => ` | ✗ ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("")}${newErrors.map((e) => ` | ERROR ${e}`).join("")}`;
      setLog((l) => [...l, line]);
      return { name, ok: !failed.length && !newErrors.length, failed, errors: newErrors };
    };

    const run = async ({ rounds = 2, scrollInto = true } = {}) => {
      const results = [];
      for (let r = 0; r < rounds; r++) {
        for (const name of Object.keys(MUTATIONS)) {
          // Half the steps happen while scrolled INTO a pinned band — the worst case.
          if (scrollInto) {
            const spacer = document.querySelectorAll<HTMLElement>(".pin-spacer")[r % 2];
            if (spacer && Math.random() < 0.5) scrollTo(0, spacer.getBoundingClientRect().top + scrollY + spacer.offsetHeight / 2);
            else scrollTo(0, Math.random() * (document.documentElement.scrollHeight - innerHeight));
          }
          results.push(await apply(name));
        }
      }
      // Rapid typing: 25 edits, 40ms apart, no waiting for layout.
      for (let i = 0; i < 25; i++) {
        const next = clone(docRef.current);
        MUTATIONS["type into every text"](next);
        setDoc(next);
        await wait(40);
      }
      await wait(800);
      const rapid = runChecks(`✎${stamp}`);
      results.push({ name: "rapid typing ×25", ok: rapid.every((c) => c.ok) && errors.current.length === 0, failed: rapid.filter((c) => !c.ok), errors: [] });
      setLog((l) => [...l, `${rapid.every((c) => c.ok) ? "✓" : "✗"} rapid typing ×25`]);
      return { passed: results.filter((x) => x.ok).length, total: results.length, failures: results.filter((x) => !x.ok), allErrors: [...errors.current] };
    };

    (window as unknown as { __lab: unknown }).__lab = { run, apply, checks: () => runChecks(null), mutations: Object.keys(MUTATIONS), reset: () => setDoc(page) };
    return () => {
      console.error = origError;
      window.removeEventListener("error", onErr);
    };
  }, [page]);

  return (
    <>
      <Boundary onError={(e) => errors.current.push(`BOUNDARY ${e.message}`)}>
        <PageBuilder page={doc} routes={routes} components={components} />
      </Boundary>
      <aside
        style={{ position: "fixed", right: 12, bottom: 12, zIndex: 2147483647, width: 360, maxHeight: "45vh", overflow: "auto", background: "#111", color: "#eee", font: "12px/1.4 ui-monospace, monospace", padding: 12, borderRadius: 10, boxShadow: "0 10px 40px #0008" }}
      >
        <strong>LAB</strong> — {page.slug?.current}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "8px 0" }}>
          {Object.keys(MUTATIONS).map((m) => (
            <button key={m} style={{ font: "inherit", fontSize: 10 }} onClick={() => (window as unknown as { __lab: { apply: (n: string) => void } }).__lab.apply(m)}>
              {m}
            </button>
          ))}
          <button style={{ font: "inherit", fontSize: 10, fontWeight: 700 }} onClick={() => (window as unknown as { __lab: { run: () => void } }).__lab.run()}>
            ▶ run all
          </button>
        </div>
        {log.map((l, i) => (
          <div key={i} style={{ color: l.startsWith("✓") ? "#8f8" : "#f88" }}>
            {l}
          </div>
        ))}
      </aside>
    </>
  );
}
