import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";

import {
  buildFacebookCaption,
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
    assert.match(await readFile(result.captionPath, "utf8"), /Adult 21\+ only/);
    assert.match(await readFile(result.groupKitPath, "utf8"), /Group API publishing is intentionally not attempted/);
    assert.equal(result.pagePost?.status, "dry_run");
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

test("Cigar Flow Facebook caption keeps adult and no-marketplace framing", () => {
  const caption = buildFacebookCaption({
    slug: "test",
    title: "Latest Cigar Industry Updates: June 10 Edition",
    dek: "A source-backed update for adult cigar readers.",
    category: "Cigar Industry News",
    bodyMarkdown: "## Oliva Cigar Company\n## Perdomo Cigars",
    sourceNotes: [],
    officialSources: [],
    status: "published",
    publishedAt: "2026-06-10T16:17:21.403Z",
    updatedAt: "2026-06-10T16:17:21.403Z",
  });

  assert.match(caption, /21\+ only/);
  assert.match(caption, /No marketplace/);
  assert.doesNotMatch(caption, /\bbuy\b|\border\b|\bgiveaway\b|\bsample\b/i);
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
