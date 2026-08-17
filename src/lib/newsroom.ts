import cigarNewsSourceConfig from "../../config/cigar-news-sources.json";

export type NewsSourceStatus = "official" | "needs_review" | "blocked_secondary" | "invalid";

export type NewsSourceCandidate = {
  input: string;
  url: string;
  domain: string;
  status: NewsSourceStatus;
  sourceType: NewsSourceStatus;
  reviewNote: string;
};

export type NewsSourceNote = {
  label: string;
  url: string;
  note: string;
  sourceType: NewsSourceStatus;
  domain?: string;
  reviewNote?: string;
};

export type NewsroomDraftInput = {
  angle: string;
  timeframe?: string;
  audience?: string;
  sourceUrls: string[];
  sourceNotes?: string[];
  storyImages?: NewsStoryImage[];
};

export type NewsroomSection = {
  heading: string;
  body: string;
};

export type NewsroomDraft = {
  title: string;
  dek: string;
  category: string;
  bodyMarkdown: string;
  sections: NewsroomSection[];
  images?: NewsStoryImage[];
  sourceNotes: NewsSourceNote[];
  publishStatus: "draft";
  operatorReviewRequired: true;
  complianceReview: {
    ageRestricted: true;
    humanApprovalRequired: true;
    sourceVerificationRequired: true;
    prohibitedClaims: string[];
    prohibitedInputs: string[];
  };
};

export type NewsStoryImage = {
  label: string;
  image: string;
  imagePosition?: string;
  alt?: string;
  sourceUrl?: string;
};

export type NewsStory = {
  id?: string;
  slug: string;
  title: string;
  dek: string;
  category: string;
  bodyMarkdown: string;
  images?: NewsStoryImage[];
  sourceNotes: NewsSourceNote[];
  officialSources: string[];
  leadUrls?: string[];
  dedupeKey?: string | null;
  contentFingerprint?: string | null;
  sourceFingerprint?: string | null;
  revision?: number;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  updatedAt: string | null;
};

export const officialCigarNewsSources = cigarNewsSourceConfig.officialSources;
export const officialCigarNewsDomains = [
  ...new Set([...officialCigarNewsSources.map((source) => source.domain), ...cigarNewsSourceConfig.additionalOfficialDomains]),
];

const officialDomains: ReadonlySet<string> = new Set(officialCigarNewsDomains);

const blockedSecondaryDomains = new Set(cigarNewsSourceConfig.blockedSecondaryDomains);

const fallbackNewsBodyPatterns = [
  "keep this section factual and concise until an operator verifies each detail against the source urls.",
  "frame the update around release timing, availability, craftsmanship, events, or education value.",
  "verify every product name, date, quote, msrp, distributor note, and availability claim before publication.",
];

export function normalizeNewsSourceCandidate(value: string): NewsSourceCandidate {
  const input = value.trim();

  if (!input) {
    return {
      input: value,
      url: "",
      domain: "",
      status: "invalid",
      sourceType: "invalid",
      reviewNote: "Add a source URL before drafting.",
    };
  }

  try {
    const parsedUrl = new URL(input);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return invalidSource(value, "Use an HTTP or HTTPS source URL.");
    }

    const domain = normalizeDomain(parsedUrl.hostname);
    if (isBlockedSecondaryDomain(domain)) {
      return {
        input,
        url: parsedUrl.toString(),
        domain,
        status: "blocked_secondary",
        sourceType: "blocked_secondary",
        reviewNote: "This looks like a magazine or third-party story. Use it only as a lead; do not rewrite it.",
      };
    }

    if (isOfficialDomain(domain)) {
      return {
        input,
        url: parsedUrl.toString(),
        domain,
        status: "official",
        sourceType: "official",
        reviewNote: "Official brand, company, or wire source accepted.",
      };
    }

    return {
      input,
      url: parsedUrl.toString(),
      domain,
      status: "needs_review",
      sourceType: "needs_review",
      reviewNote: "Unknown source. Verify it is a brand, distributor, event organizer, or official wire before publishing.",
    };
  } catch {
    return invalidSource(value, "Enter a valid source URL.");
  }
}

