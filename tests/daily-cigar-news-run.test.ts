import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

type DraftCall = {
  angle?: string;
  sourceNotes?: string[];
  sourceUrls: string[];
  storyImages?: Array<{ sourceUrl?: string }>;
};

type PublishCall = {
  slug?: string;
  automationDate?: string;
  dedupeKey?: string;
  leadUrls?: string[];
  images?: Array<{ image?: string; imagePosition?: string; sourceUrl?: string }>;
  sourceNotes?: Array<{ label?: string; url?: string; note?: string }>;
};

test("daily cigar flow writer retries draft generation with another official source batch", async () => {
  const draftCalls: DraftCall[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
      draftCalls.push(payload);

      if (draftCalls.length === 1) {
        response.writeHead(502, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            error: "news_story_generation_failed",
            message: "YCCNewsAgent did not return a publication-ready story draft. Add concrete source details or try again before publishing.",
          }),
        );
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          draft: {
            title: "Official Cigar Source Update",
            dek: "A source-safe daily update for adult Yuzu readers.",
            category: "Industry News",
            bodyMarkdown: "## Release desk\nAn official brand source shared enough concrete detail for an operator-reviewed daily story.",
            sections: [
              {
                heading: "Release desk",
                body: "An official brand source shared enough concrete detail for an operator-reviewed daily story.",
              },
            ],
            sourceNotes: [
              {
                label: "Official source",
                url: payload.sourceUrls[0],
                note: "Accepted official source.",
              },
            ],
          },
          prompt: {
            acceptedSourceCount: payload.sourceUrls.length,
          },
        }),
      );
      return;
    }

    if (request.method === "POST" && request.url === "/news/stories") {
      response.writeHead(201, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          story: {
            title: "Official Cigar Source Update",
            slug: "official-cigar-source-update",
            status: "published",
          },
          persistence: {
            status: "stored",
            table: "news_stories",
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "true",
      YCC_DAILY_NEWSROOM_SOURCE_LIMIT: "3",
      YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "2",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(draftCalls.length, 2);
    assert.notDeepEqual(draftCalls[1].sourceUrls, draftCalls[0].sourceUrls);
    assert.match(result.stderr, /Retrying with the next official source batch/);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer does not attach unrelated static card images to new source batches", async () => {
  const draftCalls: DraftCall[] = [];
  const publishCalls: PublishCall[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
      draftCalls.push(payload);

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          draft: {
            title: "Fresh Brand Source Update",
            dek: "A source-safe daily update for adult Yuzu readers.",
            category: "Industry News",
            bodyMarkdown: "## Release desk\nAn official brand source shared enough concrete detail for an operator-reviewed daily story.",
            sections: [
              {
                heading: "Release desk",
                body: "An official brand source shared enough concrete detail for an operator-reviewed daily story.",
              },
            ],
            sourceNotes: [
              {
                label: "Official source",
                url: payload.sourceUrls[0],
                note: "Accepted official source.",
              },
            ],
          },
          prompt: {
            acceptedSourceCount: payload.sourceUrls.length,
          },
        }),
      );
      return;
    }

    if (request.method === "POST" && request.url === "/news/stories") {
      const payload = JSON.parse(await readRequestBody(request)) as PublishCall;
      publishCalls.push(payload);

      response.writeHead(201, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          story: {
            title: "Fresh Brand Source Update",
            slug: "fresh-brand-source-update",
            status: "published",
          },
          persistence: {
            status: "stored",
            table: "news_stories",
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "true",
      YCC_DAILY_NEWSROOM_SOURCE_LIMIT: "3",
      YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(draftCalls.length, 1);
    assert.equal(publishCalls.length, 1);
    assert.deepEqual(draftCalls[0].storyImages ?? [], [], "draft should not seed unrelated static Cigar Flow card images");
    assert.deepEqual(publishCalls[0].images ?? [], [], "publish should not attach stale static Cigar Flow card images");
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer includes press-release search sources in draft requests", async () => {
  const draftCalls: DraftCall[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
      draftCalls.push(payload);

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          draft: {
            title: "Daily Cigar Press Release Search",
            dek: "A source-safe daily update for adult Yuzu readers.",
            category: "Industry News",
            bodyMarkdown: "## Release desk\nA daily press-release search found a concrete cigar story lead for operator review.",
            sections: [
              {
                heading: "Release desk",
                body: "A daily press-release search found a concrete cigar story lead for operator review.",
              },
            ],
            sourceNotes: [
              {
                label: "Press release search",
                url: payload.sourceUrls[0],
                note: "Accepted daily search source.",
              },
            ],
          },
          prompt: {
            acceptedSourceCount: payload.sourceUrls.length,
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_SOURCE_LIMIT: "2",
      YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(draftCalls.length, 1);
    assert.ok(draftCalls[0].sourceUrls.some((sourceUrl) => sourceUrl.includes("prnewswire.com/news-releases/news-releases-list")));
    assert.ok(draftCalls[0].sourceUrls.some((sourceUrl) => sourceUrl.includes("businesswire.com/newsroom")));
    assert.ok(draftCalls[0].sourceUrls.some((sourceUrl) => sourceUrl.includes("globenewswire.com/en/search/tag/cigar")));
    assert.ok(draftCalls[0].sourceNotes?.some((note) => /daily cigar press-release search/i.test(note)));
    assert.ok(draftCalls[0].sourceNotes?.some((note) => /write stories/i.test(note)));
    assert.ok(draftCalls[0].sourceNotes?.some((note) => /Cigar Flow editorial format/i.test(note)));
    assert.ok(draftCalls[0].sourceNotes?.some((note) => /image web\/source-page search/i.test(note)));
    assert.ok(draftCalls[0].sourceNotes?.some((note) => /3-6 real source-aligned story images/i.test(note)));
    assert.match(draftCalls[0].angle ?? "", /press releases/i);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer pulls fresh RSS leads and prioritizes matching official sources", async () => {
  const draftCalls: DraftCall[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/rss.xml") {
      response.writeHead(200, { "content-type": "application/rss+xml" });
      response.end(`
        <rss version="2.0">
          <channel>
            <title>Test cigar feed</title>
            <item>
              <title>Rocky Patel announces a fresh Cigar Flow signal</title>
              <link>https://halfwheel.example/rocky-patel-fresh-signal</link>
              <pubDate>Thu, 25 Jun 2026 15:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `);
      return;
    }

    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
      draftCalls.push(payload);

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          draft: {
            title: "Fresh Rocky Patel Cigar Flow Update",
            dek: "A source-safe daily update for adult Yuzu readers.",
            category: "Industry News",
            bodyMarkdown: "## Release desk\nAn RSS lead moved the matching official source to the front of the daily review queue.",
            sections: [
              {
                heading: "Release desk",
                body: "An RSS lead moved the matching official source to the front of the daily review queue.",
              },
            ],
            sourceNotes: [
              {
                label: "Rocky Patel",
                url: payload.sourceUrls[0],
                note: "Accepted official source.",
              },
            ],
          },
          prompt: {
            acceptedSourceCount: payload.sourceUrls.length,
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_SOURCE_LIMIT: "1",
      YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
      YCC_DAILY_NEWSROOM_RSS_FEEDS: `http://127.0.0.1:${address.port}/rss.xml`,
      YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "2",
      YCC_DAILY_NEWSROOM_NOW: "2026-06-25T18:00:00.000Z",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(draftCalls.length, 1);
    assert.equal(draftCalls[0].sourceUrls[0], "https://www.rockypatel.com/cigar-news/");
    assert.ok(draftCalls[0].sourceNotes?.some((note) => /Current RSS lead from 127\.0\.0\.1/i.test(note)));
    assert.ok(draftCalls[0].sourceNotes?.some((note) => /Rocky Patel announces a fresh Cigar Flow signal/i.test(note)));
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer keeps the newest fresh canonical RSS alias and rejects stale, future, and undated leads", async () => {
  const draftCalls: DraftCall[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/rss.xml") {
      response.writeHead(200, { "content-type": "application/rss+xml" });
      response.end(`
        <rss version="2.0">
          <channel>
            <title>Canonical cigar feed</title>
            <item>
              <title>Stale alias must not suppress its fresh canonical match</title>
              <link>http://www.example.test/releases/rocky/?utm_source=old&amp;b=2&amp;a=1#fragment</link>
              <pubDate>Wed, 24 Jun 2026 12:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Fresh Rocky Patel canonical lead</title>
              <link>https://example.test/releases/rocky?b=2&amp;a=1</link>
              <pubDate>Thu, 25 Jun 2026 17:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Too old to be today</title>
              <link>https://example.test/releases/old</link>
              <pubDate>Sun, 21 Jun 2026 17:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Too far in the future</title>
              <link>https://example.test/releases/future</link>
              <pubDate>Fri, 26 Jun 2026 03:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Undated lead</title>
              <link>https://example.test/releases/undated</link>
            </item>
          </channel>
        </rss>
      `);
      return;
    }

    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
      draftCalls.push(payload);
      respondWithDraft(response, payload, "Fresh Rocky Patel Canonical Update");
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_RSS_FEEDS: `http://127.0.0.1:${address.port}/rss.xml`,
      YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "8",
      YCC_DAILY_NEWSROOM_RSS_MAX_AGE_HOURS: "24",
      YCC_DAILY_NEWSROOM_RSS_MAX_FUTURE_SKEW_HOURS: "2",
      YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS: "true",
      YCC_DAILY_NEWSROOM_NOW: "2026-06-25T18:00:00.000Z",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(draftCalls.length, 1);
    const leadNotes = (draftCalls[0].sourceNotes ?? []).filter((note) => /Current RSS lead/i.test(note));
    assert.equal(leadNotes.length, 1);
    assert.match(leadNotes[0], /Fresh Rocky Patel canonical lead/);
    assert.match(leadNotes[0], /https:\/\/example\.test\/releases\/rocky\?a=1&b=2/);
    assert.doesNotMatch(leadNotes[0], /Stale alias|Too old|Too far|Undated/i);
    assert.match(result.stdout, /Fresh RSS leads pulled: 1/);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer rejects a successful HTML response masquerading as an RSS feed", async () => {
  let draftCallCount = 0;
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/rss.xml") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<html><body><item><title>Not actually RSS</title></item></body></html>");
      return;
    }

    if (request.method === "POST" && request.url === "/news/story-drafts") {
      draftCallCount += 1;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_RSS_FEEDS: `http://127.0.0.1:${address.port}/rss.xml`,
      YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "8",
      YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS: "true",
      YCC_DAILY_NEWSROOM_NOW: "2026-06-25T18:00:00.000Z",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(draftCallCount, 0);
    assert.match(result.stderr, /response is not an RSS or Atom feed/i);
    assert.match(result.stdout, /No action: no fresh, unprocessed RSS leads/i);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer suppresses a canonically equivalent lead already published in a prior run", async () => {
  let draftCallCount = 0;
  let storyListCallCount = 0;
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/news/stories?limit=50") {
      storyListCallCount += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          stories: [
            {
              slug: "daily-cigar-flow-2026-06-24",
              leadUrls: ["http://www.example.test/releases/rocky/?utm_source=prior#story"],
            },
          ],
        }),
      );
      return;
    }

    if (request.method === "GET" && request.url === "/rss.xml") {
      response.writeHead(200, { "content-type": "application/rss+xml" });
      response.end(`
        <rss version="2.0">
          <channel>
            <item>
              <title>Previously published Rocky Patel lead</title>
              <link>https://example.test/releases/rocky</link>
              <pubDate>Thu, 25 Jun 2026 17:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
      `);
      return;
    }

    if (request.method === "POST" && request.url === "/news/story-drafts") {
      draftCallCount += 1;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_DEDUPE_PREFLIGHT: "true",
      YCC_DAILY_NEWSROOM_RSS_FEEDS: `http://127.0.0.1:${address.port}/rss.xml`,
      YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "8",
      YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS: "true",
      YCC_DAILY_NEWSROOM_NOW: "2026-06-25T18:00:00.000Z",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(storyListCallCount, 1);
    assert.equal(draftCallCount, 0);
    assert.match(result.stdout, /No action: no fresh, unprocessed RSS leads/i);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer refuses to invent primary source notes when the draft omits them", async () => {
  const draftCalls: DraftCall[] = [];
  const publishCalls: PublishCall[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
      draftCalls.push(payload);

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          draft: {
            title: "Cigar Flow Update: Primary Source Carryover",
            dek: "A source-safe daily update for adult Yuzu readers.",
            category: "Cigar Flow Update",
            bodyMarkdown: "## Release desk\nAn official source batch produced a publication-ready daily story.",
            sections: [
              {
                heading: "Release desk",
                body: "An official source batch produced a publication-ready daily story.",
              },
            ],
          },
          prompt: {
            acceptedSourceCount: payload.sourceUrls.length,
          },
        }),
      );
      return;
    }

    if (request.method === "POST" && request.url === "/news/stories") {
      const payload = JSON.parse(await readRequestBody(request)) as PublishCall;
      publishCalls.push(payload);

      if (!payload.sourceNotes?.some((note) => draftCalls[0]?.sourceUrls.includes(note.url ?? ""))) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            error: "official_source_required",
            message: "At least one primary source note is required before publishing.",
          }),
        );
        return;
      }

      response.writeHead(201, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          story: {
            title: "Cigar Flow Update: Primary Source Carryover",
            slug: "cigar-flow-update-primary-source-carryover",
            status: "published",
          },
          persistence: {
            status: "stored",
            table: "news_stories",
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "true",
      YCC_DAILY_NEWSROOM_SOURCE_LIMIT: "3",
      YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
    });

    assert.equal(result.code, 1, result.stderr || result.stdout);
    assert.equal(draftCalls.length, 1);
    assert.equal(publishCalls.length, 0);
    assert.match(result.stderr, /requires at least one draft-returned, specific official source note/i);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer uses a deterministic Phoenix-date slug and verifies it first in the live runtime feed", async () => {
  let publishedSlug = "";
  const publishCalls: PublishCall[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          draft: {
            title: "Fresh Cigar Flow Runtime Guard",
            dek: "A source-safe daily update for adult Yuzu readers.",
            category: "Cigar Flow Update",
            bodyMarkdown: "## Release desk\nA fresh story should become the top live Cigar Flow record after publishing.",
            sections: [
              {
                heading: "Release desk",
                body: "A fresh story should become the top live Cigar Flow record after publishing.",
              },
            ],
            sourceNotes: [
              {
                label: "Official source",
                url: payload.sourceUrls[0],
                note: "Accepted official source.",
              },
            ],
          },
          prompt: {
            acceptedSourceCount: payload.sourceUrls.length,
          },
        }),
      );
      return;
    }

    if (request.method === "POST" && request.url === "/news/stories") {
      const payload = JSON.parse(await readRequestBody(request)) as PublishCall;
      publishCalls.push(payload);
      publishedSlug = payload.slug || "";

      response.writeHead(201, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          story: {
            title: "Fresh Cigar Flow Runtime Guard",
            slug: publishedSlug,
            status: "published",
          },
          persistence: {
            status: "stored",
            table: "news_stories",
          },
        }),
      );
      return;
    }

    if (request.method === "GET" && request.url === "/news/stories?limit=3") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          stories: [
            {
              slug: publishedSlug,
              title: "Fresh Cigar Flow Runtime Guard",
              publishedAt: new Date().toISOString(),
            },
          ],
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "true",
      YCC_DAILY_NEWSROOM_SOURCE_LIMIT: "3",
      YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
      YCC_DAILY_NEWSROOM_VERIFY_PUBLISHED: "true",
      YCC_DAILY_NEWSROOM_NOW: "2026-06-25T18:00:00.000Z",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Runtime freshness verified:/);
    assert.equal(publishedSlug, "daily-cigar-flow-2026-06-25", "generated title wording must not change the daily identity");
    assert.equal(publishCalls.length, 1);
    assert.equal(publishCalls[0].automationDate, "2026-06-25");
    assert.equal(publishCalls[0].dedupeKey, "daily-cigar-flow:2026-06-25");
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer fails when the live runtime feed remains stale after publish", async () => {
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          draft: {
            title: "Fresh Cigar Flow Stale Runtime Guard",
            dek: "A source-safe daily update for adult Yuzu readers.",
            category: "Cigar Flow Update",
            bodyMarkdown: "## Release desk\nThe runtime checker should fail if this story is not visible first.",
            sections: [
              {
                heading: "Release desk",
                body: "The runtime checker should fail if this story is not visible first.",
              },
            ],
            sourceNotes: [
              {
                label: "Official source",
                url: payload.sourceUrls[0],
                note: "Accepted official source.",
              },
            ],
          },
          prompt: {
            acceptedSourceCount: payload.sourceUrls.length,
          },
        }),
      );
      return;
    }

    if (request.method === "POST" && request.url === "/news/stories") {
      const payload = JSON.parse(await readRequestBody(request)) as PublishCall;

      response.writeHead(201, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          story: {
            title: "Fresh Cigar Flow Stale Runtime Guard",
            slug: payload.slug,
            status: "published",
          },
          persistence: {
            status: "stored",
            table: "news_stories",
          },
        }),
      );
      return;
    }

    if (request.method === "GET" && request.url === "/news/stories?limit=3") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          stories: [
            {
              slug: "daily-cigar-flow-2026-06-18-stale-story",
              title: "Stale Cigar Flow Story",
              publishedAt: "2026-06-18T16:10:23.440Z",
            },
          ],
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "true",
      YCC_DAILY_NEWSROOM_SOURCE_LIMIT: "3",
      YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
      YCC_DAILY_NEWSROOM_VERIFY_PUBLISHED: "true",
    });

    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Runtime freshness check failed: live feed top story is "daily-cigar-flow-2026-06-18-stale-story"/);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer publishes only renderable draft story images", async () => {
  const draftCalls: DraftCall[] = [];
  const publishCalls: PublishCall[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/news/story-drafts") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
      draftCalls.push(payload);
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const serverUrl = `http://127.0.0.1:${address.port}`;

      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          draft: {
            title: "Renderable Cigar Flow Image Update",
            dek: "A source-safe daily update for adult Yuzu readers.",
            category: "Cigar Flow Update",
            bodyMarkdown: "## Release desk\nAn official source batch produced a publication-ready daily story.",
            sections: [
              {
                heading: "Release desk",
                body: "An official source batch produced a publication-ready daily story.",
              },
            ],
            images: [
              {
                label: "Blocked dead Oliva image",
                image: "https://olivacigar.com/wp-content/uploads/2024/06/Oliva-Serie-V-Maduro.jpg",
                imagePosition: "hero",
                sourceUrl: payload.sourceUrls[0],
              },
              {
                label: "Missing local image",
                image: `${serverUrl}/images/missing.jpg`,
                imagePosition: "inline",
                sourceUrl: payload.sourceUrls[0],
              },
              {
                label: "Renderable local image",
                image: `${serverUrl}/images/renderable.jpg`,
                imagePosition: "inline",
                sourceUrl: payload.sourceUrls[0],
              },
            ],
            sourceNotes: [
              {
                label: "Official source",
                url: payload.sourceUrls[0],
                note: "Accepted official source.",
              },
            ],
          },
          prompt: {
            acceptedSourceCount: payload.sourceUrls.length,
          },
        }),
      );
      return;
    }

    if ((request.method === "HEAD" || request.method === "GET") && request.url === "/images/renderable.jpg") {
      response.writeHead(request.method === "GET" && request.headers.range ? 206 : 200, {
        "content-type": "image/jpeg",
        "content-length": "4",
      });
      if (request.method !== "HEAD") {
        response.end(Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      } else {
        response.end();
      }
      return;
    }

    if ((request.method === "HEAD" || request.method === "GET") && request.url === "/images/missing.jpg") {
      response.writeHead(404, { "content-type": "text/html" });
      response.end("missing");
      return;
    }

    if (request.method === "POST" && request.url === "/news/stories") {
      const payload = JSON.parse(await readRequestBody(request)) as PublishCall;
      publishCalls.push(payload);

      response.writeHead(201, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          story: {
            title: "Renderable Cigar Flow Image Update",
            slug: "renderable-cigar-flow-image-update",
            status: "published",
          },
          persistence: {
            status: "stored",
            table: "news_stories",
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not_found" }));
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");

    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "true",
      YCC_DAILY_NEWSROOM_SOURCE_LIMIT: "3",
      YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
    });

    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.equal(draftCalls.length, 1);
    assert.equal(publishCalls.length, 1);
    assert.deepEqual(
      publishCalls[0].images?.map((image) => ({
        image: image.image,
        imagePosition: image.imagePosition,
      })),
      [
        {
          image: `http://127.0.0.1:${address.port}/images/renderable.jpg`,
          imagePosition: "50% 50%",
        },
      ],
    );
    assert.match(result.stderr, /Skipping Cigar Flow story image "Blocked dead Oliva image"/);
    assert.match(result.stderr, /Skipping Cigar Flow story image "Missing local image"/);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

function respondWithDraft(response: ServerResponse, payload: DraftCall, title: string) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      draft: {
        title,
        dek: "A source-safe daily update for adult Yuzu readers.",
        category: "Industry News",
        bodyMarkdown: "## Release desk\nA fresh canonical lead produced a publication-ready operator draft.",
        sections: [
          {
            heading: "Release desk",
            body: "A fresh canonical lead produced a publication-ready operator draft.",
          },
        ],
        sourceNotes: [
          {
            label: "Official source",
            url: payload.sourceUrls[0],
            note: "Accepted official source.",
          },
        ],
      },
      prompt: {
        acceptedSourceCount: payload.sourceUrls.length,
      },
    }),
  );
}

