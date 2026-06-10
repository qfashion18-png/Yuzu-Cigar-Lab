import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import test from "node:test";

import sitemap from "../src/app/sitemap";
import {
  cigarFlowAutomation,
  cigarFlowItems,
  cigarFlowNewsStories,
  cigarFlowSources,
  cigarPressReleaseSearchSources,
} from "../src/lib/cigar-flow";
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
  assert.ok(sitemap().some((entry) => entry.url === `${siteUrl}/cigar-flow/`));
  assert.ok(cigarFlowPageSource.includes("Cigar Flow | Yuzu Cigar Club"));
  assert.ok(cigarFlowPageSource.includes("CigarFlowExperience"));
  assert.ok(cigarFlowPageSource.includes("NewsStoryFeed"));
  assert.ok(cigarFlowPageSource.includes("cigarFlowNewsStories"));
  assert.ok(cigarFlowPageSource.includes("cigarFlowSources.map"));
  assert.ok(cigarFlowPageSource.includes("RSS and news sources"));
  assert.ok(cigarFlowPageSource.includes("Manufacturer update watchlist"));
  assert.ok(cigarFlowPageSource.includes("Prepare Smoke Note"));
  assert.equal(cigarFlowPageSource.includes("Start a Post"), false, "Cigar Flow should not advertise a direct public post flow without a post endpoint");
});

