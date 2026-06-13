import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

type NewsSourceNote = {
  label: string;
  url: string;
  note?: string;
  sourceType?: string;
  domain?: string;
  reviewNote?: string;
};

type NewsStoryImage = {
  label: string;
  image: string;
  imagePosition?: string;
  alt?: string;
  sourceUrl?: string;
};

type NewsStory = {
  id?: string;
  slug: string;
  title: string;
  dek: string;
  category: string;
  bodyMarkdown: string;
  images?: NewsStoryImage[];
  sourceNotes?: NewsSourceNote[];
  officialSources?: string[];
  status?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

type PublishedNewsStoriesResponse = {
  stories: NewsStory[];
  persistence?: string;
};

type ImageSearchTarget = {
  label: string;
  url: string;
  source: "story_image" | "story_image_source_page" | "source_note" | "official_source" | "inferred_source_page" | "local_cache";
  localPath?: string;
  alt?: string;
  sourcePageUrl?: string;
};

type MarkdownSection = {
  heading: string;
  body: string;
};

export type ImageSearchCandidate = {
  label: string;
  sourcePageUrl: string;
  imageUrl: string;
  alt?: string;
  width?: number;
  height?: number;
  score: number;
  reasons: string[];
  status: "candidate" | "downloaded" | "skipped" | "failed";
  statusReason?: string;
  localPath?: string;
};

type FacebookCredentials = {
  pageId: string;
  pageName?: string;
  pageAccessToken: string;
  graphVersion: string;
};

type CigarFlowFacebookOptions = {
  apiBaseUrl: string;
  targetDate?: string;
  storySlug?: string;
  storyLimit: number;
  outputDir: string;
  imageLimit: number;
  publishPage: boolean;
  dryRun: boolean;
  force: boolean;
  pageId?: string;
  pageAccessToken?: string;
  systemUserToken?: string;
  secretId?: string;
  awsRegion: string;
  graphVersion: string;
  graphBaseUrl: string;
  baseUrl: string;
  allowLocalCache: boolean;
};

type SocialPostRunResult = {
  story: NewsStory;
  outputDir: string;
  captionPath: string;
  groupKitPath: string;
  imageSearchPath: string;
  manifestPath: string;
  selectedImages: ImageSearchCandidate[];
  pagePost?: FacebookPagePostResult;
  groupStatus: {
    status: "kit_created";
    reason: string;
  };
};

type FacebookPagePostResult = {
  status: "dry_run" | "published" | "skipped_existing" | "no_action";
  postId?: string;
  permalinkUrl?: string;
  uploadedPhotos?: Array<{ image: string; photoId: string; postId?: string | null }>;
  existingManifestPath?: string;
  reason?: string;
};

type GraphPhotoResponse = {
  id?: string;
  post_id?: string;
  error?: unknown;
};

type GraphFeedResponse = {
  id?: string;
  error?: unknown;
};

type GraphReadbackResponse = {
  id?: string;
  permalink_url?: string;
  message?: string;
  status_type?: string;
};

const defaultOutputRoot = "output/social";
const defaultGraphVersion = "v25.0";
const adultComplianceClose =
  "Adults 21+ only. Editorial education and culture coverage.";
let insecureTlsRetryEnabled = process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";

const blockedCaptionPatterns = [
  /\bbuy\b/i,
  /\border\b/i,
  /\bsale\b/i,
  /\bdiscount\b/i,
  /\bcoupon\b/i,
  /\bpromo\b/i,
  /\bfree\b/i,
  /\bfreebie\b/i,
  /\bgiveaway\b/i,
  /\bsample\b/i,
  /\bdeal\b/i,
  /\bclearance\b/i,
  /\bin stock\b/i,
  /\bavailable now\b/i,
  /\bdm to order\b/i,
  /\blowest price\b/i,
  /\bships nationwide\b/i,
  /\bpricing\b/i,
  /\binventory\b/i,
  /\bmarketplace\b/i,
  /\bsafer\b/i,
  /\bhealthy\b/i,
  /\blow-risk\b/i,
  /\bmedicinal\b/i,
  /\btherapeutic\b/i,
];

const inferredImageSourceHints = [
  {
    pattern: /oliva[\s\S]{0,120}serie\s+v[\s\S]{0,80}maduro|serie\s+v[\s\S]{0,80}maduro[\s\S]{0,120}oliva/i,
    label: "Oliva Serie V Maduro",
    url: "https://olivacigar.com/cigars/serie-v-maduro/",
  },
  {
    pattern: /perdomo[\s\S]{0,120}(anniversary|reserve)|perdomo[\s\S]{0,120}(20th|25th)/i,
    label: "Perdomo 20th Anniversary",
    url: "https://www.perdomocigars.com/20th-anniversary",
  },
  {
    pattern: /foundation[\s\S]{0,160}(wise\s+man|maduro|serie|1926)|foundation\s+cigar\s+company/i,
    label: "Foundation Wise Man Maduro",
    url: "https://foundationcigarcompany.com/the-wise-man-maduro/",
  },
];

const localCacheHints = [
  {
    pattern: /oliva|serie\s+v/i,
    label: "Oliva Serie V Maduro cached research image",
    localPath: "public/assets/news/researched/oliva-serie-v-maduro.jpg",
  },
  {
    pattern: /perdomo/i,
    label: "Perdomo 20th Anniversary cached research image",
    localPath: "public/assets/news/researched/perdomo-20th-anniversary-maduro.jpg",
  },
  {
    pattern: /foundation|wise\s+man/i,
    label: "Foundation Wise Man Maduro cached research image",
    localPath: "public/assets/news/researched/foundation-wise-man-maduro.jpg",
  },
];

export async function runCigarFlowFacebookSocial(options: Partial<CigarFlowFacebookOptions> = {}): Promise<SocialPostRunResult> {
  const normalizedOptions = normalizeOptions(options);
  await mkdir(normalizedOptions.outputDir, { recursive: true });

  const story = await fetchTargetStory(normalizedOptions);
  const storyOutputDir = resolveOutputDir(normalizedOptions.outputDir, story, normalizedOptions.targetDate);
  await mkdir(storyOutputDir, { recursive: true });

  const caption = buildFacebookCaption(story, normalizedOptions.baseUrl);
  assertSocialCaptionCompliance(caption);

  const captionPath = join(storyOutputDir, "facebook-caption.txt");
  await writeFile(captionPath, caption, "utf8");

  const selectedImages = await findRelatedImagesForStory(story, storyOutputDir, normalizedOptions.imageLimit, {
    allowLocalCache: normalizedOptions.allowLocalCache,
  });
  if (selectedImages.length === 0) {
    throw new Error(`No related images could be found or downloaded for ${story.title}.`);
  }

  const imageSearchPath = join(storyOutputDir, "image-search-candidates.json");
  await writeFile(imageSearchPath, JSON.stringify(selectedImages, null, 2), "utf8");

  const groupKitPath = await writeGroupPostKit(story, storyOutputDir, caption, selectedImages, normalizedOptions.baseUrl);
  const manifestPath = join(storyOutputDir, "cigar-flow-facebook-social-manifest.json");

  let pagePost: FacebookPagePostResult | undefined;
  if (normalizedOptions.publishPage) {
    try {
      pagePost = await maybePublishPagePost(storyOutputDir, caption, selectedImages, normalizedOptions);
    } catch (error) {
      pagePost = {
        status: "no_action",
        reason: error instanceof Error ? error.message : "Page publish step failed before a post could be created.",
      };
    }
  } else {
    pagePost = {
      status: "dry_run",
      uploadedPhotos: selectedImages.map((image) => ({ image: image.localPath || image.imageUrl, photoId: "dry-run" })),
    };
  }

  const result: SocialPostRunResult = {
    story,
    outputDir: storyOutputDir,
    captionPath,
    groupKitPath,
    imageSearchPath,
    manifestPath,
    selectedImages,
    pagePost,
    groupStatus: {
      status: "kit_created",
      reason:
        "Meta removed normal Facebook Groups API publishing after the v19 Groups API deprecation; this automation creates a group-ready kit for browser/manual posting.",
    },
  };

  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        story: summarizeStory(story),
        caption_file: captionPath,
        image_search_file: imageSearchPath,
        selected_images: selectedImages,
        facebook_page: pagePost,
        facebook_group: result.groupStatus,
        group_kit_file: groupKitPath,
      },
      null,
      2,
    ),
    "utf8",
  );

  return result;
}

