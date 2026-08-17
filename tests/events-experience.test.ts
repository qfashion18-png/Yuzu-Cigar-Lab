import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import EventsPage from "../src/app/events/page";
import { searchCuratedArea } from "../src/lib/curated-event-search";
import { curatedCigarMarkets, events } from "../src/lib/data";
import { getAutoUpdatedEvents, getFeaturedEvent } from "../src/lib/event-schedule";
import {
  archiveAdminEvent,
  createAdminEvent,
  fetchAdminEvents,
  fetchPublishedEvents,
  livePublishedEventToExperience,
  publishAdminEvent,
  updateAdminEvent,
  type LivePublishedEvent,
} from "../src/lib/live-api";

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
    ["opus-x-allocation-night", "fox-cigar-bar-second-saturday", "smoke-n-the-desert-phx-cigar-week-2026"]
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

test("Facebook-sourced primary events use local copies of their event artwork", () => {
  const facebookEvents = [
    ["fox-cigar-bar-second-saturday", "/assets/events/fox-cigar-bar-second-saturday.jpg"],
    ["smoke-n-the-desert-phx-cigar-week-2026", "/assets/events/smoke-n-the-desert-phx-cigar-week-2026.jpg"],
  ] as const;

  for (const [slug, image] of facebookEvents) {
    const event = events.find((item) => item.slug === slug);

    assert.ok(event, `missing primary Facebook event ${slug}`);
    assert.equal(event.image, image);
    assert.ok(existsSync(new URL(`../public${image}`, import.meta.url)), `missing local event artwork for ${slug}`);
  }
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
    ["Downtown Chandler Patio Signal", "Smoke 'N The Desert: PHX Cigar Week 2026"]
  );
  assert.deepEqual(
    zipResults.lounges.map((lounge) => lounge.name),
    ["Puro Cigar Bar"]
  );

  const cigarWeekResults = searchCuratedArea(phoenixMarket, "phoenix cigar week");

  assert.deepEqual(
    cigarWeekResults.events.map((event) => event.title),
    ["Smoke 'N The Desert: PHX Cigar Week 2026"]
  );

  const secondSaturdayResults = searchCuratedArea(phoenixMarket, "Gilbert second saturday");

  assert.deepEqual(
    secondSaturdayResults.events.map((event) => event.title),
    ["Fox Cigar Bar Second Saturday"]
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

  const externalEventHtml = renderToStaticMarkup(
    await eventDetailModule.default({
      params: Promise.resolve({ slug: "fox-cigar-bar-second-saturday" }),
    })
  );

  assert.ok(externalEventHtml.includes("Fox Cigar Bar Second Saturday"));
  assert.ok(externalEventHtml.includes("View Source Event"));
  assert.ok(externalEventHtml.includes("https://www.facebook.com/events/2502127350222287/"));
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

test("home and events surfaces hydrate from the same shared event API with fallback states", () => {
  const gridSource = readFileSync(new URL("../src/components/auto-updating-event-grid.tsx", import.meta.url), "utf8");
  const homeSource = readFileSync(new URL("../src/components/home-event-feature.tsx", import.meta.url), "utf8");

  for (const source of [gridSource, homeSource]) {
    assert.match(source, /fetchPublishedEvents/);
    assert.match(source, /livePublishedEventToExperience/);
    assert.match(source, /fallback/);
    assert.doesNotMatch(source, /getLiveApiErrorMessage/);
    assert.doesNotMatch(source, /live Yuzu API could not be reached/i);
  }

  assert.match(gridSource, /data-event-feed-status/);
  assert.match(homeSource, /data-home-event-feed-status/);
  assert.match(gridSource, /target="_blank"/);
  assert.match(gridSource, /if \(response\.events\.length\)/);
  assert.match(homeSource, /if \(response\.events\.length\)/);
  assert.match(gridSource, /Showing the latest verified event listings while the shared calendar refreshes\./);
});

test("live events API client uses the public feed and authenticated admin contracts", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const event = createLiveEventFixture();

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://events-api.example.test/";
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.includes("/events?") && !url.includes("/admin/")) {
      return Response.json({
        events: [event],
        feed: {
          from: "2026-09-01T00:00:00.000Z",
          to: "2027-09-01T00:00:00.000Z",
          count: 1,
          updatedAt: "2026-09-01T00:05:00.000Z",
          lastSuccessfulSyncAt: "2026-09-01T00:04:00.000Z",
        },
        persistence: "stored",
      });
    }

    if (url.includes("/admin/events?") && init?.method === "GET") {
      return Response.json({ events: [event], persistence: "stored" });
    }

    return Response.json({ event, persistence: { status: "stored", table: "events" } });
  }) as typeof fetch;

  try {
    const headers = { Authorization: "Bearer admin-token" };
    const publicResponse = await fetchPublishedEvents({
      from: "2026-09-01T00:00:00.000Z",
      to: "2027-09-01T00:00:00.000Z",
      limit: 999,
    });
    const adminResponse = await fetchAdminEvents(headers, { status: "published", limit: 100 });
    await createAdminEvent({ title: event.title, startsAt: event.startsAt, endsAt: event.endsAt }, headers);
    await updateAdminEvent(event.id, { title: "Updated tasting" }, headers);
    await publishAdminEvent(event.id, headers);
    await archiveAdminEvent(event.id, headers);

    assert.equal(publicResponse.events[0].id, event.id);
    assert.equal(adminResponse.events[0].status, "published");
    assert.match(calls[0].url, /^https:\/\/events-api\.example\.test\/events\?/);
    assert.ok(calls[0].url.includes("limit=250"), "public limit should be capped at the backend maximum");
    assert.ok(calls.some((call) => call.url.endsWith(`/admin/events/${event.id}/publish`) && call.init?.method === "POST"));
    assert.ok(calls.some((call) => call.url.endsWith(`/admin/events/${event.id}/archive`) && call.init?.method === "POST"));
    assert.ok(calls.filter((call) => call.url.includes("/admin/")).every((call) => new Headers(call.init?.headers).get("Authorization") === "Bearer admin-token"));

    const experience = livePublishedEventToExperience(event);
    assert.equal(experience.location, "Puro Cigar Bar, 111 W Boston St, Chandler AZ 85225");
    assert.equal(experience.sourceUrl, "https://facebook.example.test/events/123");
    assert.equal(experience.externalSource, true);
    assert.equal(experience.imported, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = originalBaseUrl;
    }
  }
});

