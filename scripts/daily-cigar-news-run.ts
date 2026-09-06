import { request as httpRequest, type OutgoingHttpHeaders } from "node:http";
import { request as httpsRequest } from "node:https";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { cigarFlowItems, cigarFlowSources, cigarPressReleaseSearchSources } from "../src/lib/cigar-flow";
import { resolveNewsroomAutomationAuth } from "../src/lib/newsroom-automation-auth";
import {
  isPlaceholderNewsBodyMarkdown,
  isSpecificNewsSourceUrl,
  canonicalizeNewsUrl,
  canonicalNewsImageKey,
  normalizeNewsSourceCandidate,
  officialCigarNewsSources,
  type NewsSourceNote,
  type NewsStoryImage,
} from "../src/lib/newsroom";

type NewsStoryDraftResponse = {
  draft: {
    title: string;
    dek: string;
    category: string;
    bodyMarkdown: string;
    images?: NewsStoryImage[];
    sourceNotes?: NewsSourceNote[];
    sections: Array<{ heading: string; body: string }>;
  };
  prompt?: {
    acceptedSourceCount?: number;
  };
  story?: { id: string; slug: string; status: string };
  persistence?: { status: string; table?: string };
};

type NewsStoryPublishResponse = {
  story: { title: string; slug: string; status: string };
  deduplicated?: boolean;
  persistence: { status: string; table: string };
};

type PublishedNewsStoriesResponse = {
  stories: Array<{
    id?: string;
    slug?: string;
    title?: string;
    publishedAt?: string | null;
    leadUrls?: string[];
    officialSources?: string[];
    sourceNotes?: Array<{ url?: string }>;
  }>;
};

type OfficialCigarNewsSource = (typeof officialCigarNewsSources)[number];

type DailyCigarFlowSourceBatch = {
  sourceNames: string[];
  sourceUrls: string[];
};

type DailyCigarFlowRssFeed = {
  name: string;
  feedUrl: string;
};

type DailyCigarFlowRssLead = {
  sourceName: string;
  title: string;
  link: string;
  publishedAt: string | null;
};

type DailyCigarFlowSourceEvidence = {
  sourceUrl: string;
  title: string;
  publishedAt?: string;
  note: string;
  image: NewsStoryImage | null;
  linkedArticles?: Array<{ url: string; title: string }>;
};

const defaultRenderableStoryImageHosts = [
  "swwest.com",
  "halfwheel.com",
  "cigardojo.com",
  "classroom2.s3.us-east-1.amazonaws.com",
  "yuzucigarclub.com",
  "www.yuzucigarclub.com",
  ...officialCigarNewsSources.map((source) => source.domain),
];

const storyImageProbeTimeoutMs = 4_000;
const defaultStoryImagePosition = "50% 50%";
const rssLeadFetchTimeoutMs = 7_000;
const sourceEvidenceFetchTimeoutMs = 8_000;
const apiRequestTimeoutMs = 15_000;
const draftRequestTimeoutMs = 28_000;
const draftSourceInputLimit = 12;

