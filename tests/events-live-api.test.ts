import assert from "node:assert/strict";
import test from "node:test";

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
    assert.ok(
      calls
        .filter((call) => call.url.includes("/admin/"))
        .every((call) => new Headers(call.init?.headers).get("Authorization") === "Bearer admin-token"),
    );

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
