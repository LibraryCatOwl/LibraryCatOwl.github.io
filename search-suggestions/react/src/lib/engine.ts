/*
 * Suggestion engine (TypeScript port of ../../js/engine.js).
 * In production this runs inside the suggest service, behind /v1/suggest.
 * Here src/api/suggestApi.ts calls it to mock that service.
 */
import type { Product, QueryEntry, QuerySuggestion, ScopeSuggestion } from "../types";

export interface EngineOptions {
  rows: number;
  scope: boolean;
  prod: boolean;
  fuzzy: boolean;
  dept: string;
}

export interface EngineResult {
  queries: QuerySuggestion[];
  scopes: ScopeSuggestion[];
  products: Product[];
  corrected: string | null;
}

const STOPWORDS = new Set(["for", "the", "with", "and", "a"]);

// v1 linear blend: score = log10(volume) + W_CONVERSION * conversion + W_MATCH * matchQuality
const W_CONVERSION = 8;
const W_MATCH = 2;
const HOT_VOLUME = 7000;
const MIN_SCOPE_ITEMS = 2;

export const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/^ /, "");

function levenshtein(a: string, b: string): number {
  const n = b.length;
  const d = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[n];
}

/** Typo tolerance by token length (PRD FR-2). */
const tolerance = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

function wordHit(tok: string, word: string, fuzzy: boolean): boolean {
  if (word.startsWith(tok)) return true;
  if (tok.length > 3 && tok.endsWith("s") && word.startsWith(tok.slice(0, -1))) return true;
  const tol = tolerance(tok.length);
  if (!fuzzy || tol === 0) return false;
  const L = tok.length;
  return (
    Math.min(
      levenshtein(tok, word.slice(0, L - 1)),
      levenshtein(tok, word.slice(0, L)),
      levenshtein(tok, word.slice(0, L + 1))
    ) <= tol
  );
}

function matchQuery(text: string, q: string, toks: string[], fuzzy: boolean): number {
  const words = text.split(" ");
  if (text.startsWith(q)) return 1;
  if (toks.every((k) => words.some((w) => w.startsWith(k)))) return 0.6;
  if (fuzzy && toks.every((k) => words.some((w) => wordHit(k, w, true)))) return 0.35;
  return 0;
}

export function createEngine(data: { queries: QueryEntry[]; products: Product[] }) {
  const products = data.products.map((p) => ({
    ...p,
    words: `${p.title} ${p.brand} ${p.category} ${p.tags ?? ""}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  }));
  const brands = [...new Set(products.map((p) => p.brand))];

  function results(q: string, dept = "All", fuzzy = false): Product[] {
    const toks = norm(q).trim().split(" ").filter((t) => t && !STOPWORDS.has(t));
    let max = Infinity;
    const ui = toks.indexOf("under");
    if (ui > -1 && +toks[ui + 1]) {
      max = +toks[ui + 1];
      toks.splice(ui, 2);
    }
    if (!toks.length && max === Infinity) return [];
    return products
      .filter(
        (p) =>
          (dept === "All" || p.category === dept) &&
          p.price <= max &&
          toks.every((t) => p.words.some((w) => wordHit(t, w, fuzzy)))
      )
      .sort((a, b) => b.rating * Math.log(b.reviews) - a.rating * Math.log(a.reviews));
  }

  function suggest(raw: string, opts: EngineOptions): EngineResult {
    const q = norm(raw);
    const toks = q.trim().split(" ").filter(Boolean);
    type Cand = QueryEntry & { m: number; fuzzy: boolean };

    // 1. Candidates: prefix and word-prefix first, fuzzy only if too few.
    let cands: Cand[] = [];
    for (const x of data.queries) {
      const m = matchQuery(x.text, q, toks, false);
      if (m) cands.push({ ...x, m, fuzzy: false });
    }
    if (cands.length < 3 && opts.fuzzy && q.trim().length >= 4) {
      const have = new Set(cands.map((x) => x.text));
      for (const x of data.queries) {
        if (have.has(x.text)) continue;
        const m = matchQuery(x.text, q, toks, true);
        if (m) cands.push({ ...x, m, fuzzy: true });
      }
    }

    // 2. Keep only queries with results; 3. score, sort, cut.
    const ranked = cands
      .map((x) => ({ ...x, n: results(x.text, opts.dept).length }))
      .filter((x) => x.n > 0)
      .map((x) => ({ ...x, score: Math.log10(x.volume) + W_CONVERSION * x.conversion + W_MATCH * x.m }))
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.rows);

    // 4. Scoped suggestions on the top completion.
    const top = ranked[0];
    let scopes: ScopeSuggestion[] = [];
    if (opts.scope && top) {
      const counts: Record<string, number> = {};
      for (const p of results(top.text, opts.dept)) {
        if (opts.dept === "All") counts[p.category] = (counts[p.category] ?? 0) + 1;
        counts[p.brand] = (counts[p.brand] ?? 0) + 1;
      }
      scopes = Object.entries(counts)
        .filter(
          ([k, n]) =>
            n >= MIN_SCOPE_ITEMS &&
            k.toLowerCase() !== top.text &&
            !top.text.includes(k.toLowerCase().split(" ")[0])
        )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([label, count]) => ({ query: top.text, label, count, brand: false }));
      const br = brands.find((b) => toks.length > 0 && toks[0].length >= 2 && b.toLowerCase().startsWith(toks[0]));
      if (br) {
        scopes.unshift({ query: "", label: br, count: products.filter((p) => p.brand === br).length, brand: true });
        scopes = scopes.slice(0, 2);
      }
    }

    // 5. Product suggestions.
    let prods: Product[] = [];
    if (opts.prod) {
      prods = results(q, opts.dept);
      if (!prods.length && opts.fuzzy) prods = results(q, opts.dept, true);
      if (!prods.length && top) prods = results(top.text, opts.dept);
      prods = prods.slice(0, 4);
    }

    return {
      queries: ranked.map((x) => ({
        text: x.text,
        score: +x.score.toFixed(2),
        fuzzy: x.fuzzy,
        results: x.n,
        hot: x.volume >= HOT_VOLUME,
      })),
      scopes,
      products: prods,
      corrected: ranked.length && ranked.every((x) => x.fuzzy) ? ranked[0].text : null,
    };
  }

  return {
    suggest,
    results,
    productsByBrand: (b: string) => products.filter((p) => p.brand === b),
    product: (id: number): Product | undefined => products.find((p) => p.id === id),
  };
}