function runDailyWriter(env: Record<string, string>) {
  const scriptPath = path.resolve("scripts/daily-cigar-news-run.ts");
  const child = spawn(process.execPath, ["--import", "tsx", scriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      YCC_NEWSROOM_COGNITO_USERNAME: "",
      YCC_NEWSROOM_COGNITO_PASSWORD: "",
      YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "0",
      YCC_DAILY_NEWSROOM_VERIFY_PUBLISHED: "false",
      YCC_DAILY_NEWSROOM_DEDUPE_PREFLIGHT: "false",
      YCC_DAILY_NEWSROOM_FETCH_SOURCE_EVIDENCE: "false",
      YCC_DAILY_NEWSROOM_REQUIRE_SOURCE_EVIDENCE: "false",
      YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS: "false",
      YCC_DAILY_NEWSROOM_OPERATOR_APPROVED: "true",
      YCC_DAILY_NEWSROOM_MIN_PUBLISH_IMAGES: "0",
      YCC_DAILY_NEWSROOM_DRAFT_OUTPUT_PATH: path.join(tmpdir(), `ycc-cigar-flow-draft-${randomUUID()}.json`),
      ...env,
    },
    stdio: "pipe",
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += String(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += String(chunk);
  });

  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`daily writer timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 15000);

    child.on("error", (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