function normalizeOptions(options: Partial<CigarFlowFacebookOptions>): CigarFlowFacebookOptions {
  const targetDate = options.targetDate ?? readArgValue("--date") ?? process.env.YCC_CIGAR_FLOW_SOCIAL_DATE;
  const storySlug = options.storySlug ?? readArgValue("--story-slug") ?? process.env.YCC_CIGAR_FLOW_SOCIAL_STORY_SLUG;
  const outputDir = resolve(
    process.cwd(),
    options.outputDir ?? readArgValue("--output-dir") ?? process.env.YCC_CIGAR_FLOW_SOCIAL_OUTPUT_DIR ?? defaultOutputRoot,
  );
  const publishPage = options.publishPage ?? (hasArg("--publish-page") || process.env.YCC_CIGAR_FLOW_SOCIAL_PUBLISH_PAGE === "true");
  const dryRun = options.dryRun ?? (!publishPage || hasArg("--dry-run"));

  return {
    apiBaseUrl:
      options.apiBaseUrl ??
      readArgValue("--api-base-url") ??
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL ??
      "https://api.yuzucigarclub.com",
    targetDate,
    storySlug,
    storyLimit: options.storyLimit ?? readInt("YCC_CIGAR_FLOW_SOCIAL_STORY_LIMIT", 12, 1, 50),
    outputDir,
    imageLimit: options.imageLimit ?? readInt("YCC_CIGAR_FLOW_SOCIAL_IMAGE_LIMIT", 3, 1, 8),
    publishPage,
    dryRun,
    force: options.force ?? (hasArg("--force") || process.env.YCC_CIGAR_FLOW_SOCIAL_FORCE === "true"),
    pageId: options.pageId ?? readArgValue("--page-id") ?? process.env.YCC_FACEBOOK_PAGE_ID,
    pageAccessToken: options.pageAccessToken ?? process.env.YCC_FACEBOOK_PAGE_ACCESS_TOKEN,
    systemUserToken: options.systemUserToken ?? process.env.YCC_FACEBOOK_SYSTEM_USER_TOKEN,
    secretId:
      options.secretId ??
      readArgValue("--facebook-secret-id") ??
      process.env.YCC_FACEBOOK_SECRET_ID ??
      process.env.YCC_SOCIAL_FACEBOOK_SECRET_ID,
    awsRegion: options.awsRegion ?? process.env.AWS_REGION ?? "us-east-1",
    graphVersion: options.graphVersion ?? process.env.YCC_FACEBOOK_GRAPH_VERSION ?? defaultGraphVersion,
    graphBaseUrl: options.graphBaseUrl ?? process.env.YCC_FACEBOOK_GRAPH_BASE_URL ?? "https://graph.facebook.com",
    baseUrl: options.baseUrl ?? process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL ?? "https://www.yuzucigarclub.com",
    allowLocalCache: options.allowLocalCache ?? (hasArg("--allow-local-cache") || process.env.YCC_CIGAR_FLOW_SOCIAL_ALLOW_LOCAL_CACHE === "true"),
  };
}

