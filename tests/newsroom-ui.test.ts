import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { officialCigarNewsSources } from "../src/lib/newsroom";

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

test("newsroom manufacturer watchlist seeds all configured brand sources", () => {
  assert.ok(officialCigarNewsSources.length >= 40);
  assert.ok(officialCigarNewsSources.some((source) => source.name === "Drew Estate"));
  assert.ok(officialCigarNewsSources.some((source) => source.name === "Rocky Patel"));
  assert.ok(officialCigarNewsSources.some((source) => source.name === "J.C. Newman"));
  assert.equal(new Set(officialCigarNewsSources.map((source) => source.domain)).size, officialCigarNewsSources.length);
});
