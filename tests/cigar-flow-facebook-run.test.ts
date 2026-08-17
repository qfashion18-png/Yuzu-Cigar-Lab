import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";

import {
  buildFacebookCaption,
  extractImageCandidatesFromHtml,
  findRelatedImagesForStory,
  publishFacebookPageAlbum,
  runCigarFlowFacebookSocial,
} from "../scripts/cigar-flow-facebook-run";

test("cigar flow Facebook runner finds a related source-page image and creates a group kit", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "ycc-cigar-flow-facebook-"));
  const imageBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(15_000, 1)]);
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/news/stories?limit=12") {
      return sendJson(response, {
        stories: [
          {
            id: "story-june-10",
            slug: "latest-cigar-industry-updates-june-10-edition",
            title: "Latest Cigar Industry Updates: June 10 Edition",
            dek: "A source-backed update for adult cigar readers.",
            category: "Cigar Industry News",
            bodyMarkdown: "## Test Brand\nA source-backed note for adult readers.",
            images: [],
            sourceNotes: [
              {
                label: "Test Brand",
                url: serverUrl(server, "/brand"),
                sourceType: "official",
              },
            ],
            officialSources: [serverUrl(server, "/brand")],
            status: "published",
            publishedAt: "2026-06-10T16:17:21.403Z",
          },
        ],
      });
    }

    if (request.method === "GET" && request.url === "/brand") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`
        <html>
          <head><meta property="og:image" content="${serverUrl(server, "/images/test-brand-cigar.jpg")}"></head>
          <body><img src="${serverUrl(server, "/images/test-brand-cigar.jpg")}" width="900" height="1200" alt="Test Brand cigar"></body>
        </html>
      `);
      return;
    }

    if (request.method === "GET" && request.url === "/images/test-brand-cigar.jpg") {
      response.writeHead(200, { "content-type": "image/jpeg" });
      response.end(imageBytes);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const result = await runCigarFlowFacebookSocial({
      apiBaseUrl: serverUrl(server, ""),
      targetDate: "2026-06-10",
      outputDir: outputRoot,
      publishPage: false,
      dryRun: true,
      imageLimit: 1,
    });

    assert.equal(result.story.slug, "latest-cigar-industry-updates-june-10-edition");
    assert.equal(result.selectedImages.length, 1);
    assert.equal(result.selectedImages[0].status, "downloaded");
    assert.match(await readFile(result.captionPath, "utf8"), /Adults 21\+ only/);
    assert.match(await readFile(result.groupKitPath, "utf8"), /Group API publishing is intentionally not attempted/);
    assert.equal(result.pagePost?.status, "dry_run");
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("cigar flow Facebook runner defaults to today's story instead of reposting stale latest", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "ycc-cigar-flow-facebook-today-"));
  const today = phoenixDate();
  const imageBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(15_000, 7)]);
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/news/stories?limit=12") {
      return sendJson(response, {
        stories: [
          {
            id: "story-old",
            slug: "daily-cigar-flow-2026-06-10-old-update",
            title: "Old Cigar Flow Update",
            dek: "An older source-backed update.",
            category: "Cigar Industry News",
            bodyMarkdown: "## Old Brand\nAn older source-backed note.",
            images: [],
            sourceNotes: [{ label: "Old Brand", url: serverUrl(server, "/old-brand"), sourceType: "official" }],
            officialSources: [serverUrl(server, "/old-brand")],
            status: "published",
            publishedAt: "2026-06-10T16:17:21.403Z",
          },
          {
            id: "story-today",
            slug: `daily-cigar-flow-${today}-fresh-update`,
            title: "Fresh Cigar Flow Update",
            dek: "Today's source-backed update for adult cigar readers.",
            category: "Cigar Industry News",
            bodyMarkdown: "## Fresh Brand\nA fresh source-backed note for adult readers.",
            images: [],
            sourceNotes: [{ label: "Fresh Brand", url: serverUrl(server, "/fresh-brand"), sourceType: "official" }],
            officialSources: [serverUrl(server, "/fresh-brand")],
            status: "published",
            publishedAt: `${today}T16:17:21.403Z`,
          },
        ],
      });
    }

    if (request.method === "GET" && request.url === "/fresh-brand") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<html><head><meta property="og:image" content="${serverUrl(server, "/images/fresh-brand-cigar.jpg")}"></head></html>`);
      return;
    }

    if (request.method === "GET" && request.url === "/images/fresh-brand-cigar.jpg") {
      response.writeHead(200, { "content-type": "image/jpeg" });
      response.end(imageBytes);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const result = await runCigarFlowFacebookSocial({
      apiBaseUrl: serverUrl(server, ""),
      outputDir: outputRoot,
      publishPage: false,
      dryRun: true,
      imageLimit: 1,
    });

    assert.equal(result.story.slug, `daily-cigar-flow-${today}-fresh-update`);
    assert.match(result.outputDir, new RegExp(`cigar-flow-facebook-${today}`));
    assert.equal(result.pagePost?.status, "dry_run");
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("cigar flow Facebook runner never selects a wrong-year story from a misleading dated slug", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "ycc-cigar-flow-wrong-year-"));
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/news/stories?limit=12") {
      return sendJson(response, {
        stories: [
          {
            id: "story-wrong-year",
            slug: "daily-cigar-flow-2026-06-10-republished-old-story",
            title: "Cigar Industry Update: June 10, 2025",
            dek: "An older story whose slug must not override its publication timestamp.",
            category: "Cigar Industry News",
            bodyMarkdown: "## Old update\nThis record was published in the prior year.",
            images: [],
            sourceNotes: [],
            officialSources: [],
            status: "published",
            publishedAt: "2025-06-10T16:17:21.403Z",
          },
        ],
      });
    }

    response.writeHead(404);
    response.end();
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    await assert.rejects(
      runCigarFlowFacebookSocial({
        apiBaseUrl: serverUrl(server, ""),
        targetDate: "2026-06-10",
        outputDir: outputRoot,
        publishPage: false,
        dryRun: true,
      }),
      /No published story matched date 2026-06-10/,
    );
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("fresh Cigar Flow image search does not use cached research images by default", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "ycc-cigar-flow-fresh-images-"));
  const imageBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(15_000, 3)]);
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/oliva-signal") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`
        <html>
          <head><meta property="og:image" content="${serverUrl(server, "/images/fresh-oliva-signal.jpg")}"></head>
          <body><img src="${serverUrl(server, "/images/fresh-oliva-signal.jpg")}" width="900" height="1200" alt="Fresh Oliva signal"></body>
        </html>
      `);
      return;
    }

    if (request.method === "GET" && request.url === "/images/fresh-oliva-signal.jpg") {
      response.writeHead(200, { "content-type": "image/jpeg" });
      response.end(imageBytes);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const images = await findRelatedImagesForStory(
      {
        slug: "fresh-oliva-signal",
        title: "Oliva daily signal",
        dek: "A source-backed image search should not reuse old cached research.",
        category: "Cigar Industry News",
        bodyMarkdown: "## Oliva\nA fresh source-page visual is available.",
        images: [],
        sourceNotes: [{ label: "Oliva", url: serverUrl(server, "/oliva-signal"), sourceType: "official" }],
        officialSources: [serverUrl(server, "/oliva-signal")],
        status: "published",
        publishedAt: "2026-06-10T16:17:21.403Z",
        updatedAt: "2026-06-10T16:17:21.403Z",
      },
      outputRoot,
      1,
    );

    assert.equal(images.length, 1);
    assert.equal(images[0].status, "downloaded");
    assert.match(images[0].sourcePageUrl, /\/oliva-signal$/);
    assert.doesNotMatch(images[0].imageUrl, /public\/assets\/news\/researched/);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("Cigar Flow image search deduplicates identical bytes without deleting the selected file", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "ycc-cigar-flow-image-content-dedupe-"));
  const imageBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(15_000, 9)]);
  const server = createServer(async (request, response) => {
    if (request.method === "GET" && (request.url === "/images/duplicate-a.jpg" || request.url === "/images/duplicate-b.jpg")) {
      response.writeHead(200, { "content-type": "image/jpeg" });
      response.end(imageBytes);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const images = await findRelatedImagesForStory(
      {
        slug: "duplicate-image-bytes",
        title: "Duplicate image byte guard",
        dek: "Two URLs return the same approved product image.",
        category: "Cigar Industry News",
        bodyMarkdown: "## Product image\nOnly one copy should be selected.",
        images: [
          { label: "Approved product", image: serverUrl(server, "/images/duplicate-a.jpg") },
          { label: "Approved product", image: serverUrl(server, "/images/duplicate-b.jpg") },
        ],
        sourceNotes: [],
        officialSources: [],
        status: "published",
        publishedAt: "2026-06-10T16:17:21.403Z",
        updatedAt: "2026-06-10T16:17:21.403Z",
      },
      outputRoot,
      2,
    );

    assert.equal(images.length, 1);
    assert.ok(images[0].contentHash, "selected image should retain its byte-level fingerprint");
    assert.ok(images[0].localPath, "selected image should have a local upload path");
    assert.deepEqual(await readFile(images[0].localPath!), imageBytes, "dedupe must not delete the already-selected shared path");
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("Cigar Flow image search prefers product visuals over publication cover art", () => {
  const story = {
    slug: "cigar-industry-update-june-13-2023",
    title: "Cigar Industry Update: June 13, 2023",
    dek: "Oliva, Perdomo, and Foundation signals for adult cigar readers.",
    category: "Cigar Industry News",
    bodyMarkdown: [
      "## Perdomo Cigars",
      "Perdomo Cigars is tied to a Reserve anniversary Maduro blend.",
      "",
      "## Foundation Cigar Company",
      "Foundation Cigar Company distribution news is part of this update.",
    ].join("\n"),
    images: [],
    sourceNotes: [],
    officialSources: [],
    status: "published",
    publishedAt: "2023-06-13T16:17:21.403Z",
    updatedAt: "2023-06-13T16:17:21.403Z",
  };
  const target = {
    label: "Perdomo Reserve 25th Anniversary Maduro",
    url: "https://www.perdomocigars.example/news/perdomo-reserve-25th-anniversary",
    source: "story_image_source_page",
  } as Parameters<typeof extractImageCandidatesFromHtml>[1];
  const html = `
    <html>
      <head>
        <meta property="og:image" content="https://images.squarespace-cdn.com/content/v1/site/TB+Cover+layers.jpg">
      </head>
      <body>
        <img
          src="https://www.perdomocigars.example/images/nick-perdomo-20th-anniversary-maduro-cigar.jpg"
          width="1500"
          height="316"
          alt="Perdomo 20th Anniversary Maduro cigar"
        >
      </body>
    </html>
  `;

  const candidates = extractImageCandidatesFromHtml(html, target, story).sort((left, right) => right.score - left.score);

  assert.ok(candidates.length >= 2);
  assert.match(candidates[0].imageUrl, /perdomo-20th-anniversary-maduro-cigar\.jpg$/);
  assert.doesNotMatch(candidates[0].imageUrl, /TB\+Cover\+layers/i);
});

test("Cigar Flow Facebook runner keeps skipping after a skipped-existing manifest", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "ycc-cigar-flow-skip-existing-"));
  const storyOutputDir = join(outputRoot, "cigar-flow-facebook-2026-06-10-latest-cigar-industry-updates-june-10-edition");
  await mkdir(storyOutputDir, { recursive: true });
  await writeFile(
    join(storyOutputDir, "cigar-flow-facebook-social-manifest.json"),
    JSON.stringify(
      {
        facebook_page: {
          status: "skipped_existing",
          postId: "page-123_post-existing",
          permalinkUrl: "https://www.facebook.com/example/posts/existing",
        },
      },
      null,
      2,
    ),
  );

  const imageBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(15_000, 4)]);
  let graphCalls = 0;
  const server = createServer(async (request, response) => {
    if (request.url?.startsWith("/graph/")) {
      graphCalls += 1;
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Graph should not be called for existing posts." } }));
      return;
    }

    if (request.method === "GET" && request.url === "/news/stories?limit=12") {
      return sendJson(response, {
        stories: [
          {
            slug: "latest-cigar-industry-updates-june-10-edition",
            title: "Latest Cigar Industry Updates: June 10 Edition",
            dek: "A source-backed update for adult cigar readers.",
            category: "Cigar Industry News",
            bodyMarkdown: "## Test Brand\nA source-backed note for adult readers.",
            images: [],
            sourceNotes: [{ label: "Test Brand", url: serverUrl(server, "/brand"), sourceType: "official" }],
            officialSources: [serverUrl(server, "/brand")],
            status: "published",
            publishedAt: "2026-06-10T16:17:21.403Z",
          },
        ],
      });
    }

    if (request.method === "GET" && request.url === "/brand") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`<html><head><meta property="og:image" content="${serverUrl(server, "/images/test-brand-cigar.jpg")}"></head></html>`);
      return;
    }

    if (request.method === "GET" && request.url === "/images/test-brand-cigar.jpg") {
      response.writeHead(200, { "content-type": "image/jpeg" });
      response.end(imageBytes);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const result = await runCigarFlowFacebookSocial({
      apiBaseUrl: serverUrl(server, ""),
      targetDate: "2026-06-10",
      outputDir: outputRoot,
      publishPage: true,
      dryRun: false,
      imageLimit: 1,
      pageId: "page-123",
      pageAccessToken: "test-token",
      graphBaseUrl: serverUrl(server, "/graph"),
    });

    assert.equal(result.pagePost?.status, "skipped_existing");
    assert.equal(result.pagePost?.postId, "page-123_post-existing");
    assert.equal(graphCalls, 0);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("Facebook Page album publisher uploads photos before creating the feed post", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "ycc-fb-page-album-"));
  const imagePath = join(tempDir, "image.jpg");
  await writeFile(imagePath, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(15_000, 2)]));

  const calls: Array<{ method: string; url: string; body: string }> = [];
  const server = createServer(async (request, response) => {
    const body = await readBody(request);
    calls.push({ method: request.method || "GET", url: request.url || "", body });

    if (request.method === "POST" && request.url === "/v25.0/page-123/photos") {
      return sendJson(response, { id: "photo-1", post_id: null });
    }

    if (request.method === "POST" && request.url === "/v25.0/page-123/feed") {
      assert.match(body, /attached_media%5B0%5D/);
      assert.match(body, /Cigar\+Flow/);
      return sendJson(response, { id: "page-123_post-456" });
    }

    if (request.method === "GET" && request.url?.startsWith("/v25.0/page-123_post-456")) {
      return sendJson(response, {
        id: "page-123_post-456",
        permalink_url: "https://www.facebook.com/example/posts/456",
        status_type: "added_photos",
      });
    }

    response.writeHead(404);
    response.end();
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const result = await publishFacebookPageAlbum({
      caption: "Cigar Flow | Daily update\n\nAdult 21+ only.",
      imagePaths: [imagePath],
      credentials: {
        pageId: "page-123",
        pageAccessToken: "test-token",
        graphVersion: "v25.0",
      },
      graphBaseUrl: serverUrl(server, ""),
    });

    assert.equal(result.status, "published");
    assert.equal(result.postId, "page-123_post-456");
    assert.equal(result.permalinkUrl, "https://www.facebook.com/example/posts/456");
    assert.deepEqual(
      calls.map((call) => `${call.method} ${call.url.split("?")[0]}`),
      ["POST /v25.0/page-123/photos", "POST /v25.0/page-123/feed", "GET /v25.0/page-123_post-456"],
    );
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Facebook Page album publisher retains the accepted post ID when readback fails", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "ycc-fb-page-readback-pending-"));
  const imagePath = join(tempDir, "image.jpg");
  await writeFile(imagePath, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(15_000, 5)]));

  const calls: string[] = [];
  const server = createServer(async (request, response) => {
    calls.push(`${request.method || "GET"} ${request.url?.split("?")[0] || ""}`);

    if (request.method === "POST" && request.url === "/v25.0/page-123/photos") {
      await readBody(request);
      return sendJson(response, { id: "photo-1", post_id: null });
    }

    if (request.method === "POST" && request.url === "/v25.0/page-123/feed") {
      await readBody(request);
      return sendJson(response, { id: "page-123_post-accepted" });
    }

    if (request.method === "GET" && request.url?.startsWith("/v25.0/page-123_post-accepted")) {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Readback temporarily unavailable" } }));
      return;
    }

    response.writeHead(404);
    response.end();
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const result = await publishFacebookPageAlbum({
      caption: "Cigar Flow | Daily update\n\nAdult 21+ only.",
      imagePaths: [imagePath],
      credentials: {
        pageId: "page-123",
        pageAccessToken: "test-token",
        graphVersion: "v25.0",
      },
      graphBaseUrl: serverUrl(server, ""),
    });

    assert.equal(result.status, "published");
    assert.equal(result.postId, "page-123_post-accepted");
    assert.equal(result.permalinkUrl, undefined);
    assert.match(result.reason ?? "", /accepted post page-123_post-accepted.*readback is pending/i);
    assert.deepEqual(calls, [
      "POST /v25.0/page-123/photos",
      "POST /v25.0/page-123/feed",
      "GET /v25.0/page-123_post-accepted",
    ]);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Facebook Page album publisher performs a final remote duplicate check after uploads", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "ycc-fb-page-final-preflight-"));
  const imagePath = join(tempDir, "image.jpg");
  const caption = "Cigar Flow | Daily update\n\nAdult 21+ only.";
  await writeFile(imagePath, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(15_000, 6)]));

  const calls: string[] = [];
  const server = createServer(async (request, response) => {
    calls.push(`${request.method || "GET"} ${request.url?.split("?")[0] || ""}`);
    if (request.method === "POST" && request.url === "/v25.0/page-123/photos") {
      await readBody(request);
      return sendJson(response, { id: "orphaned-unpublished-photo", post_id: null });
    }
    if (request.method === "GET" && request.url?.startsWith("/v25.0/page-123/feed")) {
      return sendJson(response, {
        data: [{ id: "page-123_existing", permalink_url: "https://www.facebook.com/example/posts/existing", message: caption }],
      });
    }
    response.writeHead(500);
    response.end("unexpected feed mutation");
  });

  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const result = await publishFacebookPageAlbum({
      caption,
      imagePaths: [imagePath],
      credentials: { pageId: "page-123", pageAccessToken: "test-token", graphVersion: "v25.0" },
      graphBaseUrl: serverUrl(server, ""),
      verifyNoExistingPost: true,
    });

    assert.equal(result.status, "skipped_existing");
    assert.equal(result.postId, "page-123_existing");
    assert.deepEqual(calls, ["POST /v25.0/page-123/photos", "GET /v25.0/page-123/feed"]);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Cigar Flow Facebook caption keeps adult and no-marketplace framing", () => {
  const caption = buildFacebookCaption({
    slug: "test",
    title: "Latest Cigar Industry Updates: June 10 Edition",
    dek: "A source-backed update for adult cigar readers.",
    category: "Cigar Industry News",
    bodyMarkdown: [
      "## Oliva Cigar Company",
      "Oliva Cigar Company has announced a Serie V Maduro limited-edition note.",
      "",
      "## Perdomo Cigars",
      "Perdomo Cigars is tied to a Reserve anniversary blend and brand-milestone angle.",
      "",
      "## Foundation Cigar Company",
      "Foundation Cigar Company is connected to a Foundation Series heritage-style signal.",
    ].join("\n"),
    sourceNotes: [],
    officialSources: [],
    status: "published",
    publishedAt: "2026-06-10T16:17:21.403Z",
    updatedAt: "2026-06-10T16:17:21.403Z",
  });

  assert.match(caption, /21\+ only/);
  assert.match(caption, /Editorial education and culture coverage/);
  assert.match(caption, /Inside this update:/);
  assert.match(caption, /Oliva Cigar Company: Oliva Cigar Company has announced a Serie V Maduro limited-edition note\./);
  assert.match(caption, /Perdomo Cigars: Perdomo Cigars is tied to a Reserve anniversary blend/);
  assert.match(caption, /Foundation Cigar Company: Foundation Cigar Company is connected to a Foundation Series/);
  assert.doesNotMatch(caption, /Signals in this update/);
  assert.doesNotMatch(caption, /\bbuy\b|\border\b|\bgiveaway\b|\bsample\b|\bpricing\b|\binventory\b|\bmarketplace\b/i);
});

function sendJson(response: ServerResponse, payload: unknown) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function serverUrl(server: ReturnType<typeof createServer>, path: string) {
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}${path}`;
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function phoenixDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Phoenix",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}