async function fetchTargetStory(options: CigarFlowFacebookOptions) {
  const url = `${trimTrailingSlash(options.apiBaseUrl)}/news/stories?limit=${options.storyLimit}`;
  const response = await fetchWithTlsRetry(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch Cigar Flow stories from ${url}: HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as PublishedNewsStoriesResponse;
  const stories = Array.isArray(payload.stories) ? payload.stories : [];
  if (stories.length === 0) {
    throw new Error("No published Cigar Flow stories were returned by the live API.");
  }

  if (options.storySlug) {
    const story = stories.find((candidate) => candidate.slug === options.storySlug);
    if (!story) {
      throw new Error(`No published story matched slug ${options.storySlug}.`);
    }
    return story;
  }

  if (options.targetDate) {
    const story = stories.find((candidate) => storyMatchesDate(candidate, options.targetDate || ""));
    if (!story) {
      throw new Error(`No published story matched date ${options.targetDate}.`);
    }
    return story;
  }

  return stories[0];
}

function storyMatchesDate(story: NewsStory, targetDate: string) {
  if (story.publishedAt && story.publishedAt.slice(0, 10) === targetDate) {
    return true;
  }

  return story.slug.includes(targetDate) || normalizedDateTitle(story.title).includes(targetDate);
}

function normalizedDateTitle(title: string) {
  const months: Record<string, string> = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const match = title.toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/);
  if (!match) {
    return title.toLowerCase();
  }

  const month = months[match[1]];
  const day = match[2].padStart(2, "0");
  return `2026-${month}-${day}`;
}

function resolveOutputDir(rootDir: string, story: NewsStory, targetDate?: string) {
  const date = targetDate ?? story.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  return join(rootDir, `cigar-flow-facebook-${date}-${slugify(story.slug || story.title)}`);
}

