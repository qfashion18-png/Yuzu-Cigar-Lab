import type { Metadata } from "next";
import { Newspaper, ShieldCheck } from "lucide-react";

import { NewsStoryFeed } from "@/components/news-story-feed";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Cigar News | Yuzu Cigar Club",
  description:
    "Original Yuzu Cigar Club cigar-industry news stories drafted from official brand, company, event, regulator, and wire sources.",
  path: "/news",
  image: "/assets/about-lounge.png",
  imageAlt: "Yuzu Cigar Club newsroom and cigar lounge",
  keywords: ["cigar news", "cigar industry updates", "cigar manufacturer news"],
});

export default function NewsPage() {
  return (
    <div className="relative overflow-hidden bg-yuzu-night text-yuzu-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(15,83,55,0.28),transparent_27rem),radial-gradient(circle_at_84%_4%,rgba(220,169,58,0.12),transparent_25rem),linear-gradient(180deg,rgba(3,5,4,0)_0%,rgba(3,5,4,0.94)_72%)]" />

      <section className="relative border-b border-yuzu-line/70">
        <div className="mx-auto grid max-w-[1520px] gap-8 px-5 py-12 lg:grid-cols-[minmax(0,0.84fr)_minmax(320px,0.42fr)] lg:px-10">
          <div>
            <div className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.3em] text-yuzu-gold">
              <span className="h-px w-10 bg-yuzu-line" />
              <span>Yuzu Newsroom</span>
            </div>
            <h1 className="mt-5 max-w-4xl font-heading text-5xl leading-[0.98] text-yuzu-cream sm:text-6xl xl:text-[4.25rem]">
              Cigar news with primary-source discipline.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-yuzu-muted">
              Original stories for adult readers, published from official brand announcements, company posts, event updates, regulator releases, and verified wire notes.
            </p>
          </div>

          <div className="grid content-start gap-3 border border-yuzu-line bg-yuzu-panel/74 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-yuzu-gold" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Editorial Standard</h2>
                <p className="mt-3 text-sm leading-6 text-yuzu-muted">
                  We do not repost magazine articles. Yuzu stories are drafted from primary sources and reviewed before publication.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 border border-yuzu-line bg-yuzu-night/44 px-3 py-2 text-sm text-yuzu-cream/82">
              <Newspaper className="size-4 text-yuzu-gold" />
              Brand, company, event, regulator, and wire sources
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-[1520px] px-5 py-8 lg:px-10">
        <NewsStoryFeed />
      </section>
    </div>
  );
}
