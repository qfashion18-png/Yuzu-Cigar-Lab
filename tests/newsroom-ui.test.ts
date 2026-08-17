import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { canonicalNewsImageKey, normalizeNewsImageUrl, officialCigarNewsSources } from "../src/lib/newsroom";
import { deduplicateNewsStories, markdownSections } from "../src/components/news-story-feed";
import type { NewsStory } from "../src/lib/newsroom";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("admin newsroom route is Cognito-gated and renders the newsroom agent panel", () => {
  const page = source("../src/app/admin/newsroom/page.tsx");

  assert.ok(page.includes("AdminAccessGate"));
  assert.ok(page.includes("NewsroomAgentPanel"));
});

test("newsroom agent panel drafts from official sources and requires approval before publishing", () => {
  const panel = source("../src/components/newsroom-agent-panel.tsx");

  assert.ok(panel.includes("draftNewsStory"));
  assert.ok(panel.includes("publishNewsStory"));
  assert.ok(panel.includes("normalizeNewsSourceCandidate"));
  assert.ok(panel.includes("officialCigarNewsSources"));
  assert.ok(panel.includes("defaultManufacturerSourceText"));
  assert.ok(panel.includes("operatorApproved: true"));
});

test("public news cards prefer story images and hide source note rails", () => {
  const page = source("../src/app/news/page.tsx");
  const feed = source("../src/components/news-story-feed.tsx");
  const data = source("../src/lib/data.ts");
  const panel = source("../src/components/newsroom-agent-panel.tsx");

  assert.ok(page.includes("NewsStoryFeed"));
  assert.ok(feed.includes("fetchPublishedNewsStories"));
  assert.ok(feed.includes("fallbackStories"));
  assert.ok(feed.includes("mergeFallbackStoryImages"));
  assert.ok(feed.includes("data-news-story-images"));
  assert.ok(feed.includes("story.images"));
  assert.ok(feed.includes("story-provided"));
  assert.ok(feed.includes("storyVisuals"));
  assert.ok(feed.includes("Published from official sources"));
  assert.equal(feed.includes(">Source Notes<"), false);
  assert.equal(data.includes('href: "/news", label: "News"'), false);
  assert.ok(panel.includes('href="/cigar-flow#cigar-flow-news"'));
  assert.ok(panel.includes("View Cigar Flow"));
});

