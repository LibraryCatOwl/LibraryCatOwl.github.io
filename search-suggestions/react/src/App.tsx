import { useState } from "react";
import { bestSellers, catalog, mockConfig, searchCatalog } from "./api/suggestApi";
import { ResultsView, type View } from "./components/ResultsView";
import { SearchBox, type SuggestDebugInfo } from "./components/SearchBox";
import type { Product, SearchFilter } from "./types";

export default function App() {
  const [dept, setDept] = useState("All");
  const [view, setView] = useState<View>({ kind: "home", products: bestSellers() });
  const [debug, setDebug] = useState<SuggestDebugInfo | null>(null);
  const [latency, setLatency] = useState(mockConfig.originLatencyMs);

  function handleSearch(query: string, filter: SearchFilter = {}) {
    const { products, correctedTo } = searchCatalog(query, dept, filter);
    const where = filter.scope || (dept !== "All" ? dept : "");
    setView({ kind: "results", query, where, brand: filter.brand, products, correctedTo });
  }

  const openProduct = (product: Product) => setView({ kind: "product", product });

  return (
    <>
      <div className="promo">Free shipping on orders $49+ · New-customer deals this week</div>
      <header>
        <div className="bar">
          <div className="logo">
            kaiyo<small>Asian goods, delivered</small>
          </div>
          <SearchBox
            dept={dept}
            departments={catalog.categories}
            trending={catalog.trending}
            onDeptChange={setDept}
            onSearch={handleSearch}
            onSelectProduct={openProduct}
            onDebug={setDebug}
          />
          <div className="acct">
            <span>Sign in</span>
            <span>Cart (0)</span>
          </div>
        </div>
        <nav className="cats" aria-label="Departments">
          {catalog.categories.map((c) => (
            <a
              key={c}
              tabIndex={0}
              className={dept === c ? "on" : undefined}
              onClick={() => setDept(dept === c ? "All" : c)}
            >
              {c}
            </a>
          ))}
          <span className="sep">|</span>
          <a>Best Sellers</a>
          <a>New Arrivals</a>
          <a>
            Sale<span className="new">HOT</span>
          </a>
        </nav>
      </header>
      <main>
        <ResultsView view={view} onOpen={openProduct} />
        <aside className="side">
          <div className="panel">
            <h2>Under the hood</h2>
            <label className="ctl">
              Service latency
              <input
                type="range"
                min={10}
                max={400}
                step={10}
                value={latency}
                onChange={(e) => {
                  mockConfig.originLatencyMs = +e.target.value;
                  setLatency(+e.target.value);
                }}
              />
              <span className="val">{latency} ms</span>
            </label>
            {debug ? (
              <>
                <div className="stats">
                  <div className="stat">
                    <b>{debug.stats.requests}</b>
                    <span>requests sent</span>
                  </div>
                  <div className="stat">
                    <b>{debug.stats.clientHits}</b>
                    <span>client cache</span>
                  </div>
                  <div className="stat">
                    <b>{debug.stats.aborted}</b>
                    <span>aborted</span>
                  </div>
                </div>
                <div className="lat">
                  “{debug.query}” served by <b>{debug.source === "client" ? "client cache" : debug.source === "edge" ? "edge cache" : "suggest service"}</b> in {debug.latencyMs} ms
                </div>
              </>
            ) : (
              <div className="lat">No request yet.</div>
            )}
            <p className="small">
              Responses come from a mock of <code>GET /v1/suggest</code> in <code>src/api/suggestApi.ts</code>. Brands,
              products, prices, ratings and query volumes are fictional sample data.
            </p>
          </div>
        </aside>
      </main>
    </>
  );
}