export function buildFacebookCaption(story: NewsStory, baseUrl = "https://www.yuzucigarclub.com") {
  const detailLines = getStoryDetailLines(story)
    .slice(0, 4)
    .map((line) => `- ${line}`);
  const details = detailLines.length ? `\n\nInside this update:\n${detailLines.join("\n")}` : "";
  const title = stripMarkdown(story.title);
  const dek = stripMarkdown(story.dek || "A source-backed Cigar Flow update for adult readers.");
  const link = `${trimTrailingSlash(baseUrl)}/cigar-flow/#cigar-flow-news`;

  return [
    "Cigar Flow | Daily update",
    "",
    title,
    "",
    dek,
    details,
    "",
    `Read the Cigar Flow desk: ${link}`,
    "",
    "Which signal should we track deeper next?",
    "",
    adultComplianceClose,
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getStoryDetailLines(story: NewsStory) {
  const sectionLines = extractMarkdownSections(story.bodyMarkdown)
    .filter((section) => !isGenericStoryHeading(section.heading))
    .map(summarizeStorySection)
    .filter(Boolean);

  if (sectionLines.length) {
    return uniqueStrings(sectionLines);
  }

  return getStorySourceLabels(story);
}

function getStorySourceLabels(story: NewsStory) {
  const fromNotes = (story.sourceNotes ?? []).map((note) => cleanCaptionLine(note.label)).filter(Boolean);
  if (fromNotes.length) {
    return uniqueStrings(fromNotes);
  }

  const headings = extractMarkdownHeadings(story.bodyMarkdown).map(cleanCaptionLine).filter(Boolean);
  return uniqueStrings(headings);
}

function assertSocialCaptionCompliance(caption: string) {
  if (!caption.includes("21+")) {
    throw new Error("Facebook caption must include adult 21+ framing.");
  }

  for (const pattern of blockedCaptionPatterns) {
    if (pattern.test(caption)) {
      throw new Error(`Facebook caption contains blocked marketplace or health language: ${pattern.source}`);
    }
  }
}

export async function findRelatedImagesForStory(
  story: NewsStory,
  storyOutputDir: string,
  imageLimit = 3,
  options: { allowLocalCache?: boolean } = {},
) {
  const imageDir = join(storyOutputDir, "images");
  await mkdir(imageDir, { recursive: true });

  const allowLocalCache = options.allowLocalCache === true;
  const targets = buildImageSearchTargets(story, { allowLocalCache });
  const candidates: ImageSearchCandidate[] = [];

  for (const target of targets) {
    if (target.source === "story_image" && target.localPath) {
      const copied = await copyLocalCandidate(target, imageDir);
      if (copied) {
        candidates.push(copied);
      }
      continue;
    }

    if (target.source === "story_image" && isHttpUrl(target.url)) {
      candidates.push(buildDirectStoryImageCandidate(target));
      continue;
    }

    if (target.source === "local_cache" && target.localPath) {
      const copied = await copyLocalCandidate(target, imageDir);
      if (copied) {
        candidates.push(copied);
      }
      continue;
    }

    candidates.push(...(await searchSourcePageForImages(target, story)));
  }

  const downloaded: ImageSearchCandidate[] = [];
  const seenUrls = new Set<string>();
  const selectedLabels = new Set<string>();
  const orderedCandidates = candidates
    .filter((candidate) => candidate.status === "candidate" || candidate.status === "downloaded")
    .filter((candidate) => {
      const key = candidate.imageUrl.toLowerCase();
      if (seenUrls.has(key)) {
        return false;
      }
      seenUrls.add(key);
      return true;
    })
    .sort((left, right) => right.score - left.score);

  await downloadCandidatesUntil({
    orderedCandidates,
    imageDir,
    downloaded,
    imageLimit,
    selectedLabels,
    requireNewDomain: true,
    requireNewLabel: true,
  });

  await downloadCandidatesUntil({
    orderedCandidates,
    imageDir,
    downloaded,
    imageLimit,
    selectedLabels,
    requireNewDomain: false,
    requireNewLabel: false,
  });

  if (allowLocalCache && downloaded.length < imageLimit) {
    const cacheCandidates = await copyLocalCacheFallbacks(story, imageDir, imageLimit - downloaded.length, downloaded);
    downloaded.push(...cacheCandidates);
  }

  return downloaded.slice(0, imageLimit);
}

async function downloadCandidatesUntil({
  orderedCandidates,
  imageDir,
  downloaded,
  imageLimit,
  selectedLabels,
  requireNewDomain,
  requireNewLabel,
}: {
  orderedCandidates: readonly ImageSearchCandidate[];
  imageDir: string;
  downloaded: ImageSearchCandidate[];
  imageLimit: number;
  selectedLabels: Set<string>;
  requireNewDomain: boolean;
  requireNewLabel: boolean;
}) {
  const selectedUrls = new Set(downloaded.map((candidate) => candidate.imageUrl.toLowerCase()));
  const selectedDomains = new Set(downloaded.map((candidate) => candidateDomainKey(candidate)).filter(Boolean));

  for (const candidate of orderedCandidates) {
    if (downloaded.length >= imageLimit) {
      break;
    }

    if (selectedUrls.has(candidate.imageUrl.toLowerCase())) {
      continue;
    }

    const labelKey = slugify(candidate.label);
    if (requireNewLabel && selectedLabels.has(labelKey)) {
      continue;
    }

    const domainKey = candidateDomainKey(candidate);
    if (requireNewDomain && domainKey && selectedDomains.has(domainKey)) {
      continue;
    }

    const downloadedCandidate =
      candidate.status === "downloaded" && candidate.localPath ? candidate : await downloadImageCandidate(candidate, imageDir);
    if (downloadedCandidate.status === "downloaded") {
      downloaded.push(downloadedCandidate);
      selectedUrls.add(downloadedCandidate.imageUrl.toLowerCase());
      selectedLabels.add(labelKey);
      if (domainKey) {
        selectedDomains.add(domainKey);
      }
    }
  }
}

function buildImageSearchTargets(story: NewsStory, options: { allowLocalCache?: boolean } = {}): ImageSearchTarget[] {
  const targets: ImageSearchTarget[] = [];

  for (const image of story.images ?? []) {
    if (isLocalProjectPath(image.image)) {
      targets.push({
        label: image.label,
        url: image.image,
        source: "story_image",
        localPath: publicAssetToLocalPath(image.image),
        alt: image.alt,
        sourcePageUrl: image.sourceUrl,
      });
    } else if (isHttpUrl(image.image)) {
      targets.push({ label: image.label, url: image.image, source: "story_image", alt: image.alt, sourcePageUrl: image.sourceUrl });
      if (isHttpUrl(image.sourceUrl || "")) {
        targets.push({ label: image.label, url: image.sourceUrl!, source: "story_image_source_page", alt: image.alt, sourcePageUrl: image.sourceUrl });
      }
    }
  }

  for (const note of story.sourceNotes ?? []) {
    if (isHttpUrl(note.url)) {
      targets.push({ label: note.label || hostnameLabel(note.url), url: note.url, source: "source_note" });
    }
  }

  for (const sourceUrl of story.officialSources ?? []) {
    if (isHttpUrl(sourceUrl)) {
      targets.push({ label: hostnameLabel(sourceUrl), url: sourceUrl, source: "official_source" });
    }
  }

  const storyText = `${story.title}\n${story.dek}\n${story.bodyMarkdown}`;
  for (const hint of inferredImageSourceHints) {
    if (hint.pattern.test(storyText)) {
      targets.push({ label: hint.label, url: hint.url, source: "inferred_source_page" });
    }
  }

  if (options.allowLocalCache === true) {
    for (const hint of localCacheHints) {
      if (hint.pattern.test(storyText)) {
        targets.push({ label: hint.label, url: hint.localPath, source: "local_cache", localPath: hint.localPath });
      }
    }
  }

  return uniqueTargets(targets);
}

function buildDirectStoryImageCandidate(target: ImageSearchTarget): ImageSearchCandidate {
  return {
    label: target.label,
    sourcePageUrl: target.sourcePageUrl || target.url,
    imageUrl: target.url,
    alt: target.alt || target.label,
    score: 96,
    reasons: ["direct story image from published Cigar Flow payload"],
    status: "candidate",
  };
}

async function searchSourcePageForImages(target: ImageSearchTarget, story: NewsStory) {
  if (!isHttpUrl(target.url)) {
    return [];
  }

  const response = await fetchWithTlsRetry(target.url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "Yuzu Cigar Club social image search/1.0",
    },
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, text: async () => message } as Response;
  });

  if (!response.ok) {
    return [
      {
        label: target.label,
        sourcePageUrl: target.url,
        imageUrl: target.url,
        score: 0,
        reasons: [`source page fetch failed: HTTP ${response.status}`],
        status: "failed",
      } satisfies ImageSearchCandidate,
    ];
  }

  const html = await response.text();
  return extractImageCandidatesFromHtml(html, target, story);
}

