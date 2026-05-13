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

export type NewsStory = {
  id?: string;
  slug: string;
  title: string;
  dek: string;
  category: string;
  bodyMarkdown: string;
  sourceNotes: NewsSourceNote[];
  officialSources: string[];
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  updatedAt: string | null;
};

export const officialCigarNewsSources = [
  { name: "Drew Estate", url: "https://drewestate.com/", domain: "drewestate.com" },
  { name: "Rocky Patel", url: "https://www.rockypatel.com/cigar-news/", domain: "rockypatel.com" },
  { name: "J.C. Newman", url: "https://www.jcnewman.com/", domain: "jcnewman.com" },
  { name: "Arturo Fuente", url: "https://arturofuente.com/", domain: "arturofuente.com" },
  { name: "Oliva", url: "https://olivacigar.com/news/", domain: "olivacigar.com" },
  { name: "Perdomo", url: "https://www.perdomocigars.com/news", domain: "perdomocigars.com" },
  { name: "Foundation Cigar Company", url: "https://foundationcigarcompany.com/press/", domain: "foundationcigarcompany.com" },
  { name: "Fratello", url: "https://fratellocigar.com/fratello-news/", domain: "fratellocigar.com" },
  { name: "Warped", url: "https://www.warpedcigars.com/news", domain: "warpedcigars.com" },
  { name: "La Aurora", url: "https://www.laaurora.com.do/?lang=en", domain: "laaurora.com.do" },
  { name: "Oettinger Davidoff", url: "https://www.oettingerdavidoff.com/", domain: "oettingerdavidoff.com" },
  { name: "Habanos", url: "https://www.habanos.com/en/categoria-news/news/", domain: "habanos.com" },
  { name: "Altadis U.S.A. PR Newswire", url: "https://www.prnewswire.com/news/altadis.u.s.a./", domain: "prnewswire.com" },
  { name: "Cigar World / General Cigar", url: "https://www.cigarworld.com/news/tag/general-cigar-co/", domain: "cigarworld.com" },
] as const;

const officialDomains: ReadonlySet<string> = new Set(officialCigarNewsSources.map((source) => source.domain));

const blockedSecondaryDomains = new Set([
  "blindmanspuff.com",
  "cigaraficionado.com",
  "cigardojo.com",
  "cigarjournal.com",
  "cigar-coop.com",
  "cigarcoop.com",
  "cigarsnobmag.com",
  "developingpalates.com",
  "halfwheel.com",
  "stogieguys.com",
  "tobaccobusiness.com",
]);

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

    if (officialDomains.has(domain)) {
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

export function buildNewsAgentPrompt(input: NewsroomDraftInput) {
  const vettedSources = input.sourceUrls.map(normalizeNewsSourceCandidate);
  const officialSources = vettedSources.filter((source) => source.status === "official" || source.status === "needs_review");
  const blockedSources = vettedSources.filter((source) => source.status === "blocked_secondary" || source.status === "invalid");
  const sourceLines = officialSources.length
    ? officialSources.map((source, index) => `${index + 1}. ${source.url} (${source.reviewNote})`).join("\n")
    : "No accepted primary sources were supplied.";
  const noteLines = (input.sourceNotes ?? []).filter(Boolean).map((note, index) => `${index + 1}. ${note}`).join("\n") || "No operator notes supplied.";
  const blockedLines = blockedSources.map((source) => `- ${source.input}: ${source.reviewNote}`).join("\n") || "None.";

  return [
    "You are YCCNewsAgent, an internal editorial agent for authorized Yuzu operators.",
    "Draft original cigar-industry news copy for adult readers of legal tobacco age.",
    "Use facts only from official brand, company, distributor, event, regulator, or wire sources supplied below.",
    "Do not rewrite magazine articles, reviews, or third-party stories. If a third-party story appears, treat it only as a lead and ask for primary verification.",
    "Do not copy source wording beyond short attributed names or product titles. Use a new structure and Yuzu's own editorial voice.",
    "Avoid health, cessation, medical, therapeutic, disease, safety, or underage tobacco claims.",
    "Every factual claim must be tied to a source note. Publication requires human approval.",
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
    "Blocked or invalid sources:",
    blockedLines,
    "",
    "Return JSON with title, dek, category, bodyMarkdown (a complete publication-ready story in markdown), sections[{heading,body}], and sourceNotes[{label,url,note}].",
    "BodyMarkdown should be a full draft article for operator approval; sections should be a readable breakdown of that article.",
  ].join("\n");
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
    sourceNotes,
    publishStatus: "draft",
    operatorReviewRequired: true,
    complianceReview: buildComplianceReview(),
  };
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
    return notesFromReply;
  }

  return input.sourceUrls
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
    .filter((source) => Boolean(source.url));
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

function isBlockedSecondaryDomain(domain: string) {
  return blockedSecondaryDomains.has(domain) || [...blockedSecondaryDomains].some((blocked) => domain.endsWith(`.${blocked}`));
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
