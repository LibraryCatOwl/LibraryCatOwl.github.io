import type { Product } from "../types";
import { ProductThumb, money } from "./ProductThumb";

export type View =
  | { kind: "home"; products: Product[] }
  | { kind: "results"; query: string; where: string; brand?: string; products: Product[]; correctedTo: string | null }
  | { kind: "product"; product: Product };

function Card({ product, onOpen }: { product: Product; onOpen: (p: Product) => void }) {
  return (
    <div
      className="card"
      role="link"
      tabIndex={0}
      aria-label={product.title}
      style={{ cursor: "pointer" }}
      onClick={() => onOpen(product)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(product)}
    >
      {product.reviews >= 4000 && <span className="hot">Best seller</span>}
      <ProductThumb product={product} size={180} />
      <div className="pt">{product.title}</div>
      <div className="price">{money(product.price)}</div>
      <div className="meta">
        ★ {product.rating} ({product.reviews.toLocaleString()})
      </div>
    </div>
  );
}

export function ResultsView({ view, onOpen }: { view: View; onOpen: (p: Product) => void }) {
  if (view.kind === "home") {
    return (
      <section>
        <h1>Find it before you finish typing</h1>
        <p className="lede">
          The React version of the search suggestions prototype. Click into the search box to see recent and
          trending searches, then type. Use ↑ ↓ to move, Enter to choose, Tab to accept the top completion, Esc to
          close.
        </p>
        <h2>Best sellers</h2>
        <div className="grid">
          {view.products.map((p) => (
            <Card key={p.id} product={p} onOpen={onOpen} />
          ))}
        </div>
      </section>
    );
  }

  if (view.kind === "product") {
    const p = view.product;
    return (
      <section>
        <p className="crumb">
          Home › {p.category} › {p.brand}
        </p>
        <div className="pdp">
          <ProductThumb product={p} size={260} />
          <div>
            <h1>{p.title}</h1>
            <p>
              <span className="price" style={{ fontSize: 26 }}>
                {money(p.price)}
              </span>
            </p>
            <p className="pm" style={{ textAlign: "left" }}>
              ★ {p.rating} from {p.reviews.toLocaleString()} reviews · Free shipping on orders $49+
            </p>
          </div>
        </div>
      </section>
    );
  }

  const n = view.products.length;
  return (
    <section>
      <p className="crumb">
        Home › Search{view.where && ` › ${view.where}`}
        {view.brand && ` › ${view.brand}`}
      </p>
      <h1>
        {n} {n === 1 ? "result" : "results"} for “{view.brand || view.query}”
      </h1>
      {view.correctedTo && (
        <p className="lede">
          No results for “{view.query}”. Showing results for <b>{view.correctedTo}</b>.
        </p>
      )}
      {n ? (
        <div className="grid">
          {view.products.map((p) => (
            <Card key={p.id} product={p} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className="lede">Nothing matches. Suggestions only offer queries that return results, to prevent this page.</p>
      )}
    </section>
  );
}
