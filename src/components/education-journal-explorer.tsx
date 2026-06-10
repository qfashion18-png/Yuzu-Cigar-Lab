"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Leaf,
  Mail,
  NotebookPen,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import Link from "@/components/static-link";
import { NewsletterSignupForm } from "@/components/newsletter-signup-form";
import { ReferenceImage } from "@/components/reference-image";
import { Button } from "@/components/ui/button";
import {
  educationJournalFilters,
  featuredLesson,
  filterJournalArticles,
  journalArticles,
  popularReads,
  type JournalArticle,
  type PopularRead,
} from "@/lib/education-journal";

const benefits = [
  {
    title: "Member Access to Insights",
    copy: "Exclusive articles and expert content.",
    icon: BookOpen,
  },
  {
    title: "Humidor Guidance",
    copy: "Digital tools and tips to protect your collection.",
    icon: ShieldCheck,
  },
  {
    title: "Early Access",
    copy: "Be the first to know about new releases and events.",
    icon: CalendarDays,
  },
  {
    title: "Community of Aficionados",
    copy: "Connect, share, and elevate your cigar journey.",
    icon: Users,
  },
];

type EducationJournalExplorerProps = {
  onOpenStory?: (storyId: string) => void;
};

export function EducationJournalExplorer({ onOpenStory }: EducationJournalExplorerProps) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState(educationJournalFilters[0]);

  const filteredArticles = useMemo(
    () => filterJournalArticles(journalArticles, { category: activeFilter, query }),
    [activeFilter, query]
  );

  return (
    <section className="relative mx-auto max-w-[1520px] px-5 py-7 lg:px-10">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.4fr)]">
            <label className="relative block">
              <span className="sr-only">Search the education journal</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-yuzu-gold" />
              <input
                className="h-12 w-full rounded-none border border-yuzu-line bg-yuzu-night/72 pl-12 pr-4 text-sm text-yuzu-cream outline-none transition placeholder:text-yuzu-muted/70 focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the Journal..."
                type="search"
                value={query}
              />
            </label>
            <div className="flex min-w-0 gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {educationJournalFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={activeFilter === filter}
                  onClick={() => setActiveFilter(filter)}
                  className={[
                    "h-12 shrink-0 rounded-none border px-2.5 text-[0.56rem] font-black uppercase tracking-[0.08em] transition",
                    activeFilter === filter
                      ? "border-yuzu-gold bg-yuzu-night text-yuzu-gold"
                      : "border-yuzu-line bg-yuzu-panel/80 text-yuzu-cream/82 hover:border-yuzu-gold hover:text-yuzu-gold",
                  ].join(" ")}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredArticles.length ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredArticles.map((article) => (
                <JournalArticleCard key={article.title} article={article} onOpenStory={onOpenStory} />
              ))}
            </div>
          ) : (
            <div className="luxury-card p-8">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold">
                No journal stories found
              </p>
              <p className="mt-3 text-sm leading-6 text-yuzu-muted">
                Try another search or return to all articles.
              </p>
            </div>
          )}

          <div className="grid border border-yuzu-line/70 bg-yuzu-panel/70 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <div key={benefit.title} className="grid gap-3 border-yuzu-line p-5 md:border-r last:border-r-0">
                  <Icon className="size-9 text-yuzu-gold" />
                  <div>
                    <h3 className="font-heading text-xl leading-tight text-yuzu-gold">{benefit.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-yuzu-muted">{benefit.copy}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="grid gap-5 xl:self-start">
          <div className="luxury-card p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-yuzu-gold">Popular Reads</h2>
            <div className="mt-4 grid gap-0">
              {popularReads.map((read) => (
                <PopularRead key={read.title} read={read} />
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden border border-yuzu-line/70 bg-[linear-gradient(135deg,rgba(10,28,20,0.96),rgba(7,17,13,0.95))] p-5">
            <div className="absolute -bottom-10 -right-10 size-36 rotate-[-16deg] border border-yuzu-line/50 bg-yuzu-panel/80 shadow-[0_20px_50px_rgba(0,0,0,0.28)]" />
            <Mail className="absolute bottom-8 right-8 size-12 text-yuzu-gold/70" />
            <div className="relative z-10 max-w-[250px]">
              <h2 className="text-lg font-black uppercase leading-7 tracking-[0.22em] text-yuzu-gold">
                Join the club. Stay inspired.
              </h2>
              <p className="mt-3 text-sm leading-6 text-yuzu-muted">
                Get journal highlights, member exclusives, and early access to curated box drops.
              </p>
            </div>
            <NewsletterSignupForm source="education-newsletter" variant="compact" />
          </div>
        </aside>
      </div>

      <div
        id="featured-lesson"
        data-story-trigger="featured-lesson"
        className="relative z-10 mt-8 max-w-4xl border border-yuzu-gold/80 bg-yuzu-night p-6 shadow-[0_28px_80px_rgba(0,0,0,0.42)] sm:p-8"
      >
        <p className="fine-label">Featured Lesson</p>
        <h2 className="mt-4 font-heading text-4xl leading-tight text-yuzu-cream sm:text-5xl">
          {featuredLesson.title}
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-8 text-yuzu-cream/86 sm:text-lg">
          {featuredLesson.deck}
        </p>
        {onOpenStory ? (
          <Button
            type="button"
            className="mt-6 h-11 rounded-none bg-yuzu-gold px-7 text-xs font-black uppercase tracking-[0.2em] text-yuzu-ink hover:bg-yuzu-gold-light"
            onClick={() => onOpenStory(featuredLesson.storyId)}
          >
            Open Lesson
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button
            className="mt-6 h-11 rounded-none bg-yuzu-gold px-7 text-xs font-black uppercase tracking-[0.2em] text-yuzu-ink hover:bg-yuzu-gold-light"
            render={<Link href="#stories" />}
          >
            Open Lesson
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </section>
  );
}

function JournalArticleCard({
  article,
  onOpenStory,
}: {
  article: JournalArticle;
  onOpenStory?: (storyId: string) => void;
}) {
  const cardContent = (
    <div className={article.featured ? "relative min-h-[420px]" : "relative min-h-[190px]"}>
      <ReferenceImage
        src={article.image}
        alt={article.title}
        className="absolute inset-0"
        imageClassName="transition duration-500 group-hover:scale-105"
        objectPosition={article.imagePosition}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.04)_0%,rgba(3,5,4,0.42)_46%,rgba(3,5,4,0.98)_100%)]" />
      {article.featured && (
        <span className="absolute left-0 top-0 bg-yuzu-gold px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-yuzu-ink">
          Featured
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <h2 className="font-heading text-3xl leading-tight text-yuzu-cream sm:text-4xl">{article.title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-yuzu-cream/82">{article.summary}</p>
        <ArticleMeta category={article.category} minutes={article.minutes} />
      </div>
    </div>
  );

  return (
    <article
      data-story-open-id={article.storyId}
      className={[
        "luxury-card overflow-hidden transition hover:border-yuzu-gold focus-within:border-yuzu-gold focus-within:ring-2 focus-within:ring-yuzu-gold/45",
        article.featured ? "lg:row-span-2" : "",
      ].join(" ")}
    >
      {onOpenStory ? (
        <button
          type="button"
          className="group block w-full text-left outline-none"
          aria-label={`Open ${article.title}`}
          onClick={() => onOpenStory(article.storyId)}
        >
          {cardContent}
        </button>
      ) : (
        <div className="group">{cardContent}</div>
      )}
    </article>
  );
}

function PopularRead({ read }: { read: PopularRead }) {
  return (
    <article className="grid grid-cols-[82px_1fr] gap-4 border-b border-yuzu-line/60 py-4 first:pt-0 last:border-b-0 last:pb-0">
      <ReferenceImage src={read.image} alt={`${read.title} education article thumbnail`} className="h-16 border border-yuzu-line/70" imageClassName="object-contain p-1" sizes="82px" />
      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-5 text-yuzu-cream">{read.title}</h3>
        <ArticleMeta category={read.category} minutes={read.minutes} compact />
      </div>
    </article>
  );
}

function ArticleMeta({
  category,
  minutes,
  compact = false,
}: {
  category: string;
  minutes: number;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted",
        compact ? "mt-2" : "mt-5",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-2">
        <Clock3 className="size-4 text-yuzu-gold" />
        {minutes} min read
      </span>
      <span className="h-4 w-px bg-yuzu-line" />
      <span className="inline-flex items-center gap-2 text-yuzu-gold">
        {compact ? <Leaf className="size-3.5" /> : <NotebookPen className="size-4" />}
        {category}
      </span>
      {!compact && <Sparkles className="ml-auto size-4 text-yuzu-gold/80" />}
    </div>
  );
}