export async function runDailyCigarFlow(options: { collectSourceEvidence?: typeof collectDailyCigarFlowSourceEvidence } = {}) {
  const baseUrl = resolveRequiredEnv("NEXT_PUBLIC_YCC_API_BASE_URL");
  const insecureApiTls = readBoolean("YCC_NEWSROOM_API_TLS_INSECURE", false);
  const autoPublish = readBoolean("YCC_DAILY_NEWSROOM_AUTO_PUBLISH", false);
  const runNow = resolveDailyRunNow();
  const runDate = getPhoenixDate(runNow);
  const stableSlug = buildDailyCigarFlowPublishSlug("", runDate);
  const existingStories = readBoolean("YCC_DAILY_NEWSROOM_DEDUPE_PREFLIGHT", true)
    ? await getJson<PublishedNewsStoriesResponse>(`${baseUrl}/news/stories?limit=50`, insecureApiTls)
    : { stories: [] };

  if (!readBoolean("YCC_DAILY_NEWSROOM_FORCE_RERUN", false) && existingStories.stories.some((story) => story.slug === stableSlug)) {
    console.log(`No action: ${stableSlug} is already published.`);
    await writeDailyRunReport("already_published", `${stableSlug} is already published.`, { runDate });
    return;
  }

  const seenLeadUrls = collectPublishedLeadUrlKeys(existingStories.stories);
  const rssLeads = (await collectDailyCigarFlowRssLeads(runNow)).filter((lead) => !seenLeadUrls.has(canonicalizeNewsUrl(lead.link)));
  if (readBoolean("YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS", true) && !rssLeads.length) {
    console.log("No action: no fresh, unprocessed RSS leads passed the recency and canonical-URL checks.");
    await writeDailyRunReport("no_fresh_leads", "The feeds were checked, but no fresh, unprocessed leads were available. No draft or publication was created.", { runDate });
    return;
  }

  const auth = await resolveNewsroomAutomationAuth(process.env);
  const sourceLimit = readInt("YCC_DAILY_NEWSROOM_SOURCE_LIMIT", 3, 1, officialCigarNewsSources.length);
  const maxDraftAttempts = readInt(
    "YCC_DAILY_NEWSROOM_MAX_ATTEMPTS",
    3,
    1,
    Math.max(1, Math.ceil(officialCigarNewsSources.length / sourceLimit)),
  );
  const sourceBatches = buildDailyCigarFlowSourceBatches(sourceLimit, maxDraftAttempts, rssLeads, runDate);

  console.log(
    `Auth ready: ${auth.source === "cognito_password" ? `fresh Cognito token for ${auth.username}` : "bearer token from env"}${
      auth.expiresAt ? ` (expires ${auth.expiresAt})` : ""
    }`,
  );
  console.log(
    rssLeads.length
      ? `Fresh RSS leads pulled: ${rssLeads.length} (${rssLeads.map((lead) => lead.sourceName).join(", ")})`
      : "Fresh RSS leads pulled: 0; continuing only because fresh-lead enforcement is disabled.",
  );

  const draftUrl = `${baseUrl}/news/story-drafts`;
  let draftResult: NewsStoryDraftResponse | null = null;
  let lastDraftError: unknown = null;
  let publishImages: NewsStoryImage[] = [];
  let publishSourceNotes: NewsSourceNote[] = [];
  let draftSourceEvidence: DailyCigarFlowSourceEvidence[] = [];
  let draftedLeads: DailyCigarFlowRssLead[] = [];
  let qualifiedBatchCount = 0;

  for (const [index, sourceBatch] of sourceBatches.entries()) {
    const fetchSourceEvidence = readBoolean("YCC_DAILY_NEWSROOM_FETCH_SOURCE_EVIDENCE", true);
    const sourceEvidence = fetchSourceEvidence
      ? await (options.collectSourceEvidence ?? collectDailyCigarFlowSourceEvidence)(sourceBatch.sourceUrls, runNow, { rssLeads })
      : [];
    if (readBoolean("YCC_DAILY_NEWSROOM_REQUIRE_SOURCE_EVIDENCE", true) && !sourceEvidence.length) {
      console.warn(`Draft attempt ${index + 1}/${sourceBatches.length}: no retrievable, specific primary announcement matched the current leads; trying the next batch.`);
      continue;
    }
    const verifiedSourceBatch = fetchSourceEvidence
      ? { ...sourceBatch, sourceUrls: sourceEvidence.map((evidence) => evidence.sourceUrl) }
      : sourceBatch;
    const sourceMatchedLeads = fetchSourceEvidence
      ? matchDailyCigarFlowEvidenceLeads(rssLeads, sourceEvidence)
      : rssLeads;
    if (readBoolean("YCC_DAILY_NEWSROOM_REQUIRE_FRESH_LEADS", true) && !sourceMatchedLeads.length) {
      console.warn(`Draft attempt ${index + 1}/${sourceBatches.length}: the primary evidence did not match a fresh discovery lead; trying the next batch.`);
      continue;
    }
    qualifiedBatchCount += 1;
    const storyImages = mergeDailyStoryImages(
      sourceEvidence.map((evidence) => evidence.image).filter((image): image is NewsStoryImage => Boolean(image)),
      buildDailyCigarFlowStoryImages(verifiedSourceBatch.sourceUrls),
    );
    const draftInput = buildDailyCigarFlowDraftInput(verifiedSourceBatch, storyImages, sourceMatchedLeads, runDate, sourceEvidence);
    console.log(`Draft attempt ${index + 1}/${sourceBatches.length}: ${sourceBatch.sourceNames.join(", ")}`);

    try {
      const candidateDraftResult = await postJson<NewsStoryDraftResponse>(draftUrl, draftInput, auth.authorizationHeader, insecureApiTls, draftRequestTimeoutMs);
      if (isPlaceholderNewsBodyMarkdown(candidateDraftResult.draft.bodyMarkdown)) {
        throw new Error("Draft generation returned placeholder scaffold copy instead of a real story.");
      }
      assertDailyDraftDateConsistency(candidateDraftResult.draft.title, runDate);
      publishImages = await selectSourceAlignedStoryImages(candidateDraftResult.draft.images, draftInput.sourceUrls, storyImages);
      publishSourceNotes = buildDailyCigarFlowPublishSourceNotes(
        candidateDraftResult.draft.sourceNotes,
        fetchSourceEvidence ? sourceEvidence.map((evidence) => evidence.sourceUrl) : sourceBatch.sourceUrls,
      );
      draftSourceEvidence = sourceEvidence;
      draftedLeads = sourceMatchedLeads;
      draftResult = candidateDraftResult;
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
    if (!qualifiedBatchCount) {
      const message = "No specific primary announcement could be retrieved and matched to the discovery leads. An editor must supply primary evidence before drafting; no AI draft or publication was created.";
      console.warn(message);
      await writeDailyRunReport("no_verified_primary_sources", message, { runDate });
      return;
    }
    throw lastDraftError instanceof Error ? lastDraftError : new Error("Draft generation failed without a usable response.");
  }

  console.log(
    `Draft generated: ${draftResult.draft.title} (${draftResult.prompt?.acceptedSourceCount ?? "n/a"} source(s) accepted)`,
  );
  const savedDraft = draftResult.story;
  if (draftResult.persistence?.status !== "stored" || !savedDraft?.id || !savedDraft.slug || savedDraft.status !== "draft") {
    throw new Error(`Draft was generated but not durably saved to the newsroom approval inbox (${draftResult.persistence?.status || "unknown"}; story status: ${savedDraft?.status || "missing"}).`);
  }
  console.log(`Draft saved in newsroom: ${savedDraft.slug} (${savedDraft.id})`);
  const artifact = await writeDailyDraftArtifact(
    runDate,
    runNow,
    { ...draftResult.draft, images: publishImages, sourceNotes: publishSourceNotes },
    rssLeads,
    draftSourceEvidence,
    draftedLeads,
    savedDraft,
  );

  if (!autoPublish) {
    console.log("Auto-publish is disabled. The saved draft is awaiting approval in the newsroom.");
    await writeDailyRunReport("draft_ready_for_review", `Draft ${savedDraft.slug} was durably saved and is awaiting approval in the newsroom. An editor must verify the source claims, imagery, and final revision before publishing. The public feed was not updated.`, { runDate, ...artifact });
    return;
  }

  if (!readBoolean("YCC_DAILY_NEWSROOM_OPERATOR_APPROVED", false)) {
    throw new Error("Auto-publish requires YCC_DAILY_NEWSROOM_OPERATOR_APPROVED=true after a human reviews the final draft revision.");
  }

  if (!publishSourceNotes.length) {
    throw new Error("Auto-publish requires at least one draft-returned, specific official source note from the requested source set.");
  }

  const minimumImages = readInt("YCC_DAILY_NEWSROOM_MIN_PUBLISH_IMAGES", 1, 0, 6);
  if (publishImages.length < minimumImages) {
    throw new Error(`Auto-publish requires at least ${minimumImages} verified source-aligned image(s); received ${publishImages.length}.`);
  }

  const publishPayload = {
    ...draftResult.draft,
    slug: stableSlug,
    automationDate: runDate,
    dedupeKey: `daily-cigar-flow:${runDate}`,
    leadUrls: draftedLeads.map((lead) => canonicalizeNewsUrl(lead.link)).filter(Boolean),
    images: publishImages,
    sourceNotes: publishSourceNotes,
    operatorApproved: true,
    publishStatus: "published",
    status: "published",
  };

  const publishResult = await postJson<NewsStoryPublishResponse>(`${baseUrl}/news/stories`, publishPayload, auth.authorizationHeader, insecureApiTls);
  if (publishResult.persistence?.status !== "stored") {
    throw new Error(`Publish was not durably stored (${publishResult.persistence?.status || "unknown"}).`);
  }
  if (publishResult.deduplicated) {
    console.log(`No action: verified source evidence is already attached to ${publishResult.story.slug}; no duplicate was created.`);
    await writeDailyRunReport("deduplicated", `The API matched an existing publication (${publishResult.story.slug}); no duplicate was created.`, { runDate, ...artifact });
    return;
  }
  console.log(`Published: ${publishResult.story.title} (${publishResult.story.slug})`);
  console.log(`Persistence: ${publishResult.persistence.status}/${publishResult.persistence.table}`);

  if (readBoolean("YCC_DAILY_NEWSROOM_VERIFY_PUBLISHED", true)) {
    await verifyDailyCigarFlowRuntimeFreshness(baseUrl, publishResult.story.slug, runDate, insecureApiTls);
  }
  await writeDailyRunReport("published", `The API durably stored ${publishResult.story.slug}.`, { runDate, ...artifact });
}

async function writeDailyDraftArtifact(
  runDate: string,
  runNow: Date,
  draft: NewsStoryDraftResponse["draft"],
  rssLeads: readonly DailyCigarFlowRssLead[],
  sourceEvidence: readonly DailyCigarFlowSourceEvidence[],
  draftedLeads: readonly DailyCigarFlowRssLead[],
  savedDraft: NonNullable<NewsStoryDraftResponse["story"]>,
) {
  const outputPath = resolve(process.env.YCC_DAILY_NEWSROOM_DRAFT_OUTPUT_PATH || `output/cigar-flow-drafts/${runDate}.json`);
  const warnings = [
    ...(!draft.images?.length ? ["No source-aligned images passed the renderability checks. Select and verify appropriate editorial images before publication."] : []),
    ...(!draft.sourceNotes?.length ? ["No returned source notes matched the retrieved official evidence."] : []),
    ...(draft.sourceNotes?.length && !draft.sourceNotes.some((note) => isSpecificNewsSourceUrl(note.url))
      ? ["The source notes cite only home or index pages. Verify each news claim against a specific primary announcement."]
      : []),
    ...(!/^##\s+\S/m.test(draft.bodyMarkdown) ? ["The draft has no section headings for the Cigar Flow article layout."] : []),
  ];
  const review = {
    operatorReviewRequired: true,
    sourceClaimsVerified: false,
    verifiedImageCount: draft.images?.length ?? 0,
    matchedSourceNoteCount: draft.sourceNotes?.length ?? 0,
    warnings,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ generatedAt: runNow.toISOString(), runDate, draft, savedDraft, discoveryLeads: rssLeads, draftedLeads, sourceEvidence, review }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Draft artifact: ${outputPath}`);
  return { draftPath: outputPath, draftId: savedDraft.id, draftSlug: savedDraft.slug, reviewWarnings: warnings };
}

async function writeDailyRunReport(
  outcome: "already_published" | "no_fresh_leads" | "no_verified_primary_sources" | "draft_ready_for_review" | "deduplicated" | "published" | "failed",
  message: string,
  details: { runDate?: string; draftPath?: string; draftId?: string; draftSlug?: string; reviewWarnings?: string[] } = {},
) {
  const outputPath = resolve(process.env.YCC_DAILY_NEWSROOM_RUN_STATUS_OUTPUT_PATH || "output/cigar-flow-run-status.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ completedAt: new Date().toISOString(), outcome, message, ...details }, null, 2)}\n`, "utf8");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const escapeMarkdown = (value: string) => value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!);
    const lines = [
      "## Cigar Flow run result",
      "",
      `**Outcome: ${outcome.replaceAll("_", " ")}**`,
      "",
      escapeMarkdown(message),
      ...(details.runDate ? ["", `Phoenix edition date: ${details.runDate}.`] : []),
      ...(details.draftSlug ? ["", `Saved newsroom draft: ${escapeMarkdown(details.draftSlug)} (ID: ${escapeMarkdown(details.draftId || "unknown")}).`] : []),
      ...(details.draftPath ? ["", "Download the draft and run-status files from this run's artifact to review the source evidence and editorial checks."] : []),
      ...(details.reviewWarnings?.length ? ["", ...details.reviewWarnings.map((warning) => `- ${escapeMarkdown(warning)}`)] : []),
      "",
    ];
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, "utf8");
  }
}

