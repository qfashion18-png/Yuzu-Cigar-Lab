import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { officialCigarNewsSources } from "../src/lib/newsroom";
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
      sourceNotes: [sourceNote],
      officialSources: [sourceNote.url],
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
  assert.equal(uniqueGeneratedImages.size, stories.length, "each image-less latest news story should receive its own generated image");
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
