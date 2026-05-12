"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, Newspaper, ShieldCheck } from "lucide-react";

import { fetchPublishedNewsStories, getLiveApiErrorMessage } from "@/lib/live-api";
import type { NewsStory } from "@/lib/newsroom";
import { cn } from "@/lib/utils";

export function NewsStoryFeed() {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStories() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetchPublishedNewsStories(18);

        if (!cancelled) {
          setStories(response.stories);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getLiveApiErrorMessage(loadError));
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
  }, []);

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
          <p className="text-xs font-black uppercase tracking-[0.2em] text-yuzu-gold">Published from official sources</p>
          <h2 className="mt-2 font-heading text-3xl text-yuzu-cream">Latest cigar industry stories</h2>
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
  const publishedDate = story.publishedAt ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(story.publishedAt)) : "Recently";

  return (
    <article
      className={cn(
        "border border-yuzu-line bg-yuzu-panel/74 p-5",
        featured ? "lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,0.86fr)_minmax(280px,0.44fr)] lg:gap-7" : "",
      )}
    >
      <div>
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

      <aside className={cn("mt-5 border-t border-yuzu-line pt-5", featured ? "lg:mt-0 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" : "")}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">Source Notes</p>
        <div className="mt-3 grid gap-3">
          {story.sourceNotes.map((source) => (
            <a
              key={source.url}
              className="group grid gap-1 border border-yuzu-line bg-yuzu-night/38 p-3 transition hover:border-yuzu-gold"
              href={source.url}
              rel="noreferrer"
              target="_blank"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-yuzu-cream group-hover:text-yuzu-gold">
                <ExternalLink className="size-4 shrink-0" />
                <span className="truncate">{source.label || source.domain || "Official source"}</span>
              </span>
              <span className="text-xs leading-5 text-yuzu-muted">{source.note}</span>
            </a>
          ))}
        </div>
      </aside>
    </article>
  );
}

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
