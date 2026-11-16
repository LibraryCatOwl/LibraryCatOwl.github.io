export interface Product {
  id: number;
  title: string;
  brand: string;
  category: string;
  price: number;
  rating: number;
  reviews: number;
  /** Placeholder thumbnail shape; a real catalog would have an image URL. */
  shape: string;
  hue: number;
  tags?: string;
}

/** One row of the aggregated query log the offline pipeline produces. */
export interface QueryEntry {
  text: string;
  volume: number;
  conversion: number;
}

export interface QuerySuggestion {
  text: string;
  score: number;
  fuzzy: boolean;
  /** Number of products the query returns. Always > 0 (PRD FR-3). */
  results: number;
  hot: boolean;
}

export interface ScopeSuggestion {
  /** The query being scoped; empty for a brand-only scope ("All of Hanbit"). */
  query: string;
  /** Category or brand name. */
  label: string;
  count: number;
  brand: boolean;
}

/** Response body of GET /v1/suggest (PRD section 6, API sketch). */
export interface SuggestResponse {
  requestId: string;
  queries: QuerySuggestion[];
  scopes: ScopeSuggestion[];
  products: Product[];
  /** Set when every suggestion came from typo correction. */
  corrected: string | null;
  servedBy: "edge" | "origin";
  latencyMs: number;
}

export interface SuggestParams {
  q: string;
  dept: string;
  limit?: number;
}

export type SearchFilter = { scope?: string; brand?: string };
