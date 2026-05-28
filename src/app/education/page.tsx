import type { Metadata } from "next";
import Link from "@/components/static-link";
import { Clock3 } from "lucide-react";

import { EducationVideoLibrary } from "@/components/education-video-library";
import { EducationStoryHub } from "@/components/education-story-hub";
import { MemberViewBanner } from "@/components/member-view-banner";
import { ReferenceImage } from "@/components/reference-image";
import { Button } from "@/components/ui/button";
import { cigarEducationStories } from "@/lib/data";
import { featuredStory } from "@/lib/education-journal";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Education Journal | Yuzu Cigar Club",
  description:
    "Read Yuzu Cigar Club education stories about cigars, culture, craftsmanship, pairings, and collection care.",
  path: "/education",
  image: "/assets/hero-boxes.png",
  imageAlt: "Yuzu cigar boxes and a glass arranged for the education journal",
  keywords: ["cigar education", "cigar aging", "cigar pairing guide"],
});

export default function EducationPage() {
  return (
    <div
      data-education-layout="journal"
      className="relative overflow-hidden bg-yuzu-night text-yuzu-cream"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_4%_12%,rgba(34,92,62,0.22),transparent_24rem),radial-gradient(circle_at_92%_16%,rgba(220,169,58,0.12),transparent_30rem),linear-gradient(180deg,rgba(3,5,4,0)_0%,rgba(3,5,4,0.94)_70%)]" />

      <section className="relative border-b border-yuzu-line/70">
        <div className="mx-auto grid max-w-[1760px] lg:min-h-[360px] lg:grid-cols-[minmax(280px,0.36fr)_minmax(0,1fr)]">
          <div className="flex items-center border-b border-yuzu-line/60 px-5 py-8 sm:px-8 lg:border-b-0 lg:border-r lg:px-10">
            <div className="max-w-md">
              <div className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.34em] text-yuzu-gold">
                <span className="h-px w-10 bg-yuzu-line" />
                <span data-yuzu-editable="education.hero.kicker">The Education Journal</span>
                <span className="h-px w-10 bg-yuzu-line" />
              </div>
              <h1 className="mt-5 font-heading text-5xl leading-[0.98] text-yuzu-cream sm:text-6xl xl:text-[4rem]" data-yuzu-editable="education.hero.title">
                Stories Worth Savoring.
              </h1>
              <p className="mt-5 text-base leading-7 text-yuzu-muted" data-yuzu-editable="education.hero.copy">
                Insights on cigars, culture, and craftsmanship. Curated for those who appreciate the finer things - one box at a time.
              </p>
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden bg-yuzu-ink">
            <ReferenceImage
              src="/assets/hero-boxes.png"
              alt="Yuzu cigar boxes and a glass arranged for the education journal"
              className="absolute inset-0"
              imageClassName="opacity-90"
              objectPosition="78% 52%"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,5,4,0.98)_0%,rgba(3,5,4,0.68)_34%,rgba(3,5,4,0.16)_68%,rgba(3,5,4,0.76)_100%)]" />
            <div className="relative z-10 flex min-h-[360px] items-center px-5 py-10 sm:px-8 lg:px-14">
              <div className="max-w-md">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-yuzu-gold" data-yuzu-editable="education.featured.kicker">Featured Story</p>
                <h2 className="mt-4 font-heading text-4xl leading-tight text-yuzu-cream sm:text-5xl" data-yuzu-editable="education.featured.title">
                  {featuredStory.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-yuzu-cream/82">{featuredStory.deck}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-[0.18em] text-yuzu-muted">
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="size-4 text-yuzu-gold" />
                    {featuredStory.minutes} min read
                  </span>
                  <span className="h-4 w-px bg-yuzu-line" />
                  <span className="text-yuzu-gold">{featuredStory.category}</span>
                </div>
                <Button
                  className="mt-5 h-11 rounded-none border-yuzu-gold bg-transparent px-10 text-xs font-black uppercase tracking-[0.22em] text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
                  variant="outline"
                  render={<Link href="#stories" />}
                >
                  <span data-yuzu-editable="education.featured.cta">Read the Story</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1520px] px-5 pt-6 lg:px-10">
        <MemberViewBanner context="site" />
      </section>

      <EducationVideoLibrary />

      <EducationStoryHub stories={cigarEducationStories} />
    </div>
  );
}
