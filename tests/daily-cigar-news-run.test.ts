import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { buildDailyCigarFlowDraftInput, collectDailyCigarFlowSourceEvidence, matchDailyCigarFlowEvidenceLeads, runDailyCigarFlow } from "../scripts/daily-cigar-news-run";

type DraftCall = {
  angle?: string;
  sourceNotes?: string[];
  sourceUrls: string[];
  leadUrls?: string[];
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

type DraftArtifact = {
  draft: PublishCall;
  savedDraft: { id: string; slug: string; status: string };
  sourceEvidence: Array<{ publishedAt?: string; note: string }>;
  review: { operatorReviewRequired: boolean; sourceClaimsVerified: boolean; verifiedImageCount: number; warnings: string[] };
};

type DailyWriterResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  artifact: DraftArtifact | null;
  report: { outcome: string; message: string; draftId?: string; draftSlug?: string } | null;
  summary: string;
};

const storedDraftReceipt = {
  story: { id: "scheduled-draft-id", slug: "saved-scheduled-story-draft", status: "draft" },
  persistence: { status: "stored", table: "news_stories" },
};

test("a full three-maker batch preserves nine primary evidence notes within the twelve-note API contract", () => {
  const makers = ["perdomocigars.com", "plasenciacigars.com", "olivacigar.com"];
  const evidence = makers.flatMap((maker) => Array.from({ length: 3 }, (_, index) => ({
    sourceUrl: `https://${maker}/news/announcement-${index}`,
    title: `${maker} announcement ${index}`,
    note: `Complete primary evidence for ${maker} announcement ${index}. ${"Manufacturer release facts and dates remain intact. ".repeat(35)}END ${maker}/${index}`,
    image: null,
  })));
  const leads = Array.from({ length: 8 }, (_, index) => ({ sourceName: "Discovery feed", title: `Fresh discovery headline ${index}`, link: `https://halfwheel.com/discovery-${index}`, publishedAt: "2026-09-05T15:00:00Z" }));
  const input = buildDailyCigarFlowDraftInput({ sourceNames: makers, sourceUrls: evidence.map((source) => source.sourceUrl) }, [], leads, "2026-09-05", evidence);
  assert.equal(input.sourceUrls.length, 12);
  assert.equal(input.sourceNotes.length, 12);
  for (const source of evidence) assert.ok(input.sourceNotes.includes(source.note), `Primary evidence was dropped for ${source.sourceUrl}`);
  assert.deepEqual(input.leadUrls, leads.map((lead) => lead.link));
  assert.equal(input.sourceNotes.filter((note) => note.startsWith("Current RSS lead")).length, 2);
  assert.match(input.sourceNotes[0], /Cigar Flow editorial format/);
  assert.match(input.sourceNotes[0], /Do not invent image URLs/);
  assert.ok(input.sourceNotes[0].length <= 500, "Guidance must fit even the older API's note-length limit");
});

test("an oversized primary evidence batch fails before silently losing source facts", () => {
  const evidence = Array.from({ length: 12 }, (_, index) => ({ sourceUrl: `https://perdomocigars.com/news/announcement-${index}`, title: `Announcement ${index}`, note: `Full primary evidence ${index}`, image: null }));
  assert.throws(() => buildDailyCigarFlowDraftInput({ sourceNames: ["Perdomo"], sourceUrls: evidence.map((source) => source.sourceUrl) }, [], [], "2026-09-05", evidence), /primary evidence cannot be dropped/);
});

