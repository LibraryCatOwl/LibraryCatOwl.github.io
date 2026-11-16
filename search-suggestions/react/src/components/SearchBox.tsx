import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { useRecentSearches } from "../hooks/useRecentSearches";
import { useSuggestions, type SuggestionsStats } from "../hooks/useSuggestions";
import { norm } from "../lib/engine";
import type { Product, SearchFilter } from "../types";
import { SuggestionDropdown, optionId, type Item } from "./SuggestionDropdown";

export interface SuggestDebugInfo {
  query: string;
  requestId: string;
  source: "client" | "edge" | "origin";
  latencyMs: number;
  stats: SuggestionsStats;
}

interface Props {
  dept: string;
  departments: string[];
  trending: string[];
  onDeptChange: (dept: string) => void;
  onSearch: (query: string, filter?: SearchFilter) => void;
  onSelectProduct: (product: Product) => void;
  /** Called with every suggestion response, for logging or a debug panel. */
  onDebug?: (info: SuggestDebugInfo) => void;
  debounceMs?: number;
}

/**
 * E-commerce search box with typeahead suggestions.
 * Implements the WAI-ARIA combobox pattern: the input owns focus and
 * aria-activedescendant points at the highlighted option.
 */
export function SearchBox({
  dept,
  departments,
  trending,
  onDeptChange,
  onSearch,
  onSelectProduct,
  onDebug,
  debounceMs = 100,
}: Props) {
  const listId = useId();
  const [typed, setTyped] = useState(""); // what the shopper actually typed
  const [value, setValue] = useState(""); // what the input shows (may be a keyboard preview)
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { recent, add: addRecent, remove: removeRecent, clear: clearRecent } = useRecentSearches();
  const { data, status, source, stats } = useSuggestions(typed, dept, { debounceMs });

  useEffect(() => {
    if (data && source) {
      onDebug?.({ query: typed, requestId: data.requestId, source, latencyMs: source === "client" ? 0 : data.latencyMs, stats: { ...stats } });
    }
  }, [data, source]);

  const items: Item[] = useMemo(() => {
    if (!typed.trim()) {
      return [
        ...recent.map((text): Item => ({ kind: "recent", text })),
        ...trending.map((text): Item => ({ kind: "trend", text })),
      ];
    }
    if (!data) return [];
    const out: Item[] = [];
    data.queries.forEach((q, k) => {
      out.push({ kind: "query", text: q.text, fuzzy: q.fuzzy, hot: q.hot });
      if (k === 0) data.scopes.forEach((s) => out.push({ kind: "scope", ...s }));
    });
    data.products.forEach((product) => out.push({ kind: "product", product }));
    return out;
  }, [typed, data, recent, trending]);

  // Reset the highlight whenever the list changes.
  useEffect(() => setActive(-1), [items]);

  function type(text: string) {
    setTyped(text);
    setValue(text);
    setOpen(true);
  }

  function submit(text: string, filter?: SearchFilter) {
    const q = text.trim();
    if (!q) return;
    addRecent(q);
    setTyped(q);
    setValue(q);
    setOpen(false);
    onSearch(q, filter);
  }

  function choose(i: number) {
    const it = items[i];
    if (!it) return;
    switch (it.kind) {
      case "product":
        setOpen(false);
        setValue(typed);
        onSelectProduct(it.product);
        return;
      case "scope":
        submit(it.brand ? it.label : it.query, it.brand ? { brand: it.label } : { scope: it.label });
        return;
      default:
        submit(it.text);
    }
  }

  function preview(i: number) {
    setActive(i);
    if (i < 0) return setValue(typed);
    const it = items[i];
    if (it.kind === "product") setValue(typed);
    else if (it.kind === "scope") setValue(it.query || it.label);
    else setValue(it.text);
    document.getElementById(optionId(listId, i))?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = items.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (!n) return;
      let i = active + (e.key === "ArrowDown" ? 1 : -1);
      if (i >= n) i = -1;
      if (i < -1) i = n - 1;
      preview(i);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setValue(typed);
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active > -1) choose(active);
      else submit(value);
    } else if (
      open &&
      active < 0 &&
      ((e.key === "Tab" && !e.shiftKey) ||
        (e.key === "ArrowRight" && e.currentTarget.selectionStart === value.length))
    ) {
      // Accept the top completion (inline autocomplete).
      const top = items.find((x) => x.kind === "query");
      if (top && "text" in top && top.text !== norm(value).trim()) {
        e.preventDefault();
        type(top.text);
      }
    }
  }

  return (
    <form
      className="search"
      role="search"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <div className="box">
        <select className="dept" aria-label="Department" value={dept} onChange={(e) => onDeptChange(e.target.value)}>
          <option>All</option>
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <input
          id="q"
          type="text"
          placeholder="Search snacks, ramen, K-beauty…"
          role="combobox"
          aria-label="Search the store"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active > -1 ? optionId(listId, active) : undefined}
          spellCheck={false}
          value={value}
          onChange={(e) => type(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <button className="go" type="submit">
          Search
        </button>
      </div>
      <div className="tags">
        {trending.slice(0, 6).map((t) => (
          <button key={t} type="button" onClick={() => submit(t)}>
            {t}
          </button>
        ))}
      </div>
      {open && (
        <SuggestionDropdown
          id={listId}
          items={items}
          active={active}
          typed={typed}
          dept={dept}
          corrected={typed.trim() && data ? data.corrected : null}
          loading={status === "loading"}
          onChoose={choose}
          onFill={(i) => {
            const it = items[i];
            if ("text" in it) type(it.text + " ");
          }}
          onRemoveRecent={removeRecent}
          onClearRecent={clearRecent}
        />
      )}
      <div className="sr" aria-live="polite">
        {open ? `${items.length} suggestions` : ""}
      </div>
    </form>
  );
}
