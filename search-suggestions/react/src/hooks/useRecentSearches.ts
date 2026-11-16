import { useCallback, useState } from "react";

const KEY = "ky-recent";
const MAX = 5;

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

/** Recent searches kept on the device (logged-out behavior in PRD FR-7). */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>(load);

  const add = useCallback((q: string) => {
    setRecent((r) => {
      const next = [q, ...r.filter((x) => x !== q)].slice(0, MAX);
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((q: string) => {
    setRecent((r) => {
      const next = r.filter((x) => x !== q);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecent([]);
    save([]);
  }, []);

  return { recent, add, remove, clear };
}