export function buildDailyCigarFlowDraftInput(
  sourceBatch: DailyCigarFlowSourceBatch,
  storyImages: NewsStoryImage[],
  rssLeads: readonly DailyCigarFlowRssLead[],
  runDate: string,
  sourceEvidence: readonly DailyCigarFlowSourceEvidence[] = [],
) {
  const sourceUrls = uniqueStrings([...sourceBatch.sourceUrls, ...cigarPressReleaseSearchSources.map((source) => source.url)]);
  const evidenceNotes = sourceEvidence.map((evidence) => evidence.note);
  if (evidenceNotes.length >= draftSourceInputLimit) {
    throw new Error(`Daily drafting has ${evidenceNotes.length} primary evidence notes, exceeding the ${draftSourceInputLimit - 1} available slots. Reduce the source batch; primary evidence cannot be dropped.`);
  }
  if (sourceUrls.length > draftSourceInputLimit) {
    throw new Error(`Daily drafting has ${sourceUrls.length} source URLs, exceeding the API limit of ${draftSourceInputLimit}. Reduce the source batch.`);
  }
  const guidanceNote = [
    "Daily cigar press-release search: use the supplied wire pages only as discovery to find primary evidence to write stories on.",
    "Cigar Flow editorial format: use ## headings and 3-6 real source-aligned story images.",
    "For image web/source-page search, return label, image, imagePosition, alt, sourceUrl. Do not invent image URLs or facts.",
    "Draft only from the retrieved primary evidence; RSS headlines are discovery context.",
  ].join(" ");
  // Evidence has priority. Every matched discovery URL remains in leadUrls;
  // only the optional secondary-headline notes use the remaining API slots.
  const rssLeadNotes = rssLeads.slice(0, Math.min(8, draftSourceInputLimit - 1 - evidenceNotes.length)).map(formatRssLeadNote);

  return {
    angle: `Daily cigar flow press releases update - ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${runDate}T00:00:00.000Z`))}`,
    timeframe: "today",
    audience: "Adult Yuzu Cigar Club members of legal tobacco age",
    sourceUrls,
    leadUrls: rssLeads.map((lead) => canonicalizeNewsUrl(lead.link)).filter(Boolean),
    sourceNotes: [
      guidanceNote,
      ...evidenceNotes,
      ...rssLeadNotes,
    ],
    ...(storyImages.length ? { storyImages } : {}),
  };
}

function buildDailyCigarFlowSourceBatches(
  sourceLimit: number,
  maxAttempts: number,
  rssLeads: readonly DailyCigarFlowRssLead[] = [],
  runDate = getPhoenixDate(),
): DailyCigarFlowSourceBatch[] {
  const rankedSources = rankDailyCigarFlowSources(officialCigarNewsSources, rssLeads, runDate);
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

function rankDailyCigarFlowSources(
  sources: readonly OfficialCigarNewsSource[],
  rssLeads: readonly DailyCigarFlowRssLead[] = [],
  runDate = getPhoenixDate(),
) {
  return [...sources].sort((left, right) => {
    const scoreDifference = getDailySourceScore(right, rssLeads) - getDailySourceScore(left, rssLeads);
    return scoreDifference || dailyRotationRank(left, runDate) - dailyRotationRank(right, runDate) || left.name.localeCompare(right.name);
  });
}

function dailyRotationRank(source: OfficialCigarNewsSource, runDate: string) {
  let hash = 2166136261;
  for (const character of `${runDate}:${source.domain}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getDailySourceScore(source: OfficialCigarNewsSource, rssLeads: readonly DailyCigarFlowRssLead[] = []) {
  const url = source.url.toLowerCase();
  const matchingLeadIndex = rssLeads.findIndex((lead) => sourceMatchesRssLead(source, lead));
  const rssScore = matchingLeadIndex >= 0 ? 100 - matchingLeadIndex : 0;

  if (/\/(news|press|fratello-news|categoria-news)(\/|$)|prnewswire\.com/.test(url)) {
    return rssScore + 2;
  }
  if (/news|press|release/.test(url)) {
    return rssScore + 1;
  }
  return rssScore;
}

