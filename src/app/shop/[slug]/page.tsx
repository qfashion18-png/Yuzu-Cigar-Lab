import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Cigarette,
  ExternalLink,
  Flame,
  Package,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import Link from "@/components/static-link";
import { ProductPrice } from "@/components/product-price";
import { ReferenceImage } from "@/components/reference-image";
import type { CatalogProduct } from "@/lib/catalog";
import {
  getCatalogProductDetails,
  getCatalogProductDisplayName,
  getCatalogProductSeoName,
  getStorefrontProductBySlug,
  storefrontProducts,
} from "@/lib/catalog";
import { buildProductImageAlt } from "@/lib/image-seo";
import { buildProductPageCopy } from "@/lib/product-page-content";
import { buildBreadcrumbJsonLd, buildPageMetadata, buildProductJsonLd, jsonLdScriptProps } from "@/lib/seo";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

type ProductFact = {
  icon: LucideIcon;
  label: string;
  value: string;
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
  const copy = buildProductPageCopy(details.summary, product.sku);
  const displayName = getCatalogProductDisplayName(product.name);
  const seoName = getCatalogProductSeoName(product);

  return buildPageMetadata({
    title: `${seoName} | Yuzu Cigar Club`,
    description: copy.metaDescription,
    path: `/shop/${product.slug}/`,
    image: product.image,
    imageAlt: buildProductImageAlt(product),
    keywords: [displayName, product.brand, product.category, "premium cigar box"],
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProduct(slug);

  if (!product) {
    notFound();
  }

  const details = getCatalogProductDetails(product);
  const copy = buildProductPageCopy(details.summary, product.sku);
  const displayName = getCatalogProductDisplayName(product.name);
  const overviewFacts = buildOverviewFacts(product);
  const specificationRows = buildSpecificationRows(product);
  const relatedProducts = storefrontProducts
    .filter((candidate) => candidate.id !== product.id)
    .filter((candidate) => candidate.category === product.category || candidate.brand === product.brand)
    .slice(0, 3);
  const productJsonLd = buildProductJsonLd(product, details);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop/" },
    { name: displayName, path: `/shop/${product.slug}/` },
  ]);

  return (
    <div
      data-product-page-layout="editorial"
      className="mx-auto flex max-w-[1520px] flex-col gap-10 px-5 py-7 md:px-[clamp(3rem,8.5vw,5rem)] md:py-9"
    >
      <script {...jsonLdScriptProps(productJsonLd)} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <Link
        href="/shop"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-muted transition hover:text-yuzu-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold"
      >
        <ArrowLeft className="size-4" />
        Back to shop
      </Link>

      <section aria-labelledby="product-title" className="luxury-card grid overflow-hidden lg:grid-cols-[1.04fr_0.96fr]">
        <div
          data-product-main-image="contained"
          className="relative min-h-[14rem] border-b border-yuzu-line/70 bg-[#d8ccb1] sm:min-h-[22rem] lg:min-h-[38rem] lg:border-b-0 lg:border-r"
        >
          <ReferenceImage
            src={product.image}
            alt={buildProductImageAlt(product)}
            objectPosition={product.imagePosition}
            className="absolute inset-0 h-full bg-[#d8ccb1]"
            imageClassName="object-contain opacity-100"
            sizes="(max-width: 768px) 100vw, 52vw"
            priority
          />
          {product.memberOnly && (
            <span className="absolute left-4 top-4 border border-yuzu-gold bg-yuzu-night/85 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold backdrop-blur">
              Members only
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-col p-6 sm:p-8 md:p-7 lg:p-10 xl:p-12">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold">
            <span>{product.brand}</span>
            <span aria-hidden="true" className="h-px w-8 bg-yuzu-line" />
            <span className="text-yuzu-muted">{product.category}</span>
          </div>

          <h1 id="product-title" className="mt-4 max-w-3xl font-heading text-4xl leading-tight text-yuzu-cream sm:mt-5 lg:text-5xl xl:text-6xl">
            {displayName}
          </h1>
          <p data-product-summary="lead" className="mt-3 max-w-2xl text-sm leading-7 text-yuzu-muted sm:mt-4 lg:text-base lg:leading-8">
            {copy.lead}
          </p>

          <div className="mt-5 border-y border-yuzu-line/70 py-5 max-lg:pr-12 sm:mt-7 sm:py-6">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <ProductPrice
                product={product}
                priceClassName="font-heading text-4xl text-yuzu-gold lg:text-5xl"
                captionClassName="text-xs uppercase tracking-[0.16em]"
              />
              <p className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-yuzu-cream">
                <span aria-hidden="true" className="size-2 bg-yuzu-gold" />
                {product.availability}
              </p>
            </div>

            <AddToCartButton
              product={product}
              label="Add to cart"
              icon="bag"
              className="mt-4 h-12 w-full bg-yuzu-gold px-6 text-sm text-yuzu-ink hover:bg-yuzu-gold-light sm:mt-5"
              variant="default"
            />

            <div className="mt-4 grid gap-3 text-xs leading-5 text-yuzu-muted sm:grid-cols-2">
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-yuzu-gold" />
                Age-verified checkout
              </p>
              <p className="flex items-center gap-2 sm:justify-end">
                <Truck className="size-4 shrink-0 text-yuzu-gold" />
                Adult signature delivery
              </p>
            </div>
          </div>

          {overviewFacts.length > 0 && (
            <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-3">
              {overviewFacts.map((fact) => (
                <OverviewFact key={fact.label} {...fact} />
              ))}
            </dl>
          )}
        </div>
      </section>

      {product.assortment && <AssortmentPanel assortment={product.assortment} />}

      <section className={`grid gap-6 ${copy.story ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-1"}`} aria-label="Product information">
        {copy.story && (
          <article className="luxury-card min-w-0 p-6 sm:p-8 lg:p-10">
            <SectionHeading eyebrow="Overview" title="About this selection" />
            <p data-product-summary="story" className="mt-6 max-w-3xl text-base leading-8 text-yuzu-muted">
              {copy.story}
            </p>
          </article>
        )}

        <article className="luxury-card min-w-0 p-6 sm:p-8 lg:p-10">
          <SectionHeading
            eyebrow="Product details"
            title={product.assortment ? "Sampler details" : specificationRows.length > 1 ? "Blend and origin" : "Catalog reference"}
          />
          <dl className="mt-6 grid gap-4">
            {specificationRows.map((row) => (
              <DataRow key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        </article>
      </section>

      <section aria-labelledby="reviews-title" className="luxury-card min-w-0 p-6 sm:p-8 lg:p-10">
        <div className="grid gap-3 border-b border-yuzu-line/70 pb-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="fine-label">Independent sources</p>
            <h2 id="reviews-title" className="mt-2 font-heading text-3xl text-yuzu-cream sm:text-4xl">
              Ratings &amp; reviews
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-yuzu-muted md:text-right">Only ratings matched to this blend or product line are shown.</p>
        </div>

        <div className="pt-6">
          {product.expertReview && <ExpertReviewPanel product={product} />}
          {product.reviewProfile && <ReviewProfilePanel profile={product.reviewProfile} />}
          {!product.expertReview && !product.reviewProfile && <NoSourcedReviewsPanel />}
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section aria-labelledby="related-products-title">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="fine-label">Keep exploring</p>
              <h2 id="related-products-title" className="mt-2 font-heading text-3xl text-yuzu-cream sm:text-4xl">
                Similar selections
              </h2>
            </div>
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold transition hover:text-yuzu-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold"
            >
              View all
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {relatedProducts.map((relatedProduct) => (
              <RelatedProductCard key={relatedProduct.id} product={relatedProduct} />
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

function buildOverviewFacts(product: CatalogProduct): ProductFact[] {
  if (product.assortment) {
    return [
      { icon: Package, label: "Pack", value: `${product.assortment.items.length} cigars` },
      { icon: Cigarette, label: "Format", value: "60 ring · mixed lengths" },
      { icon: Flame, label: "Strength", value: "Varied profiles" },
    ];
  }

  const format = buildFormat(product);

  return [
    { icon: Package, label: "Pack", value: product.packageLabel },
    format ? { icon: Cigarette, label: "Format", value: format } : null,
    product.strength ? { icon: Flame, label: "Strength", value: product.strength } : null,
  ].filter((fact): fact is ProductFact => Boolean(fact));
}

function buildFormat(product: CatalogProduct) {
  const dimensions = [
    product.length && product.length !== "Assorted" ? product.length : null,
    product.gauge && product.gauge !== "Assorted" ? `${product.gauge} ring` : null,
  ].filter(Boolean);
  const size = dimensions.join(" × ");
  const values = [product.vitola, size].filter((value) => value && value !== "Assorted");

  return values.join(" · ");
}

function buildSpecificationRows(product: CatalogProduct) {
  const rows = product.assortment
    ? [
        { label: "Blend & origin", value: "Varies by selection" },
        { label: "Packaging", value: "Sealed pack" },
      ]
    : [
        product.origin ? { label: "Origin", value: product.origin } : null,
        product.wrapper ? { label: "Wrapper", value: product.wrapper } : null,
        product.binder ? { label: "Binder", value: product.binder } : null,
        product.filler ? { label: "Filler", value: product.filler } : null,
      ];

  return [...rows, { label: "SKU", value: product.sku }].filter((row): row is { label: string; value: string } => Boolean(row));
}

function OverviewFact({ icon: Icon, label, value }: ProductFact) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-yuzu-muted">
        <Icon className="size-4 shrink-0 text-yuzu-gold" />
        {label}
      </dt>
      <dd className="mt-2 break-words font-heading text-lg leading-6 text-yuzu-cream">{value}</dd>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="fine-label">{eyebrow}</p>
      <h2 className="mt-2 font-heading text-3xl text-yuzu-cream sm:text-4xl">{title}</h2>
    </div>
  );
}

function AssortmentPanel({ assortment }: { assortment: NonNullable<CatalogProduct["assortment"]> }) {
  return (
    <section aria-labelledby="assortment-title" className="luxury-card min-w-0 p-6 sm:p-8 lg:p-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="fine-label">Inside the sampler</p>
          <h2 id="assortment-title" className="mt-2 font-heading text-3xl text-yuzu-cream sm:text-4xl">
            What&apos;s included
          </h2>
        </div>
        <a
          href={assortment.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open sampler contents source at ${assortment.sourceName} in a new tab`}
          className="inline-flex min-h-11 w-fit items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-gold transition hover:text-yuzu-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold"
        >
          Verified by {assortment.sourceName}
          <ExternalLink className="size-4" />
        </a>
      </div>

      <ol className="mt-6 grid gap-px border border-yuzu-line/70 bg-yuzu-line/70 sm:grid-cols-2">
        {assortment.items.map((item, index) => (
          <li key={`${item.name}-${item.variant}`} className="grid grid-cols-[2.5rem_1fr] gap-4 bg-yuzu-night p-5">
            <span aria-hidden="true" className="font-heading text-xl text-yuzu-gold">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className="break-words font-heading text-xl leading-7 text-yuzu-cream">{item.name}</h3>
              <p className="mt-1 text-sm leading-6 text-yuzu-muted">
                {item.variant} · {item.size}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
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
    <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
      <div className="flex items-start justify-between gap-4 border border-yuzu-line bg-yuzu-night p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-yuzu-muted">{product.expertReview.sourceName}</p>
          <p className="mt-2 font-heading text-6xl text-yuzu-gold" aria-label={`${product.expertReview.score} out of 100`}>
            {product.expertReview.score}
          </p>
        </div>
        <SourceLink href={product.expertReview.sourceUrl} label={product.expertReview.sourceName} />
      </div>
      <div className="grid gap-5">
        <p className="text-base leading-8 text-yuzu-muted">{product.expertReview.tastingSummary}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DataRow label="Issue" value={product.expertReview.issue} />
          <DataRow label="Other reviews" value={formatOtherReviews(product.expertReview.otherReviews)} />
        </dl>
      </div>
    </div>
  );
}

function ReviewProfilePanel({ profile }: { profile: NonNullable<ReturnType<typeof getProduct>>["reviewProfile"] }) {
  if (!profile) {
    return null;
  }

  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {profile.sources.map((source) => (
        <li key={`${source.sourceName}-${source.sourceUrl}`} className="flex min-w-0 items-start justify-between gap-4 border border-yuzu-line bg-yuzu-night p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">{source.sourceName}</p>
            <p className="mt-2 break-words font-heading text-lg leading-7 text-yuzu-cream">{source.rating}</p>
          </div>
          <SourceLink href={source.sourceUrl} label={source.sourceName} />
        </li>
      ))}
    </ul>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${label} source in a new tab`}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 border border-yuzu-gold px-3 text-xs font-bold uppercase tracking-[0.12em] text-yuzu-gold transition hover:bg-yuzu-gold hover:text-yuzu-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold"
    >
      Source
      <ExternalLink className="size-4" />
    </a>
  );
}

function NoSourcedReviewsPanel() {
  return (
    <div className="flex max-w-2xl items-start gap-3 text-sm leading-7 text-yuzu-muted">
      <Star className="mt-1 size-5 shrink-0 text-yuzu-gold" />
      <p>Verified publication or customer reviews have not been attached to this item yet.</p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 border-b border-yuzu-line/60 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[8rem_1fr] sm:items-start sm:gap-5">
      <dt className="text-sm text-yuzu-muted">{label}</dt>
      <dd className="min-w-0 break-words font-heading text-lg leading-7 text-yuzu-cream sm:text-right">{value}</dd>
    </div>
  );
}

function RelatedProductCard({ product }: { product: CatalogProduct }) {
  const href = `/shop/${product.slug}`;
  const displayName = getCatalogProductDisplayName(product.name);

  return (
    <article data-related-product-card="compact" className="luxury-card min-w-0 overflow-hidden">
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold">
        <ReferenceImage
          src={product.image}
          alt={buildProductImageAlt(product)}
          objectPosition={product.imagePosition}
          className="h-52 border-b border-yuzu-line/70"
          imageClassName="object-contain"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </Link>
      <div className="grid gap-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">{product.brand}</p>
          <Link href={href} className="mt-2 block font-heading text-xl leading-7 text-yuzu-cream transition hover:text-yuzu-gold">
            {displayName}
          </Link>
          <p className="mt-1 text-sm text-yuzu-muted">{product.packageLabel}</p>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-yuzu-line/60 pt-4">
          <ProductPrice
            product={product}
            priceClassName="font-heading text-2xl text-yuzu-gold"
            captionClassName="sr-only"
          />
          <Link
            href={href}
            aria-label={`View ${displayName}`}
            className="grid size-11 shrink-0 place-items-center border border-yuzu-line text-yuzu-gold transition hover:border-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yuzu-gold"
          >
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
