import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  assert.ok(panel.includes("operatorApproved: true"));
});

test("public news page reads published stories from the live API without admin auth", () => {
  const page = source("../src/app/news/page.tsx");
  const feed = source("../src/components/news-story-feed.tsx");
  const data = source("../src/lib/data.ts");

  assert.ok(page.includes("NewsStoryFeed"));
  assert.ok(feed.includes("fetchPublishedNewsStories"));
  assert.ok(feed.includes("Published from official sources"));
  assert.match(data, /href: "\/news", label: "News"/);
});
