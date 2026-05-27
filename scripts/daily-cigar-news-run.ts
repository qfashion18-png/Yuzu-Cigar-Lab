import { request as httpRequest, type OutgoingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";

import { cigarFlowItems, cigarPressReleaseSearchSources } from "../src/lib/cigar-flow";
import { resolveNewsroomAutomationAuth } from "../src/lib/newsroom-automation-auth";
import { isPlaceholderNewsBodyMarkdown, officialCigarNewsSources, type NewsStoryImage } from "../src/lib/newsroom";

type NewsStoryDraftResponse = {
  draft: {
    title: string;
    dek: string;
    category: string;
    bodyMarkdown: string;
    images?: NewsStoryImage[];
    sourceNotes: { url: string; label?: string; note?: string }[];
    sections: Array<{ heading: string; body: string }>;
  };
  prompt?: {
    acceptedSourceCount?: number;
  };
};

type NewsStoryPublishResponse = {
  story: { title: string; slug: string; status: string };
  persistence: { status: string; table: string };
};

type OfficialCigarNewsSource = (typeof officialCigarNewsSources)[number];

type DailyCigarFlowSourceBatch = {
  sourceNames: string[];
  sourceUrls: string[];
};

async function runDailyCigarFlow() {
  const baseUrl = resolveRequiredEnv("NEXT_PUBLIC_YCC_API_BASE_URL");
  const auth = await resolveNewsroomAutomationAuth(process.env);
  const insecureApiTls = readBoolean("YCC_NEWSROOM_API_TLS_INSECURE", false);
  const autoPublish = readBoolean("YCC_DAILY_NEWSROOM_AUTO_PUBLISH", false);
  const sourceLimit = readInt("YCC_DAILY_NEWSROOM_SOURCE_LIMIT", 3, 1, officialCigarNewsSources.length);
  const maxDraftAttempts = readInt(
    "YCC_DAILY_NEWSROOM_MAX_ATTEMPTS",
    3,
    1,
    Math.max(1, Math.ceil(officialCigarNewsSources.length / sourceLimit)),
  );
  const sourceBatches = buildDailyCigarFlowSourceBatches(sourceLimit, maxDraftAttempts);

  console.log(
    `Auth ready: ${auth.source === "cognito_password" ? `fresh Cognito token for ${auth.username}` : "bearer token from env"}${
      auth.expiresAt ? ` (expires ${auth.expiresAt})` : ""
    }`,
  );

  const draftUrl = `${baseUrl}/news/story-drafts`;
  let draftResult: NewsStoryDraftResponse | null = null;
  let lastDraftError: unknown = null;
  let publishImages: NewsStoryImage[] = [];

  for (const [index, sourceBatch] of sourceBatches.entries()) {
    const storyImages = buildDailyCigarFlowStoryImages(sourceBatch.sourceUrls);
    const draftInput = buildDailyCigarFlowDraftInput(sourceBatch, storyImages);
    console.log(`Draft attempt ${index + 1}/${sourceBatches.length}: ${sourceBatch.sourceNames.join(", ")}`);

    try {
      draftResult = await postJson<NewsStoryDraftResponse>(draftUrl, draftInput, auth.authorizationHeader, insecureApiTls);
      if (isPlaceholderNewsBodyMarkdown(draftResult.draft.bodyMarkdown)) {
        throw new Error("Draft generation returned placeholder scaffold copy instead of a real story.");
      }
      publishImages = selectSourceAlignedStoryImages(draftResult.draft.images, draftInput.sourceUrls, storyImages);
      break;
    } catch (error) {
      lastDraftError = error;
      if (index + 1 < sourceBatches.length && isRetriableDraftGenerationError(error)) {
        console.warn(
          `Draft attempt ${index + 1} did not produce publication-ready copy. Retrying with the next official source batch.`,
        );
        continue;
      }
      throw error;
    }
  }

  if (!draftResult) {
    throw lastDraftError instanceof Error ? lastDraftError : new Error("Draft generation failed without a usable response.");
  }

  console.log(
    `Draft generated: ${draftResult.draft.title} (${draftResult.prompt?.acceptedSourceCount ?? "n/a"} source(s) accepted)`,
  );

  if (!autoPublish) {
    console.log("Auto-publish is disabled. Draft was generated only.");
    return;
  }

  const publishPayload = {
    ...draftResult.draft,
    images: publishImages,
    operatorApproved: true,
    publishStatus: "published",
    status: "published",
  };

  const publishResult = await postJson<NewsStoryPublishResponse>(`${baseUrl}/news/stories`, publishPayload, auth.authorizationHeader, insecureApiTls);
  console.log(`Published: ${publishResult.story.title} (${publishResult.story.slug})`);
  console.log(`Persistence: ${publishResult.persistence.status}/${publishResult.persistence.table}`);
}

function buildDailyCigarFlowDraftInput(sourceBatch: DailyCigarFlowSourceBatch, storyImages: NewsStoryImage[]) {
  const sourceUrls = uniqueStrings([...sourceBatch.sourceUrls, ...cigarPressReleaseSearchSources.map((source) => source.url)]);
  const searchSourceNames = cigarPressReleaseSearchSources.map((source) => source.publisher).join(", ");
  const searchQueries = cigarPressReleaseSearchSources.map((source) => `"${source.searchQuery}"`).join(", ");

  return {
    angle: `Daily cigar flow press releases update - ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/Phoenix",
    }).format(new Date())}`,
    timeframe: "today",
    audience: "Adult Yuzu Cigar Club members of legal tobacco age",
    sourceUrls,
    sourceNotes: [
      `Automated daily flow draft run from approved source set: ${sourceBatch.sourceNames.join(", ")}.`,
      `Daily cigar press-release search: search ${searchSourceNames} for ${searchQueries} to find source-safe leads to write stories on. Treat search pages as discovery surfaces and draft only from primary release, wire, or official maker pages.`,
    ],
    ...(storyImages.length ? { storyImages } : {}),
  };
}

function buildDailyCigarFlowSourceBatches(sourceLimit: number, maxAttempts: number): DailyCigarFlowSourceBatch[] {
  const rankedSources = rankDailyCigarFlowSources(officialCigarNewsSources);
  const batches: DailyCigarFlowSourceBatch[] = [];

  for (let start = 0; start < rankedSources.length && batches.length < maxAttempts; start += sourceLimit) {
    const sources = rankedSources.slice(start, start + sourceLimit);
    const sourceUrls = sources.map((source) => source.url).filter((sourceUrl, index, list) => list.indexOf(sourceUrl) === index);

    if (sourceUrls.length) {
      batches.push({
        sourceNames: sources.map((source) => source.name),
        sourceUrls,
      });
    }
  }

  return batches;
}

function rankDailyCigarFlowSources(sources: readonly OfficialCigarNewsSource[]) {
  return [...sources].sort((left, right) => getDailySourceScore(right) - getDailySourceScore(left));
}

function getDailySourceScore(source: OfficialCigarNewsSource) {
  const url = source.url.toLowerCase();
  if (/\/(news|press|fratello-news|categoria-news)(\/|$)|prnewswire\.com/.test(url)) {
    return 2;
  }
  if (/news|press|release/.test(url)) {
    return 1;
  }
  return 0;
}

function buildDailyCigarFlowStoryImages(sourceUrls: readonly string[], limit = 3): NewsStoryImage[] {
  // Only seed source-aligned card images. Unrelated static Cigar Flow art is worse than no image.
  return cigarFlowItems
    .filter((item) => item.kind !== "member" && isHttpUrl(item.image) && isHttpUrl(item.href))
    .filter((item) => isSourceAlignedUrl(item.href, sourceUrls))
    .slice(0, limit)
    .map((item) => ({
      label: item.title,
      image: item.image,
      imagePosition: item.imagePosition,
      alt: `${item.title} story image`,
      sourceUrl: item.href,
    }));
}

function selectSourceAlignedStoryImages(
  draftImages: NewsStoryImage[] | undefined,
  sourceUrls: readonly string[],
  fallbackImages: NewsStoryImage[],
) {
  const alignedDraftImages = (draftImages ?? []).filter((image) => isHttpUrl(image.image) && isSourceAlignedUrl(image.sourceUrl ?? "", sourceUrls));

  return alignedDraftImages.length ? alignedDraftImages : fallbackImages;
}

async function postJson<TResponse>(url: string, body: unknown, token: string, insecureTls: boolean): Promise<TResponse> {
  const init = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  } satisfies RequestInit;

  const response = insecureTls ? await postJsonWithInsecureTls(url, init) : await fetch(url, init);

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> | null;

  if (!response.ok) {
    throw new JsonHttpError(response.status, payload);
  }

  return payload as TResponse;
}

