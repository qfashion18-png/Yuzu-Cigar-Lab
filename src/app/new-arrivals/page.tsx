import type { Metadata } from "next";

import { MemberViewBanner } from "@/components/member-view-banner";
import { ProductCard } from "@/components/product-card";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import { luxuryCatalogProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "New Arrivals | Yuzu Cigar Club",
  description:
    "Browse newly released premium cigar boxes selected for freshness, aging potential, and member value.",
  alternates: {
    canonical: "/new-arrivals",
  },
  openGraph: {
    title: "New Arrivals | Yuzu Cigar Club",
    description:
      "Browse newly released premium cigar boxes selected for freshness, aging potential, and member value.",
    url: "/new-arrivals",
  },
};

export default function NewArrivalsPage() {
  const arrivals = luxuryCatalogProducts.slice(0, 8);

  return (
    <div className="mx-auto max-w-[1520px] px-5 py-8 lg:px-10">
      <section className="luxury-card grid overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-center p-8 lg:p-10">
          <SectionHeading
            kicker="New Arrivals"
            title="Fresh boxes with a proper aging path."
            copy="Latest curated boxes, inspected for wrapper integrity, box condition, age, and member value before release."
          />
        </div>
        <ReferenceImage src="/assets/shop-hero.png" alt="New cigar arrivals" className="min-h-80" objectPosition="center" priority />
      </section>
      <MemberViewBanner context="shop" className="mt-6" />
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {arrivals.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>
    </div>
  );
}