export function buildNewsAgentPrompt(input: NewsroomDraftInput, options: { strictNoPlaceholder?: boolean } = {}) {
  const strictNoPlaceholder = options.strictNoPlaceholder === true;
  const vettedSources = input.sourceUrls.map(normalizeNewsSourceCandidate);
  const officialSources = vettedSources.filter((source) => source.status === "official" || source.status === "needs_review");
  const blockedSources = vettedSources.filter((source) => source.status === "blocked_secondary" || source.status === "invalid");
  const storyImages = normalizeNewsStoryImages(input.storyImages);
  const sourceLines = officialSources.length
    ? officialSources.map((source, index) => `${index + 1}. ${source.url} (${source.reviewNote})`).join("\n")
    : "No accepted primary sources were supplied.";
  const noteLines = (input.sourceNotes ?? []).filter(Boolean).map((note, index) => `${index + 1}. ${note}`).join("\n") || "No operator notes supplied.";
  const blockedLines = blockedSources.map((source) => `- ${source.input}: ${source.reviewNote}`).join("\n") || "None.";
  const storyImageLines = storyImages.length
    ? storyImages
        .map((image, index) => `${index + 1}. ${image.label}: ${image.image}${image.sourceUrl ? ` (source: ${image.sourceUrl})` : ""}`)
        .join("\n")
    : "No operator-provided story image URLs supplied.";

  const promptLines = [
    "You are YCCNewsAgent, an internal editorial agent for authorized Yuzu operators.",
    "Draft original cigar-industry news copy for adult readers of legal tobacco age.",
    "Use facts only from official brand, company, distributor, event, regulator, or wire sources supplied below.",
    "Do not rewrite magazine articles, reviews, or third-party stories. If a third-party story appears, treat it only as a lead and ask for primary verification.",
    "Do not copy source wording beyond short attributed names or product titles. Use a new structure and Yuzu's own editorial voice.",
    "Avoid health, cessation, medical, therapeutic, disease, safety, or underage tobacco claims.",
    "Every factual claim must be tied to a source note. Publication requires human approval.",
    "Do not return template scaffolding, checklists, or placeholder section headings.",
    "Do not use the placeholder headings: What changed; Why adult members may care; Operator review notes.",
    "The draft must contain concrete details (dates, product names, events, claims) from the accepted source list.",
    "Return JSON only with no prose before or after the object.",
    "bodyMarkdown must be a fully written story in publication-ready prose, not an outline, checklist, or operator note scaffold.",
    "Each section body must contain the same substantive reporting as the article body, not editorial instructions.",
    "",
    `Angle: ${input.angle || "weekly cigar industry news"}`,
    `Timeframe: ${input.timeframe || "this week"}`,
    `Audience: ${input.audience || "adult Yuzu Cigar Club members of legal tobacco age"}`,
    "",
    "Accepted official or review-needed source URLs:",
    sourceLines,
    "",
    "Operator source notes:",
    noteLines,
    "",
    "Operator-provided story images:",
    storyImageLines,
    "",
    "Blocked or invalid sources:",
    blockedLines,
    "",
    "Return JSON with title, dek, category, bodyMarkdown (a complete publication-ready story in markdown), sections[{heading,body}], images[{label,image,imagePosition,alt,sourceUrl}], and sourceNotes[{label,url,note}].",
    "Use only actual image URLs from operator-provided story images or accepted source pages. Do not invent image URLs.",
    "BodyMarkdown should be a full draft article for operator approval; sections should be a readable breakdown of that article.",
  ];

  if (strictNoPlaceholder) {
    promptLines.push(
      "STRICT MODE: If your draft is uncertain, still provide a real story draft and never output placeholder copy.",
      "Never include the exact text from fallback template sections or the required placeholder phrases.",
      "If source details are insufficient, explicitly note which fields are unverified in bodyMarkdown and still provide concrete available facts.",
      "Do not reuse heading names that look like templates.",
    );
  }

  return promptLines.join("\n");
}