function createLiveEventFixture(): LivePublishedEvent {
  return {
    id: "event-123",
    slug: "shared-calendar-tasting",
    title: "Shared Calendar Tasting",
    summary: "A live event from the shared calendar.",
    description: "Current details supplied by the durable event service.",
    host: "Yuzu Cigar Club",
    status: "published",
    visibility: "public",
    verificationStatus: "verified",
    startsAt: "2026-10-10T02:00:00.000Z",
    endsAt: "2026-10-10T05:00:00.000Z",
    timezone: "America/Phoenix",
    allDay: false,
    startDate: null,
    endDate: null,
    location: {
      name: "Puro Cigar Bar",
      addressLine1: "111 W Boston St",
      addressLine2: null,
      city: "Chandler",
      state: "AZ",
      postalCode: "85225",
      country: "US",
      latitude: 33.301,
      longitude: -111.842,
    },
    source: {
      type: "operator_import",
      provider: "facebook",
      sourceId: null,
      providerEventId: "123",
      providerOccurrenceId: null,
      url: "https://facebook.example.test/events/123",
    },
    ticketUrl: null,
    imageUrl: "/assets/about-lounge.png",
    accessLevel: "Open",
    capacity: "Open lounge",
    includes: ["Tasting"],
    agenda: [{ time: "7:00 PM", label: "Doors" }],
    goodFor: ["Adult cigar guests"],
    publishedAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:05:00.000Z",
  };
}
