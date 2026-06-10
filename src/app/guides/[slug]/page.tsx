import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { InteractiveGuideExperience } from "@/components/interactive-guide-experience";
import { ProductCard } from "@/components/product-card";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";
import { getSeoGuide, getSeoPageProducts, seoGuides, type SeoContentPage } from "@/lib/seo-content";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildPageMetadata,
  jsonLdScriptProps,
} from "@/lib/seo";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return seoGuides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getSeoGuide(slug);

  if (!guide) {
    return {
      title: "Guide Not Found | Yuzu Cigar Club",
    };
  }

  return buildPageMetadata({
    title: guide.metadataTitle,
    description: guide.description,
    path: guide.path,
    image: guide.image,
    imageAlt: guide.imageAlt,
    keywords: guide.keywords,
  });
}

export default async function SeoGuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getSeoGuide(slug);

  if (!guide) {
    notFound();
  }

  const products = getSeoPageProducts(guide, 3);
  const articleJsonLd = buildArticleJsonLd({
    title: guide.title,
    description: guide.description,
    path: guide.path,
    image: guide.image,
    datePublished: "2026-05-28",
    dateModified: guide.updatedAt.slice(0, 10),
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Guides", path: "/education/" },
    { name: guide.title, path: guide.path },
  ]);

  return (
    <main className="bg-yuzu-night text-yuzu-cream">
      <script {...jsonLdScriptProps(articleJsonLd)} />
      <script {...jsonLdScriptProps(buildFaqPageJsonLd(guide.faqs))} />
      <script {...jsonLdScriptProps(breadcrumbJsonLd)} />

      <section className="border-b border-yuzu-line/70">
        <div className="mx-auto grid max-w-[1760px] lg:min-h-[500px] lg:grid-cols-[minmax(0,0.43fr)_minmax(0,0.57fr)]">
          <div className="flex items-center px-5 py-10 sm:px-8 lg:px-10">
            <div className="max-w-2xl">
              <Link href="/education/" className="mb-6 inline-flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-muted transition hover:text-yuzu-gold">
                <ArrowLeft className="size-4" />
                Education
              </Link>
              <p className="fine-label">{guide.kicker}</p>
              <h1 className="mt-4 font-heading text-4xl leading-tight text-yuzu-cream sm:text-5xl xl:text-6xl">
                {guide.heroTitle}
              </h1>
              <p className="mt-5 text-base leading-8 text-yuzu-muted sm:text-lg">{guide.heroCopy}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button className="h-12 bg-yuzu-gold px-7 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href={guide.primaryCta.href} />}>
                  {guide.primaryCta.label}
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button className="h-12 border-yuzu-gold px-7 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href={guide.secondaryCta.href} />}>
                  {guide.secondaryCta.label}
                </Button>
              </div>
            </div>
          </div>
          <div className="relative min-h-[340px] border-t border-yuzu-line bg-yuzu-ink lg:min-h-full lg:border-l lg:border-t-0">
            <ReferenceImage
              src={guide.image}
              alt={guide.imageAlt}
              className="absolute inset-0 h-full"
              imageClassName="opacity-92"
              objectPosition={guide.imagePosition ?? "50% 50%"}
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.1)_0%,rgba(3,5,4,0.28)_50%,rgba(3,5,4,0.86)_100%)]" />
          </div>
        </div>
      </section>

      <GuideResearchPanel guide={guide} />

      <InteractiveGuideExperience guide={guide} />

      <section className="border-t border-yuzu-line bg-yuzu-forest/70">
        <div className="mx-auto max-w-[1520px] px-5 py-12 lg:px-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <SectionHeading kicker="Related catalog" title="Apply the guide while browsing." />
            <Link href="/shop/" className="hidden text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold transition hover:text-yuzu-gold-light md:inline">
              Shop all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function GuideResearchPanel({ guide }: { guide: SeoContentPage }) {
  const visualLessons = guide.visualLessons ?? [];
  const researchNotes = guide.researchNotes ?? [];

  if (visualLessons.length === 0 && researchNotes.length === 0) {
    return null;
  }

  return (
    <section data-guide-research="field-notes" className="border-b border-yuzu-line/70 bg-yuzu-ink">
      <div className="mx-auto grid max-w-[1520px] gap-7 px-5 py-12 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] lg:px-10 lg:py-14">
        <div className="grid content-start gap-5">
          <SectionHeading
            kicker="Cigar field guide"
            title="See the lesson before you light."
            copy="Use the imagery and source-backed cues to connect the article to real wrapper, storage, pairing, and lounge decisions."
          />
          <div className="grid gap-3">
            {researchNotes.map((note) => (
              <a
                key={`${guide.slug}-${note.sourceUrl}-${note.label}`}
                href={note.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="group border border-yuzu-line bg-yuzu-panel/72 p-4 transition hover:border-yuzu-gold/80 hover:bg-yuzu-panel"
              >
                <span className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-yuzu-gold">{note.label}</span>
                <span className="mt-2 block text-sm leading-6 text-yuzu-cream/86">{note.takeaway}</span>
                <span className="mt-3 block text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted transition group-hover:text-yuzu-gold">
                  Source: {note.sourceLabel}
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {visualLessons.map((lesson) => (
            <article key={`${guide.slug}-${lesson.label}`} className="grid overflow-hidden border border-yuzu-line bg-yuzu-panel/78 shadow-[0_20px_60px_rgba(0,0,0,0.26)]">
              <ReferenceImage
                src={lesson.image}
                alt={lesson.imageAlt}
                className="aspect-[4/3] w-full"
                imageClassName="opacity-94"
                objectPosition={lesson.imagePosition ?? "50% 50%"}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 280px"
              />
              <div className="p-4">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-yuzu-gold">{lesson.label}</p>
                <p className="mt-2 text-sm leading-6 text-yuzu-muted">{lesson.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
