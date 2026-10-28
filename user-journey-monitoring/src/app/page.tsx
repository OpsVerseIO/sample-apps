import Link from "next/link";
import { TrackJourneyStep } from "@/components/TrackJourneyStep";
import { CATEGORIES, formatPrice, PRODUCTS } from "@/lib/products";

export default async function Home({ searchParams }: PageProps<"/">) {
  const category = (await searchParams).category as string | undefined;
  const products = category ? PRODUCTS.filter((p) => p.category === category) : PRODUCTS;

  return (
    <>
      <TrackJourneyStep key={category ?? "all"} step="browse" attributes={{ category: category ?? "all" }} />
      <h1>Shop</h1>
      <div className="filters">
        <Link href="/" className={!category ? "chip active" : "chip"}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/?category=${c}`}
            className={category === c ? "chip active" : "chip"}
          >
            {c}
          </Link>
        ))}
      </div>
      <ul className="grid">
        {products.map((p) => (
          <li key={p.id} className="card">
            <Link href={`/products/${p.id}`}>
              <div className="thumb">{p.emoji}</div>
              <h3>{p.name}</h3>
              <p className="price">{formatPrice(p.price)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