test("primary discovery follows only bounded relevant official announcement links", async () => {
  const requested: string[] = [];
  const landingUrl = "https://www.perdomocigars.com/news";
  const articleUrl = "https://perdomocigars.com/news/30th-anniversary-box-update";
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requested.push(url);
    const html = url === landingUrl
      ? `<title>Perdomo News</title><p>${"Official manufacturer newsroom and product background. ".repeat(4)}</p>
         <a href="/news/30th-anniversary-box-update">Perdomo 30th Anniversary box update</a>
         <a href="/30th-anniversary">Perdomo 30th Anniversary</a>
         <a href="/products/30th-anniversary-release">Perdomo 30th Anniversary release</a>
         <a href="https://unapproved.example/news/30th-anniversary-box-update">Perdomo 30th Anniversary</a>
         <a href="/news/unrelated-podcast">Podcast episode</a>`
      : `<title>Perdomo 30th Anniversary box update</title><meta property="article:published_time" content="2026-09-03T15:00:00Z"><p>${"The manufacturer confirms the 30th Anniversary line changes its box count while retaining the blend. ".repeat(3)}</p>`;
    return new Response(html, { headers: { "content-type": "text/html" } });
  };
  const evidence = await collectDailyCigarFlowSourceEvidence([landingUrl], new Date("2026-09-04T15:00:00Z"), {
    fetchImpl,
    rssLeads: [{ sourceName: "Discovery desk", title: "Perdomo Shifts 30th Anniversary to 20-Count Boxes", link: "https://halfwheel.com/example", publishedAt: "2026-09-03T15:00:00Z" }],
  });
  assert.deepEqual(requested, [landingUrl, articleUrl]);
  assert.deepEqual(evidence.map((source) => source.sourceUrl), [articleUrl]);
  assert.match(evidence[0].note, /manufacturer confirms/);
  assert.equal(evidence[0].publishedAt, "2026-09-03T15:00:00.000Z");
  const input = buildDailyCigarFlowDraftInput({ sourceNames: ["Perdomo"], sourceUrls: [articleUrl] }, [], [], "2026-09-04", evidence);
  assert.ok(input.sourceNotes.some((note) => note.includes("Primary publication date: 2026-09-03T15:00:00.000Z. Retrieved official-source evidence at 2026-09-04T15:00:00.000Z")));
});

test("primary publication dates must be explicit and use the same recency window as discovery leads", async () => {
  const articleUrl = "https://www.warpedcigars.com/news/gellis-family-absolutos-coming-in-march";
  const currentDate = "2026-09-05T12:00:00Z";
  const cases = [
    { label: "publication metadata", markup: `<meta property="article:published_time" content="${currentDate}">`, accepted: true },
    { label: "Article JSON-LD", markup: `<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","datePublished":"${currentDate}","dateModified":"2026-09-05T14:00:00Z"}]}</script>`, accepted: true },
    { label: "publication time", markup: `<article><time itemprop="datePublished" datetime="${currentDate}">Published September 5, 2026</time></article>`, accepted: true },
    { label: "actual old Absolutos date", markup: '<meta property="article:published_time" content="2025-02-12T12:00:00Z">', accepted: false },
    { label: "old Piece Unique with recent modification", markup: `<script type="application/ld+json">{"@type":"BlogPosting","datePublished":"2024-12-21T12:00:00Z","dateModified":"${currentDate}"}</script>`, accepted: false },
    { label: "modified metadata only", markup: `<meta property="article:modified_time" content="${currentDate}">`, accepted: false },
    { label: "updated time only", markup: `<article><time class="updated" datetime="${currentDate}">Updated September 5, 2026</time></article>`, accepted: false },
    { label: "no publication date", markup: "", accepted: false },
    { label: "future beyond six hours", markup: '<meta property="article:published_time" content="2026-09-06T12:00:00Z">', accepted: false },
    { label: "conflicting publication fields retain original", markup: `<meta property="article:published_time" content="2024-12-21T12:00:00Z"><script type="application/ld+json">{"@type":"Article","datePublished":"${currentDate}"}</script>`, accepted: false },
  ];
  for (const scenario of cases) {
    const evidence = await collectDailyCigarFlowSourceEvidence([articleUrl], new Date("2026-09-05T15:00:00Z"), {
      fetchImpl: async () => new Response(`<title>Gellis Family Absolutos</title>${scenario.markup}<p>${"The maker supplies concrete release details and confirmed shipping information. ".repeat(4)}</p>`, { headers: { "content-type": "text/html" } }),
    });
    assert.equal(evidence.length, Number(scenario.accepted), scenario.label);
    if (scenario.accepted) assert.equal(evidence[0].publishedAt, "2026-09-05T12:00:00.000Z", scenario.label);
  }
  const savedAge = process.env.YCC_DAILY_NEWSROOM_RSS_MAX_AGE_HOURS;
  const savedSkew = process.env.YCC_DAILY_NEWSROOM_RSS_MAX_FUTURE_SKEW_HOURS;
  process.env.YCC_DAILY_NEWSROOM_RSS_MAX_AGE_HOURS = "24";
  process.env.YCC_DAILY_NEWSROOM_RSS_MAX_FUTURE_SKEW_HOURS = "0";
  try {
    for (const date of ["2026-09-04T14:00:00Z", "2026-09-05T16:00:00Z"]) {
      const evidence = await collectDailyCigarFlowSourceEvidence([articleUrl], new Date("2026-09-05T15:00:00Z"), {
        fetchImpl: async () => new Response(`<title>Gellis Family Absolutos</title><meta property="article:published_time" content="${date}"><p>${"The maker supplies concrete release details and confirmed shipping information. ".repeat(4)}</p>`, { headers: { "content-type": "text/html" } }),
      });
      assert.deepEqual(evidence, [], `Configured recency window was ignored for ${date}`);
    }
  } finally {
    if (savedAge === undefined) delete process.env.YCC_DAILY_NEWSROOM_RSS_MAX_AGE_HOURS;
    else process.env.YCC_DAILY_NEWSROOM_RSS_MAX_AGE_HOURS = savedAge;
    if (savedSkew === undefined) delete process.env.YCC_DAILY_NEWSROOM_RSS_MAX_FUTURE_SKEW_HOURS;
    else process.env.YCC_DAILY_NEWSROOM_RSS_MAX_FUTURE_SKEW_HOURS = savedSkew;
  }
});

