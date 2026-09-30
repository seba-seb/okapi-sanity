import { useEffect, useMemo, useState } from "react";
import { useClient } from "sanity";
import { usePresentationNavigate, usePresentationParams } from "sanity/presentation";

import { apiVersion, previewPrefix } from "@/core/sanity/env";
import { pageHref } from "@/core/lib/routes";

type Row = { _id: string; title?: string; slug?: string; draftOnly?: boolean; published?: boolean };

const QUERY = `*[_type == "page" && defined(slug.current)]{ _id, title, "slug": slug.current }`;

/** The preview URL of a page: the /preview mirror of its public URL. */
const previewHref = (slug: string) => {
  const href = pageHref(slug);
  return href === "/" ? previewPrefix : `${previewPrefix}${href}`;
};

/**
 * Page picker in Presentation's side panel (`components.unstable_navigator`).
 * Editors shouldn't need to know which URLs exist. Plain HTML on purpose:
 * `@sanity/ui` changed its scale props between majors; `color: inherit`
 * picks up the Studio theme without declaring a colour.
 */
export function PageNavigator() {
  const client = useClient({ apiVersion });
  const navigate = usePresentationNavigate();
  const current = usePresentationParams(false)?.preview;
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    // Raw perspective returns published + draft documents separately, so a
    // never-published page shows up and can be flagged; the draft wins.
    const raw = client.withConfig({ perspective: "raw" });
    const load = () =>
      raw
        .fetch<Row[]>(QUERY)
        .then((all) => {
          const byId = new Map<string, Row>();
          for (const r of all) {
            const id = r._id.replace(/^drafts\./, "");
            const seen = byId.get(id);
            const isDraft = r._id.startsWith("drafts.");
            if (!seen || isDraft) byId.set(id, { ...r, draftOnly: isDraft && !seen?.published, published: seen?.published || !isDraft });
            else Object.assign(seen, { published: true, draftOnly: false });
          }
          setRows([...byId.values()].filter((r) => !r._id.startsWith("versions.")));
        })
        .catch(() => {});
    load();
    let timer: ReturnType<typeof setTimeout>;
    const sub = client
      .listen(`*[_type == "page"]`, {}, { events: ["mutation"], includeResult: false, visibility: "query" })
      .subscribe(() => {
        clearTimeout(timer);
        timer = setTimeout(load, 300);
      });
    return () => {
      sub.unsubscribe();
      clearTimeout(timer);
    };
  }, [client]);

  const pages = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return rows
      .filter((r) => r.slug && (!q || `${r.title} ${r.slug}`.toLowerCase().includes(q)))
      .sort((a, b) =>
        a.slug === "home" ? -1 : b.slug === "home" ? 1 : (a.title ?? a.slug!).localeCompare(b.title ?? b.slug!),
      );
  }, [rows, filter]);

  return (
    <nav aria-label="Pages" style={{ padding: 12, font: "inherit", fontSize: 13, color: "inherit", overflowY: "auto", height: "100%" }}>
      <div style={{ fontWeight: 600, margin: "4px 4px 10px" }}>Pages</div>
      <input
        type="search"
        placeholder="Filter…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: "6px 8px", font: "inherit", color: "inherit", background: "transparent", border: "1px solid color-mix(in srgb, currentColor 25%, transparent)", borderRadius: 6 }}
      />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {pages.map((p) => {
          const href = previewHref(p.slug!);
          const active = current === href || current === `${href}/`;
          return (
            <li key={p._id}>
              <button
                type="button"
                onClick={() => navigate(href, { type: "page", id: p._id.replace(/^drafts\./, "") })}
                title={pageHref(p.slug!)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 8px",
                  border: 0,
                  borderRadius: 6,
                  font: "inherit",
                  color: "inherit",
                  cursor: "pointer",
                  background: active ? "color-mix(in srgb, currentColor 14%, transparent)" : "transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {p.title || p.slug}
                <span style={{ display: "block", opacity: 0.55, fontSize: 11 }}>
                  {pageHref(p.slug!)}
                  {p.draftOnly ? " · not published" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
