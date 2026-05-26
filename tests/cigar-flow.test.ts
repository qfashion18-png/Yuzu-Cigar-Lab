import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import sitemap from "../src/app/sitemap";
import { cigarFlowAutomation, cigarFlowItems, cigarFlowNewsStories, cigarFlowSources } from "../src/lib/cigar-flow";
import { navItems } from "../src/lib/data";
import { officialCigarNewsSources } from "../src/lib/newsroom";
import { siteUrl } from "../src/lib/site";

const cigarFlowPageSource = readFileSync(new URL("../src/app/cigar-flow/page.tsx", import.meta.url), "utf8");
const cigarFlowExperienceSource = readFileSync(new URL("../src/components/cigar-flow-experience.tsx", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const dailyCigarNewsRunSource = readFileSync(new URL("../scripts/daily-cigar-news-run.ts", import.meta.url), "utf8");

test("cigar flow exposes verified RSS feed sources", () => {
  const feedUrls = cigarFlowSources.map((source) => source.feedUrl);

  assert.equal(new Set(feedUrls).size, feedUrls.length);
  assert.ok(feedUrls.includes("https://halfwheel.com/feed"));
  assert.ok(feedUrls.includes("https://cigardojo.com/feed"));
  assert.ok(feedUrls.includes("https://www.cigarjournal.com/feed"));
  assert.ok(feedUrls.includes("https://www.jrcigars.com/blending-room/feed/"));
  assert.ok(feedUrls.includes("http://cigaraficionado.com/"));

  for (const source of cigarFlowSources) {
    assert.match(source.feedUrl, /^https?:\/\//);
    assert.ok(source.focus.length > 20);
  }
});

test("cigar flow feed mixes RSS news, manufacturer drops, member posts, image cards, and video cards", () => {
  const kinds = new Set(cigarFlowItems.map((item) => item.kind));
  const mediaTypes = new Set(cigarFlowItems.map((item) => item.mediaType));

  assert.ok(kinds.has("rss"));
  assert.ok(kinds.has("manufacturer"));
  assert.ok(kinds.has("member"));
  assert.ok(mediaTypes.has("image"));
  assert.ok(mediaTypes.has("video"));
  assert.ok(cigarFlowItems.some((item) => item.featured), "one card should anchor the flow visually");

  for (const item of cigarFlowItems) {
    assert.ok(item.tags.length >= 2);
    if (item.kind === "member") {
      assert.match(item.image, /^\/(assets|refs)\//);
    } else {
      assert.match(item.image, /^https?:\/\//, "feed and manufacturer cards should use actual feed-provided images");
    }
    assert.equal(item.publishedAt.includes("ago"), false, "static feed dates should not use stale relative copy");
  }
});

test("cigar flow reader notes carry compact story snippets", () => {
  for (const item of cigarFlowItems) {
    const storySnippet = (item as { storySnippet?: string }).storySnippet;

    if (typeof storySnippet !== "string") {
      assert.fail(`${item.title} should provide a story snippet for the reader note`);
    }

    assert.ok(storySnippet.length >= 50, `${item.title} reader snippet should feel story-specific`);
    assert.ok(storySnippet.length <= 220, `${item.title} reader snippet should stay compact`);
    assert.notEqual(storySnippet, item.excerpt, `${item.title} reader snippet should add context beyond the card excerpt`);
  }
});

test("cigar flow route is wired into navigation, sitemap, metadata, and source panel", () => {
  assert.ok(navItems.some((item) => item.href === "/cigar-flow" && item.label === "Cigar Flow"));
  assert.equal(navItems.some((item) => item.href === "/news"), false, "News should not appear as a separate public tab");
  assert.ok(sitemap().some((entry) => entry.url === `${siteUrl}/cigar-flow`));
  assert.ok(cigarFlowPageSource.includes("Cigar Flow | Yuzu Cigar Club"));
  assert.ok(cigarFlowPageSource.includes("CigarFlowExperience"));
  assert.ok(cigarFlowPageSource.includes("NewsStoryFeed"));
  assert.ok(cigarFlowPageSource.includes("cigarFlowNewsStories"));
  assert.ok(cigarFlowPageSource.includes("cigarFlowSources.map"));
  assert.ok(cigarFlowPageSource.includes("RSS and news sources"));
  assert.ok(cigarFlowPageSource.includes("Manufacturer update watchlist"));
  assert.ok(cigarFlowPageSource.includes("Start a Post"));
});

test("cigar flow documents the Friday refresh automation target", () => {
  assert.equal(cigarFlowAutomation.id, "cigar-flow-friday-update");
  assert.equal(cigarFlowAutomation.cadence, "Fridays at 8:00 AM America/Phoenix");
  assert.ok(cigarFlowAutomation.outputTargets.includes("Cigar Flow feed"));
  assert.ok(cigarFlowAutomation.outputTargets.includes("Education weekly article"));
  assert.ok(cigarFlowAutomation.outputTargets.includes("Newsletter draft"));
  assert.ok(cigarFlowAutomation.updateScope.some((line) => line.includes("officialCigarNewsSources")));
  assert.ok(officialCigarNewsSources.length >= 40);
  assert.ok(cigarFlowNewsStories.some((story) => story.title.includes("Cigar Flow Update")));
  assert.ok(cigarFlowNewsStories.every((story) => (story.images?.length ?? 0) >= 3));
  assert.ok(cigarFlowNewsStories.every((story) => story.images?.every((image) => /^https?:\/\//.test(image.image) && /^https?:\/\//.test(image.sourceUrl ?? ""))));
  assert.ok(cigarFlowPageSource.includes("cigarFlowAutomation.cadence"));
  assert.ok(!cigarFlowPageSource.includes("A later scheduled job can pull"));
});

test("daily cigar flow writer submits actual feed story images", () => {
  assert.ok(dailyCigarNewsRunSource.includes("cigarFlowItems"), "daily writer should read current Cigar Flow cards");
  assert.ok(dailyCigarNewsRunSource.includes("storyImages"), "daily writer should build story image metadata");
  assert.ok(dailyCigarNewsRunSource.includes("imagePosition"), "story images should preserve crop positioning from feed cards");
  assert.ok(dailyCigarNewsRunSource.includes("sourceUrl"), "story images should link back to their source story");
  assert.ok(dailyCigarNewsRunSource.includes("images: storyImages"), "publish payload should include actual story images");
});

test("home page promotes Cigar Flow with live feed context", () => {
  assert.ok(homePageSource.includes('data-home-cigar-flow="feature"'), "missing home Cigar Flow promo marker");
  assert.ok(homePageSource.includes("featuredCigarFlowItem.image"), "home promo should use the feed image binding");
  assert.ok(homePageSource.includes("homeCigarFlowItems.map"), "home promo should preview multiple flow cards");
  assert.ok(homePageSource.includes("cigarFlowStats.map"), "home promo should reuse Cigar Flow stats");
  assert.ok(homePageSource.includes('href="/cigar-flow"'), "home promo should link into Cigar Flow");
});

test("cigar flow cards open an in-Yuzu reader with close and article navigation controls", () => {
  assert.ok(cigarFlowExperienceSource.includes('"use client"'), "reader needs client state");
  assert.ok(cigarFlowExperienceSource.includes("setActiveIndex"), "cards should open local reader state");
  assert.ok(cigarFlowExperienceSource.includes('role="dialog"'), "opened article should render as an in-site dialog");
  assert.ok(cigarFlowExperienceSource.includes('data-cigar-flow-reader-panel="details"'), "reader details panel should be targetable for viewport fit checks");
  assert.ok(cigarFlowExperienceSource.includes("lg:overflow-hidden"), "desktop reader details should fit without an internal scrollbar");
  assert.ok(cigarFlowExperienceSource.includes('aria-label="Close article"'), "reader should expose a close control");
  assert.ok(cigarFlowExperienceSource.includes('aria-label="Next article"'), "reader should expose next article control");
  assert.ok(cigarFlowExperienceSource.includes("openPrevious"), "reader should expose previous article control");
  assert.ok(cigarFlowExperienceSource.includes("Read Full Source"), "source article link should remain available inside the reader");
  assert.ok(cigarFlowExperienceSource.includes("activeItem.storySnippet"), "reader note should render the active story snippet");
  assert.ok(cigarFlowExperienceSource.includes("Escape"), "keyboard users should be able to close the reader");
});