test("a generic manufacturer page cannot qualify as primary announcement evidence", async () => {
  let requests = 0;
  const evidence = await collectDailyCigarFlowSourceEvidence(["https://www.perdomocigars.com/news"], new Date("2026-09-04T15:00:00Z"), {
    fetchImpl: async () => {
      requests += 1;
      return new Response(`<title>Perdomo News</title><p>${"Background about the manufacturer and its longstanding products. ".repeat(4)}</p>`, { headers: { "content-type": "text/html" } });
    },
    rssLeads: [{ sourceName: "Discovery desk", title: "Perdomo Shifts 30th Anniversary to 20-Count Boxes", link: "https://halfwheel.com/example", publishedAt: "2026-09-03T15:00:00Z" }],
  });
  assert.equal(requests, 1);
  assert.deepEqual(evidence, []);
});

test("an official-domain article explicitly reposting secondary coverage is not primary evidence", async () => {
  const articleUrl = "https://foundationcigarcompany.com/news/pca-2026-foundation-cigar-co";
  for (const label of ["VIEW THE ARTICLE HERE", "Read the full article", "Original article"]) {
    const evidence = await collectDailyCigarFlowSourceEvidence([articleUrl], new Date("2026-09-05T15:00:00Z"), {
      fetchImpl: async () => new Response(`<title>Foundation PCA 2026 coverage</title><meta property="article:published_time" content="2026-09-05T12:00:00Z"><main><article>
        <p>${"Our magazine visited the Foundation booth to report on the maker's announcements. ".repeat(4)}</p>
        <a href="https://halfwheel.com/pca-2026-foundation-cigar-co/">${label}</a>
        </article></main>`, { headers: { "content-type": "text/html" } }),
    });
    assert.deepEqual(evidence, [], `Secondary repost qualified with the explicit label: ${label}`);
  }
});