async function postJsonWithInsecureTls(url: string, init: RequestInit) {
  const target = new URL(url);
  const requestImpl = target.protocol === "https:" ? httpsRequest : httpRequest;
  const headers: OutgoingHttpHeaders | undefined = init.headers ? Object.fromEntries(new Headers(init.headers)) : undefined;

  return await new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve, reject) => {
    const request = requestImpl(
      target,
      {
        method: init.method || "POST",
        headers,
        ...(target.protocol === "https:" ? { rejectUnauthorized: false } : {}),
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300,
            status: response.statusCode || 500,
            async json() {
              try {
                return text ? JSON.parse(text) : {};
              } catch {
                return {};
              }
            },
          });
        });
      },
    );

    request.on("error", reject);

    if (typeof init.body === "string" || Buffer.isBuffer(init.body)) {
      request.write(init.body);
    } else if (init.body) {
      request.write(String(init.body));
    }

    request.end();
  });
}

class JsonHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: Record<string, unknown> | null,
  ) {
    const message = typeof payload?.message === "string" ? payload.message : `Request failed with status ${status}.`;
    super(`${status}: ${message}`);
    this.name = "JsonHttpError";
  }

  get code() {
    return typeof this.payload?.error === "string" ? this.payload.error : "";
  }
}

function isRetriableDraftGenerationError(error: unknown) {
  if (error instanceof JsonHttpError) {
    return error.status >= 500 && (error.code === "news_story_generation_failed" || /publication-ready story draft/i.test(error.message));
  }

  return error instanceof Error && /placeholder scaffold copy/i.test(error.message);
}

function resolveRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function readBoolean(name: string, defaultValue: boolean) {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.trim().toLowerCase() === "true";
}

function readInt(name: string, defaultValue: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.min(Math.max(parsed, min), max);
}

function isHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

function isSourceAlignedUrl(value: string, sourceUrls: readonly string[]) {
  const hostname = getHostname(value);

  return Boolean(hostname) && sourceUrls.some((sourceUrl) => hostnamesOverlap(hostname, getHostname(sourceUrl)));
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostnamesOverlap(left: string, right: string) {
  return Boolean(left && right && (left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`)));
}

function uniqueStrings(values: readonly string[]) {
  return values.filter((value, index, list) => list.indexOf(value) === index);
}

runDailyCigarFlow().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[daily-cigar-news-run] ${error.message}`);
  } else {
    console.error("[daily-cigar-news-run] Unexpected error:", error);
  }
  process.exitCode = 1;
});