export function extractImageCandidatesFromHtml(html: string, target: ImageSearchTarget, story: NewsStory) {
  const candidates: ImageSearchCandidate[] = [];
  const metaTags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);

  for (const tag of metaTags) {
    const attrs = parseHtmlAttributes(tag);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key !== "og:image" && key !== "og:image:secure_url" && key !== "twitter:image") {
      continue;
    }

    const imageUrl = normalizeImageUrl(attrs.content || "", target.url);
    if (!imageUrl) {
      continue;
    }

    candidates.push(scoreImageCandidate({ imageUrl, alt: target.label, target, story, width: parseOptionalInt(attrs.width), height: parseOptionalInt(attrs.height), source: "meta" }));
  }

  for (const tag of imgTags) {
    const attrs = parseHtmlAttributes(tag);
    const rawUrl = attrs["data-image"] || attrs["data-src"] || attrs.src || firstSrcsetUrl(attrs.srcset || "") || "";
    const imageUrl = normalizeImageUrl(rawUrl, target.url);
    if (!imageUrl) {
      continue;
    }

    const dimensions = parseDimensions(attrs["data-image-dimensions"]);
    candidates.push(
      scoreImageCandidate({
        imageUrl,
        alt: attrs.alt || target.label,
        target,
        story,
        width: parseOptionalInt(attrs.width) ?? dimensions?.width,
        height: parseOptionalInt(attrs.height) ?? dimensions?.height,
        source: "img",
      }),
    );
  }

  return candidates.filter((candidate) => candidate.score > 0);
}

function scoreImageCandidate({
  imageUrl,
  alt,
  target,
  story,
  width,
  height,
  source,
}: {
  imageUrl: string;
  alt?: string;
  target: ImageSearchTarget;
  story: NewsStory;
  width?: number;
  height?: number;
  source: "meta" | "img";
}): ImageSearchCandidate {
  const reasons: string[] = [];
  let score = source === "meta" ? 35 : 20;
  reasons.push(`${source} image on ${target.source.replaceAll("_", " ")}`);

  if (target.source === "story_image_source_page") {
    score += 28;
    reasons.push("exact story label searched on story source page");
  }

  const searchableText = `${imageUrl} ${alt || ""}`.toLowerCase();
  const normalizedSearchableText = searchableText.replace(/[%+_-]+/g, " ");
  const targetKeywords = keywordsFor(`${target.label} ${story.title} ${story.dek}`);
  const matchingKeywords = targetKeywords.filter((keyword) => searchableText.includes(keyword));
  if (matchingKeywords.length) {
    score += Math.min(35, matchingKeywords.length * 7);
    reasons.push(`matches keywords: ${matchingKeywords.slice(0, 5).join(", ")}`);
  }

  if (/\b(cigar|cigars|box|boxes|blend|wrapper|maduro|connecticut|corojo|habano|sumatra|reserve|serie|anniversary|robusto|toro)\b/i.test(normalizedSearchableText)) {
    score += 16;
    reasons.push("likely cigar or product visual");
  }

  if (/\b(tobacco\s+business|magazine|publication|newsletter|issue|cover|layers)\b/i.test(normalizedSearchableText)) {
    score -= 48;
    reasons.push("likely publication cover or editorial art");
  }

  if (width && height) {
    if (width >= 300 && height >= 300) {
      score += 20;
      reasons.push(`usable dimensions ${width}x${height}`);
    } else if (width < 120 || height < 120) {
      score -= 35;
      reasons.push(`too small ${width}x${height}`);
    }

    const aspectRatio = width / height;
    if (aspectRatio > 3.5 || aspectRatio < 0.25) {
      score -= 28;
      reasons.push(`awkward social aspect ratio ${aspectRatio.toFixed(2)}`);
    }
  }

  if (/\b(logo|icon|pixel|tracking|avatar|sprite|badge)\b/i.test(imageUrl)) {
    score -= 35;
    reasons.push("likely logo/icon/tracking asset");
  }

  if (/\b(bkgd|background)\b/i.test(imageUrl)) {
    score -= 20;
    reasons.push("likely decorative background asset");
  }

  const normalizedLabel = target.label.toLowerCase();
  if (normalizedLabel.includes("maduro") && /\bmaduro\b/i.test(imageUrl)) {
    score += 18;
    reasons.push("matches requested Maduro variant");
  }

  if (normalizedLabel.includes("maduro") && /\b(corojo|connecticut|sungrown|sun-grown|sun_grown)\b/i.test(imageUrl)) {
    score -= 45;
    reasons.push("different wrapper variant than requested Maduro signal");
  }

  if (!/\.(avif|jpe?g|png|webp)(\?|#|$)/i.test(imageUrl)) {
    score -= 20;
    reasons.push("unsupported or weak image extension");
  }

  if (score <= 0) {
    return {
      label: target.label,
      sourcePageUrl: target.url,
      imageUrl,
      alt,
      width,
      height,
      score,
      reasons,
      status: "skipped",
      statusReason: "candidate scored below threshold",
    };
  }

  return {
    label: target.label,
    sourcePageUrl: target.url,
    imageUrl,
    alt,
    width,
    height,
    score,
    reasons,
    status: "candidate",
  };
}

async function downloadImageCandidate(candidate: ImageSearchCandidate, imageDir: string): Promise<ImageSearchCandidate> {
  const response = await fetchWithTlsRetry(candidate.imageUrl, {
    headers: {
      accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
      "user-agent": "Yuzu Cigar Club social image search/1.0",
    },
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, status: 0, headers: new Headers(), arrayBuffer: async () => new TextEncoder().encode(message).buffer } as Response;
  });

  if (!response.ok) {
    return { ...candidate, status: "failed", statusReason: `image fetch failed: HTTP ${response.status}` };
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) {
    return { ...candidate, status: "skipped", statusReason: `not an image content type: ${contentType || "unknown"}` };
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 12_000) {
    return { ...candidate, status: "skipped", statusReason: `image file too small: ${bytes.length} bytes` };
  }

  const extension = extensionFromContentType(contentType) || extensionFromUrl(candidate.imageUrl) || ".jpg";
  const fileName = `${slugify(candidate.label)}-${hash(candidate.imageUrl).slice(0, 10)}${extension}`;
  const localPath = join(imageDir, fileName);
  await writeFile(localPath, bytes);

  return {
    ...candidate,
    status: "downloaded",
    localPath,
    statusReason: `downloaded ${bytes.length} bytes`,
  };
}