function buildDailyCigarFlowStoryImages(sourceUrls: readonly string[], limit = 3): NewsStoryImage[] {
  // Only seed source-aligned card images. Unrelated static Cigar Flow art is worse than no image.
  return cigarFlowItems
    .filter((item) => isHttpUrl(item.image) && isHttpUrl(item.href))
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

function mergeDailyStoryImages(...groups: readonly NewsStoryImage[][]) {
  const seen = new Set<string>();
  return groups
    .flat()
    .filter((image) => {
      const key = canonicalNewsImageKey(image.image);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

export async function collectDailyCigarFlowSourceEvidence(
  sourceUrls: readonly string[],
  runNow: Date,
  options: { rssLeads?: readonly DailyCigarFlowRssLead[]; fetchImpl?: typeof fetch } = {},
): Promise<DailyCigarFlowSourceEvidence[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const results = await Promise.allSettled(sourceUrls.map((sourceUrl) => fetchDailyCigarFlowSourceEvidence(sourceUrl, runNow, fetchImpl)));
  const landingEvidence = results.flatMap((result, index) => {
    if (result.status === "fulfilled" && result.value) {
      return [result.value];
    }
    const reason = result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : "empty source page";
    console.warn(`Skipping official source evidence ${sourceUrls[index]}: ${reason}.`);
    return [];
  });
  const maxAgeHours = readInt("YCC_DAILY_NEWSROOM_RSS_MAX_AGE_HOURS", 72, 1, 720);
  const maxFutureSkewHours = readInt("YCC_DAILY_NEWSROOM_RSS_MAX_FUTURE_SKEW_HOURS", 6, 0, 48);
  const isCurrentPrimaryEvidence = (evidence: DailyCigarFlowSourceEvidence) => {
    if (!isPrimaryAnnouncementUrl(evidence.sourceUrl)) return false;
    if (isFreshPublicationDate(evidence.publishedAt, runNow, maxAgeHours, maxFutureSkewHours)) return true;
    console.warn(`Skipping primary announcement ${evidence.sourceUrl}: publication date ${evidence.publishedAt || "missing"} is not within the fresh-source window.`);
    return false;
  };
  const directEvidence = landingEvidence.filter(isCurrentPrimaryEvidence);
  const candidates = uniqueStrings(landingEvidence.flatMap((evidence) => {
    if (isSpecificNewsSourceUrl(evidence.sourceUrl)) return [];
    return (evidence.linkedArticles ?? [])
      .map((article) => ({ ...article, relevance: primaryArticleLeadRelevance(article, options.rssLeads ?? []) }))
      .filter((article) => article.relevance >= 2)
      .sort((left, right) => right.relevance - left.relevance || left.url.localeCompare(right.url))
      .slice(0, 3)
      .map((article) => article.url);
  }));
  const articleResults = await Promise.allSettled(candidates.map((url) => fetchDailyCigarFlowSourceEvidence(url, runNow, fetchImpl)));
  const specificEvidence = articleResults.flatMap((result, index) => {
    if (result.status === "fulfilled" && result.value && isCurrentPrimaryEvidence(result.value)) return [result.value];
    console.warn(`Skipping primary announcement ${candidates[index]}: the page could not be retrieved as a specific source.`);
    return [];
  });
  const seen = new Set<string>();
  return [...directEvidence, ...specificEvidence].filter((evidence) => {
    const key = canonicalizeNewsUrl(evidence.sourceUrl);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((evidence) => ({ sourceUrl: evidence.sourceUrl, title: evidence.title, publishedAt: evidence.publishedAt, note: evidence.note, image: evidence.image }));
}

export function matchDailyCigarFlowEvidenceLeads(leads: readonly DailyCigarFlowRssLead[], evidence: readonly DailyCigarFlowSourceEvidence[]) {
  return leads.filter((lead) => evidence.some((source) => primaryArticleLeadRelevance({ url: source.sourceUrl, title: source.title }, [lead]) >= 2));
}

function primaryArticleLeadRelevance(article: { url: string; title: string }, leads: readonly DailyCigarFlowRssLead[]) {
  const tokenize = (value: string) => (value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map((token) => token === "boxes" ? "box" : token === "counts" ? "count" : token);
  const ignoredTokens = new Set([
    "cigar", "cigars", "with", "from", "this", "that", "their", "the", "and", "for", "its", "new", "company", "family", "brand", "brands", "trading", "tobacco", "news",
    "launch", "launches", "announces", "announcement", "release", "releases", "ships", "shipping", "shifts", "arrives", "coming", "introduces", "update",
    ...officialCigarNewsSources.flatMap((source) => tokenize(source.name)),
  ]);
  const articleTokens = new Set(tokenize(`${article.title} ${new URL(article.url).pathname}`));
  return Math.max(0, ...leads.map((lead) => {
    const tokens = [...new Set(tokenize(lead.title))].filter((token) => !ignoredTokens.has(token) && (token.length >= 3 || /^\d+$/.test(token)));
    const matched = tokens.filter((token) => articleTokens.has(token));
    return matched.length >= 2 && matched.length / tokens.length >= 0.5 ? matched.length : 0;
  }));
}

function extractPrimaryArticleLinks(html: string, sourceUrl: string) {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    const url = resolvePageUrl(decodeXmlText(match[1]), sourceUrl);
    if (!url || !isSourceAlignedUrl(url, [sourceUrl]) || !isPrimaryAnnouncementUrl(url)) return [];
    return [{ url: canonicalizeNewsUrl(url), title: decodeXmlText(match[2]) }];
  });
}

function isPrimaryAnnouncementUrl(value: string) {
  if (!isSpecificNewsSourceUrl(value)) return false;
  const parsed = new URL(value);
  return parsed.protocol === "https:" && !parsed.username && !parsed.password
    && /(?:news|press|blog|announcement|launch|introduc|release|campaign)/i.test(parsed.pathname)
    && !/\/(?:cigars?|products?|shop|store|collections?|cart|checkout|tag|category|page|contact|privacy|terms)(?:\/|$)|\.(?:jpg|png|webp|pdf|zip)$/i.test(parsed.pathname);
}

function findExplicitSecondaryArticleRepost(html: string, sourceUrl: string) {
  const content = (html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html).replace(/<(script|style|nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  for (const match of content.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = decodeXmlText(match[2].replace(/&nbsp;|&#160;/gi, " "));
    if (!/^(?:(?:view|read)\s+(?:the\s+)?(?:(?:full|original)\s+)?article(?:\s+here)?|original\s+article)\s*[.!:»→]*$/i.test(label)) continue;
    const url = resolvePageUrl(decodeXmlText(match[1]), sourceUrl);
    if (url && normalizeNewsSourceCandidate(url).status === "blocked_secondary") return url;
  }
  return null;
}

async function fetchDailyCigarFlowSourceEvidence(sourceUrl: string, runNow: Date, fetchImpl: typeof fetch = fetch): Promise<DailyCigarFlowSourceEvidence | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), sourceEvidenceFetchTimeoutMs);

  try {
    const response = await fetchImpl(sourceUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
        "user-agent": "Yuzu Cigar Flow official-source monitor/2.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!/(?:text\/html|application\/xhtml\+xml|text\/plain)/.test(contentType)) {
      throw new Error(`unsupported content type ${contentType || "unknown"}`);
    }
    if (!hostnamesOverlap(getHostname(sourceUrl), getHostname(response.url || sourceUrl))) {
      throw new Error(`redirected outside the configured official domain to ${response.url}`);
    }

    const html = await response.text();
    const resolvedSourceUrl = response.url || sourceUrl;
    const secondaryArticle = findExplicitSecondaryArticleRepost(html, resolvedSourceUrl);
    if (secondaryArticle) {
      throw new Error(`official page explicitly points to a secondary article repost (${secondaryArticle}); original primary evidence is required`);
    }
    const title = extractHtmlMetadata(html, "title") || extractHtmlTitle(html) || getHostname(sourceUrl);
    const publishedAt = extractPrimaryPublicationDate(html);
    const description = extractHtmlMetadata(html, "description");
    const pageText = decodeXmlText(
      html
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer\b[\s\S]*?<\/footer>/gi, " "),
    ).slice(0, 1800);
    const excerpt = cleanDailySourceNoteText([description, pageText].filter(Boolean).join(" "), 2000);
    if (excerpt.length < 80) {
      return null;
    }

    const imageUrl = resolvePageUrl(extractHtmlMetadata(html, "og:image") || extractHtmlMetadata(html, "twitter:image"), resolvedSourceUrl);
    return {
      sourceUrl: resolvedSourceUrl,
      title,
      ...(publishedAt ? { publishedAt } : {}),
      note: `Primary publication date: ${publishedAt || "unverified"}. Retrieved official-source evidence at ${runNow.toISOString()} from ${title} (${resolvedSourceUrl}): ${excerpt}`,
      linkedArticles: extractPrimaryArticleLinks(html, resolvedSourceUrl),
      image: imageUrl
        ? {
            label: title,
            image: imageUrl,
            imagePosition: defaultStoryImagePosition,
            alt: `${title} official source image`,
            sourceUrl: resolvedSourceUrl,
          }
        : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractPrimaryPublicationDate(html: string) {
  const dates: string[] = ["article:published_time", "datePublished", "pubdate", "publish-date", "publication_date"]
    .map((key) => extractHtmlMetadata(html, key)).filter(Boolean);
  const readStructuredArticle = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(readStructuredArticle);
    } else if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
      if (types.some((type) => typeof type === "string" && /(?:^|\/)(?:Article|NewsArticle|BlogPosting)$/i.test(type)) && typeof item.datePublished === "string") dates.push(item.datePublished);
      if (item["@graph"]) readStructuredArticle(item["@graph"]);
      if (item.mainEntity) readStructuredArticle(item.mainEntity);
    }
  };
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { readStructuredArticle(JSON.parse(match[1])); } catch { /* Invalid structured data is not publication evidence. */ }
  }
  const content = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  for (const match of content.matchAll(/<time\b([^>]*)>([\s\S]*?)<\/time>/gi)) {
    if (/modified|updated/i.test(`${match[1]} ${decodeXmlText(match[2])}`) || !/pubdate|published|publication/i.test(`${match[1]} ${decodeXmlText(match[2])}`)) continue;
    const value = match[1].match(/\bdatetime\s*=\s*["']([^"']+)["']/i)?.[1];
    if (value) dates.push(value);
  }
  // Ignore modified timestamps and ambiguous partial dates. If explicit publication
  // fields disagree, retain the oldest date rather than making an old article fresh.
  return dates.filter((value) => /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value.trim()))
    .map((value) => Date.parse(value)).filter(Number.isFinite).sort((left, right) => left - right)
    .map((value) => new Date(value).toISOString())[0];
}

function extractHtmlMetadata(html: string, key: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escapedKey}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escapedKey}["'][^>]*>`, "i"),
  ];
  return decodeXmlText(patterns.map((pattern) => html.match(pattern)?.[1] || "").find(Boolean) || "");
}

function extractHtmlTitle(html: string) {
  return decodeXmlText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function resolvePageUrl(value: string, baseUrl: string) {
  if (!value) {
    return "";
  }
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

async function selectSourceAlignedStoryImages(
  draftImages: NewsStoryImage[] | undefined,
  sourceUrls: readonly string[],
  fallbackImages: NewsStoryImage[],
) {
  const alignedDraftImages = (draftImages ?? []).filter((image) => isHttpUrl(image.image) && isSourceAlignedUrl(image.sourceUrl ?? "", sourceUrls));

  const renderableDraftImages = await filterRenderableStoryImages(alignedDraftImages);
  if (renderableDraftImages.length) {
    return renderableDraftImages;
  }

  if (alignedDraftImages.length && fallbackImages.length) {
    console.warn("No renderable draft story images remained after validation. Checking source-seeded fallback images.");
  }

  return filterRenderableStoryImages(fallbackImages);
}

async function filterRenderableStoryImages(images: NewsStoryImage[]) {
  const renderableImages: NewsStoryImage[] = [];

  for (const image of images) {
    const normalizedImage = {
      ...image,
      imagePosition: normalizeStoryImagePosition(image.imagePosition),
    };
    const validation = await validateRenderableStoryImage(normalizedImage);

    if (validation.ok) {
      renderableImages.push(normalizedImage);
    } else {
      console.warn(`Skipping Cigar Flow story image "${normalizedImage.label}": ${validation.reason}.`);
    }
  }

  return renderableImages;
}

async function validateRenderableStoryImage(image: NewsStoryImage) {
  if (!isAllowedRenderableStoryImageUrl(image.image)) {
    return {
      ok: false,
      reason: "image host is not allowed by the deployed site image policy",
    };
  }

  const headResult = await probeImageUrl(image.image, "HEAD");
  if (headResult.ok) {
    return headResult;
  }

  return probeImageUrl(image.image, "GET");
}

async function probeImageUrl(url: string, method: "HEAD" | "GET") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), storyImageProbeTimeoutMs);

  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      ...(method === "GET" ? { headers: { range: "bytes=0-2047" } } : {}),
    });
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok && response.status !== 206) {
      return {
        ok: false,
        reason: `image probe returned HTTP ${response.status}`,
      };
    }

    if (!contentType.toLowerCase().startsWith("image/")) {
      return {
        ok: false,
        reason: `image probe returned non-image content type ${contentType || "unknown"}`,
      };
    }

    return { ok: true, reason: "" };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "image probe failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isAllowedRenderableStoryImageUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    const hostname = parsedUrl.hostname.toLowerCase();
    const localHost = isLocalhost(hostname);

    if (parsedUrl.protocol !== "https:" && !(parsedUrl.protocol === "http:" && localHost)) {
      return false;
    }

    return localHost || getRenderableStoryImageHosts().has(hostname);
  } catch {
    return false;
  }
}

