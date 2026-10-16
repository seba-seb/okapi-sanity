/**
 * A tab that outlives its server (dev restart, or a new deploy) asks for lazy
 * chunks by hashes that no longer exist: Vite answers 504 "Outdated Optimize
 * Dep" in dev, a 404 in production, and the Studio goes blank — typically right
 * after sign-in, when it first lazy-loads its tools. Reload once to pick up
 * the current chunks. Guarded so a genuinely broken module can't loop.
 */
const STALE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const KEY = "okapi:stale-chunk-reload";

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 15_000) return; // just reloaded: it's not staleness
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage blocked: still reload, the 15s guard is best-effort
  }
  location.reload();
}

export function installStaleChunkReload() {
  if (typeof window === "undefined" || (window as { __staleChunkReload?: boolean }).__staleChunkReload) return;
  (window as { __staleChunkReload?: boolean }).__staleChunkReload = true;
  // Production builds: Vite's own signal for a failed preload.
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });
  // Dev (no preload wrapper) and anything that escapes as an error/rejection.
  window.addEventListener("error", (e) => STALE.test(String(e.message ?? e.error?.message)) && reloadOnce());
  window.addEventListener("unhandledrejection", (e) => STALE.test(String(e.reason?.message ?? e.reason)) && reloadOnce());
}