test("a primary release may reference ordinary secondary coverage and unrelated site navigation", async () => {
  const articleUrl = "https://foundationcigarcompany.com/news/new-release-announcement";
  const evidence = await collectDailyCigarFlowSourceEvidence([articleUrl], new Date("2026-09-05T15:00:00Z"), {
    fetchImpl: async () => new Response(`<title>Foundation new release announcement</title><meta property="article:published_time" content="2026-09-05T12:00:00Z">
      <nav><a href="https://halfwheel.com/unrelated-feature/">View the article here</a></nav>
      <article><p>${"Foundation confirms a September 2026 release with a new wrapper and announced box count. ".repeat(4)}</p>
      <a href="https://halfwheel.com/related-coverage/">Related coverage by Halfwheel</a>
      <a href="/news/original-release-announcement">Read the original article</a></article>`, { headers: { "content-type": "text/html" } }),
  });
  assert.deepEqual(evidence.map((source) => source.sourceUrl), [articleUrl]);
  assert.match(evidence[0].note, /Foundation confirms a September 2026 release/);
});

test("drafting and deduplication use only leads matched to retrieved primary announcements", () => {
  const leads = [
    { sourceName: "Discovery desk", title: "Perdomo Shifts 30th Anniversary to 20-Count Boxes", link: "https://halfwheel.com/perdomo-update", publishedAt: "2026-09-03T15:00:00Z" },
    { sourceName: "Discovery desk", title: "Plasencia Launches Born of This Land Brand Campaign", link: "https://cigardojo.com/plasencia-campaign", publishedAt: "2026-09-03T16:00:00Z" },
  ];
  const matched = matchDailyCigarFlowEvidenceLeads(leads, [{ sourceUrl: "https://perdomocigars.com/news/30th-anniversary-box-update", title: "Perdomo 30th Anniversary box update", note: "Retrieved primary announcement.", image: null }]);
  assert.deepEqual(matched, [leads[0]]);
});

test("shared Gellis Family branding cannot match Heritage No. 50 to other products", async () => {
  const lead = { sourceName: "halfwheel", title: "Gellis Family Cigars Heritage No. 50", link: "https://halfwheel.com/gellis-family-cigars-heritage-no-50/478332", publishedAt: "2026-09-04T21:00:21Z" };
  const wrongProducts = [
    { sourceUrl: "https://www.warpedcigars.com/news/gellis-family-absolutos-coming-in-march", title: "Gellis Family 'Absolutos' Coming in March | Warped Cigars", publishedAt: "2026-09-05T12:00:00Z", note: "Different product, even if freshly announced.", image: null },
    { sourceUrl: "https://www.warpedcigars.com/news/gellis-family-piece-unique", title: "Gellis Family 'Piece Unique' | Warped Cigars", publishedAt: "2026-09-05T12:00:00Z", note: "Different product, even if freshly announced.", image: null },
  ];
  assert.deepEqual(matchDailyCigarFlowEvidenceLeads([lead], wrongProducts), []);
  assert.deepEqual(matchDailyCigarFlowEvidenceLeads([lead], [{ ...wrongProducts[0], sourceUrl: "https://www.warpedcigars.com/news/gellis-family-heritage-no-50-release", title: "Gellis Family Heritage No. 50 release" }]), [lead]);
  const requested: string[] = [];
  const evidence = await collectDailyCigarFlowSourceEvidence(["https://www.warpedcigars.com/news"], new Date("2026-09-05T15:00:00Z"), {
    rssLeads: [lead],
    fetchImpl: async (input) => {
      requested.push(String(input));
      return new Response(`<title>Warped News</title><p>${"Manufacturer newsroom with announcements and product details. ".repeat(4)}</p>${wrongProducts.map((product) => `<a href="${product.sourceUrl}">${product.title}</a>`).join("")}`, { headers: { "content-type": "text/html" } });
    },
  });
  assert.deepEqual(evidence, []);
  assert.deepEqual(requested, ["https://www.warpedcigars.com/news"], "Brand-only candidate links must not be fetched as matching stories");
});