function getRenderableStoryImageHosts() {
  return new Set(
    [...defaultRenderableStoryImageHosts, ...(process.env.YCC_DAILY_NEWSROOM_ALLOWED_IMAGE_HOSTS || "").split(",")]
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isLocalhost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");
}

function normalizeStoryImagePosition(value: string | undefined) {
  const position = (value || "").trim().toLowerCase();

  if (/^(100|[1-9]?\d)%\s+(100|[1-9]?\d)%$/.test(position)) {
    return position;
  }

  if (/^(center|top|bottom|left|right)(\s+(center|top|bottom|left|right))?$/.test(position)) {
    return position;
  }

  return defaultStoryImagePosition;
}

function buildDailyCigarFlowPublishSourceNotes(
  draftNotes: NewsSourceNote[] | undefined,
  retrievedEvidenceUrls: readonly string[],
): NewsSourceNote[] {
  const allowedSourceUrls = new Set(retrievedEvidenceUrls.map(canonicalizeNewsUrl).filter(Boolean));
  return uniqueNewsSourceNotes(normalizeDailyPublishSourceNotes(draftNotes)).filter(
    (note) => note.sourceType === "official" && allowedSourceUrls.has(canonicalizeNewsUrl(note.url)),
  );
}

async function collectDailyCigarFlowRssLeads(now = new Date()): Promise<DailyCigarFlowRssLead[]> {
  const leadLimit = readInt("YCC_DAILY_NEWSROOM_RSS_LEAD_LIMIT", 8, 0, 20);
  if (leadLimit <= 0) {
    return [];
  }

  const feeds = getDailyCigarFlowRssFeeds();
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchTextWithTimeout(feed.feedUrl, rssLeadFetchTimeoutMs);
      return parseDailyCigarFlowRssLeads(xml, feed);
    }),
  );
  const leads = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    console.warn(`Skipping Cigar Flow RSS feed "${feeds[index]?.name ?? "unknown"}": ${result.reason instanceof Error ? result.reason.message : String(result.reason)}.`);
    return [];
  });
  if (!results.some((result) => result.status === "fulfilled")) {
    throw new Error("RSS discovery failed: no configured feed could be read. This is an upstream failure, not a no-news day.");
  }

  const maxAgeHours = readInt("YCC_DAILY_NEWSROOM_RSS_MAX_AGE_HOURS", 72, 1, 720);
  const maxFutureSkewHours = readInt("YCC_DAILY_NEWSROOM_RSS_MAX_FUTURE_SKEW_HOURS", 6, 0, 48);
  return uniqueRssLeads(
    leads
      .filter((lead) => isFreshRssLead(lead, now, maxAgeHours, maxFutureSkewHours))
      .sort((left, right) => rssLeadTimestamp(right) - rssLeadTimestamp(left)),
  )
    .slice(0, leadLimit);
}

