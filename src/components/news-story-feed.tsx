"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Newspaper, ShieldCheck, Square, Volume2 } from "lucide-react";

import { useOptionalBackupAuth } from "@/components/backup-auth-provider";
import { ReferenceImage } from "@/components/reference-image";
import { Button } from "@/components/ui/button";
import { fetchPublishedNewsStories, getLiveApiErrorMessage } from "@/lib/live-api";
import { buildEditorialImageAlt } from "@/lib/image-seo";
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
  isGeneratedStoryImage?: boolean;
  brandLogo?: NewsStoryBrandLogo;
};

type NewsStoryBrandLogo = {
  label: string;
  mark: string;
  keywords: string[];
};

type NewsStoryCardModel = {
  story: NewsStory;
  visuals: NewsStoryVisual[];
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
  const auth = useOptionalBackupAuth();
  const intro = getFeedIntro(variant);
  const storyCards = useMemo(() => buildStoryCardModels(stories, variant), [stories, variant]);
  const canUseReadAloud = Boolean(auth?.isReady && auth.isMember && variant === "cigarFlow");

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
        <div className="grid gap-3 sm:justify-items-end">
          <div className="inline-flex items-center gap-2 text-sm text-yuzu-muted">
            <ShieldCheck className="size-5 text-yuzu-gold" />
            Operator reviewed
          </div>
          {canUseReadAloud ? <NewsReadAloudControl stories={stories} /> : null}
        </div>
      </div>

      {variant === "cigarFlow" ? (
        <div className="grid gap-6" data-cigar-flow-editorial-feed="true">
          {storyCards.map(({ story, visuals }, index) => (
            <CigarFlowEditorialStory
              key={story.id || story.slug || story.title}
              featured={index === 0}
              story={story}
              visuals={visuals}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {storyCards.map(({ story, visuals }, index) => (
            <StoryCard key={story.id || story.slug || story.title} featured={index === 0} story={story} visuals={visuals} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsReadAloudControl({ stories }: { stories: NewsStory[] }) {
  const [isSpeechSupported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const narration = useMemo(() => buildLatestNewsNarration(stories), [stories]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleReadAloud() {
    if (!isSpeechSupported) {
      setStatusMessage("Read-aloud is not available in this browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setStatusMessage("Read-aloud stopped.");
      return;
    }

    if (!narration.trim()) {
      setStatusMessage("There is no latest news to read yet.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(narration);
    utterance.rate = 0.94;
    utterance.pitch = 0.98;
    utterance.onend = () => {
      setIsSpeaking(false);
      setStatusMessage("Read-aloud complete.");
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setStatusMessage("Read-aloud stopped.");
    };

    setIsSpeaking(true);
    setStatusMessage("Reading latest news aloud.");
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        className="h-10 border-yuzu-gold px-4 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
        disabled={!isSpeechSupported}
        onClick={handleReadAloud}
        type="button"
        variant="outline"
      >
        {isSpeaking ? <Square data-icon="inline-start" /> : <Volume2 data-icon="inline-start" />}
        {isSpeaking ? "Stop reading" : "Read latest news"}
      </Button>
      <p className="min-h-5 text-xs leading-5 text-yuzu-muted" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  );
}

export function buildLatestNewsNarration(stories: NewsStory[]) {
  if (!stories.length) {
    return "Latest news inside the flow. No published stories are ready to read yet.";
  }

  const storyBriefs = stories.slice(0, 8).map((story, index) => {
    const sections = markdownSections(story.bodyMarkdown).slice(0, 2);

    return [
      `Story ${index + 1}: ${story.title}.`,
      story.dek,
      `${story.category}. Published ${formatSpeechDate(story.publishedAt)}.`,
      ...sections.map((section) => `${section.heading}. ${section.body}`),
    ]
      .filter(Boolean)
      .join(" ");
  });

  return ["Latest news inside the flow.", ...storyBriefs].join("\n\n");
}

function StoryCard({ story, featured, visuals }: { story: NewsStory; featured: boolean; visuals: NewsStoryVisual[] }) {
  const sections = useMemo(() => markdownSections(story.bodyMarkdown), [story.bodyMarkdown]);
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

function CigarFlowEditorialStory({
  story,
  featured,
  visuals,
}: {
  story: NewsStory;
  featured: boolean;
  visuals: NewsStoryVisual[];
}) {
  const sections = useMemo(() => markdownSections(story.bodyMarkdown), [story.bodyMarkdown]);
  const publishedDate = story.publishedAt
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(story.publishedAt))
    : "Recently";
  const [hero, ...supportingVisuals] = visuals;

  if (!hero) {
    return null;
  }

  const brandPlate = hero.brandLogo ?? brandLogoForText(hero.label);
  const brandLabel = brandPlate?.label ?? hero.label;
  const remainingVisuals = supportingVisuals.slice(sections.length);

  return (
    <article
      className={cn(
        "overflow-hidden border border-yuzu-gold/35 bg-[#07110d] shadow-[0_28px_80px_rgba(0,0,0,0.38)]",
        featured ? "lg:grid lg:grid-cols-[minmax(320px,0.41fr)_minmax(0,0.59fr)]" : "lg:grid lg:grid-cols-[minmax(260px,0.34fr)_minmax(0,0.66fr)]",
      )}
      data-cigar-flow-editorial-story="true"
    >
      <div
        className={cn(
          "relative min-h-[24rem] border-b border-yuzu-gold/35 bg-yuzu-night lg:min-h-full lg:border-b-0 lg:border-r",
          featured ? "sm:min-h-[32rem]" : "sm:min-h-[26rem]",
        )}
        data-news-story-images={getVisualImageSource(visuals)}
      >
        <ReferenceImage
          src={hero.image}
          alt={hero.alt ?? buildEditorialImageAlt({ title: story.title, label: hero.label })}
          className="absolute inset-0"
          imageClassName="opacity-94"
          objectPosition={hero.imagePosition}
          priority={featured}
          sizes="(max-width: 1024px) 100vw, 42vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.05)_0%,rgba(3,5,4,0.12)_48%,rgba(3,5,4,0.78)_100%)]" />
        <div
          className="absolute right-4 top-4 z-20 grid min-w-24 place-items-center border border-yuzu-gold/75 bg-yuzu-night/84 px-3 py-2 text-center shadow-[0_14px_38px_rgba(0,0,0,0.42)] backdrop-blur"
          data-cigar-flow-brand-plate={brandLabel}
          data-news-brand-logo={brandLabel}
        >
          <span className="font-heading text-xl leading-none text-yuzu-cream">{brandPlate?.mark ?? brandLabel.slice(0, 1)}</span>
          <span className="mt-1 max-w-28 truncate text-[0.58rem] font-black uppercase tracking-[0.12em] text-yuzu-gold">
            {brandLabel}
          </span>
        </div>
        <span className="absolute bottom-4 left-4 z-20 max-w-[calc(100%-2rem)] truncate border border-yuzu-gold/70 bg-yuzu-night/80 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-yuzu-gold backdrop-blur">
          {hero.label}
        </span>
      </div>

      <div className="bg-[radial-gradient(circle_at_100%_0%,rgba(220,169,58,0.1),transparent_24rem),linear-gradient(180deg,rgba(16,24,18,0.98),#07110d)] p-5 sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-center gap-3 text-[0.68rem] font-black uppercase tracking-[0.18em] text-yuzu-muted">
          <span className="text-yuzu-gold">{story.category.toUpperCase()}</span>
          <span className="h-4 w-px bg-yuzu-line" />
          <span>{publishedDate.toUpperCase()}</span>
        </div>
        <h3
          className={cn(
            "mt-4 max-w-5xl font-heading leading-[0.98] text-yuzu-cream",
            featured ? "text-4xl sm:text-5xl xl:text-6xl" : "text-3xl sm:text-4xl",
          )}
        >
          {story.title}
        </h3>
        <p className="mt-5 max-w-4xl text-sm leading-7 text-yuzu-cream/84 sm:text-base sm:leading-8">{story.dek}</p>
        <div className="mt-6 h-px bg-yuzu-line/75" />

        <div className="mt-6 grid gap-6" data-cigar-flow-story-body="true">
          {sections.map((section, index) => (
            <section key={section.heading} className="grid gap-4" data-cigar-flow-story-section={section.heading}>
              <div>
                <h4 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">{section.heading}</h4>
                <p className="mt-3 text-sm leading-7 text-yuzu-muted sm:text-[0.95rem] sm:leading-8">{section.body}</p>
              </div>
              {supportingVisuals[index] ? (
                <EditorialInlineImage storyTitle={story.title} visual={supportingVisuals[index]} />
              ) : null}
            </section>
          ))}
          {remainingVisuals.length ? (
            <div className="grid gap-4 sm:grid-cols-2" data-cigar-flow-image-strip="true">
              {remainingVisuals.map((visual) => (
                <EditorialInlineImage key={`${visual.label}-${visual.image}`} storyTitle={story.title} visual={visual} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EditorialInlineImage({ storyTitle, visual }: { storyTitle: string; visual: NewsStoryVisual }) {
  return (
    <figure
      className="grid gap-2 border border-yuzu-line/70 bg-yuzu-night/52 p-2 sm:grid-cols-[minmax(12rem,0.42fr)_minmax(0,0.58fr)] sm:items-stretch"
      data-cigar-flow-inline-image={visual.label}
    >
      <ReferenceImage
        src={visual.image}
        alt={visual.alt ?? buildEditorialImageAlt({ title: storyTitle, label: visual.label })}
        className="min-h-40"
        imageClassName="opacity-88"
        objectPosition={visual.imagePosition}
        sizes="(max-width: 768px) 100vw, 28vw"
      />
      <figcaption className="flex items-center border border-yuzu-line/55 bg-yuzu-ink/80 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-yuzu-cream">
        <span className="text-yuzu-gold">{visual.label}</span>
      </figcaption>
    </figure>
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

  return (
    <div
      className={cn(
        "relative min-h-72 border-b border-yuzu-line bg-yuzu-ink",
        featured ? "lg:min-h-full lg:border-b-0 lg:border-r" : "",
      )}
      data-news-story-images={getVisualImageSource(visuals)}
    >
      <ReferenceImage
        src={hero.image}
        alt={hero.alt ?? buildEditorialImageAlt({ title, label: hero.label })}
        className="absolute inset-0"
        imageClassName="opacity-92"
        objectPosition={hero.imagePosition}
        priority={featured}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.02)_0%,rgba(3,5,4,0.2)_46%,rgba(3,5,4,0.88)_100%)]" />
      {hero.brandLogo ? <BrandLogoBadge brandLogo={hero.brandLogo} /> : null}
      <div className="absolute bottom-3 left-3 right-3 grid gap-2">
        <span className="w-fit max-w-full truncate border border-yuzu-gold/65 bg-yuzu-night/78 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold backdrop-blur">
          {hero.label}
        </span>
        {supportingVisuals.length ? (
          <div className="grid grid-cols-2 gap-2">
            {supportingVisuals.slice(0, 2).map((visual) => (
              <div key={`${visual.label}-${visual.image}`} className="relative min-h-20 overflow-hidden border border-yuzu-line/80 bg-yuzu-night">
                <ReferenceImage
                  src={visual.image}
                  alt={visual.alt ?? buildEditorialImageAlt({ title, label: visual.label })}
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
        ) : null}
      </div>
    </div>
  );
}

function BrandLogoBadge({ brandLogo }: { brandLogo: NewsStoryBrandLogo }) {
  return (
    <div
      aria-label={`${brandLogo.label} logo`}
      className="absolute right-3 top-3 z-20 grid min-w-24 place-items-center border border-yuzu-gold/70 bg-yuzu-night/82 px-3 py-2 text-center shadow-[0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur"
      data-news-brand-logo={brandLogo.label}
    >
      <span className="font-heading text-xl leading-none text-yuzu-cream">{brandLogo.mark}</span>
      <span className="mt-1 max-w-28 truncate text-[0.58rem] font-black uppercase tracking-[0.12em] text-yuzu-gold">
        {brandLogo.label}
      </span>
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

function buildStoryCardModels(stories: NewsStory[], variant: NewsStoryFeedProps["variant"]): NewsStoryCardModel[] {
  const usedGeneratedImages = new Set<string>();
  const minimumVisualCount = variant === "cigarFlow" ? 3 : 1;

  return stories.map((story, index) => ({
    story,
    visuals: storyVisuals(story, index, usedGeneratedImages, minimumVisualCount),
  }));
}

function storyVisuals(
  story: NewsStory,
  storyIndex: number,
  usedGeneratedImages: Set<string>,
  minimumVisualCount: number,
): NewsStoryVisual[] {
  const generatedBrandLogo = brandLogoForStory(story);
  const storyImages = (story.images ?? [])
    .filter((visual) => visual.image)
    .map((visual, index) => ({
      ...visual,
      imagePosition: visual.imagePosition ?? "50% 50%",
      isStoryImage: true,
      brandLogo: index === 0 ? brandLogoForStoryImage(visual) : undefined,
    }));

  if (storyImages.length) {
    const maxVisualCount = minimumVisualCount > 1 ? Math.max(minimumVisualCount, storyImages.length) : 3;
    const supplementalVisuals =
      storyImages.length < minimumVisualCount
        ? generatedVisualsForStory(story, storyIndex, usedGeneratedImages, minimumVisualCount - storyImages.length)
        : [];

    return [...storyImages, ...supplementalVisuals].slice(0, maxVisualCount);
  }

  return generatedVisualsForStory(story, storyIndex, usedGeneratedImages, minimumVisualCount, generatedBrandLogo);
}

function generatedVisualsForStory(
  story: NewsStory,
  storyIndex: number,
  usedGeneratedImages: Set<string>,
  count: number,
  brandLogo?: NewsStoryBrandLogo,
): NewsStoryVisual[] {
  const normalized = storyVisualText(story).toLowerCase();
  const matchedVisuals = generatedStoryVisuals.filter((visual) => visual.keywords.some((keyword) => normalized.includes(keyword)));
  const orderedVisuals = [
    ...matchedVisuals,
    ...generatedStoryVisuals.filter((visual) => !matchedVisuals.some((matched) => matched.image === visual.image)),
  ];
  const offset = stableIndex(`${story.id || story.slug || story.title}-${storyIndex}`, orderedVisuals.length);
  const selectedVisuals: NewsStoryVisual[] = [];

  for (let selectedIndex = 0; selectedIndex < Math.max(1, count); selectedIndex += 1) {
    let selected = orderedVisuals[(offset + selectedIndex) % orderedVisuals.length] ?? generatedStoryVisuals[0];

    for (let index = 0; index < orderedVisuals.length; index += 1) {
      const candidate = orderedVisuals[(offset + selectedIndex + index) % orderedVisuals.length];

      if (!usedGeneratedImages.has(candidate.image)) {
        selected = candidate;
        break;
      }
    }

    usedGeneratedImages.add(selected.image);
    selectedVisuals.push({
      label: selectedIndex === 0 && brandLogo ? brandLogo.label : selected.label,
      image: selected.image,
      imagePosition: selected.imagePosition,
      alt: `${story.title} generated story image`,
      isGeneratedStoryImage: true,
      brandLogo: selectedIndex === 0 ? brandLogo : undefined,
    });
  }

  return selectedVisuals;
}

function getVisualImageSource(visuals: NewsStoryVisual[]) {
  const hasStoryImages = visuals.some((visual) => visual.isStoryImage);
  const hasGeneratedStoryImages = visuals.some((visual) => visual.isGeneratedStoryImage);

  return hasStoryImages ? "story-provided" : hasGeneratedStoryImages ? "generated-story" : "source-derived";
}

function brandLogoForStory(story: NewsStory) {
  const normalized = storyVisualText(story).toLowerCase();

  return brandLogos.find((brandLogo) => brandLogo.keywords.some((keyword) => normalized.includes(keyword)));
}

function brandLogoForStoryImage(visual: NewsStoryImage) {
  return brandLogoForText(`${visual.label} ${visual.alt ?? ""} ${visual.sourceUrl ?? ""}`);
}

function brandLogoForText(value: string) {
  const normalized = value.toLowerCase();

  return brandLogos.find((brandLogo) => brandLogo.keywords.some((keyword) => normalized.includes(keyword)));
}

function storyVisualText(story: NewsStory) {
  return `${story.title} ${story.dek} ${story.category} ${story.bodyMarkdown} ${(story.sourceNotes ?? [])
    .map((source) => `${source.label} ${source.domain ?? ""} ${source.url}`)
    .join(" ")}`;
}

function stableIndex(value: string, length: number) {
  if (length <= 0) {
    return 0;
  }

  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash % length;
}

function formatSpeechDate(value: string | null) {
  if (!value) {
    return "recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const brandLogos: NewsStoryBrandLogo[] = [
  {
    label: "Drew Estate",
    mark: "DE",
    keywords: ["drew estate", "drewestate", "acid", "liga", "undercrown", "tabak"],
  },
  {
    label: "Rocky Patel",
    mark: "RP",
    keywords: ["rocky patel", "rockypatel"],
  },
  {
    label: "J.C. Newman",
    mark: "JCN",
    keywords: ["j.c. newman", "jcnewman", "newman", "diamond crown", "brick house"],
  },
  {
    label: "Arturo Fuente",
    mark: "AF",
    keywords: ["arturo fuente", "arturofuente", "fuente"],
  },
  {
    label: "Padron",
    mark: "P",
    keywords: ["padron", "padr\u00f3n"],
  },
  {
    label: "Davidoff",
    mark: "D",
    keywords: ["davidoff", "oettinger"],
  },
  {
    label: "Plasencia",
    mark: "PL",
    keywords: ["plasencia"],
  },
  {
    label: "Oliva",
    mark: "O",
    keywords: ["oliva", "nub", "serie v"],
  },
  {
    label: "Camacho",
    mark: "C",
    keywords: ["camacho"],
  },
  {
    label: "Aganorsa Leaf",
    mark: "AL",
    keywords: ["aganorsa", "aganorsa leaf"],
  },
];

const generatedStoryVisuals: Array<Pick<NewsStoryVisual, "label" | "image" | "imagePosition"> & { keywords: string[] }> = [
  {
    label: "Release Desk",
    image: "/assets/news/cigar-flow-release-desk.jpg",
    imagePosition: "50% 50%",
    keywords: ["release", "announcement", "maker", "manufacturer", "news", "update"],
  },
  {
    label: "Drew Estate",
    image: "/assets/news/cigar-flow-drew-estate-maker.jpg",
    imagePosition: "50% 50%",
    keywords: ["drew estate", "drewestate", "liga", "acid", "undercrown", "tabak", "infused"],
  },
  {
    label: "Anniversary",
    image: "/assets/news/cigar-flow-rocky-anniversary.jpg",
    imagePosition: "50% 50%",
    keywords: ["rocky patel", "rockypatel", "anniversary", "milestone", "limited edition"],
  },
  {
    label: "Heritage Factory",
    image: "/assets/news/cigar-flow-newman-heritage.jpg",
    imagePosition: "50% 50%",
    keywords: ["j.c. newman", "jcnewman", "newman", "heritage", "factory", "craft"],
  },
  {
    label: "Press Wire",
    image: "/assets/news/cigar-flow-press-wire.jpg",
    imagePosition: "50% 50%",
    keywords: ["press", "wire", "source", "official", "review", "newsroom"],
  },
  {
    label: "Limited Drop",
    image: "/assets/news/cigar-flow-limited-drop.jpg",
    imagePosition: "50% 50%",
    keywords: ["limited", "drop", "allocation", "short-window", "inventory"],
  },
  {
    label: "Lounge Event",
    image: "/assets/news/cigar-flow-lounge-event.jpg",
    imagePosition: "50% 50%",
    keywords: ["event", "lounge", "tasting", "member", "dinner"],
  },
  {
    label: "Blend Workshop",
    image: "/assets/news/cigar-flow-blend-workshop.jpg",
    imagePosition: "50% 50%",
    keywords: ["blend", "wrapper", "binder", "filler", "workshop"],
  },
  {
    label: "Trade Show",
    image: "/assets/news/cigar-flow-trade-show.jpg",
    imagePosition: "50% 50%",
    keywords: ["trade", "show", "display", "booth", "convention"],
  },
  {
    label: "Collaboration",
    image: "/assets/news/cigar-flow-collaboration.jpg",
    imagePosition: "50% 50%",
    keywords: ["collaboration", "collab", "partnership", "joint"],
  },
  {
    label: "Wrapper Harvest",
    image: "/assets/news/cigar-flow-wrapper-harvest.jpg",
    imagePosition: "50% 50%",
    keywords: ["wrapper", "crop", "harvest", "leaf", "farm"],
  },
  {
    label: "Distribution",
    image: "/assets/news/cigar-flow-distribution.jpg",
    imagePosition: "50% 50%",
    keywords: ["shipping", "distribution", "import", "retailer", "arrival"],
  },
  {
    label: "Education",
    image: "/assets/news/cigar-flow-education.jpg",
    imagePosition: "50% 50%",
    keywords: ["education", "notes", "rating", "review", "flavor"],
  },
  {
    label: "Retail Shelf",
    image: "/assets/news/cigar-flow-retail-shelf.jpg",
    imagePosition: "50% 50%",
    keywords: ["availability", "retail", "stock", "shelf", "store"],
  },
  {
    label: "Commemorative",
    image: "/assets/news/cigar-flow-commemorative.jpg",
    imagePosition: "50% 50%",
    keywords: ["commemorative", "charity", "tribute", "anniversary"],
  },
  {
    label: "Interview",
    image: "/assets/news/cigar-flow-interview.jpg",
    imagePosition: "50% 50%",
    keywords: ["interview", "executive", "founder", "president"],
  },
  {
    label: "Awards Roundup",
    image: "/assets/news/cigar-flow-awards-roundup.jpg",
    imagePosition: "50% 50%",
    keywords: ["award", "ratings", "roundup", "top", "score"],
  },
  {
    label: "Production QC",
    image: "/assets/news/cigar-flow-production-qc.jpg",
    imagePosition: "50% 50%",
    keywords: ["production", "quality", "factory", "inspection"],
  },
  {
    label: "Release Calendar",
    image: "/assets/news/cigar-flow-release-calendar.jpg",
    imagePosition: "50% 50%",
    keywords: ["calendar", "seasonal", "schedule", "timing"],
  },
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
