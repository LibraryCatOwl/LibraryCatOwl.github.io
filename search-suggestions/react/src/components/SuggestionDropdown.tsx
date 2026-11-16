import type { ReactNode } from "react";
import { norm } from "../lib/engine";
import type { Product, ScopeSuggestion } from "../types";
import { ProductThumb, money } from "./ProductThumb";

export type Item =
  | { kind: "query"; text: string; fuzzy: boolean; hot: boolean }
  | ({ kind: "scope" } & ScopeSuggestion)
  | { kind: "product"; product: Product }
  | { kind: "recent"; text: string }
  | { kind: "trend"; text: string };

interface Props {
  id: string;
  items: Item[];
  active: number;
  typed: string;
  dept: string;
  corrected: string | null;
  loading: boolean;
  onChoose: (i: number) => void;
  onFill: (i: number) => void;
  onRemoveRecent: (text: string) => void;
  onClearRecent: () => void;
}

export const optionId = (listId: string, i: number) => `${listId}-opt-${i}`;

/** Bold the part of each word the shopper hasn't typed yet. */
function Highlight({ text, typed }: { text: string; typed: string }) {
  const toks = norm(typed).trim().split(" ").filter(Boolean);
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => {
        const k = toks.filter((t) => w.startsWith(t)).sort((a, b) => b.length - a.length)[0];
        const sep = i < words.length - 1 ? " " : "";
        if (!k) return <b key={i}>{w + sep}</b>;
        return (
          <span key={i}>
            {k}
            {w.length > k.length && <b>{w.slice(k.length)}</b>}
            {sep}
          </span>
        );
      })}
    </>
  );
}

const SearchIcon = () => (
  <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const ClockIcon = () => (
  <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const FillIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M12 12L4.5 4.5M4 10V4h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export function SuggestionDropdown(p: Props) {
  const { id, items, active, typed } = p;
  const zeroState = !typed.trim();

  const option = (i: number, className: string, children: ReactNode) => (
    <li
      key={i}
      role="option"
      id={optionId(id, i)}
      className={`${className}${i === active ? " on" : ""}`}
      aria-selected={i === active}
      onClick={() => p.onChoose(i)}
    >
      {children}
    </li>
  );

  const renderItem = (it: Item, i: number) => {
    switch (it.kind) {
      case "product":
        return option(
          i,
          "row prod",
          <>
            <ProductThumb product={it.product} size={50} />
            <span className="pt">{it.product.title}</span>
            <span className="pm">
              <span className="price">{money(it.product.price)}</span>
              <br />★ {it.product.rating}
            </span>
          </>
        );
      case "scope":
        return option(
          i,
          "row scope",
          <>
            <span className="t">
              {it.brand ? "All of" : `${it.query} in`} <b>{it.label}</b>
            </span>
            <span className="n">
              {it.count} {it.count === 1 ? "item" : "items"}
            </span>
          </>
        );
      case "trend":
        return option(i, "row", it.text);
      case "recent":
        return option(
          i,
          "row",
          <>
            <ClockIcon />
            <span className="t">{it.text}</span>
            <button
              type="button"
              className="x"
              tabIndex={-1}
              aria-label={`Remove ${it.text} from recent searches`}
              onClick={(e) => {
                e.stopPropagation();
                p.onRemoveRecent(it.text);
              }}
            >
              <XIcon />
            </button>
          </>
        );
      case "query":
        return option(
          i,
          "row",
          <>
            <SearchIcon />
            <span className="t">{it.fuzzy ? <b>{it.text}</b> : <Highlight text={it.text} typed={typed} />}</span>
            {it.hot && <span className="hot">Hot</span>}
            <button
              type="button"
              className="fill"
              tabIndex={-1}
              aria-label={`Fill ${it.text} into the search box`}
              onClick={(e) => {
                e.stopPropagation();
                p.onFill(i);
              }}
            >
              <FillIcon />
            </button>
          </>
        );
    }
  };

  const indexed = items.map((it, i) => ({ it, i }));

  if (zeroState) {
    const recent = indexed.filter((x) => x.it.kind === "recent");
    const trend = indexed.filter((x) => x.it.kind === "trend");
    return (
      <div className="dd" id={id} onMouseDown={(e) => e.preventDefault()}>
        <div className="col">
          {recent.length > 0 && (
            <>
              <div className="sec">
                Recent searches
                <button type="button" onClick={p.onClearRecent}>
                  Clear all
                </button>
              </div>
              <ul role="listbox" aria-label="Recent searches">
                {recent.map(({ it, i }) => renderItem(it, i))}
              </ul>
            </>
          )}
          <div className="sec">Trending searches</div>
          <ul className="chips" role="listbox" aria-label="Trending searches">
            {trend.map(({ it, i }) => renderItem(it, i))}
          </ul>
        </div>
      </div>
    );
  }

  const left = indexed.filter((x) => x.it.kind === "query" || x.it.kind === "scope");
  const right = indexed.filter((x) => x.it.kind === "product");

  return (
    <div className={`dd${right.length ? " two" : ""}`} id={id} onMouseDown={(e) => e.preventDefault()}>
      <div className="col">
        {p.dept !== "All" && (
          <div className="note">
            Searching in <b>{p.dept}</b>
          </div>
        )}
        {p.corrected && (
          <div className="note">
            No matches for “{typed.trim()}”. Showing <b>{p.corrected}</b>
          </div>
        )}
        {left.length > 0 ? (
          <ul role="listbox" aria-label="Search suggestions">
            {left.map(({ it, i }) => renderItem(it, i))}
          </ul>
        ) : (
          <div className="empty">
            {p.loading ? "Looking…" : `No suggestions. Press Enter to search for “${typed.trim()}”.`}
          </div>
        )}
      </div>
      {right.length > 0 && (
        <div className="col">
          <div className="sec">Products</div>
          <ul role="listbox" aria-label="Product suggestions">
            {right.map(({ it, i }) => renderItem(it, i))}
          </ul>
        </div>
      )}
    </div>
  );
}
