import type { Product } from "../types";

const SHAPES: Record<string, string> = {
  bowl: "M5 19h30a15 13 0 0 1-30 0zM8 16h24v3H8z",
  box: "M8 13l12-6 12 6v15l-12 6-12-6zM8 13l12 6 12-6M20 19v15",
  jar: "M13 6h14v5H13zM11 12h18v20a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z",
  bottle: "M17 5h6v5l3 4v20H14V14l3-4z",
  tube: "M15 5h10v4l2 2v24H13V11l2-2z",
  mask: "M8 10c4-3 20-3 24 0v14c0 6-6 10-12 10S8 30 8 24z",
  cup: "M8 14h24v14a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6zM10 10h20v3H10z",
};

/** Placeholder product image. Swap for <img src={product.imageUrl}> with a real catalog. */
export function ProductThumb({ product, size }: { product: Product; size: number }) {
  const { hue } = product;
  return (
    <svg className="th" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="6" fill={`hsl(${hue} 55% 92%)`} />
      <path
        d={SHAPES[product.shape] ?? SHAPES.box}
        fill={`hsl(${hue} 50% 48%)`}
        stroke={`hsl(${hue} 50% 34%)`}
        strokeWidth=".6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const money = (n: number) => `$${n.toFixed(2)}`;