function getDailyCigarFlowRssFeeds(): DailyCigarFlowRssFeed[] {
  const configuredFeeds = (process.env.YCC_DAILY_NEWSROOM_RSS_FEEDS || "")
    .split(",")
    .map((feedUrl) => feedUrl.trim())
    .filter(Boolean);

  if (configuredFeeds.length) {
    return configuredFeeds.map((feedUrl) => ({
      name: getHostname(feedUrl) || "Configured RSS feed",
      feedUrl,
    }));
  }

  return cigarFlowSources
    .filter((source) => isHttpUrl(source.feedUrl))
    .map((source) => ({
      name: source.publisher,
      feedUrl: source.feedUrl,
    }));
}

async function fetchTextWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "user-agent": "Yuzu Cigar Flow newsroom lead scanner/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const text = await response.text();
    const looksLikeFeed = /<(?:rss|feed|rdf:RDF)\b/i.test(text) && /<\/(?:rss|feed|rdf:RDF)\s*>/i.test(text);
    if (!looksLikeFeed || (contentType.includes("text/html") && !/<(?:rss|feed|rdf:RDF)\b/i.test(text))) {
      throw new Error(`response is not an RSS or Atom feed (${contentType || "unknown content type"})`);
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function parseDailyCigarFlowRssLeads(xml: string, feed: DailyCigarFlowRssFeed): DailyCigarFlowRssLead[] {
  return [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)]
    .map((match) => {
      const entry = match[0];
      const title = cleanDailySourceNoteText(getXmlTagText(entry, "title"), 220);
      const link = normalizeRssLink(getXmlTagText(entry, "link") || getAtomLinkHref(entry), feed.feedUrl);
      const publishedAt = normalizeRssDate(
        getXmlTagText(entry, "pubDate") || getXmlTagText(entry, "published") || getXmlTagText(entry, "updated"),
      );

      return title && link
        ? {
            sourceName: feed.name,
            title,
            link,
            publishedAt,
          }
        : null;
    })
    .filter((lead): lead is DailyCigarFlowRssLead => Boolean(lead));
}

