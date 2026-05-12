import Link from "@/components/static-link";
import type { LucideIcon } from "lucide-react";
import { Cigarette, Flame, Gauge, Ruler, ShieldCheck, Star } from "lucide-react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductPrice } from "@/components/product-price";
import { ReferenceImage } from "@/components/reference-image";
import { SavedProductButton } from "@/components/saved-product-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ProductCardItem = {
  id: string;
  slug: string;
  name: string;
  price: number;
  description?: string;
  image: string;
  imagePosition: string;
  memberOnly: boolean;
  status: string;
  tags: string[];
  boxCount?: number;
  packageLabel?: string;
  category?: string;
  sku?: string;
  marketPrice?: number;
  nonMemberPrice?: number;
  memberPrice?: number;
  availability?: string;
  origin?: string;
  wrapper?: string;
  vitola?: string;
  length?: string;
  gauge?: string;
  strength?: string;
  expertReview?: {
    sourceName: string;
    score: number;
  };
};

type ProductCardProps = {
  product: ProductCardItem;
  compact?: boolean;
};

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const productHref = `/shop/${product.slug}`;
  const packageLabel = product.packageLabel ?? `Box of ${product.boxCount ?? 1}`;
  const availability = product.availability ?? product.status;
  const priceUnit = /^box\b/i.test(packageLabel) ? "/ box" : "/ item";
  const description =
    product.description?.trim() ||
    (product.sku && product.category
      ? `${product.category} catalog item matched to SKU ${product.sku}.`
      : product.origin && product.wrapper && product.strength
        ? `${product.origin} ${product.wrapper.toLowerCase()} wrapper, ${product.strength.toLowerCase()} strength, curated for balanced aging.`
        : "Published from the live shop catalog with shared storefront and inventory data.");
  const cigarSpecs = [
    { icon: Cigarette, label: "Product", value: product.vitola },
    { icon: Ruler, label: "Length", value: product.length },
    { icon: Gauge, label: "Gauge", value: product.gauge },
    { icon: Flame, label: "Strength", value: product.strength },
  ].filter((spec) => spec.value);

  return (
    <Card className="luxury-card group p-0 transition duration-300 hover:-translate-y-0.5 hover:border-yuzu-gold/75 hover:shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <div className="relative">
        <Link href={productHref} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold">
          <ReferenceImage
            src={product.image}
            alt={`${product.name} product image`}
            objectPosition={product.imagePosition}
            className={cn("h-52 border-b border-yuzu-line/75", compact && "h-40")}
          />
          <span className="sr-only">View details for {product.name}</span>
        </Link>
        <SavedProductButton productName={product.name} productSlug={product.slug} />
        {product.memberOnly && (
          <Badge className="absolute left-3 top-3 border-yuzu-gold bg-yuzu-gold text-yuzu-ink" variant="outline">
            Member
          </Badge>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-3.5 p-4">
        <div className="flex flex-col gap-1">
          <Link href={productHref} className="font-heading text-xl leading-tight text-yuzu-cream transition hover:text-yuzu-gold">
            {product.name}
          </Link>
          <p className="text-sm text-yuzu-muted">{packageLabel}</p>
        </div>
        <p className="line-clamp-3 min-h-14 text-sm leading-6 text-yuzu-muted">
          {description}
        </p>
        {cigarSpecs.length > 0 && (
          <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-2")}>
            {cigarSpecs.map((spec) => (
              <SpecPill key={spec.label} icon={spec.icon} label={spec.label} value={spec.value ?? ""} compact={compact} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-xs text-yuzu-muted">
          <span>{product.category ?? product.tags[0] ?? "Catalog"}</span>
          <span className="text-right text-yuzu-cream/70">{availability}</span>
        </div>
        {product.expertReview && (
          <div className="flex items-center gap-2 border border-yuzu-line/60 bg-yuzu-night/75 px-3 py-2 text-xs text-yuzu-muted">
            <Star className="size-4 text-yuzu-gold" />
            <span>
              {product.expertReview.score}-point {product.expertReview.sourceName} review
            </span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t border-yuzu-line/75 bg-yuzu-night/18 p-4">
        <ProductPrice
          product={product}
          unitLabel={priceUnit}
          priceClassName="font-heading text-2xl text-yuzu-gold"
          unitClassName="ml-1 text-xs text-yuzu-muted"
          captionClassName="text-[0.68rem] uppercase tracking-[0.12em]"
        />
        <AddToCartButton
          product={product}
          className="border-yuzu-gold bg-transparent text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
          variant="outline"
        />
      </CardFooter>
      <div className="flex items-center gap-2 border-t border-yuzu-line/60 bg-yuzu-night/20 px-4 py-3 text-xs text-yuzu-muted">
        <ShieldCheck />
        Adult signature and age verification required
      </div>
    </Card>
  );
}

function SpecPill({ icon: Icon, label, value, compact = false }: { icon: LucideIcon; label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("grid gap-1 border border-yuzu-line/55 bg-yuzu-night/78 px-2.5 text-xs", compact ? "min-h-11 py-1.5" : "min-h-14 py-2")}>
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-yuzu-gold" />
        <p className="min-w-0 truncate text-[0.62rem] font-bold uppercase tracking-[0.08em] text-yuzu-muted">{label}</p>
      </div>
      <p className="break-words font-heading text-[0.82rem] leading-tight text-yuzu-cream">{value}</p>
    </div>
  );
}
