"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

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

type CatalogPagination = {
  category: string;
  visibleCount: number;
};

function getCategoryFromParam(category: string | null, categories: string[]) {
  return category && categories.includes(category) ? category : "All";
}

export function ShopCatalog({ products, categories }: ShopCatalogProps) {
  const searchParams = useSearchParams();
  const activeCategory = getCategoryFromParam(searchParams.get(categoryParamKey), categories);
  const [query, setQuery] = useState("");
  const shouldReduceMotion = useReducedMotion();
  const [pagination, setPagination] = useState<CatalogPagination>(() => ({
    category: activeCategory,
    visibleCount: pageSize,
  }));
  const visibleCount = pagination.category === activeCategory ? pagination.visibleCount : pageSize;

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setPagination({ category: activeCategory, visibleCount: pageSize });
  }

  function updateCategory(nextCategory: string) {
    setPagination({ category: nextCategory, visibleCount: pageSize });

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
            <motion.p
              key={`${activeCategory}-${query}-${visibleProducts.length}-${filteredProducts.length}`}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="mt-2 text-sm text-yuzu-muted"
            >
              Showing {visibleProducts.length.toLocaleString()} of {filteredProducts.length.toLocaleString()} matched catalog items
            </motion.p>
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
        <AnimatePresence mode="popLayout">
          {visibleProducts.map((product) => (
            <motion.div
              key={product.id}
              layout
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {visibleProducts.length < filteredProducts.length && (
        <div className="mt-6 flex justify-center">
          <Button
            className="h-11 border-yuzu-gold px-7 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
            variant="outline"
            onClick={() =>
              setPagination((current) => ({
                category: activeCategory,
                visibleCount: (current.category === activeCategory ? current.visibleCount : pageSize) + pageSize,
              }))
            }
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
