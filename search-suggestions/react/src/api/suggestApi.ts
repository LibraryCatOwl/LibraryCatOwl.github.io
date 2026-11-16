/*
 * Mock of the suggest service and catalog search.
 *
 * To connect a real backend, replace the body of fetchSuggestions with:
 *
 *   const qs = new URLSearchParams({ q: params.q, dept: params.dept, limit: String(params.limit ?? 8) });
 *   const res = await fetch(`/v1/suggest?${qs}`, { signal });
 *   if (!res.ok) throw new Error(`suggest ${res.status}`);
 *   return res.json();
 *
 * The rest of the app only depends on the SuggestResponse shape in ../types.ts.
 */
import queriesJson from "../../../data/queries.json";
import productsJson from "../../../data/products.json";
import { createEngine } from "../lib/engine";
import type { Product, SearchFilter, SuggestParams, SuggestResponse } from "../types";

export const catalog = {
  trending: queriesJson.trending as string[],
  categories: productsJson.categories as string[],
};

const engine = createEngine({
  queries: queriesJson.queries,
  products: productsJson.products as Product[],
});

/** Simulated service latency, adjustable for demos. */
export const mockConfig = { originLatencyMs: 40 };

let requestSeq = 0;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export async function fetchSuggestions(params: SuggestParams, signal?: AbortSignal): Promise<SuggestResponse> {
  const requestId = `r-${++requestSeq}`;
  // Short prefixes are served from the edge cache (PRD section 6).
  const edge = params.q.trim().length <= 3;
  const latencyMs = Math.round(
    edge ? 8 + Math.random() * 8 : mockConfig.originLatencyMs * (0.8 + Math.random() * 0.4)
  );
  await sleep(latencyMs, signal);
  const r = engine.suggest(params.q, {
    rows: params.limit ?? 8,
    scope: true,
    prod: true,
    fuzzy: true,
    dept: params.dept,
  });
  return { ...r, requestId, servedBy: edge ? "edge" : "origin", latencyMs };
}

/** Results page search. Falls back to the top typo correction on zero results. */
export function searchCatalog(q: string, dept: string, filter: SearchFilter = {}) {
  let list = filter.brand ? engine.productsByBrand(filter.brand) : engine.results(q, dept);
  let correctedTo: string | null = null;
  if (!list.length && !filter.brand) {
    const r = engine.suggest(q, { rows: 1, scope: false, prod: false, fuzzy: true, dept });
    if (r.queries.length) {
      correctedTo = r.queries[0].text;
      list = engine.results(correctedTo, dept);
    }
  }
  if (filter.scope) list = list.filter((p) => p.category === filter.scope || p.brand === filter.scope);
  return { products: list, correctedTo };
}

export const bestSellers = (): Product[] =>
  [8, 3, 0, 19, 12, 17].map((id) => engine.product(id)).filter((p): p is Product => p !== undefined);
