import { useRef } from "react";
import { usePresentationQuery } from "@sanity/visual-editing/react";

/**
 * `initial` from the server, replaced by the Studio's live result while in
 * Presentation (typing streams in without a reload). Keeps the last non-null
 * live value so a transient null doesn't flash stale content. Outside
 * Presentation it's just `initial`.
 */
export function useLiveQuery<T>(query: string, params: Record<string, unknown>, initial: T): T {
  const live = usePresentationQuery({ query, params, stega: false });
  const last = useRef<T | null>(null);
  if (live.data) last.current = live.data as T;
  return last.current ?? initial;
}