test("the saved draft artifact preserves the primary publication date independently of retrieval time", async () => {
  const outputPrefix = path.join(tmpdir(), `cigar-flow-primary-date-${randomUUID()}`);
  const publicationDate = "2026-09-04T12:00:00.000Z";
  const runNow = new Date("2026-09-05T15:00:00Z");
  const evidence = await collectDailyCigarFlowSourceEvidence(["https://perdomocigars.com/news/30th-anniversary-box-update"], runNow, {
    fetchImpl: async () => new Response(`<title>Perdomo 30th Anniversary box update</title><meta property="article:published_time" content="${publicationDate}"><p>${"The manufacturer confirms a changed box count for the 30th Anniversary line. ".repeat(4)}</p>`, { headers: { "content-type": "text/html" } }),
  });
  const requests: DraftCall[] = [];
  const server = createServer(async (request, response) => {
    const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
    requests.push(payload);
    respondWithDraft(response, payload, "Perdomo 30th Anniversary box update");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const testEnv: Record<string, string> = {
    NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
    YCC_NEWSROOM_BEARER_TOKEN: "test-token",
    YCC_NEWSROOM_COGNITO_USERNAME: "",
    YCC_NEWSROOM_COGNITO_PASSWORD: "",
    YCC_DAILY_NEWSROOM_NOW: runNow.toISOString(),
    YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "false",
    YCC_DAILY_NEWSROOM_DEDUPE_PREFLIGHT: "false",
    YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "0",
    YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS: "false",
    YCC_DAILY_NEWSROOM_FETCH_SOURCE_EVIDENCE: "true",
    YCC_DAILY_NEWSROOM_REQUIRE_SOURCE_EVIDENCE: "true",
    YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
    YCC_DAILY_NEWSROOM_DRAFT_OUTPUT_PATH: `${outputPrefix}.draft.json`,
    YCC_DAILY_NEWSROOM_RUN_STATUS_OUTPUT_PATH: `${outputPrefix}.status.json`,
    GITHUB_STEP_SUMMARY: "",
  };
  const originalEnv = Object.fromEntries(Object.keys(testEnv).map((key) => [key, process.env[key]]));
  Object.assign(process.env, testEnv);
  try {
    await runDailyCigarFlow({ collectSourceEvidence: async () => evidence });
    assert.equal(requests.length, 1);
    assert.ok(requests[0].sourceNotes?.some((note) => note.startsWith(`Primary publication date: ${publicationDate}. Retrieved official-source evidence at ${runNow.toISOString()}`)));
    const artifact = JSON.parse(await readFile(`${outputPrefix}.draft.json`, "utf8")) as DraftArtifact;
    assert.equal(artifact.sourceEvidence[0].publishedAt, publicationDate);
    assert.match(artifact.sourceEvidence[0].note, /2026-09-04T12:00:00.000Z/);
    assert.equal(artifact.savedDraft.status, "draft");
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.close();
    await once(server, "close").catch(() => undefined);
    await Promise.all(["draft", "status"].map((kind) => rm(`${outputPrefix}.${kind}.json`, { force: true })));
  }
});

test("the daily run records missing primary evidence before invoking draft generation", async () => {
  const reportPath = path.join(tmpdir(), `cigar-flow-primary-block-${randomUUID()}.json`);
  const testEnv: Record<string, string> = {
    NEXT_PUBLIC_YCC_API_BASE_URL: "http://127.0.0.1:1",
    YCC_NEWSROOM_BEARER_TOKEN: "test-token",
    YCC_NEWSROOM_COGNITO_USERNAME: "",
    YCC_NEWSROOM_COGNITO_PASSWORD: "",
    YCC_DAILY_NEWSROOM_DEDUPE_PREFLIGHT: "false",
    YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "0",
    YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS: "false",
    YCC_DAILY_NEWSROOM_FETCH_SOURCE_EVIDENCE: "true",
    YCC_DAILY_NEWSROOM_REQUIRE_SOURCE_EVIDENCE: "true",
    YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
    YCC_DAILY_NEWSROOM_RUN_STATUS_OUTPUT_PATH: reportPath,
    GITHUB_STEP_SUMMARY: "",
  };
  const originalEnv = Object.fromEntries(Object.keys(testEnv).map((key) => [key, process.env[key]]));
  Object.assign(process.env, testEnv);
  try {
    let sourceChecks = 0;
    await runDailyCigarFlow({ collectSourceEvidence: async () => { sourceChecks += 1; return []; } });
    const report = JSON.parse(await readFile(reportPath, "utf8")) as { outcome: string; message: string };
    assert.equal(sourceChecks, 1);
    assert.equal(report.outcome, "no_verified_primary_sources");
    assert.match(report.message, /no AI draft or publication was created/);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(reportPath, { force: true });
  }
});

test("an invalid first draft cannot survive a later batch with no primary evidence", async () => {
  const outputPrefix = path.join(tmpdir(), `cigar-flow-invalid-candidate-${randomUUID()}`);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ draft: { title: "Rejected placeholder draft", bodyMarkdown: "", images: [], sourceNotes: [] } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const testEnv: Record<string, string> = {
    NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
    YCC_NEWSROOM_BEARER_TOKEN: "test-token",
    YCC_NEWSROOM_COGNITO_USERNAME: "",
    YCC_NEWSROOM_COGNITO_PASSWORD: "",
    YCC_DAILY_NEWSROOM_DEDUPE_PREFLIGHT: "false",
    YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "0",
    YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS: "false",
    YCC_DAILY_NEWSROOM_FETCH_SOURCE_EVIDENCE: "true",
    YCC_DAILY_NEWSROOM_REQUIRE_SOURCE_EVIDENCE: "true",
    YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "2",
    YCC_DAILY_NEWSROOM_DRAFT_OUTPUT_PATH: `${outputPrefix}.draft.json`,
    YCC_DAILY_NEWSROOM_RUN_STATUS_OUTPUT_PATH: `${outputPrefix}.status.json`,
    GITHUB_STEP_SUMMARY: "",
  };
  const originalEnv = Object.fromEntries(Object.keys(testEnv).map((key) => [key, process.env[key]]));
  Object.assign(process.env, testEnv);
  try {
    let sourceChecks = 0;
    await assert.rejects(runDailyCigarFlow({ collectSourceEvidence: async () => {
      sourceChecks += 1;
      return sourceChecks === 1 ? [{ sourceUrl: "https://perdomocigars.com/news/30th-anniversary-box-update", title: "Perdomo box update", note: "Retrieved announcement.", image: null }] : [];
    } }), /placeholder scaffold copy/);
    assert.equal(sourceChecks, 2);
    assert.equal(await readFile(`${outputPrefix}.draft.json`, "utf8").catch(() => null), null);
    assert.equal(await readFile(`${outputPrefix}.status.json`, "utf8").catch(() => null), null);
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    server.close();
    await once(server, "close").catch(() => undefined);
    await Promise.all(["draft", "status"].map((kind) => rm(`${outputPrefix}.${kind}.json`, { force: true })));
  }
});

test("daily draft generation allows source retrieval and writing beyond the ordinary API timeout", { concurrency: 2 }, async (t) => {
  await Promise.all([false, true].map((insecureTls) => t.test(insecureTls ? "Node request transport" : "fetch transport", async () => {
    const server = createServer(async (request, response) => {
      if (request.method === "POST" && request.url === "/news/story-drafts") {
        const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
        setTimeout(() => respondWithDraft(response, payload, "Source-backed draft after a slow generation"), 15_250);
        return;
      }
      response.writeHead(404);
      response.end();
    });
    try {
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address === "object");
      const result = await runDailyWriter({
        NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
        YCC_NEWSROOM_BEARER_TOKEN: "test-token",
        YCC_NEWSROOM_API_TLS_INSECURE: String(insecureTls),
        YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "false",
        YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
      });
      assert.equal(result.code, 0, result.stderr || result.stdout);
      assert.equal(result.report?.outcome, "draft_ready_for_review");
      assert.equal(result.report?.draftId, storedDraftReceipt.story.id);
    } finally {
      server.close();
      await once(server, "close").catch(() => undefined);
    }
  })));
});

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
          ...storedDraftReceipt,
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
          ...storedDraftReceipt,
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
          ...storedDraftReceipt,
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
          ...storedDraftReceipt,
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
    assert.deepEqual(draftCalls[0].leadUrls, ["https://example.test/releases/rocky?a=1&b=2"]);
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

    assert.equal(result.code, 1, result.stderr || result.stdout);
    assert.equal(draftCallCount, 0);
    assert.match(result.stderr, /response is not an RSS or Atom feed/i);
    assert.match(result.stderr, /RSS discovery failed: no configured feed could be read/i);
    assert.doesNotMatch(result.stdout, /No action: no fresh, unprocessed RSS leads/i);
    assert.equal(result.report?.outcome, "failed");
    assert.match(result.summary, /Outcome: failed/);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow writer distinguishes a valid empty feed from an upstream outage", async () => {
  let draftCalls = 0;
  const server = createServer((request, response) => {
    if (request.url === "/empty.xml") {
      response.writeHead(200, { "content-type": "application/rss+xml" });
      response.end('<rss version="2.0"><channel><title>Quiet news day</title></channel></rss>');
      return;
    }
    if (request.method === "POST") draftCalls += 1;
    response.writeHead(503, { "content-type": "text/plain" });
    response.end("Upstream unavailable");
  });
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: baseUrl,
      YCC_DAILY_NEWSROOM_RSS_FEEDS: `${baseUrl}/unavailable.xml,${baseUrl}/empty.xml`,
      YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT: "8",
      YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS: "true",
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(draftCalls, 0);
    assert.equal(result.artifact, null);
    assert.equal(result.report?.outcome, "no_fresh_leads");
    assert.match(result.summary, /No draft or publication was created/);
    assert.match(result.stderr, /HTTP 503/);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow review artifacts exclude rejected assets and expose unfinished editorial checks", async () => {
  let publishCalls = 0;
  const server = createServer(async (request, response) => {
    if (request.url === "/news/story-drafts" && request.method === "POST") {
      const payload = JSON.parse(await readRequestBody(request)) as DraftCall;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ...storedDraftReceipt, draft: {
        title: "Manufacturer news awaits source verification",
        dek: "A draft for editorial review.",
        category: "Industry News",
        bodyMarkdown: "A manufacturer's announcement needs an editor to verify the specific facts before publication.",
        sections: [],
        images: [{ label: "Rejected remote image", image: "https://unapproved.example/logo.jpg", sourceUrl: payload.sourceUrls[0] }],
        sourceNotes: [{ label: "Unverified source", url: "https://unapproved.example/story", note: "This was not retrieved." }],
      } }));
      return;
    }
    if (request.url === "/news/stories" && request.method === "POST") publishCalls += 1;
    response.writeHead(404);
    response.end();
  });
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const result = await runDailyWriter({
      NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
      YCC_NEWSROOM_BEARER_TOKEN: "test-token",
      YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "false",
    });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(publishCalls, 0);
    assert.deepEqual(result.artifact?.draft.images, []);
    assert.deepEqual(result.artifact?.draft.sourceNotes, []);
    assert.deepEqual(result.artifact?.sourceEvidence, []);
    assert.equal(result.artifact?.review.operatorReviewRequired, true);
    assert.equal(result.artifact?.review.sourceClaimsVerified, false);
    assert.equal(result.artifact?.review.warnings.length, 3);
    assert.equal(result.report?.outcome, "draft_ready_for_review");
    assert.deepEqual(result.artifact?.savedDraft, storedDraftReceipt.story);
    assert.equal(result.report?.draftId, storedDraftReceipt.story.id);
    assert.equal(result.report?.draftSlug, storedDraftReceipt.story.slug);
    assert.match(result.summary, /awaiting approval in the newsroom/);
    assert.match(result.summary, /public feed was not updated/);
    assert.match(result.summary, /no section headings/);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