function getXmlTagText(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return decodeXmlText(match?.[1] || "");
}

function getAtomLinkHref(xml: string) {
  const alternateLink = [...xml.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => !/\brel\s*=\s*["'](?:self|hub)["']/i.test(tag));
  const href = alternateLink?.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'>]+))/i);
  return decodeXmlText(href?.[1] || href?.[2] || href?.[3] || "");
}

function normalizeRssLink(value: string, feedUrl: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return canonicalizeNewsUrl(new URL(trimmed, feedUrl).toString());
  } catch {
    return "";
  }
}

function normalizeRssDate(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function decodeXmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)]]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueRssLeads(leads: readonly DailyCigarFlowRssLead[]) {
  const seen = new Set<string>();

  return leads.filter((lead) => {
    const key = canonicalizeNewsUrl(lead.link) || lead.title.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isFreshRssLead(lead: DailyCigarFlowRssLead, now: Date, maxAgeHours: number, maxFutureSkewHours: number) {
  return isFreshPublicationDate(lead.publishedAt, now, maxAgeHours, maxFutureSkewHours);
}

function isFreshPublicationDate(publishedAt: string | null | undefined, now: Date, maxAgeHours: number, maxFutureSkewHours: number) {
  if (!publishedAt) {
    return false;
  }

  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const ageMs = now.getTime() - timestamp;
  return ageMs <= maxAgeHours * 60 * 60 * 1000 && ageMs >= -maxFutureSkewHours * 60 * 60 * 1000;
}

function rssLeadTimestamp(lead: DailyCigarFlowRssLead) {
  return lead.publishedAt ? Date.parse(lead.publishedAt) || 0 : 0;
}

function sourceMatchesRssLead(source: OfficialCigarNewsSource, lead: DailyCigarFlowRssLead) {
  const text = `${lead.title} ${lead.link}`.toLowerCase();
  return sourceMatchTokens(source).some((token) => text.includes(token));
}

function sourceMatchTokens(source: OfficialCigarNewsSource) {
  const domainToken = source.domain.split(".")[0]?.replace(/cigars?$/i, "") || "";
  const nameTokens = source.name
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !["cigar", "cigars", "company", "brand", "leaf"].includes(token));

  return uniqueStrings([source.name.toLowerCase(), domainToken.toLowerCase(), ...nameTokens].filter(Boolean));
}

function formatRssLeadNote(lead: DailyCigarFlowRssLead) {
  const date = lead.publishedAt ? lead.publishedAt.slice(0, 10) : "undated";
  return `Current RSS lead from ${lead.sourceName} (${date}): ${lead.title} - ${lead.link}. Treat this as discovery context only; verify against primary official, company, event, regulator, or wire sources before drafting.`;
}

function buildDailyCigarFlowPublishSlug(title: string, runDate: string) {
  void title;
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(runDate)) {
    throw new Error(`Invalid daily Cigar Flow run date: ${runDate}.`);
  }
  return `daily-cigar-flow-${runDate}`;
}

function getPhoenixDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Phoenix",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function resolveDailyRunNow() {
  const configured = process.env.YCC_DAILY_NEWSROOM_NOW?.trim();
  if (!configured) {
    return new Date();
  }

  const date = new Date(configured);
  if (Number.isNaN(date.getTime())) {
    throw new Error("YCC_DAILY_NEWSROOM_NOW must be a valid ISO date/time.");
  }
  return date;
}

