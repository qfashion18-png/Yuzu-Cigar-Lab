"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogListingProduct } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const pageSize = 24;
const categoryParamKey = "category";

type ShopCatalogProps = {
  products: CatalogListingProduct[];
  categories: string[];
};

function getInitialCategory(categories: string[]) {
  if (typeof window === "undefined") {
    return "All";
  }

  const params = new URLSearchParams(window.location.search);
  const category = params.get(categoryParamKey);

  return category && categories.includes(category) ? category : "All";
}

export function ShopCatalog({ products, categories }: ShopCatalogProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(() => getInitialCategory(categories));
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    function syncCategoryFromUrl() {
      setActiveCategory(getInitialCategory(categories));
      setVisibleCount(pageSize);
    }

    window.addEventListener("popstate", syncCategoryFromUrl);

    return () => {
      window.removeEventListener("popstate", syncCategoryFromUrl);
    };
  }, [categories]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setVisibleCount(pageSize);
  }

  function updateCategory(nextCategory: string) {
    setActiveCategory(nextCategory);
    setVisibleCount(pageSize);

    const url = new URL(window.location.href);

    if (nextCategory === "All") {
      url.searchParams.delete(categoryParamKey);
    } else {
      url.searchParams.set(categoryParamKey, nextCategory);
    }

    url.hash = "catalog";
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.sku, product.brand, product.category, product.slug].some((value) =>
          value.toLowerCase().includes(normalizedQuery)
        );

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, products, query]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  return (
    <section id="catalog">
      <div className="mb-5 grid gap-4 border border-yuzu-line/70 bg-yuzu-panel/70 p-4">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">Sort by: Imported catalog order</p>
            <p className="mt-2 text-sm text-yuzu-muted">
              Showing {visibleProducts.length.toLocaleString()} of {filteredProducts.length.toLocaleString()} matched catalog items
            </p>
          </div>
          <label className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-yuzu-muted" />
            <Input
              value={query}
              onChange={(event) => updateQuery(event.currentTarget.value)}
              placeholder="Search by product, SKU, brand, or category"
              className="h-11 rounded-sm border-yuzu-line/80 bg-yuzu-night/80 pl-10 text-yuzu-cream"
            />
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {["All", ...categories].map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => updateCategory(category)}
              className={cn(
                "min-h-10 shrink-0 border px-3 text-xs font-bold uppercase tracking-[0.12em] transition",
                activeCategory === category
                  ? "border-yuzu-gold bg-yuzu-gold text-yuzu-ink"
                  : "border-yuzu-line/70 bg-yuzu-night/65 text-yuzu-muted hover:border-yuzu-gold hover:text-yuzu-gold"
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {visibleProducts.length < filteredProducts.length && (
        <div className="mt-6 flex justify-center">
          <Button
            className="h-11 border-yuzu-gold px-7 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
            variant="outline"
            onClick={() => setVisibleCount((current) => current + pageSize)}
          >
            Load More
          </Button>
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="border border-yuzu-line bg-yuzu-panel p-8 text-center text-yuzu-muted">
          No catalog items match this search.
        </div>
      )}
    </section>
  );
}
