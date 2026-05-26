"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Newspaper, ShieldCheck } from "lucide-react";

import { ReferenceImage } from "@/components/reference-image";
import { fetchPublishedNewsStories, getLiveApiErrorMessage } from "@/lib/live-api";
import type { NewsStory, NewsStoryImage } from "@/lib/newsroom";
import { cn } from "@/lib/utils";

type NewsStoryFeedProps = {
  fallbackStories?: NewsStory[];
  limit?: number;
  variant?: "news" | "cigarFlow";
};

type NewsStoryVisual = NewsStoryImage & {
  imagePosition: string;
  isStoryImage?: boolean;
};

const emptyFallbackStories: NewsStory[] = [];

export function NewsStoryFeed({
  fallbackStories = emptyFallbackStories,
  limit = 18,
  variant = "news",
}: NewsStoryFeedProps = {}) {
  const [stories, setStories] = useState<NewsStory[]>(fallbackStories);
  const [isLoading, setIsLoading] = useState(!fallbackStories.length);
  const [error, setError] = useState("");
  const intro = getFeedIntro(variant);

  useEffect(() => {
    let cancelled = false;

    async function loadStories() {
      const canUseLocalFallback = fallbackStories.length > 0 && ["localhost", "127.0.0.1"].includes(window.location.hostname);

      if (canUseLocalFallback) {
        setStories(fallbackStories);
        setIsLoading(false);
        setError("");
        return;
      }

      setIsLoading(!fallbackStories.length);
      setError("");

      try {
        const response = await fetchPublishedNewsStories(limit);
        const liveStories = mergeFallbackStoryImages(response.stories, fallbackStories);

        if (!cancelled) {
          setStories(liveStories.length ? liveStories : fallbackStories);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (fallbackStories.length) {
            setStories(fallbackStories);
          } else {
            setError(getLiveApiErrorMessage(loadError));
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadStories();

    return () => {
      cancelled = true;
    };
  }, [fallbackStories, limit]);

  if (isLoading) {
    return (
      <div className="grid min-h-72 place-items-center border border-yuzu-line bg-yuzu-panel/70 p-8 text-center">
        <div>
          <Loader2 className="mx-auto size-9 animate-spin text-yuzu-gold" />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-yuzu-muted">Loading news desk</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 border border-red-400/60 bg-red-950/20 p-5 text-red-100">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-200" />
        <p className="text-sm leading-6">{error}</p>
      </div>
    );
  }

  if (!stories.length) {
    return (
      <div className="grid min-h-72 place-items-center border border-yuzu-line bg-yuzu-panel/70 p-8 text-center">
        <div className="max-w-md">
          <Newspaper className="mx-auto size-10 text-yuzu-gold" />
          <h2 className="mt-4 font-heading text-3xl text-yuzu-cream">No published stories yet.</h2>
          <p className="mt-3 text-sm leading-6 text-yuzu-muted">
            Published stories from the official-source newsroom agent will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 border border-yuzu-line bg-yuzu-panel/72 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yuzu-gold">{intro.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl text-yuzu-cream">{intro.title}</h2>
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-yuzu-muted">
          <ShieldCheck className="size-5 text-yuzu-gold" />
          Operator reviewed
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {stories.map((story, index) => (
          <StoryCard key={story.id || story.slug || story.title} featured={index === 0} story={story} />
        ))}
      </div>
    </div>
  );
}

function StoryCard({ story, featured }: { story: NewsStory; featured: boolean }) {
  const sections = useMemo(() => markdownSections(story.bodyMarkdown), [story.bodyMarkdown]);
  const visuals = useMemo(() => storyVisuals(story), [story]);
  const publishedDate = story.publishedAt ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(story.publishedAt)) : "Recently";

  return (
    <article
      className={cn(
        "overflow-hidden border border-yuzu-line bg-yuzu-panel/74",
        featured ? "lg:col-span-2 lg:grid lg:grid-cols-[minmax(280px,0.44fr)_minmax(0,0.86fr)]" : "",
      )}
    >
      <StoryVisualPanel featured={featured} title={story.title} visuals={visuals} />

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-yuzu-muted">
          <span className="text-yuzu-gold">{story.category}</span>
          <span className="h-3 w-px bg-yuzu-line" />
          <span>{publishedDate}</span>
        </div>
        <h3 className={cn("mt-4 font-heading leading-tight text-yuzu-cream", featured ? "text-4xl sm:text-5xl" : "text-3xl")}>
          {story.title}
        </h3>
        <p className="mt-4 text-sm leading-7 text-yuzu-cream/82">{story.dek}</p>

        <div className="mt-5 grid gap-4">
          {sections.slice(0, featured ? 3 : 2).map((section) => (
            <section key={section.heading} className="border-t border-yuzu-line/70 pt-4">
              <h4 className="text-sm font-black uppercase tracking-[0.14em] text-yuzu-gold">{section.heading}</h4>
              <p className="mt-2 text-sm leading-7 text-yuzu-muted">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

function StoryVisualPanel({
  featured,
  title,
  visuals,
}: {
  featured: boolean;
  title: string;
  visuals: NewsStoryVisual[];
}) {
  const [hero, ...supportingVisuals] = visuals;
  const hasStoryImages = visuals.some((visual) => visual.isStoryImage);

  return (
    <div
      className={cn(
        "relative min-h-72 border-b border-yuzu-line bg-yuzu-ink",
        featured ? "lg:min-h-full lg:border-b-0 lg:border-r" : "",
      )}
      data-news-story-images={hasStoryImages ? "story-provided" : "source-derived"}
    >
      <ReferenceImage
        src={hero.image}
        alt={hero.alt ?? `${title} visual`}
        className="absolute inset-0"
        imageClassName="opacity-92"
        objectPosition={hero.imagePosition}
        priority={featured}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.02)_0%,rgba(3,5,4,0.2)_46%,rgba(3,5,4,0.88)_100%)]" />
      <div className="absolute bottom-3 left-3 right-3 grid gap-2">
        <span className="w-fit max-w-full truncate border border-yuzu-gold/65 bg-yuzu-night/78 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold backdrop-blur">
          {hero.label}
        </span>
        <div className="grid grid-cols-2 gap-2">
          {supportingVisuals.slice(0, 2).map((visual) => (
            <div key={`${visual.label}-${visual.image}`} className="relative min-h-20 overflow-hidden border border-yuzu-line/80 bg-yuzu-night">
              <ReferenceImage
                src={visual.image}
                alt={visual.alt ?? `${visual.label} story visual`}
                className="absolute inset-0"
                imageClassName="opacity-72"
                objectPosition={visual.imagePosition}
              />
              <div className="absolute inset-0 bg-yuzu-night/36" />
              <span className="absolute bottom-2 left-2 right-2 truncate text-[0.62rem] font-black uppercase tracking-[0.12em] text-yuzu-cream">
                {visual.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getFeedIntro(variant: NewsStoryFeedProps["variant"]) {
  if (variant === "cigarFlow") {
    return {
      eyebrow: "Cigar Flow update",
      title: "Latest news inside the flow",
    };
  }

  return {
    eyebrow: "Published from official sources",
    title: "Latest cigar industry stories",
  };
}

function mergeFallbackStoryImages(stories: NewsStory[], fallbackStories: NewsStory[]) {
  if (!fallbackStories.length) {
    return stories;
  }

  const fallbackImagesByKey = new Map<string, NewsStoryImage[]>();

  for (const story of fallbackStories) {
    for (const key of storyIdentityKeys(story)) {
      if (story.images?.length) {
        fallbackImagesByKey.set(key, story.images);
      }
    }
  }

  return stories.map((story) => {
    if (story.images?.length) {
      return story;
    }

    const fallbackImages = storyIdentityKeys(story).map((key) => fallbackImagesByKey.get(key)).find(Boolean);

    return fallbackImages ? { ...story, images: fallbackImages } : story;
  });
}

function storyIdentityKeys(story: NewsStory) {
  return [story.id, story.slug, story.title].filter((value): value is string => Boolean(value));
}

function storyVisuals(story: NewsStory): NewsStoryVisual[] {
  const storyImages = (story.images ?? [])
    .filter((visual) => visual.image)
    .map((visual) => ({
      ...visual,
      imagePosition: visual.imagePosition ?? "50% 50%",
      isStoryImage: true,
    }));
  const sourceVisuals = (story.sourceNotes ?? []).map((source) => visualForText(`${source.label} ${source.domain} ${source.url}`));
  const storyText = `${story.title} ${story.dek} ${story.category} ${story.bodyMarkdown}`;
  const keywordVisuals = [
    visualForText(storyText),
    visualForText(`${storyText} cigar box`),
    visualForText(`${storyText} lounge`),
  ];
  const visuals = [...storyImages, ...sourceVisuals, ...keywordVisuals, ...fallbackVisuals];
  const seen = new Set<string>();

  return visuals.filter((visual) => {
    const key = `${visual.label}-${visual.image}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).slice(0, 3);
}

function visualForText(value: string): NewsStoryVisual {
  const normalized = value.toLowerCase();

  for (const visual of keyedVisuals) {
    if (visual.keywords.some((keyword) => normalized.includes(keyword))) {
      return visual;
    }
  }

  return fallbackVisuals[0];
}

const keyedVisuals: Array<NewsStoryVisual & { keywords: string[] }> = [
  {
    label: "Drew Estate",
    image: "/assets/product-liga.png",
    imagePosition: "50% 50%",
    keywords: ["drew estate", "drewestate", "acid", "liga", "undercrown", "tabak"],
  },
  {
    label: "Rocky Patel",
    image: "/assets/hero-boxes.png",
    imagePosition: "54% 48%",
    keywords: ["rocky patel", "rockypatel"],
  },
  {
    label: "J.C. Newman",
    image: "/assets/product-fuente.png",
    imagePosition: "50% 50%",
    keywords: ["j.c. newman", "jcnewman", "newman", "diamond crown", "brick house"],
  },
  {
    label: "Arturo Fuente",
    image: "/assets/product-fuente.png",
    imagePosition: "50% 50%",
    keywords: ["arturo fuente", "arturofuente", "fuente"],
  },
  {
    label: "Padron",
    image: "/assets/product-padron.png",
    imagePosition: "50% 50%",
    keywords: ["padron", "padr\u00f3n"],
  },
  {
    label: "Davidoff",
    image: "/assets/product-davidoff.png",
    imagePosition: "50% 50%",
    keywords: ["davidoff", "oettinger"],
  },
  {
    label: "Plasencia",
    image: "/assets/product-plasencia.png",
    imagePosition: "50% 50%",
    keywords: ["plasencia"],
  },
  {
    label: "Oliva",
    image: "/assets/membership-boxes.png",
    imagePosition: "50% 48%",
    keywords: ["oliva", "nub", "serie v"],
  },
  {
    label: "Factory Update",
    image: "/assets/shop-hero.png",
    imagePosition: "56% 48%",
    keywords: ["manufacturer", "factory", "release", "drop", "limited", "anniversary", "blend"],
  },
  {
    label: "Member Lounge",
    image: "/assets/about-lounge.png",
    imagePosition: "52% 44%",
    keywords: ["event", "lounge", "member", "tasting", "cigar flow"],
  },
];

const fallbackVisuals: NewsStoryVisual[] = [
  { label: "Cigar Flow", image: "/assets/hero-boxes.png", imagePosition: "54% 48%" },
  { label: "News Desk", image: "/assets/shop-hero.png", imagePosition: "56% 48%" },
  { label: "Yuzu Lounge", image: "/assets/about-lounge.png", imagePosition: "52% 44%" },
];

function markdownSections(markdown: string) {
  const sections: Array<{ heading: string; body: string }> = [];
  const parts = markdown.split(/^##\s+/m).map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    const [headingLine, ...bodyLines] = part.split("\n");
    const heading = headingLine?.trim() || "Story Update";
    const body = bodyLines.join("\n").replace(/\s+/g, " ").trim();

    if (body) {
      sections.push({ heading, body });
    }
  }

  if (sections.length) {
    return sections;
  }

  return [{ heading: "Story Update", body: markdown.replace(/\s+/g, " ").trim() || "This story is being reviewed." }];
}