export function normalizeNewsDraftFromAgentReply(reply: string, input: NewsroomDraftInput): NewsroomDraft {
  const parsed = parseAgentJson(reply);
  const bodyMarkdown = trimNewsMarkdownText(parsed?.bodyMarkdown, 12000);
  const sourceNotes = normalizeSourceNotes(parsed?.sourceNotes, input);
  const parsedSections = normalizeSections(parsed?.sections);
  const splitSections = splitStoryMarkdownToSections(bodyMarkdown);
  const sections = bodyMarkdown
    ? splitSections.length
      ? splitSections
      : parsedSections.length
        ? parsedSections
        : buildFallbackSections(input)
    : parsedSections.length
      ? parsedSections
      : buildFallbackSections(input);
  const title = cleanText(parsed?.title, 120) || `${toTitleCase(input.angle || "Weekly cigar industry news")} brief`;

  return {
    title,
    dek:
      cleanText(parsed?.dek || parsed?.summary, 220) ||
      "A human-reviewed Yuzu Cigar Club news draft built from primary source notes.",
    category: cleanText(parsed?.category, 80) || "Industry News",
    bodyMarkdown: bodyMarkdown || draftToBodyMarkdown({ sections }),
    sections,
    images: mergeNewsStoryImages(input.storyImages, parsed?.images, parsed?.storyImages),
    sourceNotes,
    publishStatus: "draft",
    operatorReviewRequired: true,
    complianceReview: buildComplianceReview(),
  };
}

export function hasUsableNewsDraftReply(reply: string) {
  const parsed = parseAgentJson(reply);
  const bodyMarkdown = trimNewsMarkdownText(parsed?.bodyMarkdown, 12000);
  const sections = normalizeSections(parsed?.sections);
  const body = bodyMarkdown || draftToBodyMarkdown({ sections });

  return Boolean(body) && !isPlaceholderNewsBodyMarkdown(body);
}