test("daily cigar flow rejects draft responses that are not durably awaiting approval", async (t) => {
  for (const scenario of [
    { name: "missing storage receipt", receipt: {} },
    { name: "failed persistence", receipt: { ...storedDraftReceipt, persistence: { status: "failed" } } },
    { name: "missing saved identifier", receipt: { ...storedDraftReceipt, story: { ...storedDraftReceipt.story, id: "" } } },
    { name: "missing saved slug", receipt: { ...storedDraftReceipt, story: { ...storedDraftReceipt.story, slug: "" } } },
    { name: "already published instead of awaiting approval", receipt: { ...storedDraftReceipt, story: { ...storedDraftReceipt.story, status: "published" } } },
  ]) {
    await t.test(scenario.name, async () => {
      let publishCalls = 0;
      const server = createServer(async (request, response) => {
        if (request.method === "POST" && request.url === "/news/story-drafts") {
          await readRequestBody(request);
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({
            ...scenario.receipt,
            draft: {
              title: "A generated draft without a saved approval record",
              dek: "Editorial review is pending.",
              category: "Industry News",
              bodyMarkdown: "## Manufacturer announcement\nThe source reports a new release with confirmed manufacturer details.",
              sections: [],
              images: [],
              sourceNotes: [],
            },
          }));
          return;
        }
        if (request.method === "POST" && request.url === "/news/stories") publishCalls += 1;
        response.writeHead(404);
        response.end();
      });
      try {
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const address = server.address();
        assert.ok(address && typeof address === "object");
        const result = await runDailyWriter({
          NEXT_PUBLIC_YCC_API_BASE_URL: `http://127.0.0.1:${address.port}`,
          YCC_NEWSROOM_BEARER_TOKEN: "test-token",
          YCC_DAILY_NEWSROOM_AUTO_PUBLISH: "false",
          YCC_DAILY_NEWSROOM_MAX_ATTEMPTS: "1",
        });
        assert.equal(result.code, 1, result.stderr || result.stdout);
        assert.equal(publishCalls, 0);
        assert.equal(result.artifact, null);
        assert.equal(result.report?.outcome, "failed");
        assert.match(result.report?.message ?? "", /not durably saved to the newsroom approval inbox/);
        assert.doesNotMatch(result.summary, /Outcome: draft ready for review/);
      } finally {
        server.close();
        await once(server, "close").catch(() => undefined);
      }
    });
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
          ...storedDraftReceipt,
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
          ...storedDraftReceipt,
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
          ...storedDraftReceipt,
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
          ...storedDraftReceipt,
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
    assert.deepEqual(result.artifact?.draft.images, publishCalls[0].images);
    assert.equal(result.artifact?.review.verifiedImageCount, 1);
  } finally {
    server.close();
    await once(server, "close").catch(() => undefined);
  }
});

