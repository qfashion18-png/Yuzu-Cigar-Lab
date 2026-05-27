import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";

type DraftCall = {
  angle?: string;
  sourceNotes?: string[];
  sourceUrls: string[];
  storyImages?: Array<{ sourceUrl?: string }>;
};

type PublishCall = {
  images?: Array<{ sourceUrl?: string }>;
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
    assert.match(draftCalls[0].angle ?? "", /press releases/i);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

function runDailyWriter(env: Record<string, string>) {
  const scriptPath = path.resolve("scripts/daily-cigar-news-run.ts");
  const child = spawn(process.execPath, ["--import", "tsx", scriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      YCC_NEWSROOM_COGNITO_USERNAME: "",
      YCC_NEWSROOM_COGNITO_PASSWORD: "",
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