export function mergeNewsStoryImages(...values: unknown[]) {
  const seen = new Set<string>();

  return values
    .flatMap((value) => normalizeNewsStoryImages(value))
    .filter((image) => {
      const key = canonicalNewsImageKey(image.image);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

export function normalizeNewsStoryImages(value: unknown): NewsStoryImage[] {
  const rawImages = Array.isArray(value) ? value : [];

  return rawImages
    .map((item): NewsStoryImage | null => {
      const record = typeof item === "string" ? { image: item } : item && typeof item === "object" ? (item as Record<string, unknown>) : null;

      if (!record) {
        return null;
      }

      const image = normalizeNewsImageUrl(cleanText(record.image || record.src || record.url, 1000));
      if (!isHttpUrl(image) && !image.startsWith("/assets/")) {
        return null;
      }

      const sourceUrl = cleanText(record.sourceUrl || record.storyUrl || record.href, 1000);
      const imagePosition = cleanText(record.imagePosition || record.objectPosition, 40);
      const alt = cleanText(record.alt, 180);
      const normalized: NewsStoryImage = {
        label: cleanText(record.label || record.title, 90) || "Story image",
        image,
      };

      if (imagePosition) {
        normalized.imagePosition = imagePosition;
      }

      if (alt) {
        normalized.alt = alt;
      }

      if (isHttpUrl(sourceUrl)) {
        normalized.sourceUrl = sourceUrl;
      }

      return normalized;
    })
    .filter((image): image is NewsStoryImage => Boolean(image));
}

export function draftToBodyMarkdown(draft: Pick<NewsroomDraft, "sections">) {
  return draft.sections
    .map((section) => ({
      heading: cleanText(section.heading, 90),
      body: trimNewsMarkdownText(section.body, 5000),
    }))
    .filter((section) => Boolean(section.heading && section.body))
    .map((section) => `## ${section.heading}\n${section.body}`)
    .join("\n\n")
    .trim();
}

export function isPlaceholderNewsBodyMarkdown(value: unknown) {
  const normalized = trimNewsMarkdownText(value, 12000).toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    normalized.includes("## what changed") &&
    normalized.includes("## why adult members may care") &&
    normalized.includes("## operator review notes") &&
    fallbackNewsBodyPatterns.every((pattern) => normalized.includes(pattern))
  );
}

export function slugifyNewsTitle(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return slug || `story-${Date.now()}`;
}

export function canonicalizeNewsUrl(value: string) {
  try {
    const parsedUrl = new URL(value.trim());
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return "";
    }

    const domain = normalizeDomain(parsedUrl.hostname);
    const params = [...parsedUrl.searchParams.entries()]
      .filter(([key]) => !/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i.test(key))
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
    const search = new URLSearchParams(params).toString();
    const pathname = (parsedUrl.pathname || "/").replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";

    return `https://${domain}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return "";
  }
}

export function isSpecificNewsSourceUrl(value: string) {
  const canonicalUrl = canonicalizeNewsUrl(value);
  if (!canonicalUrl) {
    return false;
  }

  const pathname = new URL(canonicalUrl).pathname.toLowerCase().replace(/\/$/, "") || "/";
  return !new Set([
    "/",
    "/blog",
    "/cigar-news",
    "/en/categoria-news/news",
    "/en/search/tag/cigar",
    "/fratello-news",
    "/news",
    "/news-releases/news-releases-list",
    "/news/tag/general-cigar-co",
    "/newsroom",
    "/press",
  ]).has(pathname);
}

export function normalizeNewsImageUrl(value: string) {
  const input = value.trim();
  if (!input) {
    return "";
  }

  try {
    const parsedUrl = new URL(input);
    if (normalizeDomain(parsedUrl.hostname) === "yuzucigarclub.com" && parsedUrl.pathname.startsWith("/assets/")) {
      return `${parsedUrl.pathname}${parsedUrl.search}`;
    }
  } catch {
    return input.startsWith("/assets/") ? input : "";
  }

  return input;
}

export function canonicalNewsImageKey(value: string) {
  const normalized = normalizeNewsImageUrl(value);
  return normalized.startsWith("/assets/") ? normalized.toLowerCase().split("?")[0] : canonicalizeNewsUrl(normalized) || normalized.toLowerCase();
}

function normalizeSourceNotes(value: unknown, input: NewsroomDraftInput): NewsSourceNote[] {
  const rawNotes = Array.isArray(value) ? value : [];
  const notesFromReply = rawNotes
    .map((item): NewsSourceNote | null => {
      if (typeof item === "string") {
        const source = normalizeNewsSourceCandidate(item);
        return {
          label: source.domain || "Source",
          url: source.url || item,
          note: source.reviewNote,
          sourceType: source.sourceType,
          domain: source.domain,
          reviewNote: source.reviewNote,
        } satisfies NewsSourceNote;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const sourceValue = item as { label?: unknown; url?: unknown; note?: unknown; sourceType?: unknown };
      const source = normalizeNewsSourceCandidate(String(sourceValue.url || ""));
      return {
        label: cleanText(sourceValue.label, 80) || source.domain || "Source",
        url: source.url || cleanText(sourceValue.url, 240),
        note: cleanText(sourceValue.note, 280) || source.reviewNote,
        sourceType: source.sourceType,
        domain: source.domain,
        reviewNote: source.reviewNote,
      } satisfies NewsSourceNote;
    })
    .filter((item): item is NewsSourceNote => Boolean(item?.url));

  if (notesFromReply.length) {
    return deduplicateNewsSourceNotes(notesFromReply);
  }

  return deduplicateNewsSourceNotes(input.sourceUrls
    .map((sourceUrl, index) => {
      const source = normalizeNewsSourceCandidate(sourceUrl);
      return {
        label: source.domain || `Source ${index + 1}`,
        url: source.url || sourceUrl,
        note: cleanText(input.sourceNotes?.[index], 280) || source.reviewNote,
        sourceType: source.sourceType,
        domain: source.domain,
        reviewNote: source.reviewNote,
      } satisfies NewsSourceNote;
    })
    .filter((source) => Boolean(source.url)));
}

function deduplicateNewsSourceNotes(notes: NewsSourceNote[]) {
  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = canonicalizeNewsUrl(note.url);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeSections(value: unknown): NewsroomSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const section = item as { heading?: unknown; body?: unknown };
      const heading = cleanText(section.heading, 90);
      const body = cleanText(section.body, 5000);

      return heading && body ? { heading, body } : null;
    })
    .filter((item): item is NewsroomSection => Boolean(item));
}

function splitStoryMarkdownToSections(markdown: string): NewsroomSection[] {
  const normalized = trimNewsMarkdownText(markdown, 12000);
  if (!normalized) {
    return [];
  }

  const headings = [...normalized.matchAll(/^##\s+(.+)$/gm)];
  if (!headings.length) {
    return [{ heading: "Story", body: normalized }];
  }

  return headings
    .map((headingMatch, index) => {
      const heading = cleanText(headingMatch[1], 90);
      const start = headingMatch.index + headingMatch[0].length;
      const end = index + 1 < headings.length ? headings[index + 1].index : normalized.length;
      const body = trimNewsMarkdownText(normalized.slice(start, end), 5000);

      return heading && body ? { heading, body } : null;
    })
    .filter((section): section is NewsroomSection => Boolean(section));
}

function trimNewsMarkdownText(value: unknown, maxLength: number) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function buildFallbackSections(input: NewsroomDraftInput): NewsroomSection[] {
  const angle = cleanText(input.angle, 120) || "this cigar industry update";
  const timeframe = cleanText(input.timeframe, 80) || "this week";

  return [
    {
      heading: "What changed",
      body: `Yuzu is tracking ${angle} based on the official source notes supplied for ${timeframe}. Keep this section factual and concise until an operator verifies each detail against the source URLs.`,
    },
    {
      heading: "Why adult members may care",
      body: "Frame the update around release timing, availability, craftsmanship, events, or education value. Avoid sales pressure and do not make health, cessation, medical, therapeutic, disease, or safety claims.",
    },
    {
      heading: "Operator review notes",
      body: "Verify every product name, date, quote, MSRP, distributor note, and availability claim before publication. Attribute the company announcement and link to the primary source.",
    },
  ];
}

function buildComplianceReview(): NewsroomDraft["complianceReview"] {
  return {
    ageRestricted: true,
    humanApprovalRequired: true,
    sourceVerificationRequired: true,
    prohibitedClaims: ["health", "cessation", "medical", "therapeutic", "disease", "safe tobacco use"],
    prohibitedInputs: ["underage tobacco", "age-check bypass", "payment-card collection", "third-party article rewrite"],
  };
}

function parseAgentJson(reply: string): Record<string, unknown> | null {
  const text = reply.trim();
  if (!text) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text.match(/\{[\s\S]*\}/)?.[0] || "";

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function invalidSource(input: string, reviewNote: string): NewsSourceCandidate {
  return {
    input,
    url: "",
    domain: "",
    status: "invalid",
    sourceType: "invalid",
    reviewNote,
  };
}

function normalizeDomain(value: string) {
  return value.toLowerCase().replace(/^www\./, "");
}

function isHttpUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

function isBlockedSecondaryDomain(domain: string) {
  return blockedSecondaryDomains.has(domain) || [...blockedSecondaryDomains].some((blocked) => domain.endsWith(`.${blocked}`));
}

function isOfficialDomain(domain: string) {
  return officialDomains.has(domain) || [...officialDomains].some((official) => domain.endsWith(`.${official}`));
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function toTitleCase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