test("cigar flow documents the actual daily newsroom automation target", () => {
  const workflowSource = readFileSync(new URL("../.github/workflows/cigar-flow-daily.yml", import.meta.url), "utf8");

  assert.equal(cigarFlowAutomation.id, "cigar-flow-daily-newsroom-refresh");
  assert.equal(cigarFlowAutomation.cadence, "Daily at 8:00 AM America/Phoenix");
  assert.ok(cigarFlowAutomation.outputTargets.includes("Cigar Flow news desk"));
  assert.ok(cigarFlowAutomation.outputTargets.includes("Published newsroom story"));
  assert.ok(cigarFlowAutomation.outputTargets.includes("Operator review trail"));
  assert.ok(
    cigarFlowAutomation.updateScope.some((line) => /daily search/i.test(line) && /cigar press releases/i.test(line)),
    "Manufacturer update watchlist should include a daily cigar press-release search for story leads",
  );
  assert.ok(cigarFlowAutomation.updateScope.some((line) => line.includes("POST /news/story-drafts")));
  assert.ok(
    cigarFlowAutomation.updateScope.some((line) => /editorial/i.test(line) && /inline/i.test(line)),
    "future Cigar Flow stories should keep the editorial hero and inline-image format",
  );
  assert.equal(
    cigarFlowAutomation.updateScope.some((line) => line.includes("Refresh the first ten Cigar Flow cards")),
    false,
    "automation metadata should not claim the API job edits static source files"
  );
  assert.ok(workflowSource.includes('cron: "0 15 * * *"'), "GitHub workflow should match the displayed 8 AM Phoenix daily cadence");
  assert.ok(workflowSource.includes('YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "true"'), "workflow should publish the reviewed newsroom story");
  assert.ok(officialCigarNewsSources.length >= 40);
  assert.ok(cigarFlowNewsStories.some((story) => story.title.includes("May 31 Cigar Industry Highlights")));
  assert.ok(cigarFlowNewsStories.some((story) => /Oliva Serie V Maduro/.test(story.bodyMarkdown)));
  assert.ok(cigarFlowNewsStories.some((story) => /Perdomo 20th Anniversary Series/.test(story.bodyMarkdown)));
  assert.ok(cigarFlowNewsStories.some((story) => /Wise Man Maduro/.test(story.bodyMarkdown)));
  assert.ok(cigarFlowNewsStories.every((story) => (story.images?.length ?? 0) >= 3));
  assert.ok(
    cigarFlowNewsStories.every((story) =>
      story.images?.every((image) => /^(https?:\/\/|\/assets\/news\/)/.test(image.image) && /^https?:\/\//.test(image.sourceUrl ?? "")),
    ),
  );
  assert.ok(cigarFlowPageSource.includes("cigarFlowAutomation.cadence"));
  assert.ok(!cigarFlowPageSource.includes("A later scheduled job can pull"));
});

test("may 31 cigar flow story uses real researched web images", () => {
  const story = cigarFlowNewsStories.find((candidate) => candidate.title.includes("May 31 Cigar Industry Highlights"));

  assert.ok(story, "May 31 story should be available");
  assert.equal(story.images?.length, 4);
  assert.ok(story.images?.every((image) => image.image.startsWith("/assets/news/researched/")));

  for (const image of story.images ?? []) {
    assert.ok(existsSync(new URL(`../public${image.image}`, import.meta.url)), `${image.image} should be stored as a local static asset`);
  }

  assert.deepEqual(
    story.images?.map((image) => image.sourceUrl),
    [
      "https://olivacigar.com/cigars/serie-v-maduro/",
      "https://www.perdomocigars.com/20th-anniversary",
      "https://foundationcigarcompany.com/the-wise-man-maduro/",
      "https://www.cigaraficionado.com/article/highlights-from-the-pca-trade-show",
    ],
  );
});

test("manufacturer watchlist exposes daily cigar press-release search sources", () => {
  assert.ok(cigarPressReleaseSearchSources.length >= 3);
  assert.ok(cigarPressReleaseSearchSources.every((source) => source.searchQuery.toLowerCase().includes("cigar")));
  assert.ok(cigarPressReleaseSearchSources.some((source) => source.url.includes("prnewswire.com")));
  assert.ok(cigarPressReleaseSearchSources.some((source) => source.url.includes("businesswire.com")));
  assert.ok(cigarPressReleaseSearchSources.some((source) => source.url.includes("globenewswire.com")));
  assert.ok(cigarFlowPageSource.includes("cigarPressReleaseSearchSources.map"));
  assert.ok(cigarFlowPageSource.includes("Daily cigar press-release search"));
});

test("daily cigar flow writer submits actual feed story images", () => {
  assert.ok(dailyCigarNewsRunSource.includes("cigarFlowItems"), "daily writer should read current Cigar Flow cards");
  assert.ok(dailyCigarNewsRunSource.includes("source-aligned"), "daily writer should document source-aligned image filtering");
  assert.ok(dailyCigarNewsRunSource.includes("imagePosition"), "story images should preserve crop positioning from feed cards");
  assert.ok(dailyCigarNewsRunSource.includes("sourceUrl"), "story images should link back to their source story");
  assert.ok(dailyCigarNewsRunSource.includes("Cigar Flow editorial format"), "daily writer should request the new editorial story format");
  assert.ok(dailyCigarNewsRunSource.includes("image web/source-page search"), "daily writer should request researched story images");
  assert.ok(dailyCigarNewsRunSource.includes("3-6 real source-aligned story images"), "daily writer should ask for enough images throughout the story");
  assert.equal(dailyCigarNewsRunSource.includes("images: storyImages"), false, "publish should not blindly reuse static card images");
  assert.ok(dailyCigarNewsRunSource.includes("selectSourceAlignedStoryImages"), "publish payload should use only source-aligned images");
});

test("home page promotes Cigar Flow with live feed context", () => {
  assert.ok(homePageSource.includes('data-home-cigar-flow="feature"'), "missing home Cigar Flow promo marker");
  assert.ok(homePageSource.includes("featuredCigarFlowItem.image"), "home promo should use the feed image binding");
  assert.ok(homePageSource.includes("homeCigarFlowItems.map"), "home promo should preview multiple flow cards");
  assert.ok(homePageSource.includes("cigarFlowStats.map"), "home promo should reuse Cigar Flow stats");
  assert.ok(homePageSource.includes('href="/cigar-flow"'), "home promo should link into Cigar Flow");
  assert.ok(homePageSource.includes('href="/humidor?section=tools&intent=cigar-flow"'), "home Cigar Flow smoke CTA should deep-link to the humidor note workflow");
  assert.ok(homePageSource.includes("Prepare Smoke Note"), "home Cigar Flow smoke CTA should describe the real workflow");
  assert.equal(homePageSource.includes("Share a Smoke"), false, "home page should not imply a direct public post flow");
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

test("cigar flow member post CTAs route to a real humidor smoke-note workflow", () => {
  assert.ok(
    cigarFlowPageSource.includes('href="/humidor?section=tools&intent=cigar-flow"'),
    "Cigar Flow share CTAs should deep-link to the humidor workflow instead of a generic account screen"
  );
  assert.ok(cigarFlowPageSource.includes("Prepare Smoke Note"), "the CTA should describe the real workflow");
  assert.ok(cigarFlowPageSource.includes("saved cigar notes"), "member-post copy should anchor the flow in saved humidor notes");
  assert.equal(cigarFlowPageSource.includes('href="/account"'), false, "Cigar Flow post CTAs should not dead-end on the account overview");
  assert.equal(cigarFlowPageSource.includes("Admin moderation can approve public cards"), false);
});

test("cigar flow reader traps focus and restores the opener", () => {
  assert.ok(cigarFlowExperienceSource.includes("useRef"), "reader should track dialog and opener focus");
  assert.ok(cigarFlowExperienceSource.includes("readerDialogRef"), "dialog element should be addressable for focus management");
  assert.ok(cigarFlowExperienceSource.includes("previouslyFocusedElementRef"), "reader should remember the opener before moving focus");
  assert.ok(cigarFlowExperienceSource.includes("getReaderFocusableElements"), "reader should compute tabbable controls inside the dialog");
  assert.ok(cigarFlowExperienceSource.includes('event.key === "Tab"'), "reader should handle Tab navigation");
  assert.ok(cigarFlowExperienceSource.includes("event.preventDefault()"), "focus wrapping should prevent escape from the dialog");
  assert.ok(cigarFlowExperienceSource.includes("previouslyFocusedElementRef.current?.focus()"), "closing the reader should restore focus to the opener");
  assert.ok(cigarFlowExperienceSource.includes("tabIndex={-1}"), "dialog should be programmatically focusable");
});

test("cigar flow reader controls wrap within narrow mobile viewports", () => {
  assert.ok(
    cigarFlowExperienceSource.includes("grid-cols-2") && cigarFlowExperienceSource.includes("sm:grid-cols-[auto_1fr_auto]"),
    "reader footer should switch from a compact two-column mobile layout to the desktop three-column controls",
  );
  assert.ok(
    cigarFlowExperienceSource.includes("order-1 col-span-2") && cigarFlowExperienceSource.includes("sm:col-span-1"),
    "source action should occupy a full mobile row before sharing the desktop footer row",
  );
  assert.ok(
    cigarFlowExperienceSource.includes("order-2") && cigarFlowExperienceSource.includes("order-3"),
    "previous and next controls should split the second mobile row",
  );
  assert.ok(
    cigarFlowExperienceSource.includes("min-w-0"),
    "reader shell and controls should allow shrinking instead of forcing horizontal overflow",
  );
});
