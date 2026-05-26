import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Cigarette,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Gauge,
  Hash,
  Layers3,
  Leaf,
  Package,
  Ruler,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Truck,
} from "lucide-react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import Link from "@/components/static-link";
import { MemberViewBanner } from "@/components/member-view-banner";
import { ProductPrice } from "@/components/product-price";
import { ProductCard } from "@/components/product-card";
import { ReferenceImage } from "@/components/reference-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCatalogProductDetails, getCatalogReviewAudit, getStorefrontProductBySlug, storefrontProducts } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return storefrontProducts.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);

  if (!product) {
    return {
      title: "Catalog Item Not Found | Yuzu Cigar Club",
    };
  }

  const details = getCatalogProductDetails(product);

  return {
    title: `${product.name} | Yuzu Cigar Club`,
    description: details.summary,
    alternates: {
      canonical: `${siteUrl}/shop/${product.slug}/`,
    },
    openGraph: {
      title: `${product.name} | Yuzu Cigar Club`,
      description: details.summary,
      url: `${siteUrl}/shop/${product.slug}/`,
      images: [toAbsoluteUrl(product.image)],
      type: "website",
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProduct(slug);

  if (!product) {
    notFound();
  }

  const details = getCatalogProductDetails(product);
  const relatedProducts = storefrontProducts
    .filter((candidate) => candidate.id !== product.id)
    .filter((candidate) => candidate.category === product.category || candidate.brand === product.brand)
    .slice(0, 3);
  const hasCigarSpecs = Boolean(product.vitola || product.length || product.gauge || product.strength || product.wrapper || product.filler || product.binder);
  const reviewAudit = getCatalogReviewAudit(product);
  const productJsonLd = toJsonLd({
    type: "Product",
    name: product.name,
    description: details.summary,
    image: toAbsoluteUrl(product.image),
    sku: product.sku,
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    category: product.category,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/shop/${product.slug}/`,
      price: product.nonMemberPrice,
      priceCurrency: "USD",
      availability: getSchemaAvailability(product.availability),
      priceValidUntil: "2026-12-31",
      itemCondition: "https://schema.org/NewCondition",
    },
  });
  const breadcrumbJsonLd = toJsonLd({
    type: "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${siteUrl}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${siteUrl}/shop/${product.slug}/`,
      },
    ],
  });
  const specTiles = [
    ...(hasCigarSpecs
      ? [
          { icon: Cigarette, label: "Product", value: product.vitola ?? product.category },
          { icon: Ruler, label: "Length", value: product.length ?? "Not listed" },
          { icon: Gauge, label: "Gauge", value: product.gauge ?? "Not listed" },
          { icon: Flame, label: "Strength", value: product.strength ?? "Not listed" },
        ]
      : []),
    { icon: Hash, label: "SKU", value: product.sku },
    { icon: Layers3, label: "Category", value: product.category },
    { icon: Package, label: "Package", value: product.packageLabel },
    { icon: Clock, label: "Availability", value: product.availability },
    { icon: Tag, label: "Source", value: product.sourceStatus },
  ];

  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-8 px-5 py-8 md:px-[clamp(3rem,8.5vw,5rem)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Link href="/shop" className="inline-flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-muted transition hover:text-yuzu-gold">
        <ArrowLeft className="size-4" />
        Back to shop
      </Link>

      <MemberViewBanner context="shop" />

      <section className="luxury-card grid overflow-hidden md:grid-cols-[1.05fr_0.95fr]">
        <div
          data-product-main-image="contained"
          className="relative min-h-[22rem] border-b border-yuzu-line/70 bg-[#d8ccb1] md:min-h-[44rem] md:border-b-0 md:border-r"
        >
          <ReferenceImage
            src={product.image}
            alt={`${product.name} open cigar box`}
            objectPosition={product.imagePosition}
            className="absolute inset-0 h-full bg-[#d8ccb1]"
            imageClassName="object-contain opacity-100"
            priority
          />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <Badge key={tag} className="border-yuzu-gold bg-yuzu-night/75 text-yuzu-gold backdrop-blur" variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-8 p-6 md:gap-5 md:p-5 lg:gap-6 lg:p-8 xl:gap-8 xl:p-10">
          <div className="flex flex-col gap-5 md:gap-4 lg:gap-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-yuzu-gold">
              <span>{product.brand}</span>
              <span className="h-px w-8 bg-yuzu-line" />
              <span>SKU {product.sku}</span>
              {product.memberOnly && <span className="border border-yuzu-gold px-2 py-1 text-yuzu-gold">Member</span>}
            </div>

            <div className="space-y-4 md:space-y-3 lg:space-y-4">
              <h1 className="font-heading text-4xl leading-tight text-yuzu-cream md:text-[2rem] lg:text-5xl xl:text-6xl">{product.name}</h1>
              <p className="max-w-2xl text-sm leading-7 text-yuzu-muted md:text-xs md:leading-6 lg:text-sm lg:leading-7 xl:text-base xl:leading-8">{details.summary}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:gap-3">
              {specTiles.map((spec) => (
                <Spec key={spec.label} icon={spec.icon} label={spec.label} value={spec.value} />
              ))}
            </div>
          </div>

          <div className="grid gap-4 border-t border-yuzu-line pt-5 md:gap-3 md:pt-4 lg:gap-5 lg:pt-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-yuzu-muted">Box price</p>
                <ProductPrice
                  product={product}
                  priceClassName="font-heading text-4xl text-yuzu-gold lg:text-5xl"
                  captionClassName="text-xs uppercase tracking-[0.16em]"
                />
              </div>
              <div className="min-w-40">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-yuzu-muted md:text-[0.6rem] lg:text-xs">
                  <span>Inventory</span>
                  <span>{product.availability}</span>
                </div>
                <div className="h-2 overflow-hidden bg-yuzu-night ring-1 ring-yuzu-line">
                  <div className="h-full bg-yuzu-gold" style={{ width: product.availability === "Out of stock" ? "12%" : product.availability === "Low stock" ? "42%" : "88%" }} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <AddToCartButton
                product={product}
                label="Add Item"
                icon="bag"
                className="h-10 bg-yuzu-gold px-4 text-xs text-yuzu-ink hover:bg-yuzu-gold-light lg:px-6"
                variant="default"
                showInlineStatus
              />
              <Button className="h-10 border-yuzu-gold px-4 text-xs text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink lg:px-6" variant="outline" render={<Link href="/membership" />}>
                <Sparkles data-icon="inline-start" />
                Member Pricing
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-[1.08fr_0.92fr]">
        <div className="grid min-w-0 gap-5">
          <DetailPanel title="Catalog Signals" icon={FileText}>
            <div className="flex flex-wrap gap-2">
              {details.signals.map((note) => (
                <span key={note} className="border border-yuzu-line bg-yuzu-night px-3 py-2 text-sm text-yuzu-cream">
                  {note}
                </span>
              ))}
            </div>
          </DetailPanel>

          {hasCigarSpecs && (
            <DetailPanel title="Blend Details" icon={Leaf}>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <DataRow label="Product" value={product.vitola ?? "Not listed"} />
                <DataRow label="Length" value={product.length ?? "Not listed"} />
                <DataRow label="Gauge" value={product.gauge ?? "Not listed"} />
                <DataRow label="Strength" value={product.strength ?? "Not listed"} />
                <DataRow label="Country" value={product.origin ?? "Not listed"} />
                <DataRow label="Wrapper" value={product.wrapper ?? "Not listed"} />
                <DataRow label="Binder" value={product.binder ?? "Not listed"} />
                <DataRow label="Filler" value={product.filler ?? "Not listed"} />
              </dl>
            </DetailPanel>
          )}

        </div>

        <div className="grid min-w-0 gap-5">
          <DetailPanel title="Catalog Intelligence" icon={Package}>
            <dl className="grid gap-4 text-sm">
              <DataRow label="SKU" value={product.sku} />
              <DataRow label="Brand" value={product.brand} />
              <DataRow label="Category" value={product.category} />
              <DataRow label="Package" value={product.packageLabel} />
              <DataRow label="Source status" value={product.sourceStatus} />
            </dl>
          </DetailPanel>

          <DetailPanel title="Ratings & Reviews" icon={Star}>
            {product.expertReview && <ExpertReviewPanel product={product} />}

            {product.reviewProfile && <ReviewProfilePanel profile={product.reviewProfile} />}

            {!product.expertReview && !product.reviewProfile && reviewAudit && <ReviewAuditPanel audit={reviewAudit} />}

            {!product.expertReview && !product.reviewProfile && !reviewAudit && (
              <div className="grid gap-4 text-sm leading-7 text-yuzu-muted">
                <p>No matched Cigar Aficionado review is attached to this inventory item yet.</p>
                <a
                  href={product.reviewSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 w-fit items-center gap-2 border border-yuzu-gold px-3 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-gold transition hover:bg-yuzu-gold hover:text-yuzu-ink"
                >
                  Search Ratings
                  <ExternalLink className="size-4" />
                </a>
              </div>
            )}
          </DetailPanel>

          <DetailPanel title="Fulfillment" icon={Truck}>
            <ul className="grid gap-3">
              {details.fulfillment.map((pairing) => (
                <li key={pairing} className="flex items-center gap-3 text-sm text-yuzu-muted">
                  <span className="size-1.5 bg-yuzu-gold" />
                  {pairing}
                </li>
              ))}
            </ul>
          </DetailPanel>

          <div className="flex min-w-0 items-start gap-3 border border-yuzu-line bg-yuzu-night p-4 text-sm leading-6 text-yuzu-muted">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-yuzu-gold" />
            Adult signature and age verification are required before any order leaves the humidor.
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-heading text-3xl text-yuzu-cream">Similar Items</h2>
            <Link href="/shop" className="text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold transition hover:text-yuzu-gold-light">
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function getProduct(slug: string) {
  return getStorefrontProductBySlug(slug);
}

function toJsonLd<T extends { type: string }>(value: T) {
  const { type, ...rest } = value;

  return {
    "@context": "https://schema.org",
    "@type": type,
    ...rest,
  };
}

function toAbsoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function getSchemaAvailability(availability: string) {
  if (availability === "Out of stock") {
    return "https://schema.org/OutOfStock";
  }

  if (availability === "Low stock") {
    return "https://schema.org/LimitedAvailability";
  }

  return "https://schema.org/InStock";
}

function Spec({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 border border-yuzu-line/65 bg-yuzu-night/75 p-3 md:gap-1.5 md:p-2 lg:gap-3 lg:p-4">
      <Icon className="size-4 text-yuzu-gold md:size-3.5 lg:size-5" />
      <div className="min-w-0">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-yuzu-muted md:text-[0.56rem] lg:text-[0.7rem]">{label}</p>
        <p className="break-words font-heading text-sm text-yuzu-cream md:text-xs lg:text-lg">{value}</p>
      </div>
    </div>
  );
}

function formatOtherReviews(reviews: Array<{ score: number; issue: string }>) {
  if (reviews.length === 0) {
    return "None listed";
  }

  return reviews.map((review) => `${review.score} (${review.issue})`).join("; ");
}

function ExpertReviewPanel({ product }: { product: NonNullable<ReturnType<typeof getProduct>> }) {
  if (!product.expertReview) {
    return null;
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4 border border-yuzu-line bg-yuzu-night p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-yuzu-muted">{product.expertReview.sourceName}</p>
          <p className="mt-1 font-heading text-5xl text-yuzu-gold">{product.expertReview.score}</p>
        </div>
        <a
          href={product.expertReview.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-10 items-center gap-2 border border-yuzu-gold px-3 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-gold transition hover:bg-yuzu-gold hover:text-yuzu-ink"
        >
          Source
          <ExternalLink className="size-4" />
        </a>
      </div>
      <p className="text-sm leading-7 text-yuzu-muted">{product.expertReview.tastingSummary}</p>
      <dl className="grid gap-4 text-sm">
        <DataRow label="Issue" value={product.expertReview.issue} />
        <DataRow label="Other reviews" value={formatOtherReviews(product.expertReview.otherReviews)} />
      </dl>
    </div>
  );
}

function ReviewProfilePanel({ profile }: { profile: NonNullable<ReturnType<typeof getProduct>>["reviewProfile"] }) {
  if (!profile) {
    return null;
  }

  return (
    <div className="grid gap-4 text-sm leading-7 text-yuzu-muted">
      <p>{profile.summary}</p>
      <ReviewQueryRow value={profile.searchQuery} />
      <ul className="grid gap-4">
        {profile.sources.map((source) => (
          <li key={source.sourceName} className="border-t border-yuzu-line/60 pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">{source.sourceName}</p>
                <p className="mt-1 font-heading text-lg text-yuzu-cream">{source.rating}</p>
              </div>
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 border border-yuzu-gold px-3 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-gold transition hover:bg-yuzu-gold hover:text-yuzu-ink"
              >
                Source
                <ExternalLink className="size-4" />
              </a>
            </div>
            <ul className="mt-3 grid gap-2">
              {source.keyDetails.map((detail) => (
                <li key={detail} className="flex gap-3">
                  <span className="mt-3 size-1.5 shrink-0 bg-yuzu-gold" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewQueryRow({ value }: { value: string }) {
  return (
    <div className="grid gap-2 border-b border-yuzu-line/60 pb-3 text-sm sm:grid-cols-[8rem_1fr]">
      <dt className="text-yuzu-muted">Research query</dt>
      <dd className="min-w-0 break-words font-heading text-base leading-6 text-yuzu-cream sm:text-right">{value}</dd>
    </div>
  );
}

function ReviewAuditPanel({ audit }: { audit: NonNullable<ReturnType<typeof getCatalogReviewAudit>> }) {
  return (
    <div className="grid gap-4 text-sm leading-7 text-yuzu-muted">
      <p>{audit.summary}</p>
      <ReviewQueryRow value={audit.searchPrompt} />
      <dl className="grid gap-3">
        {audit.details.map((detail) => (
          <div key={detail.label} className="grid gap-1 border-b border-yuzu-line/50 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[7rem_1fr]">
            <dt className="text-yuzu-muted">{detail.label}</dt>
            <dd className="min-w-0 break-words font-heading text-base leading-6 text-yuzu-cream sm:text-right">{detail.value}</dd>
          </div>
        ))}
      </dl>
      <a
        href={audit.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-10 w-fit items-center gap-2 border border-yuzu-gold px-3 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-gold transition hover:bg-yuzu-gold hover:text-yuzu-ink"
      >
        Search Ratings
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

function DetailPanel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="luxury-card min-w-0 p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="size-5 text-yuzu-gold" />
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 border-b border-yuzu-line/60 pb-3 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-yuzu-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right font-heading text-lg text-yuzu-cream">{value}</dd>
    </div>
  );
}
