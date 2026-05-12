"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ExternalLink,
  Heart,
  MessageCircle,
  PlayCircle,
  X,
} from "lucide-react";

import Link from "@/components/static-link";
import { ReferenceImage } from "@/components/reference-image";
import { type CigarFlowItem } from "@/lib/cigar-flow";
import { cn } from "@/lib/utils";

const sourceTone: Record<CigarFlowItem["kind"], string> = {
  manufacturer: "Manufacturer",
  rss: "RSS News",
  member: "Member Post",
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function getSourceActionLabel(item: CigarFlowItem) {
  if (item.kind === "member") {
    return "Open Yuzu Context";
  }

  return "Read Full Source";
}

function CigarFlowCard({
  item,
  index,
  onOpen,
}: {
  item: CigarFlowItem;
  index: number;
  onOpen: (index: number) => void;
}) {
  return (
    <article className={cn("luxury-card overflow-hidden", item.featured && "sm:col-span-2 xl:col-span-2")}>
      <button
        type="button"
        className={cn("group/card relative w-full cursor-pointer text-left", item.featured ? "min-h-[26rem] sm:min-h-[32rem]" : "min-h-[22rem]")}
        onClick={() => onOpen(index)}
        aria-label={`Open ${item.title} in Cigar Flow reader`}
      >
        <ReferenceImage
          src={item.image}
          alt={`${item.title} visual preview`}
          className="absolute inset-0"
          imageClassName="opacity-92 transition duration-500 group-hover/card:scale-[1.03]"
          objectPosition={item.imagePosition}
          priority={item.featured}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0)_0%,rgba(3,5,4,0.14)_42%,rgba(3,5,4,0.92)_100%)]" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className="border border-yuzu-gold/60 bg-yuzu-night/72 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-yuzu-gold backdrop-blur">
            {sourceTone[item.kind]}
          </span>
          {item.mediaType === "video" && (
            <span className="inline-flex items-center gap-2 border border-yuzu-line/70 bg-yuzu-night/72 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-yuzu-cream backdrop-blur">
              <PlayCircle className="size-4 text-yuzu-gold" />
              {item.videoDuration}
            </span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted">
            <span className="text-yuzu-gold">{item.sourceHandle}</span>
            <span className="h-4 w-px bg-yuzu-line" />
            <span>{item.publishedAt}</span>
          </div>
          <h2 className={cn("mt-3 font-heading leading-tight text-yuzu-cream", item.featured ? "text-4xl sm:text-5xl" : "text-3xl")}>
            {item.title}
          </h2>
        </div>
      </button>
      <div className="grid gap-4 p-5">
        <p className="text-sm leading-6 text-yuzu-muted">{item.excerpt}</p>
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span key={tag} className="border border-yuzu-line/65 bg-yuzu-night/45 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-yuzu-cream">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-yuzu-line/60 pt-4">
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-[0.12em] text-yuzu-muted">
            <span className="inline-flex items-center gap-1.5">
              <Heart className="size-4 text-yuzu-gold" />
              {item.likes}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="size-4 text-yuzu-gold" />
              {item.comments}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bookmark className="size-4 text-yuzu-gold" />
              {item.saves}
            </span>
          </div>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 border border-yuzu-gold px-4 text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold transition hover:bg-yuzu-gold hover:text-yuzu-ink"
            onClick={() => onOpen(index)}
          >
            Open in Yuzu
            <ExternalLink className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function CigarFlowExperience({ items }: { items: CigarFlowItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex === null ? null : items[activeIndex];
  const articlePosition = useMemo(() => (activeIndex === null ? "" : `${activeIndex + 1} of ${items.length}`), [activeIndex, items.length]);

  const closeReader = useCallback(() => setActiveIndex(null), []);
  const openPrevious = useCallback(
    () => setActiveIndex((current) => (current === null ? current : (current - 1 + items.length) % items.length)),
    [items.length]
  );
  const openNext = useCallback(
    () => setActiveIndex((current) => (current === null ? current : (current + 1) % items.length)),
    [items.length]
  );

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeReader();
      }

      if (event.key === "ArrowLeft") {
        openPrevious();
      }

      if (event.key === "ArrowRight") {
        openNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [activeIndex, closeReader, openNext, openPrevious]);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" data-cigar-flow-grid="in-yuzu-reader">
        {items.map((item, index) => (
          <CigarFlowCard key={item.id} item={item} index={index} onOpen={setActiveIndex} />
        ))}
      </div>

      {activeItem && (
        <div
          className="fixed inset-0 z-50 bg-yuzu-night/88 px-3 py-3 backdrop-blur-xl sm:px-5 sm:py-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeItem.title} article preview`}
          data-cigar-flow-reader="open"
        >
          <div className="mx-auto grid h-full max-w-[1440px] overflow-hidden border border-yuzu-line/80 bg-yuzu-ink shadow-[0_30px_90px_rgba(0,0,0,0.5)] lg:grid-cols-[minmax(0,0.58fr)_minmax(360px,0.42fr)]">
            <div className="relative hidden border-b border-yuzu-line/70 bg-yuzu-night lg:block lg:min-h-0 lg:border-b-0 lg:border-r">
              <ReferenceImage
                src={activeItem.image}
                alt={`${activeItem.title} article image`}
                className="absolute inset-0"
                imageClassName="opacity-95"
                objectPosition={activeItem.imagePosition}
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.03)_0%,rgba(3,5,4,0.12)_52%,rgba(3,5,4,0.88)_100%)]" />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <span className="border border-yuzu-gold/60 bg-yuzu-night/74 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-yuzu-gold backdrop-blur">
                  {sourceTone[activeItem.kind]}
                </span>
                <span className="border border-yuzu-line/70 bg-yuzu-night/74 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-yuzu-cream backdrop-blur">
                  {articlePosition}
                </span>
              </div>
            </div>

            <div className="flex min-h-0 flex-col bg-[radial-gradient(circle_at_100%_0%,rgba(220,169,58,0.12),transparent_22rem),linear-gradient(180deg,rgba(16,24,18,0.98),#07110d)]">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-yuzu-line/70 p-3 sm:p-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">Reading in Yuzu</p>
                  <p className="mt-1 truncate text-xs text-yuzu-muted sm:text-sm">{activeItem.sourceName} - {activeItem.publishedAt}</p>
                </div>
                <button
                  type="button"
                  className="grid size-10 shrink-0 place-items-center border border-yuzu-line text-yuzu-cream transition hover:border-yuzu-gold hover:text-yuzu-gold"
                  onClick={closeReader}
                  aria-label="Close article"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 lg:overflow-hidden xl:p-6" data-cigar-flow-reader-panel="details">
                <div className="flex flex-wrap items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-yuzu-muted">
                  <span className="text-yuzu-gold">{activeItem.sourceHandle}</span>
                  <span className="h-4 w-px bg-yuzu-line" />
                  <span>{activeItem.readTime}</span>
                  {activeItem.mediaType === "video" && activeItem.videoDuration && (
                    <>
                      <span className="h-4 w-px bg-yuzu-line" />
                      <span className="inline-flex items-center gap-2">
                        <PlayCircle className="size-4 text-yuzu-gold" />
                        {activeItem.videoDuration}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="mt-4 font-heading text-2xl leading-tight text-yuzu-cream sm:text-4xl xl:text-[2.8rem]">{activeItem.title}</h2>
                <p className="mt-3 text-sm leading-6 text-yuzu-cream/82">{activeItem.excerpt}</p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "Likes", value: activeItem.likes, icon: Heart },
                    { label: "Comments", value: activeItem.comments, icon: MessageCircle },
                    { label: "Saves", value: activeItem.saves, icon: Bookmark },
                  ].map((metric) => {
                    const Icon = metric.icon;

                    return (
                      <div key={metric.label} className="border border-yuzu-line/65 bg-yuzu-night/45 p-2 sm:p-3">
                        <Icon className="size-4 text-yuzu-gold" />
                        <p className="mt-2 font-heading text-xl leading-none text-yuzu-cream sm:text-2xl">{metric.value}</p>
                        <p className="mt-1 text-[0.6rem] font-black uppercase tracking-[0.16em] text-yuzu-muted sm:mt-2 sm:text-xs">{metric.label}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {activeItem.tags.map((tag) => (
                    <span key={tag} className="border border-yuzu-line/65 bg-yuzu-night/45 px-3 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-yuzu-cream">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-4 border border-yuzu-line/70 bg-yuzu-night/42 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">Yuzu Reader Note</p>
                    <span className="h-4 w-px bg-yuzu-line" />
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-yuzu-cream">Story snippet</p>
                  </div>
                  <p className="mt-2 border-l border-yuzu-gold/70 pl-3 text-sm italic leading-5 text-yuzu-cream/88 sm:pl-4 sm:leading-6">
                    {activeItem.storySnippet}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-yuzu-muted sm:text-sm sm:leading-6">
                    Use the controls below to scan the queue, or open the full publisher article.
                  </p>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-[auto_1fr_auto] gap-2 border-t border-yuzu-line/70 p-3 sm:p-4">
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap border border-yuzu-line px-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-yuzu-cream transition hover:border-yuzu-gold hover:text-yuzu-gold sm:px-4 sm:text-xs"
                  onClick={openPrevious}
                >
                  <ArrowLeft className="size-4" />
                  Previous
                </button>
                {isExternalHref(activeItem.href) ? (
                  <a
                    href={activeItem.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap bg-yuzu-gold px-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-yuzu-ink transition hover:bg-yuzu-gold-light sm:px-5 sm:text-xs"
                  >
                    {getSourceActionLabel(activeItem)}
                    <ExternalLink className="size-4" />
                  </a>
                ) : (
                  <Link
                    href={activeItem.href}
                    className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap bg-yuzu-gold px-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-yuzu-ink transition hover:bg-yuzu-gold-light sm:px-5 sm:text-xs"
                  >
                    {getSourceActionLabel(activeItem)}
                    <ExternalLink className="size-4" />
                  </Link>
                )}
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap border border-yuzu-gold px-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-yuzu-gold transition hover:bg-yuzu-gold hover:text-yuzu-ink sm:px-4 sm:text-xs"
                  onClick={openNext}
                  aria-label="Next article"
                >
                  Next
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
