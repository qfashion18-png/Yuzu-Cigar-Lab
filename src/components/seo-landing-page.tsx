import { ArrowRight, BookOpen, CheckCircle2, Link as LinkIcon, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { ProductCard } from "@/components/product-card";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import Link from "@/components/static-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SeoContentPage } from "@/lib/seo-content";
import { getSeoPageProducts } from "@/lib/seo-content";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildFaqPageJsonLd,
  buildPageMetadata,
  jsonLdScriptProps,
} from "@/lib/seo";

export function buildSeoContentMetadata(page: SeoContentPage): Metadata {
  return buildPageMetadata({
    title: page.metadataTitle,
    description: page.description,
    path: page.path,
    image: page.image,
    imageAlt: page.imageAlt,
    keywords: page.keywords,
  });
}

export function SeoLandingPage({ page }: { page: SeoContentPage }) {
  const products = getSeoPageProducts(page, 4);
  const collectionItems = [
    ...page.internalLinks.map((link) => ({ name: link.label, path: link.href })),
    ...products.map((product) => ({ name: product.name, path: `/shop/${product.slug}/` })),
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: page.title, path: page.path },
  ]);

  return (
    <main className="bg-yuzu-night text-yuzu-cream">
      <script {...jsonLdScriptProps(buildCollectionPageJsonLd({
        title: page.title,
        description: page.description,
        path: page.path,
        image: page.image,
        items: collectionItems,
      }))} />
      <script {...jsonLdScriptProps(buildFaqPageJsonLd(page.faqs))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <section className="border-b border-yuzu-line/70">
        <div className="mx-auto grid max-w-[1760px] lg:min-h-[520px] lg:grid-cols-[minmax(0,0.46fr)_minmax(0,0.54fr)]">
          <div className="flex items-center px-5 py-10 sm:px-8 lg:px-10">
            <div className="max-w-2xl">
              <p className="fine-label">{page.kicker}</p>
              <h1 className="mt-4 font-heading text-4xl leading-tight text-yuzu-cream sm:text-5xl xl:text-6xl">
                {page.heroTitle}
              </h1>
              <p className="mt-5 text-base leading-8 text-yuzu-muted sm:text-lg">{page.heroCopy}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button className="h-12 bg-yuzu-gold px-7 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href={page.primaryCta.href} />}>
                  {page.primaryCta.label}
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button className="h-12 border-yuzu-gold px-7 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href={page.secondaryCta.href} />}>
                  {page.secondaryCta.label}
                </Button>
              </div>
              <p className="mt-5 max-w-xl text-xs leading-5 text-yuzu-muted">{page.intent}</p>
            </div>
          </div>
          <div className="relative min-h-[360px] border-t border-yuzu-line bg-yuzu-ink lg:min-h-full lg:border-l lg:border-t-0">
            <ReferenceImage
              src={page.image}
              alt={page.imageAlt}
              className="absolute inset-0 h-full"
              imageClassName="opacity-92"
              objectPosition={page.imagePosition ?? "50% 50%"}
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.08)_0%,rgba(3,5,4,0.24)_48%,rgba(3,5,4,0.82)_100%)]" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-6 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10">
        <div className="grid gap-5">
          <SectionHeading kicker="Buying map" title={page.title} copy={page.description} />
          <div className="grid gap-4 md:grid-cols-3">
            {page.sections.map((section) => (
              <Card key={section.heading} className="luxury-card">
                <CardHeader>
                  <CardTitle className="text-2xl text-yuzu-cream">{section.heading}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <p className="text-sm leading-6 text-yuzu-muted">{section.body}</p>
                  <ul className="grid gap-2 text-sm text-yuzu-cream/85">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-yuzu-gold" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-yuzu-gold">
                <ShieldCheck className="size-4" />
                Adults 21+ only
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-yuzu-muted">
              Yuzu Cigar Club content and commerce are designed for adults. Tobacco orders require age verification and compliant fulfillment controls.
            </CardContent>
          </Card>

          <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-yuzu-gold">
                <LinkIcon className="size-4" />
                Next reads
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {page.internalLinks.map((link) => (
                <Link key={link.href} href={link.href} className="group border border-yuzu-line/70 bg-yuzu-night/60 p-3 transition hover:border-yuzu-gold/70">
                  <span className="font-heading text-lg text-yuzu-cream transition group-hover:text-yuzu-gold">{link.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-yuzu-muted">{link.description}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>

      <section className="border-y border-yuzu-line/70 bg-yuzu-forest/70">
        <div className="mx-auto max-w-[1520px] px-5 py-12 lg:px-10">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <SectionHeading kicker="Related catalog" title="Boxes and tools to compare next." />
            <Button className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/shop/" />}>
              Browse Catalog
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-5 px-5 py-12 lg:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="w-fit border-yuzu-gold bg-yuzu-gold text-yuzu-ink" variant="outline">
            FAQ
          </Badge>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted">Search-ready answers</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {page.faqs.map((faq) => (
            <Card key={faq.question} className="luxury-card">
              <CardHeader>
                <CardTitle className="flex items-start gap-2 text-xl text-yuzu-cream">
                  <BookOpen className="mt-1 size-4 shrink-0 text-yuzu-gold" />
                  {faq.question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-yuzu-muted">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
