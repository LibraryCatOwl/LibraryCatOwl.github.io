import { useEffect, useRef, useState } from "react";
import { fetchSuggestions } from "../api/suggestApi";
import { norm } from "../lib/engine";
import type { SuggestResponse } from "../types";

export interface SuggestionsState {
  data: SuggestResponse | null;
  status: "idle" | "loading" | "success" | "error";
  /** Where the last response came from: client cache, edge or origin. */
  source: "client" | "edge" | "origin" | null;
}

export interface SuggestionsStats {
  requests: number;
  clientHits: number;
  aborted: number;
}

const CACHE_LIMIT = 100;

/**
 * Debounced, cancellable suggestion fetching with an in-session LRU cache.
 * - Waits `debounceMs` after the last keystroke before calling the API.
 * - Aborts the in-flight request when a newer keystroke arrives.
 * - Serves repeated prefixes (e.g. after backspace) from memory instantly.
 */
export function useSuggestions(query: string, dept: string, { debounceMs = 100, limit = 8 } = {}) {
  const [state, setState] = useState<SuggestionsState>({ data: null, status: "idle", source: null });
  const cache = useRef(new Map<string, SuggestResponse>());
  const stats = useRef<SuggestionsStats>({ requests: 0, clientHits: 0, aborted: 0 });

  useEffect(() => {
    if (!query.trim()) {
      setState({ data: null, status: "idle", source: null });
      return;
    }
    const key = `${norm(query)}|${dept}|${limit}`;
    const hit = cache.current.get(key);
    if (hit) {
      cache.current.delete(key); // refresh LRU position
      cache.current.set(key, hit);
      stats.current.clientHits++;
      setState({ data: hit, status: "success", source: "client" });
      return;
    }

    const ctrl = new AbortController();
    setState((s) => ({ ...s, status: "loading" }));
    const timer = setTimeout(() => {
      stats.current.requests++;
      fetchSuggestions({ q: query, dept, limit }, ctrl.signal)
        .then((res) => {
          cache.current.set(key, res);
          if (cache.current.size > CACHE_LIMIT) {
            cache.current.delete(cache.current.keys().next().value as string);
          }
          setState({ data: res, status: "success", source: res.servedBy });
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            stats.current.aborted++;
            return;
          }
          // Fail open: search still works without suggestions (PRD section 8).
          setState({ data: null, status: "error", source: null });
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, dept, debounceMs, limit]);

  return { ...state, stats: stats.current };
}