function collectPublishedLeadUrlKeys(stories: PublishedNewsStoriesResponse["stories"]) {
  return new Set(
    stories
      .flatMap((story) => [
        ...(story.leadUrls ?? []),
        ...(story.sourceNotes ?? []).map((note) => note.url || ""),
      ])
      .map((url) => canonicalizeNewsUrl(url))
      .filter(Boolean),
  );
}

function assertDailyDraftDateConsistency(title: string, runDate: string) {
  const expectedYear = runDate.slice(0, 4);
  const titleYears = [...title.matchAll(/\b(20\d{2})\b/g)].map((match) => match[1]);
  const mismatchedYear = titleYears.find((year) => year !== expectedYear);
  if (mismatchedYear) {
    throw new Error(`Draft title contains stale year ${mismatchedYear}; the daily run date is ${runDate}.`);
  }
}

function normalizeDailyPublishSourceNotes(value: unknown): NewsSourceNote[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): NewsSourceNote | null => {
      const record = typeof item === "string" ? { url: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : null;

      if (!record) {
        return null;
      }

      const source = normalizeNewsSourceCandidate(String(record.url || ""));
      if (!source.url) {
        return null;
      }

      return {
        label: cleanDailySourceNoteText(record.label, 80) || source.domain || "Source",
        url: source.url,
        note: cleanDailySourceNoteText(record.note, 320) || source.reviewNote,
        sourceType: source.sourceType,
        domain: source.domain,
        reviewNote: source.reviewNote,
      };
    })
    .filter((source): source is NewsSourceNote => Boolean(source));
}

function uniqueNewsSourceNotes(notes: readonly NewsSourceNote[]) {
  const seen = new Set<string>();

  return notes.filter((note) => {
    if (!isHttpUrl(note.url)) {
      return false;
    }

    const key = canonicalizeNewsUrl(note.url);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function cleanDailySourceNoteText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function postJson<TResponse>(url: string, body: unknown, token: string, insecureTls: boolean, timeoutMs = apiRequestTimeoutMs): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const init = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  } satisfies RequestInit;

  try {
    const response = insecureTls ? await postJsonWithInsecureTls(url, init, timeoutMs) : await fetch(url, init);

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> | null;

    if (!response.ok) {
      throw new JsonHttpError(response.status, payload);
    }

    return payload as TResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function getJson<TResponse>(url: string, insecureTls: boolean): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), apiRequestTimeoutMs);
  const init = {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    signal: controller.signal,
  } satisfies RequestInit;

  try {
    const response = insecureTls ? await requestJsonWithInsecureTls(url, init) : await fetch(url, init);
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> | null;

    if (!response.ok) {
      throw new JsonHttpError(response.status, payload);
    }

    return payload as TResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function postJsonWithInsecureTls(url: string, init: RequestInit, timeoutMs: number) {
  return requestJsonWithInsecureTls(url, init, timeoutMs);
}

async function requestJsonWithInsecureTls(url: string, init: RequestInit, timeoutMs = apiRequestTimeoutMs) {
  const target = new URL(url);
  const requestImpl = target.protocol === "https:" ? httpsRequest : httpRequest;
  const headers: OutgoingHttpHeaders | undefined = init.headers ? Object.fromEntries(new Headers(init.headers)) : undefined;

  return await new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve, reject) => {
    const request = requestImpl(
      target,
      {
        method: init.method || "POST",
        headers,
        signal: init.signal ?? undefined,
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
    request.setTimeout(timeoutMs, () => request.destroy(new Error(`Request timed out after ${timeoutMs} ms.`)));

    if (typeof init.body === "string" || Buffer.isBuffer(init.body)) {
      request.write(init.body);
    } else if (init.body) {
      request.write(String(init.body));
    }

    request.end();
  });
}

async function verifyDailyCigarFlowRuntimeFreshness(
  baseUrl: string,
  publishedSlug: string,
  runDate: string,
  insecureTls: boolean,
) {
  if (!publishedSlug.includes(`daily-cigar-flow-${runDate}`)) {
    throw new Error(`Published Cigar Flow slug "${publishedSlug}" does not include today's date ${runDate}.`);
  }

  const response = await getJson<PublishedNewsStoriesResponse>(`${baseUrl}/news/stories?limit=3`, insecureTls);
  const topStory = response.stories?.[0];

  if (!topStory) {
    throw new Error("Runtime freshness check failed: /news/stories returned no published stories after publish.");
  }

  if (topStory.slug !== publishedSlug) {
    throw new Error(
      `Runtime freshness check failed: live feed top story is "${topStory.slug || "unknown"}" instead of newly published "${publishedSlug}".`,
    );
  }

  console.log(`Runtime freshness verified: ${topStory.title || publishedSlug} is the top live Cigar Flow story.`);
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runDailyCigarFlow().catch(async (error: unknown) => {
  if (error instanceof Error) {
    console.error(`[daily-cigar-news-run] ${error.message}`);
  } else {
    console.error("[daily-cigar-news-run] Unexpected error:", error);
  }
  await writeDailyRunReport("failed", error instanceof Error ? error.message : "Unexpected daily newsroom failure.").catch((reportError: unknown) => {
    console.error("[daily-cigar-news-run] Failed to save the run report:", reportError instanceof Error ? reportError.message : String(reportError));
  });
  process.exitCode = 1;
});
