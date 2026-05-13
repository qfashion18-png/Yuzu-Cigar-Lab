import { isPlaceholderNewsBodyMarkdown, officialCigarNewsSources } from "../src/lib/newsroom";

type NewsStoryDraftResponse = {
  draft: {
    title: string;
    dek: string;
    category: string;
    bodyMarkdown: string;
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

async function runDailyCigarFlow() {
  const baseUrl = resolveRequiredEnv("NEXT_PUBLIC_YCC_API_BASE_URL");
  const authToken = resolveRequiredEnv("YCC_NEWSROOM_BEARER_TOKEN");
  const autoPublish = readBoolean("YCC_DAILY_NEWSROOM_AUTO_PUBLISH", false);
  const sourceLimit = readInt("YCC_DAILY_NEWSROOM_SOURCE_LIMIT", 3, 1, officialCigarNewsSources.length);
  const sourceUrls = officialCigarNewsSources
    .slice(0, sourceLimit)
    .map((source) => source.url)
    .filter((sourceUrl, index, list) => list.indexOf(sourceUrl) === index);

  const draftInput = {
    angle: `Daily cigar flow update - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" }).format(
      new Date(),
    )}`,
    timeframe: "today",
    audience: "Adult Yuzu Cigar Club members of legal tobacco age",
    sourceUrls,
    sourceNotes: ["Automated daily flow draft run from approved source set."],
  };

  const draftResult = await postJson<NewsStoryDraftResponse>(`${baseUrl}/news/story-drafts`, draftInput, authToken);
  console.log(
    `Draft generated: ${draftResult.draft.title} (${draftResult.prompt?.acceptedSourceCount ?? "n/a"} source(s) accepted)`,
  );

  if (isPlaceholderNewsBodyMarkdown(draftResult.draft.bodyMarkdown)) {
    throw new Error("Draft generation returned placeholder scaffold copy instead of a real story.");
  }

  if (!autoPublish) {
    console.log("Auto-publish is disabled. Draft was generated only.");
    return;
  }

  const publishPayload = {
    ...draftResult.draft,
    operatorApproved: true,
    publishStatus: "published",
    status: "published",
  };

  const publishResult = await postJson<NewsStoryPublishResponse>(`${baseUrl}/news/stories`, publishPayload, authToken);
  console.log(`Published: ${publishResult.story.title} (${publishResult.story.slug})`);
  console.log(`Persistence: ${publishResult.persistence.status}/${publishResult.persistence.table}`);
}

async function postJson<TResponse>(url: string, body: unknown, token: string): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> | null;

  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : `Request failed with status ${response.status}.`;
    const error = new Error(`${response.status}: ${message}`);
    throw error;
  }

  return payload as TResponse;
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

runDailyCigarFlow().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(`[daily-cigar-news-run] ${error.message}`);
  } else {
    console.error("[daily-cigar-news-run] Unexpected error:", error);
  }
  process.exitCode = 1;
});
