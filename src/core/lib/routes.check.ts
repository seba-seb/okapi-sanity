// Run: node --experimental-strip-types src/core/lib/routes.check.ts
import assert from "node:assert/strict";

import { pageHref, resolveLink, toRoutes } from "./routes.ts";

const routes = toRoutes([
  { _id: "home", slug: "home" },
  { _id: "drafts.about", slug: "about" },
]);

assert.equal(pageHref("home"), "/");
assert.equal(pageHref("about"), "/about");
assert.deepEqual(resolveLink({ kind: "internal", page: { _ref: "about" } }, routes), { href: "/about" });
assert.deepEqual(resolveLink({ kind: "internal", page: { _ref: "home" }, anchor: "#contact" }, routes), { href: "/#contact" });
// Deleted page: anchor-only fallback, or nothing.
assert.equal(resolveLink({ kind: "internal", page: { _ref: "gone" } }, routes), null);
assert.deepEqual(resolveLink({ kind: "internal", anchor: "faq" }, routes), { href: "#faq" });
// rel is derived, always, for external + new tab.
assert.deepEqual(resolveLink({ kind: "external", url: "https://x.com", newTab: true }, routes), {
  href: "https://x.com",
  target: "_blank",
  rel: "noopener noreferrer",
});
assert.deepEqual(resolveLink({ kind: "external", url: "https://x.com" }, routes), { href: "https://x.com" });
// Legacy { href, newTab } content keeps working.
assert.deepEqual(resolveLink({ href: "/old", newTab: false }, routes), { href: "/old" });
assert.equal(resolveLink(undefined, routes), null);
console.log("routes.check: ok");
