# E-commerce Search Suggestions Prototype

A working prototype of typeahead query suggestions for an e-commerce store: as the shopper types, a dropdown offers completed queries, category and brand scopes, and matching products. It comes in two versions that share the same data and styles:

| Version | Live on GitHub Pages | Best for |
|---|---|---|
| Plain HTML/CSS/JS | `/search-suggestions/` | Quick demos and tweaks: no build step |
| React + TypeScript | `/search-suggestions/react-demo/` | Handing to engineers: typed components, hooks and a mock API |

On this site those are https://librarycatowl.github.io/search-suggestions/ and https://librarycatowl.github.io/search-suggestions/react-demo/.

The store name ("kaiyo"), brands, products, prices, ratings and query volumes are all **fictional sample data**.

## What to try

- **Focus the empty box:** recent searches (removable) and trending searches.
- **`ram`:** prefix completions with the typed part in normal weight, plus "ramen in Grocery" and "ramen in Hanbit" scopes and product suggestions.
- **`macha`:** typo tolerance. Suggestions show "matcha".
- **`hanb`:** brand detection ("All of Hanbit").
- **Department menu or category bar:** narrows suggestions to one department.
- **Keyboard:** ↑ ↓ move (query rows preview in the box), Enter chooses, Tab or → accepts the top completion, Esc closes and restores what you typed.
- **↖ button:** copies a suggestion into the box without searching, so you can keep refining.

The plain version has a **Prototype controls** panel (query rows, scoped and product suggestions on/off, typo tolerance, debounce, latency) and an **Under the hood** panel showing keystrokes, requests, client and edge cache hits, and stale requests dropped.

## Folder structure

```
search-suggestions/
├── index.html            Plain version: page markup
├── css/styles.css        Styles shared by both versions
├── js/
│   ├── engine.js         Suggestion engine: candidates, ranking, filters (no DOM)
│   └── app.js            Plain version UI: dropdown, keyboard, simulated network
├── data/
│   ├── queries.json      Sample query log + trending searches
│   └── products.json     Sample catalog + department list
├── react/                React + TypeScript source (Vite)
│   └── src/
│       ├── api/suggestApi.ts          Mock of GET /v1/suggest (swap for a real fetch)
│       ├── hooks/useSuggestions.ts    Debounce, AbortController, LRU client cache
│       ├── hooks/useRecentSearches.ts Recent searches in localStorage
│       ├── components/SearchBox.tsx   ARIA combobox, keyboard handling
│       ├── components/SuggestionDropdown.tsx
│       ├── components/ResultsView.tsx
│       ├── lib/engine.ts              TypeScript port of js/engine.js
│       └── types.ts                   Shared types incl. the API response shape
└── react-demo/           Built React app (output of `npm run build`), served by Pages
```

## Run locally

**Plain version.** The page loads `data/*.json` with `fetch`, so it must be served over HTTP. Opening the file directly won't work.

```bash
cd search-suggestions
python3 -m http.server 8000
# open http://localhost:8000
```

**React version** (needs Node 18+):

```bash
cd search-suggestions/react
npm install
npm run dev      # dev server with hot reload
npm run build    # type-check, then write the static site to ../react-demo
```

GitHub Pages serves the committed `react-demo/` folder as-is, so **after changing the React source, run `npm run build` and commit `react-demo/`** too.

## Common changes

**Use your own data.** Replace `data/queries.json` and `data/products.json`, keeping the same fields. Both versions pick up the change; rebuild the React demo.

- Queries: `text`, `volume` (search count), `conversion` (orders ÷ searches).
- Products: `id`, `title`, `brand`, `category`, `price`, `rating`, `reviews`, `tags` (extra words to match, e.g. `"gifts korean"`), plus `shape` and `hue` for the placeholder thumbnail.

**Tune ranking.** The v1 score is a linear blend:

```
score = log10(volume) + 8 × conversion + 2 × matchQuality
```

`matchQuality` is 1 for a full prefix match, 0.6 when every typed word starts a word in the query, and 0.35 for a typo match. The weights are constants at the top of `js/engine.js` and `react/src/lib/engine.ts`. Keep the two files in step, or have the plain version load the React build if you only want one.

**Typo tolerance.** `tolerance()` in the engine allows 0 edits under 4 characters, 1 for 4–7 and 2 for 8+.

**Look and feel.** Colors and font are CSS variables at the top of `css/styles.css` (`--red` is the accent).

**Connect a real backend (React).** Replace the body of `fetchSuggestions` in `react/src/api/suggestApi.ts` with a `fetch` to your `/v1/suggest` endpoint. The comment there has the code. Everything else depends only on the `SuggestResponse` type in `types.ts`.

## How it maps to the PRD

| Prototype behavior | PRD |
|---|---|
| Only queries that return results are suggested | FR-3 |
| Typo tolerance by word length | FR-2 |
| Scoped (category/brand) and product suggestions | FR-8, FR-9 |
| Recent and trending in the empty state | FR-7 |
| ARIA combobox, keyboard navigation | FR-5 |
| Debounce, stale-request cancel, client cache, edge-cached short prefixes | Section 6, online path |
| Linear ranking blend weighted by conversion | Section 7, v1 scoring |