async function copyLocalCandidate(target: ImageSearchTarget, imageDir: string): Promise<ImageSearchCandidate | null> {
  if (!target.localPath) {
    return null;
  }

  const absoluteSource = resolve(process.cwd(), target.localPath);
  try {
    const sourceStat = await stat(absoluteSource);
    if (!sourceStat.isFile() || sourceStat.size < 12_000) {
      return null;
    }
  } catch {
    return null;
  }

  const extension = extname(absoluteSource) || ".jpg";
  const localPath = join(imageDir, `${slugify(target.label)}-${hash(absoluteSource).slice(0, 10)}${extension}`);
  await copyFile(absoluteSource, localPath);

  return {
    label: target.label,
    sourcePageUrl: target.localPath,
    imageUrl: target.localPath,
    score: 66,
    reasons: [`copied ${target.source.replaceAll("_", " ")} image from project cache`],
    status: "downloaded",
    localPath,
  };
}

async function copyLocalCacheFallbacks(
  story: NewsStory,
  imageDir: string,
  needed: number,
  existing: readonly ImageSearchCandidate[],
) {
  const storyText = `${story.title}\n${story.dek}\n${story.bodyMarkdown}`;
  const existingNames = new Set(existing.map((candidate) => basename(candidate.localPath || candidate.imageUrl).toLowerCase()));
  const copied: ImageSearchCandidate[] = [];

  for (const hint of localCacheHints) {
    if (copied.length >= needed) {
      break;
    }

    if (!hint.pattern.test(storyText)) {
      continue;
    }

    const candidate = await copyLocalCandidate({ label: hint.label, url: hint.localPath, localPath: hint.localPath, source: "local_cache" }, imageDir);
    if (!candidate) {
      continue;
    }

    const key = basename(candidate.localPath || candidate.imageUrl).toLowerCase();
    if (existingNames.has(key)) {
      continue;
    }

    candidate.reasons.push("fallback used after live source-page image search did not fill the requested image limit");
    copied.push(candidate);
  }

  return copied;
}

async function writeGroupPostKit(
  story: NewsStory,
  storyOutputDir: string,
  caption: string,
  selectedImages: readonly ImageSearchCandidate[],
  baseUrl: string,
) {
  const kitPath = join(storyOutputDir, "FACEBOOK-GROUP-POST-KIT.md");
  const imageLines = selectedImages.map((image, index) => `${index + 1}. ${image.localPath || image.imageUrl}`).join("\n");

  const content = `# Facebook Group Post Kit

Story: ${story.title}
Generated: ${new Date().toISOString()}

## Status

Group API publishing is intentionally not attempted. Meta removed normal Facebook Groups API publishing after the v19 Groups API deprecation, so this kit is the automation handoff for browser/manual group posting.

## Caption

\`\`\`text
${caption}
\`\`\`

## Images To Upload

${imageLines}

## Verification Checklist

- Caption includes 21+ framing.
- No marketplace, pricing, inventory, order, giveaway, sample, or health-claim language.
- Upload the images above as native group photos.
- After posting, record the group URL in this folder's manifest or the social calendar.

Source desk: ${trimTrailingSlash(baseUrl)}/cigar-flow/#cigar-flow-news
`;

  await writeFile(kitPath, content, "utf8");
  return kitPath;
}

async function maybePublishPagePost(
  storyOutputDir: string,
  caption: string,
  selectedImages: readonly ImageSearchCandidate[],
  options: CigarFlowFacebookOptions,
) {
  const manifestPath = join(storyOutputDir, "cigar-flow-facebook-social-manifest.json");
  if (!options.force) {
    const existing = await readExistingPagePost(manifestPath);
    if (existing?.postId) {
      return { status: "skipped_existing", postId: existing.postId, permalinkUrl: existing.permalinkUrl, existingManifestPath: manifestPath } satisfies FacebookPagePostResult;
    }
  }

  if (options.dryRun) {
    return {
      status: "dry_run",
      uploadedPhotos: selectedImages.map((image) => ({ image: image.localPath || image.imageUrl, photoId: "dry-run" })),
    } satisfies FacebookPagePostResult;
  }

  const credentials = await resolveFacebookCredentials(options);
  return publishFacebookPageAlbum({
    caption,
    imagePaths: selectedImages.map((image) => {
      if (!image.localPath) {
        throw new Error(`Selected image has no local file path: ${image.imageUrl}`);
      }
      return image.localPath;
    }),
    credentials,
    graphBaseUrl: options.graphBaseUrl,
  });
}

async function readExistingPagePost(manifestPath: string) {
  try {
    const payload = JSON.parse(await readFile(manifestPath, "utf8")) as {
      facebook_page?: { postId?: string; permalinkUrl?: string; status?: string };
    };
    const status = payload.facebook_page?.status;
    return status === "published" || status === "skipped_existing" ? payload.facebook_page : null;
  } catch {
    return null;
  }
}

async function resolveFacebookCredentials(options: CigarFlowFacebookOptions): Promise<FacebookCredentials> {
  let pageId = options.pageId;
  let pageName: string | undefined;
  let pageAccessToken = options.pageAccessToken;
  let systemUserToken = options.systemUserToken;

  if ((!pageId || (!pageAccessToken && !systemUserToken)) && options.secretId) {
    const secret = await readJsonSecret(options.secretId, options.awsRegion);
    pageId = pageId || stringFromSecret(secret, ["page_graph_id", "page_id", "facebook_page_id"]);
    pageName = stringFromSecret(secret, ["page_name", "facebook_page_name"]);
    pageAccessToken = pageAccessToken || stringFromSecret(secret, ["page_access_token", "facebook_page_access_token"]);
    systemUserToken =
      systemUserToken || stringFromSecret(secret, ["system_user_token", "access_token", "facebook_access_token", "meta_system_user_token"]);
  }

  if (!pageId) {
    throw new Error("Missing Facebook Page ID. Set YCC_FACEBOOK_PAGE_ID or store page_graph_id in the Facebook secret.");
  }

  if (!pageAccessToken && systemUserToken) {
    pageAccessToken = await derivePageAccessToken(pageId, systemUserToken, options.graphVersion, options.graphBaseUrl);
  }

  if (!pageAccessToken) {
    throw new Error("Missing Facebook Page access token. Set YCC_FACEBOOK_PAGE_ACCESS_TOKEN or a system-user token in the Facebook secret.");
  }

  return {
    pageId,
    pageName,
    pageAccessToken,
    graphVersion: options.graphVersion,
  };
}

