import { request as httpRequest, type OutgoingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";

import { resolveNewsroomAutomationAuth } from "../src/lib/newsroom-automation-auth";
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
  const auth = await resolveNewsroomAutomationAuth(process.env);
  const insecureApiTls = readBoolean("YCC_NEWSROOM_API_TLS_INSECURE", false);
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

  console.log(
    `Auth ready: ${auth.source === "cognito_password" ? `fresh Cognito token for ${auth.username}` : "bearer token from env"}${
      auth.expiresAt ? ` (expires ${auth.expiresAt})` : ""
    }`,
  );

  const draftResult = await postJson<NewsStoryDraftResponse>(`${baseUrl}/news/story-drafts`, draftInput, auth.authorizationHeader, insecureApiTls);
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

  const publishResult = await postJson<NewsStoryPublishResponse>(`${baseUrl}/news/stories`, publishPayload, auth.authorizationHeader, insecureApiTls);
  console.log(`Published: ${publishResult.story.title} (${publishResult.story.slug})`);
  console.log(`Persistence: ${publishResult.persistence.status}/${publishResult.persistence.table}`);
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
    const message = typeof payload?.message === "string" ? payload.message : `Request failed with status ${response.status}.`;
    const error = new Error(`${response.status}: ${message}`);
    throw error;
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