test("cigar flow latest news assigns unique generated images when live stories lack images", async () => {
  const newsStoryFeedModule = (await import("../src/components/news-story-feed")) as unknown as {
    default?: { NewsStoryFeed?: React.ComponentType<{ fallbackStories: NewsStory[]; variant: "cigarFlow" }> };
    NewsStoryFeed?: React.ComponentType<{ fallbackStories: NewsStory[]; variant: "cigarFlow" }>;
  };
  const NewsStoryFeed = newsStoryFeedModule.default?.NewsStoryFeed ?? newsStoryFeedModule.NewsStoryFeed;

  assert.ok(NewsStoryFeed, "NewsStoryFeed should be available to render the public news rail");

  const sourceNote = {
    label: "Drew Estate",
    url: "https://drewestate.com/",
    note: "Official brand website.",
    sourceType: "official" as const,
    domain: "drewestate.com",
  };
  const stories: NewsStory[] = [
    {
      slug: "drew-estate-release-update",
      title: "Drew Estate Release Update",
      dek: "A source-backed maker update for adult members tracking release timing.",
      category: "Cigar Industry News",
      bodyMarkdown: "## Release signal\nDrew Estate posted a maker update for adult cigar readers watching new releases.",
      sourceNotes: [sourceNote],
      officialSources: [sourceNote.url],
      status: "published",
      publishedAt: "2026-05-20T12:00:00.000Z",
      updatedAt: "2026-05-20T12:00:00.000Z",
    },
    {
      slug: "drew-estate-factory-update",
      title: "Drew Estate Factory Update",
      dek: "A second source-backed maker note that should not reuse the same visual.",
      category: "Cigar Industry News",
      bodyMarkdown: "## Factory note\nDrew Estate shared another official update for adult cigar readers watching maker news.",
      sourceNotes: [{ ...sourceNote, url: "https://drewestate.com/news/factory-update" }],
      officialSources: ["https://drewestate.com/news/factory-update"],
      status: "published",
      publishedAt: "2026-05-21T12:00:00.000Z",
      updatedAt: "2026-05-21T12:00:00.000Z",
    },
  ];

  const markup = renderToStaticMarkup(React.createElement(NewsStoryFeed, { fallbackStories: stories, variant: "cigarFlow" }));
  const imagePaths = [...markup.matchAll(/url=([^&"']+)/g)]
    .map((match) => decodeURIComponent(match[1]))
    .filter((path) => path.startsWith("/assets/news/"));
  const uniqueGeneratedImages = new Set(imagePaths);

  assert.ok(markup.includes('data-news-story-images="generated-story"'), "missing generated story image marker");
  assert.ok(markup.includes('data-news-brand-logo="Drew Estate"'), "branded latest news should display a brand logo badge on the image");
  assert.equal(markup.includes("/assets/product-liga.png"), false, "image-less live stories should not fall back to repeated static product art");
  assert.ok(uniqueGeneratedImages.size >= stories.length * 3, "each image-less latest news story should receive a unique hero image plus inline story images");
});

test("cigar flow never reuses a generated visual across an eight-story image-less feed", async () => {
  const newsStoryFeedModule = (await import("../src/components/news-story-feed")) as unknown as {
    default?: { NewsStoryFeed?: React.ComponentType<{ fallbackStories: NewsStory[]; variant: "cigarFlow" }> };
    NewsStoryFeed?: React.ComponentType<{ fallbackStories: NewsStory[]; variant: "cigarFlow" }>;
  };
  const NewsStoryFeed = newsStoryFeedModule.default?.NewsStoryFeed ?? newsStoryFeedModule.NewsStoryFeed;
  assert.ok(NewsStoryFeed);

  const stories = Array.from({ length: 8 }, (_, index): NewsStory => ({
    id: `unique-visual-story-${index}`,
    slug: `unique-visual-story-${index}`,
    title: `Source-backed release update ${index}`,
    dek: "An image-less source-backed update.",
    category: "Industry News",
    bodyMarkdown: "## Release signal\nThe official source confirms an update for adult cigar readers.",
    sourceNotes: [],
    officialSources: [`https://drewestate.com/news/unique-release-${index}`],
    status: "published",
    publishedAt: `2026-08-${String(16 - index).padStart(2, "0")}T15:00:00.000Z`,
    updatedAt: `2026-08-${String(16 - index).padStart(2, "0")}T15:00:00.000Z`,
  }));

  const markup = renderToStaticMarkup(React.createElement(NewsStoryFeed, { fallbackStories: stories, variant: "cigarFlow" }));
  const renderedImages = [...markup.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)]
    .map((match) => new URL(match[1].replace(/&amp;/g, "&"), "https://www.yuzucigarclub.com"))
    .map((value) => value.searchParams.get("url") || value.pathname)
    .filter((value) => value.startsWith("/assets/news/"));
  const canonicalPaths = renderedImages.map((value) => decodeURIComponent(value).split("?")[0]);

  assert.ok(canonicalPaths.length >= stories.length, "every rendered story needs at least one visual");
  assert.equal(new Set(canonicalPaths).size, canonicalPaths.length, "a visual may appear at most once across the feed");
});

test("story image logo overlays match the image brand instead of unrelated source notes", async () => {
  const newsStoryFeedModule = (await import("../src/components/news-story-feed")) as unknown as {
    default?: { NewsStoryFeed?: React.ComponentType<{ fallbackStories: NewsStory[]; variant: "cigarFlow" }> };
    NewsStoryFeed?: React.ComponentType<{ fallbackStories: NewsStory[]; variant: "cigarFlow" }>;
  };
  const NewsStoryFeed = newsStoryFeedModule.default?.NewsStoryFeed ?? newsStoryFeedModule.NewsStoryFeed;
  const story: NewsStory = {
    slug: "mixed-source-image-story",
    title: "Cigar Flow Update",
    dek: "A roundup with a Matilde image and an unrelated maker source note.",
    category: "Cigar Industry News",
    bodyMarkdown: "## Update\nA source-backed roundup for adult cigar readers.",
    images: [
      {
        label: "Matilde Limited Exposure No. 3",
        image: "/assets/news/cigar-flow-release-desk.jpg",
        alt: "Matilde cigar image",
        sourceUrl: "https://halfwheel.com/matilde-limited-exposure-no-3-robusto/470765/",
      },
    ],
    sourceNotes: [
      {
        label: "Drew Estate",
        url: "https://drewestate.com/",
        note: "Official brand website.",
        sourceType: "official",
        domain: "drewestate.com",
      },
    ],
    officialSources: ["https://drewestate.com/"],
    status: "published",
    publishedAt: "2026-05-22T12:00:00.000Z",
    updatedAt: "2026-05-22T12:00:00.000Z",
  };

  assert.ok(NewsStoryFeed, "NewsStoryFeed should be available to render image-brand logo checks");

  const markup = renderToStaticMarkup(React.createElement(NewsStoryFeed, { fallbackStories: [story], variant: "cigarFlow" }));

  assert.ok(markup.includes('data-news-story-images="story-provided"'));
  assert.equal(markup.includes('data-news-brand-logo="Drew Estate"'), false, "unrelated source notes should not brand a different story image");
});

test("cigar flow latest news renders an editorial story spread with inline images", async () => {
  const newsStoryFeedModule = (await import("../src/components/news-story-feed")) as unknown as {
    default?: { NewsStoryFeed?: React.ComponentType<{ fallbackStories: NewsStory[]; variant: "cigarFlow" }> };
    NewsStoryFeed?: React.ComponentType<{ fallbackStories: NewsStory[]; variant: "cigarFlow" }>;
  };
  const NewsStoryFeed = newsStoryFeedModule.default?.NewsStoryFeed ?? newsStoryFeedModule.NewsStoryFeed;
  const story: NewsStory = {
    slug: "may-31-cigar-industry-highlights",
    title: "May 31 Cigar Industry Highlights: New Releases and Events",
    dek: "Explore the latest cigar releases and industry events from Oliva, Perdomo, and Foundation Cigar Company.",
    category: "Cigar Industry News",
    bodyMarkdown:
      "## New Releases\nOliva Cigars has unveiled a new limited edition cigar, the Oliva Serie V Maduro. Perdomo Cigars has also announced the launch of their new Perdomo 20th Anniversary Series. Foundation Cigar Company has introduced the new Foundation 1876 Maduro.\n\n## Upcoming Events\nCigar enthusiasts should mark their calendars for the upcoming Cigar Aficionado Trade Show, scheduled for June 15-17. This event will feature a variety of cigar brands, including Oliva, Perdomo, and Foundation.\n\n## Flow Note\nStay tuned for more updates as the cigar industry continues to evolve and surprise us with new and exciting offerings.",
    images: [
      {
        label: "Oliva",
        image: "/assets/news/cigar-flow-release-desk.jpg",
        imagePosition: "50% 50%",
        alt: "Open premium cigar box for the May 31 cigar industry highlights story",
        sourceUrl: "https://olivacigar.com/news/",
      },
      {
        label: "New Releases",
        image: "/assets/news/cigar-flow-limited-drop.jpg",
        imagePosition: "50% 50%",
        alt: "Limited cigar release desk for the May 31 story",
        sourceUrl: "https://www.perdomocigars.com/news",
      },
      {
        label: "Upcoming Events",
        image: "/assets/news/cigar-flow-trade-show.jpg",
        imagePosition: "50% 50%",
        alt: "Trade show cigar display for the May 31 story",
        sourceUrl: "https://foundationcigarcompany.com/press/",
      },
      {
        label: "PCA Trade Show",
        image: "/assets/news/researched/pca-2026-trade-show.jpg",
        imagePosition: "50% 50%",
        alt: "PCA 2026 collage for the May 31 story",
        sourceUrl: "https://www.cigaraficionado.com/article/highlights-from-the-pca-trade-show",
      },
    ],
    sourceNotes: [],
    officialSources: [],
    status: "published",
    publishedAt: "2026-05-31T12:00:00.000Z",
    updatedAt: "2026-05-31T12:00:00.000Z",
  };

  assert.ok(NewsStoryFeed, "NewsStoryFeed should be available to render the Cigar Flow editorial spread");

  const markup = renderToStaticMarkup(React.createElement(NewsStoryFeed, { fallbackStories: [story], variant: "cigarFlow" }));

  assert.ok(markup.includes('data-cigar-flow-editorial-story="true"'), "missing editorial story marker");
  assert.ok(markup.includes('data-cigar-flow-story-body="true"'), "missing story body marker");
  assert.ok(markup.includes('data-cigar-flow-brand-plate="Oliva"'), "missing brand plate on the hero image");
  assert.ok(markup.includes('data-cigar-flow-inline-image="New Releases"'), "missing inline release image");
  assert.ok(markup.includes('data-cigar-flow-inline-image="Upcoming Events"'), "missing inline event image");
  assert.ok(markup.includes('data-cigar-flow-inline-image="PCA Trade Show"'), "missing fourth researched story image");
  assert.ok(markup.includes("May 31 Cigar Industry Highlights: New Releases and Events"));
  assert.ok(markup.includes("CIGAR INDUSTRY NEWS"));
  assert.equal(markup.includes("## New Releases"), false, "markdown headings should render as formatted section titles");
});

test("cigar flow latest news read-aloud is available only to members", async () => {
  const feed = source("../src/components/news-story-feed.tsx");
  const newsStoryFeedModule = (await import("../src/components/news-story-feed")) as unknown as {
    buildLatestNewsNarration?: (stories: NewsStory[]) => string;
  };
  const buildLatestNewsNarration = newsStoryFeedModule.buildLatestNewsNarration;

  assert.ok(feed.includes("useOptionalBackupAuth"), "latest news read-aloud should use the member auth state");
  assert.match(feed, /auth\?\.isReady\s*&&\s*auth\.isMember\s*&&\s*variant\s*===\s*"cigarFlow"/);
  assert.ok(feed.includes("Read latest news"));
  assert.ok(feed.includes("speechSynthesis"));
  assert.equal(typeof buildLatestNewsNarration, "function");
  assert.ok(buildLatestNewsNarration, "narration builder should be exported");

  const narration = buildLatestNewsNarration([
    {
      slug: "member-read-aloud-story",
      title: "Rocky Patel Shipment Update",
      dek: "A source-backed member brief on allocation timing.",
      category: "Cigar Industry News",
      bodyMarkdown: "## Allocation signal\nBoxes are expected to reach adult member allocations this week.",
      sourceNotes: [],
      officialSources: [],
      status: "published",
      publishedAt: "2026-05-23T12:00:00.000Z",
      updatedAt: "2026-05-23T12:00:00.000Z",
    },
  ]);

  assert.match(narration, /Latest news inside the flow/i);
  assert.match(narration, /Rocky Patel Shipment Update/);
  assert.match(narration, /Allocation signal/);
  assert.equal(narration.includes("##"), false);
});

test("newsroom manufacturer watchlist seeds all configured brand sources", () => {
  assert.ok(officialCigarNewsSources.length >= 40);
  assert.ok(officialCigarNewsSources.some((source) => source.name === "Drew Estate"));
  assert.ok(officialCigarNewsSources.some((source) => source.name === "Rocky Patel"));
  assert.ok(officialCigarNewsSources.some((source) => source.name === "J.C. Newman"));
  assert.equal(new Set(officialCigarNewsSources.map((source) => source.domain)).size, officialCigarNewsSources.length);
});

test("newsroom feed collapses logical daily duplicates and canonical same-site images", () => {
  const baseStory: NewsStory = {
    id: "story-a",
    slug: "daily-cigar-flow-2026-08-16-first-title",
    title: "Daily Cigar Flow Update",
    dek: "A source-backed update.",
    category: "Industry News",
    bodyMarkdown: "## Update\nA factual update.",
    images: [],
    sourceNotes: [],
    officialSources: [],
    status: "published",
    publishedAt: "2026-08-16T15:00:00.000Z",
    updatedAt: "2026-08-16T15:00:00.000Z",
  };
  const stories = deduplicateNewsStories([
    baseStory,
    { ...baseStory, id: "story-b", slug: "daily-cigar-flow-2026-08-16-changed-ai-title" },
  ]);

  assert.equal(stories.length, 1);

  const repeatedSourceStories = deduplicateNewsStories([
    {
      ...baseStory,
      id: "source-story-a",
      slug: "first-generated-title",
      title: "First generated title",
      officialSources: ["http://www.olivacigar.com/news/?utm_source=daily"],
    },
    {
      ...baseStory,
      id: "source-story-b",
      slug: "second-generated-title",
      title: "Second generated title",
      officialSources: ["https://olivacigar.com/news"],
      publishedAt: "2026-08-15T15:00:00.000Z",
    },
  ]);
  assert.equal(repeatedSourceStories.length, 1, "one official source page must not render as multiple generated stories");

  assert.equal(normalizeNewsImageUrl("https://yuzucigarclub.com/assets/news/example.jpg"), "/assets/news/example.jpg");
  assert.equal(
    canonicalNewsImageKey("https://www.yuzucigarclub.com/assets/news/example.jpg?utm_source=test"),
    canonicalNewsImageKey("/assets/news/example.jpg"),
  );
});

test("newsroom markdown parser drops a leading H1 that repeats the story title", () => {
  const sections = markdownSections(
    "# Source-Backed Update\n\n## Release desk\nThe official release page confirms the update.",
    "Source-Backed Update",
  );

  assert.deepEqual(sections, [{ heading: "Release desk", body: "The official release page confirms the update." }]);
});