async function readJsonSecret(secretId: string, region: string) {
  const client = new SecretsManagerClient({ region });
  let result;
  try {
    result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  } catch (error) {
    if (!shouldRetryWithInsecureTls(error)) {
      throw error;
    }
    enableInsecureTlsRetry(`AWS secret read for ${secretId}`);
    result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  }

  const secretString = result.SecretString || (result.SecretBinary ? Buffer.from(result.SecretBinary).toString("utf8") : "");
  if (!secretString) {
    throw new Error(`Secret ${secretId} did not contain a string payload.`);
  }

  return JSON.parse(secretString) as Record<string, unknown>;
}

async function derivePageAccessToken(pageId: string, systemUserToken: string, graphVersion: string, graphBaseUrl: string) {
  const accountsUrl = new URL(`${trimTrailingSlash(graphBaseUrl)}/${graphVersion}/me/accounts`);
  accountsUrl.searchParams.set("fields", "id,name,access_token");
  accountsUrl.searchParams.set("access_token", systemUserToken);

  const response = await fetchWithTlsRetry(accountsUrl);
  const payload = (await response.json()) as { data?: Array<{ id?: string; access_token?: string }>; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(`Could not derive Facebook Page token: ${payload.error?.message || `HTTP ${response.status}`}`);
  }

  const page = payload.data?.find((candidate) => candidate.id === pageId);
  if (!page?.access_token) {
    throw new Error(`Facebook Page ${pageId} was not returned by /me/accounts.`);
  }

  return page.access_token;
}

export async function publishFacebookPageAlbum({
  caption,
  imagePaths,
  credentials,
  graphBaseUrl = "https://graph.facebook.com",
}: {
  caption: string;
  imagePaths: readonly string[];
  credentials: FacebookCredentials;
  graphBaseUrl?: string;
}): Promise<FacebookPagePostResult> {
  const uploadedPhotos: Array<{ image: string; photoId: string; postId?: string | null }> = [];

  for (const imagePath of imagePaths) {
    const uploadUrl = `${trimTrailingSlash(graphBaseUrl)}/${credentials.graphVersion}/${credentials.pageId}/photos`;
    const form = new FormData();
    form.set("access_token", credentials.pageAccessToken);
    form.set("published", "false");
    form.set("source", new Blob([await readFile(imagePath)]), basename(imagePath));

    const response = await fetchWithTlsRetry(uploadUrl, { method: "POST", body: form });
    const payload = (await response.json()) as GraphPhotoResponse;
    if (!response.ok || !payload.id) {
      throw new Error(`Facebook photo upload failed for ${imagePath}: ${graphErrorMessage(payload, response.status)}`);
    }

    uploadedPhotos.push({ image: imagePath, photoId: payload.id, postId: payload.post_id ?? null });
  }

  const feedUrl = `${trimTrailingSlash(graphBaseUrl)}/${credentials.graphVersion}/${credentials.pageId}/feed`;
  const feedForm = new URLSearchParams();
  feedForm.set("access_token", credentials.pageAccessToken);
  feedForm.set("message", caption);
  uploadedPhotos.forEach((photo, index) => {
    feedForm.set(`attached_media[${index}]`, JSON.stringify({ media_fbid: photo.photoId }));
  });

  const feedResponse = await fetchWithTlsRetry(feedUrl, { method: "POST", body: feedForm });
  const feedPayload = (await feedResponse.json()) as GraphFeedResponse;
  if (!feedResponse.ok || !feedPayload.id) {
    throw new Error(`Facebook feed post failed: ${graphErrorMessage(feedPayload, feedResponse.status)}`);
  }

  const readback = await readFacebookPost(feedPayload.id, credentials, graphBaseUrl);
  return {
    status: "published",
    postId: feedPayload.id,
    permalinkUrl: readback.permalink_url,
    uploadedPhotos,
  };
}

async function readFacebookPost(postId: string, credentials: FacebookCredentials, graphBaseUrl: string) {
  const url = new URL(`${trimTrailingSlash(graphBaseUrl)}/${credentials.graphVersion}/${postId}`);
  url.searchParams.set("fields", "id,permalink_url,message,status_type");
  url.searchParams.set("access_token", credentials.pageAccessToken);
  const response = await fetchWithTlsRetry(url);
  const payload = (await response.json()) as GraphReadbackResponse & { error?: unknown };
  if (!response.ok) {
    throw new Error(`Facebook post readback failed: ${graphErrorMessage(payload, response.status)}`);
  }
  return payload;
}

function graphErrorMessage(payload: { error?: unknown }, status: number) {
  if (payload.error && typeof payload.error === "object" && "message" in payload.error && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return `HTTP ${status}`;
}

async function fetchWithTlsRetry(input: string | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!shouldRetryWithInsecureTls(error)) {
      throw error;
    }
    enableInsecureTlsRetry(typeof input === "string" ? input : input.toString());
    return fetch(input, init);
  }
}

