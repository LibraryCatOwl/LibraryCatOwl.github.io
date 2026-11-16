/*
 * Suggestion engine: candidate generation, ranking, blending and filtering.
 * Pure functions with no DOM access. In production this logic lives in the
 * suggest service (see PRD section 6); here it runs in the browser.
 *
 * Usage:
 *   const engine = SuggestEngine.create({ queries, products, trending, categories });
 *   engine.suggest("ram", { rows: 8, scope: true, prod: true, fuzzy: true, dept: "All" });
 */
(function (global) {
  "use strict";

  const STOPWORDS = new Set(["for", "the", "with", "and", "a"]);

  // Ranking weights for the v1 linear blend:
  //   score = log10(volume) + W_CONVERSION * conversion + W_MATCH * matchQuality
  const W_CONVERSION = 8;
  const W_MATCH = 2;
  const HOT_VOLUME = 7000; // queries at or above this volume get a "Hot" badge
  const MIN_SCOPE_ITEMS = 2; // a scoped suggestion needs at least this many products

  const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").replace(/^ /, "");

  function levenshtein(a, b) {
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

  // Typo tolerance by token length (PRD FR-2): 0 edits under 4 chars, 1 for 4-7, 2 for 8+.
  const tolerance = (len) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

  // Does a typed token match a word? Prefix match, naive plural, or fuzzy prefix.
  function wordHit(tok, word, fuzzy) {
    if (word.startsWith(tok)) return true;
    if (tok.length > 3 && tok.endsWith("s") && word.startsWith(tok.slice(0, -1))) return true;
    const tol = tolerance(tok.length);
    if (!fuzzy || tol === 0) return false;
    const L = tok.length;
    return Math.min(
      levenshtein(tok, word.slice(0, L - 1)),
      levenshtein(tok, word.slice(0, L)),
      levenshtein(tok, word.slice(0, L + 1))
    ) <= tol;
  }

  // Match quality of a candidate query: 1 = full prefix, 0.6 = every token
  // starts a word, 0.35 = fuzzy, 0 = no match.
  function matchQuery(text, q, toks, fuzzy) {
    const words = text.split(" ");
    if (text.startsWith(q)) return 1;
    if (toks.every((k) => words.some((w) => w.startsWith(k)))) return 0.6;
    if (fuzzy && toks.every((k) => words.some((w) => wordHit(k, w, true)))) return 0.35;
    return 0;
  }

  function create(data) {
    const products = data.products.map((p) => ({
      ...p,
      words: `${p.title} ${p.brand} ${p.category} ${p.tags || ""}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    }));
    const brands = [...new Set(products.map((p) => p.brand))];

    // Product retrieval: every token must match a word in the product's title,
    // brand, category or tags. Supports "under 50" as a price filter.
    function results(q, opts, fuzzy) {
      const toks = norm(q).trim().split(" ").filter((t) => t && !STOPWORDS.has(t));
      let max = Infinity;
      const ui = toks.indexOf("under");
      if (ui > -1 && +toks[ui + 1]) {
        max = +toks[ui + 1];
        toks.splice(ui, 2);
      }
      if (!toks.length && max === Infinity) return [];
      const dept = (opts && opts.dept) || "All";
      return products
        .filter(
          (p) =>
            (dept === "All" || p.category === dept) &&
            p.price <= max &&
            toks.every((t) => p.words.some((w) => wordHit(t, w, fuzzy)))
        )
        .sort((a, b) => b.rating * Math.log(b.reviews) - a.rating * Math.log(a.reviews));
    }

    function suggest(raw, opts) {
      const q = norm(raw);
      const toks = q.trim().split(" ").filter(Boolean);

      // 1. Candidate generation: exact/word-prefix first, fuzzy only if too few.
      let cands = data.queries
        .map((x) => {
          const m = matchQuery(x.text, q, toks, false);
          return m ? { ...x, m, fuzzy: false } : null;
        })
        .filter(Boolean);
      if (cands.length < 3 && opts.fuzzy && q.trim().length >= 4) {
        const have = new Set(cands.map((x) => x.text));
        cands = cands.concat(
          data.queries
            .filter((x) => !have.has(x.text))
            .map((x) => {
              const m = matchQuery(x.text, q, toks, true);
              return m ? { ...x, m, fuzzy: true } : null;
            })
            .filter(Boolean)
        );
      }

      // 2. Filter: only suggest queries that return results (PRD FR-3).
      // 3. Score with the v1 linear blend, then sort and cut.
      cands = cands
        .map((x) => ({ ...x, n: results(x.text, opts).length }))
        .filter((x) => x.n > 0)
        .map((x) => ({
          ...x,
          score: Math.log10(x.volume) + W_CONVERSION * x.conversion + W_MATCH * x.m,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, opts.rows);

      // 4. Scoped suggestions on the top completion: by category or brand.
      const top = cands[0];
      let scopes = [];
      if (opts.scope && top) {
        const counts = {};
        results(top.text, opts).forEach((p) => {
          if (opts.dept === "All") counts[p.category] = (counts[p.category] || 0) + 1;
          counts[p.brand] = (counts[p.brand] || 0) + 1;
        });
        scopes = Object.entries(counts)
          .filter(
            ([k, n]) =>
              n >= MIN_SCOPE_ITEMS &&
              k.toLowerCase() !== top.text &&
              !top.text.includes(k.toLowerCase().split(" ")[0])
          )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([label, n]) => ({ query: top.text, label, count: n, brand: false }));
        const br = brands.find(
          (b) => toks.length && toks[0].length >= 2 && b.toLowerCase().startsWith(toks[0])
        );
        if (br) {
          scopes.unshift({
            query: "",
            label: br,
            count: products.filter((p) => p.brand === br).length,
            brand: true,
          });
          scopes = scopes.slice(0, 2);
        }
      }

      // 5. Product suggestions: direct match, then fuzzy, then the top completion's.
      let prods = [];
      if (opts.prod) {
        prods = results(q, opts, false);
        if (!prods.length && opts.fuzzy) prods = results(q, opts, true);
        if (!prods.length && top) prods = results(top.text, opts);
        prods = prods.slice(0, 4);
      }

      return {
        queries: cands.map((x) => ({
          text: x.text,
          score: +x.score.toFixed(2),
          fuzzy: x.fuzzy,
          results: x.n,
          hot: x.volume >= HOT_VOLUME,
        })),
        scopes,
        products: prods.map((p) => p.id),
        corrected: cands.length && cands.every((x) => x.fuzzy) ? cands[0].text : null,
      };
    }

    return {
      suggest,
      results,
      brands,
      product: (id) => products[id],
      productsByBrand: (b) => products.filter((p) => p.brand === b),
      trending: data.trending,
      categories: data.categories,
    };
  }

  global.SuggestEngine = { create, norm };
})(window);