function respondWithDraft(response: ServerResponse, payload: DraftCall, title: string) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      ...storedDraftReceipt,
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
  const outputPrefix = path.join(tmpdir(), `ycc-cigar-flow-test-${randomUUID()}`);
  const draftPath = `${outputPrefix}.draft.json`;
  const reportPath = `${outputPrefix}.status.json`;
  const summaryPath = `${outputPrefix}.summary.md`;
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
      YCC_DAILY_NEWSROOM_DRAFT_OUTPUT_PATH: draftPath,
      YCC_DAILY_NEWSROOM_RUN_STATUS_OUTPUT_PATH: reportPath,
      GITHUB_STEP_SUMMARY: summaryPath,
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

  return new Promise<DailyWriterResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`daily writer timed out\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    // The runner keeps its own request deadlines; allow TypeScript child startup under concurrent build load.
    }, 45000);

    child.on("error", (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", async (code: number | null) => {
      clearTimeout(timeout);
      try {
        const [artifactText, reportText, summary] = await Promise.all([
          readFile(draftPath, "utf8").catch(() => ""),
          readFile(reportPath, "utf8").catch(() => ""),
          readFile(summaryPath, "utf8").catch(() => ""),
        ]);
        resolve({ code, stdout, stderr, artifact: artifactText ? JSON.parse(artifactText) as DraftArtifact : null, report: reportText ? JSON.parse(reportText) as DailyWriterResult["report"] : null, summary });
      } catch (error) {
        reject(error);
      } finally {
        await Promise.all([draftPath, reportPath, summaryPath].map((filePath) => rm(filePath, { force: true })));
      }
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
