import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import EventsPage from "../src/app/events/page";
import { searchCuratedArea } from "../src/lib/curated-event-search";
import { curatedCigarMarkets, events } from "../src/lib/data";
import { getAutoUpdatedEvents, getFeaturedEvent } from "../src/lib/event-schedule";

test("events detail routes are generated for every configured event", async () => {
  const html = renderToStaticMarkup(createElement(EventsPage));
  const eventDetailModule = await import("../src/app/events/[slug]/page");

  assert.ok(html.includes("AutoUpdatingEventGrid") || html.includes('data-events-section="yuzu"'), "events page must keep the Yuzu events surface");
  assert.deepEqual(
    eventDetailModule.generateStaticParams(),
    events.map((event) => ({ slug: event.slug }))
  );
  for (const event of events) {
    const detailHtml = renderToStaticMarkup(
      await eventDetailModule.default({
        params: Promise.resolve({ slug: event.slug }),
      })
    );

    assert.ok(detailHtml.includes(event.title), `missing static detail screen for ${event.title}`);
  }
});

test("event schedule automatically drops past events and promotes events going on now", () => {
  const may22EventTime = new Date("2026-05-22T19:30:00-07:00");
  const currentEvents = getAutoUpdatedEvents(events, may22EventTime);

  assert.equal(currentEvents[0]?.slug, "founder-reserve-tasting");
  assert.equal(getFeaturedEvent(events, may22EventTime)?.slug, "founder-reserve-tasting");
  assert.equal(currentEvents.some((event) => event.slug === "aire-by-puro-open-event"), false);

  const afterAgingWorkshop = new Date("2026-06-07T12:00:00-07:00");
  const laterEvents = getAutoUpdatedEvents(events, afterAgingWorkshop);

  assert.deepEqual(
    laterEvents.map((event) => event.slug),
    ["opus-x-allocation-night"]
  );
});

test("events page separates Yuzu events from location-based curated picks", () => {
  const html = renderToStaticMarkup(createElement(EventsPage));

  assert.ok(html.includes('data-events-section="yuzu"'), "missing Yuzu Events section marker");
  assert.ok(html.includes("Yuzu Events"), "missing Yuzu Events heading");
  assert.ok(html.includes('data-events-section="curated"'), "missing Curated Events section marker");
  assert.ok(html.includes("Curated Events"), "missing Curated Events heading");
  assert.ok(html.includes("Use My Location"), "missing location-aware action");
  assert.ok(html.includes("Search Your Area"), "missing area search label");
  assert.ok(html.includes("City, ZIP, lounge, or neighborhood"), "missing detailed area search placeholder");
  assert.ok(html.includes("Best Cigar Lounges Near You"), "missing curated lounge heading");
});

test("curated events search narrows event and lounge picks by local area detail", () => {
  const phoenixMarket = curatedCigarMarkets.find((market) => market.id === "phoenix-metro");

  assert.ok(phoenixMarket, "missing Phoenix curated market");

  const results = searchCuratedArea(phoenixMarket, "Chandler patio");

  assert.deepEqual(
    results.events.map((event) => event.title),
    ["Downtown Chandler Patio Signal"]
  );
  assert.deepEqual(
    results.lounges.map((lounge) => lounge.name),
    ["Puro Cigar Bar"]
  );
  assert.ok(results.matchedAreas.includes("Chandler"), "missing matched area label");
  assert.equal(results.totalMatches, 2);

  const zipResults = searchCuratedArea(phoenixMarket, "85225");

  assert.deepEqual(
    zipResults.events.map((event) => event.title),
    ["Downtown Chandler Patio Signal"]
  );
  assert.deepEqual(
    zipResults.lounges.map((lounge) => lounge.name),
    ["Puro Cigar Bar"]
  );
});

test("event detail route renders the selected event as a full detail screen", async () => {
  const routePath = new URL("../src/app/events/[slug]/page.tsx", import.meta.url);

  assert.ok(existsSync(routePath), "missing static event detail route");

  const eventDetailModule = await import("../src/app/events/[slug]/page");
  const html = renderToStaticMarkup(
    await eventDetailModule.default({
      params: Promise.resolve({ slug: "founder-reserve-tasting" }),
    })
  );

  assert.ok(html.includes("Founder Reserve Tasting"));
  assert.ok(html.includes("Reserve Seat"));
  assert.ok(html.includes("What to expect"));
  assert.ok(html.includes("Back to events"));
});

test("home page includes an image-led upcoming events promo", () => {
  const source = [
    readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFileSync(new URL("../src/components/home-event-feature.tsx", import.meta.url), "utf8"),
  ].join("\n");

  assert.ok(source.includes('data-home-events="featured"'), "missing home events promo marker");
  assert.ok(source.includes("HomeEventFeature"), "home page must use the auto-updating event feature");
  assert.equal(source.includes("const featuredEvent = events[0]"), false, "home page must not pin the oldest hard-coded event");
  assert.ok(source.includes("Upcoming Events"));
  assert.ok(source.includes('href="/events"'));
});