function shouldRetryWithInsecureTls(error: unknown) {
  const values = [collectErrorString(error), collectErrorString((error as { cause?: unknown } | null)?.cause)];
  return values.some((value) =>
    /UNABLE_TO_VERIFY_LEAF_SIGNATURE|unable to verify the first certificate|unable to get local issuer certificate|CERTIFICATE_VERIFY_FAILED/i.test(
      value,
    ),
  );
}

function collectErrorString(error: unknown) {
  if (!error) {
    return "";
  }
  if (error instanceof Error) {
    return `${error.name} ${error.message}`;
  }
  return String(error);
}

function enableInsecureTlsRetry(target: string) {
  if (insecureTlsRetryEnabled) {
    return;
  }

  insecureTlsRetryEnabled = true;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.warn(`[cigar-flow-facebook-run] Retrying with insecure TLS after certificate validation failure for ${target}.`);
}

function summarizeStory(story: NewsStory) {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    category: story.category,
    publishedAt: story.publishedAt,
    sourceNotes: story.sourceNotes,
  };
}

function parseHtmlAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function normalizeImageUrl(value: string, sourcePageUrl: string) {
  const trimmed = decodeHtmlEntities(value).trim();
  if (!trimmed || trimmed.startsWith("data:")) {
    return "";
  }

  try {
    const url = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed, sourcePageUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function parseDimensions(value?: string) {
  const match = value?.match(/^(\d{2,5})x(\d{2,5})$/);
  if (!match) {
    return null;
  }

  return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) };
}

function parseOptionalInt(value?: string) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstSrcsetUrl(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .find(Boolean);
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return ".jpg";
  }
  if (contentType.includes("png")) {
    return ".png";
  }
  if (contentType.includes("webp")) {
    return ".webp";
  }
  if (contentType.includes("avif")) {
    return ".avif";
  }
  return "";
}

function extensionFromUrl(value: string) {
  try {
    const extension = extname(new URL(value).pathname).toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension) ? extension.replace(".jpeg", ".jpg") : "";
  } catch {
    return "";
  }
}

function keywordsFor(value: string) {
  const stopWords = new Set(["latest", "cigar", "cigars", "industry", "updates", "edition", "company", "daily", "source"]);
  return uniqueStrings(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 4 && !stopWords.has(word)),
  ).slice(0, 16);
}

function extractMarkdownHeadings(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,4}\s+(.+)$/)?.[1] || "")
    .filter(Boolean);
}

function extractMarkdownSections(markdown: string) {
  const sections: MarkdownSection[] = [];
  let current: MarkdownSection | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{1,4}\s+(.+)$/)?.[1];
    if (heading) {
      if (current) {
        sections.push(current);
      }
      current = { heading: cleanStoryDetailText(heading), body: "" };
      continue;
    }

    if (current) {
      current.body += `${line}\n`;
    }
  }

  if (current) {
    sections.push(current);
  }

  return sections.filter((section) => section.heading || section.body.trim());
}

function summarizeStorySection(section: MarkdownSection) {
  const heading = cleanStoryDetailText(section.heading);
  const sentence = firstStorySentence(section.body);
  if (!heading && !sentence) {
    return "";
  }

  if (!sentence) {
    return cleanCaptionLine(heading);
  }

  const line = `${heading}: ${truncateCaptionDetail(sentence, 150)}`;
  if (blockedCaptionPatterns.some((pattern) => pattern.test(line))) {
    return cleanCaptionLine(heading);
  }

  return line;
}

function firstStorySentence(value: string) {
  const cleaned = cleanStoryDetailText(value);
  const first = cleaned.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? cleaned;
  return truncateCaptionDetail(first, 180);
}

function isGenericStoryHeading(value: string) {
  const normalized = cleanStoryDetailText(value).toLowerCase();
  return /^(latest|overview|summary|sources?|source notes?|stay tuned|conclusion|flow note)\b/.test(normalized);
}

function cleanCaptionLine(value: string) {
  return cleanStoryDetailText(value).slice(0, 90);
}

function stripMarkdown(value: string) {
  return value.replace(/[*_`#>]/g, "").trim();
}

function cleanStoryDetailText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateCaptionDetail(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength - 3).replace(/\s+\S*$/, "").trim();
  return `${clipped || value.slice(0, maxLength - 3).trim()}...`;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function uniqueTargets(targets: readonly ImageSearchTarget[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.source}:${target.url}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueStrings(values: readonly string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function publicAssetToLocalPath(value: string) {
  return value.startsWith("/") ? join("public", value.replace(/^\/+/, "")) : value;
}

function isLocalProjectPath(value: string) {
  return value.startsWith("/") || /^[a-z]:\\/i.test(value) || value.startsWith("public/");
}

function isHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

function hostnameLabel(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Source image";
  }
}

function candidateDomainKey(candidate: ImageSearchCandidate) {
  try {
    return new URL(candidate.sourcePageUrl || candidate.imageUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function stringFromSecret(secret: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    const value = secret[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readInt(name: string, defaultValue: number, min: number, max: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }
  return Math.min(Math.max(parsed, min), max);
}

function readArgValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) {
    return inline.slice(name.length + 1);
  }
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function isMainModule() {
  return Boolean(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href);
}

if (isMainModule()) {
  runCigarFlowFacebookSocial()
    .then((result) => {
      console.log(`Cigar Flow Facebook social run complete: ${result.story.title}`);
      console.log(`Output: ${result.outputDir}`);
      console.log(`Images: ${result.selectedImages.length}`);
      console.log(`Page status: ${result.pagePost?.status ?? "not_run"}${result.pagePost?.postId ? ` (${result.pagePost.postId})` : ""}`);
      console.log(`Group kit: ${result.groupKitPath}`);
    })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        console.error(`[cigar-flow-facebook-run] ${error.message}`);
      } else {
        console.error("[cigar-flow-facebook-run] Unexpected error:", error);
      }
      process.exitCode = 1;
    });
}
