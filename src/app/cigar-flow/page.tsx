import type { Metadata } from "next";
import {
  Camera,
  ExternalLink,
  Newspaper,
  Radio,
  Rss,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import Link from "@/components/static-link";
import { CigarFlowExperience } from "@/components/cigar-flow-experience";
import { ReferenceImage } from "@/components/reference-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cigarFlowAutomation, cigarFlowItems, cigarFlowSources, cigarFlowStats } from "@/lib/cigar-flow";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cigar Flow | Yuzu Cigar Club",
  description:
    "An Instagram-style cigar news feed for manufacturer releases, new drops, trusted cigar RSS sources, and member smoke posts.",
  alternates: {
    canonical: "/cigar-flow",
  },
  openGraph: {
    title: "Cigar Flow | Yuzu Cigar Club",
    description:
      "Follow cigar manufacturer news, new drops, verified RSS sources, and Yuzu member smoke posts in one visual feed.",
    url: `${siteUrl}/cigar-flow/`,
    siteName: "Yuzu Cigar Club",
    type: "website",
  },
};

export default function CigarFlowPage() {
  return (
    <div className="relative overflow-hidden bg-yuzu-night text-yuzu-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_7%_10%,rgba(34,92,62,0.24),transparent_28rem),radial-gradient(circle_at_96%_8%,rgba(220,169,58,0.13),transparent_28rem),linear-gradient(180deg,rgba(3,5,4,0)_0%,rgba(3,5,4,0.86)_64%)]" />

      <section className="relative border-b border-yuzu-line/70">
        <div className="mx-auto grid max-w-[1760px] lg:min-h-[520px] lg:grid-cols-[minmax(0,0.44fr)_minmax(0,0.56fr)]">
          <div className="flex items-center bg-[linear-gradient(90deg,#06120d_0%,#06120d_72%,rgba(6,18,13,0.9)_100%)] px-5 py-12 sm:px-8 lg:px-10">
            <div className="max-w-2xl">
              <p className="fine-label">Cigar Flow</p>
              <h1 className="mt-4 font-heading text-5xl leading-[0.98] text-yuzu-cream sm:text-6xl xl:text-[4.5rem]">
                The lounge feed for drops, makers, and member smokes.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-yuzu-cream/86 sm:text-lg sm:leading-8">
                A visual stream of cigar manufacturer news, new release signals, trusted RSS sources, and posts from Yuzu members.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button className="h-12 bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="#flow" />}>
                  <Radio data-icon="inline-start" />
                  View Flow
                </Button>
                <Button className="h-12 border-yuzu-gold px-8 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/account" />}>
                  <Camera data-icon="inline-start" />
                  Share a Smoke
                </Button>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {cigarFlowStats.map((stat) => (
                  <div key={stat.label} className="border border-yuzu-line/70 bg-yuzu-night/45 p-4">
                    <p className="font-heading text-4xl leading-none text-yuzu-gold">{stat.value}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.16em] text-yuzu-cream">{stat.label}</p>
                    <p className="mt-2 text-xs leading-5 text-yuzu-muted">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative min-h-[460px] border-t border-yuzu-line bg-yuzu-ink lg:border-l lg:border-t-0">
            <ReferenceImage
              src="/assets/about-lounge.png"
              alt="Cigar lounge table arranged for Cigar Flow"
              className="absolute inset-0"
              imageClassName="opacity-88"
              objectPosition="52% 44%"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,5,4,0.82)_0%,rgba(3,5,4,0.14)_58%,rgba(3,5,4,0.76)_100%)]" />
            <div className="absolute bottom-5 left-5 right-5 grid gap-3 sm:left-auto sm:w-[430px]">
              <div className="border border-yuzu-gold/55 bg-yuzu-night/78 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.34)] backdrop-blur">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center border border-yuzu-gold/50 bg-yuzu-gold/10 text-yuzu-gold">
                    <Sparkles className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">Signal Mix</p>
                    <p className="mt-2 text-sm leading-6 text-yuzu-cream/82">
                      RSS pulls, maker-watch cards, member smoke logs, and allocation reminders share the same scroll.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="flow" className="relative mx-auto grid max-w-[1520px] gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10">
        <div>
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="fine-label">Live-style feed</p>
              <h2 className="mt-3 font-heading text-4xl leading-tight text-yuzu-cream md:text-5xl">
                News, drops, videos, and member posts.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-yuzu-muted">
              Cards are seeded from verified cigar RSS sources and Yuzu member post concepts so the static build has a complete feed surface.
            </p>
          </div>

          <CigarFlowExperience items={cigarFlowItems} />
        </div>

        <aside className="grid content-start gap-5 lg:sticky lg:top-28">
          <Card className="luxury-card">
            <CardContent className="grid gap-5 p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
                  <Rss className="size-5" />
                </span>
                <div>
                  <h2 className="font-heading text-3xl leading-tight text-yuzu-cream">RSS and news sources</h2>
                  <p className="mt-2 text-sm leading-6 text-yuzu-muted">
                    Verified RSS feeds plus requested cigar news sources for a future ingestion job or admin publishing review.
                  </p>
                </div>
              </div>
              <div className="grid gap-3">
                {cigarFlowSources.map((source) => (
                  <a
                    key={source.feedUrl}
                    href={source.feedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group/source border border-yuzu-line/65 bg-yuzu-night/42 p-4 transition hover:border-yuzu-gold/80 hover:bg-yuzu-forest/70"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black uppercase tracking-[0.16em] text-yuzu-cream">{source.publisher}</p>
                        <p className="mt-2 text-xs leading-5 text-yuzu-muted">{source.focus}</p>
                      </div>
                      <ExternalLink className="size-4 shrink-0 text-yuzu-gold transition group-hover/source:translate-x-0.5" />
                    </div>
                    <p className="mt-3 break-all font-mono text-[0.68rem] leading-5 text-yuzu-gold/88">{source.feedUrl}</p>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="luxury-card">
            <CardContent className="grid gap-5 p-5">
              <div className="grid gap-3">
                <span className="grid size-11 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
                  <UsersRound className="size-5" />
                </span>
                <h2 className="font-heading text-3xl leading-tight text-yuzu-cream">Member posts</h2>
                <p className="text-sm leading-6 text-yuzu-muted">
                  Members can share smoke logs, first-light clips, box-aging notes, pairing photos, and allocation tips from their account experience.
                </p>
              </div>
              <div className="grid gap-3">
                {[
                  { label: "Age gate", detail: "Only adult members can post." },
                  { label: "Humidor link", detail: "Posts can reference saved cigars or boxes." },
                  { label: "Review queue", detail: "Admin moderation can approve public cards." },
                ].map((item) => (
                  <div key={item.label} className="flex gap-3 border border-yuzu-line/60 bg-yuzu-night/35 p-3">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-yuzu-gold" />
                    <p className="text-sm leading-6 text-yuzu-muted">
                      <span className="font-bold uppercase tracking-[0.12em] text-yuzu-cream">{item.label}: </span>
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
              <Button className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/account" />}>
                <Send data-icon="inline-start" />
                Start a Post
              </Button>
            </CardContent>
          </Card>

          <Card className="luxury-card">
            <CardContent className="grid gap-4 p-5">
              <Newspaper className="size-6 text-yuzu-gold" />
              <h2 className="font-heading text-3xl text-yuzu-cream">Friday refresh scheduled</h2>
              <p className="text-sm leading-6 text-yuzu-muted">
                {cigarFlowAutomation.cadence}. The recurring workspace agent refreshes the feed data, education article, and newsletter draft from the same verified source set.
              </p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
