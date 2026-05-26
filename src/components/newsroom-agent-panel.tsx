"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  Newspaper,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import {
  draftNewsStory,
  getLiveApiErrorMessage,
  publishNewsStory,
  type PublishNewsStoryResponse,
} from "@/lib/live-api";
import {
  draftToBodyMarkdown,
  normalizeNewsSourceCandidate,
  officialCigarNewsSources,
  type NewsroomDraft,
  type NewsroomSection,
  type NewsSourceCandidate,
} from "@/lib/newsroom";
import { cn } from "@/lib/utils";

const defaultAudience = "Adult Yuzu Cigar Club members of legal tobacco age";
const defaultManufacturerSourceText = officialCigarNewsSources.map((source) => source.url).join("\n");

export function NewsroomAgentPanel() {
  const auth = useBackupAuth();
  const [angle, setAngle] = useState("cigar industry brand announcements");
  const [timeframe, setTimeframe] = useState("this week");
  const [audience, setAudience] = useState(defaultAudience);
  const [sourceText, setSourceText] = useState(defaultManufacturerSourceText);
  const [sourceNoteText, setSourceNoteText] = useState("");
  const [draft, setDraft] = useState<NewsroomDraft | null>(null);
  const [publishedStory, setPublishedStory] = useState<PublishNewsStoryResponse["story"] | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [operatorApproved, setOperatorApproved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sourceUrls = useMemo(() => splitLines(sourceText), [sourceText]);
  const sourceNotes = useMemo(() => splitLines(sourceNoteText), [sourceNoteText]);
  const candidates = useMemo(() => sourceUrls.map(normalizeNewsSourceCandidate), [sourceUrls]);
  const sourceSummary = useMemo(() => summarizeCandidates(candidates), [candidates]);
  const canDraft = sourceSummary.accepted > 0 && !isDrafting;
  const canPublish = Boolean(draft && operatorApproved && !isPublishing);

  async function handleDraft() {
    if (!canDraft) {
      setError("Add at least one official or review-needed primary source before drafting.");
      return;
    }

    setIsDrafting(true);
    setError("");
    setMessage("");
    setPublishedStory(null);

    try {
      const headers = await auth.createApiHeaders();
      const response = await draftNewsStory(
        {
          angle,
          timeframe,
          audience,
          sourceUrls,
          sourceNotes,
        },
        headers,
      );

      setDraft(response.draft);
      setOperatorApproved(false);
      setMessage("Draft ready for operator review.");
    } catch (draftError) {
      setError(getLiveApiErrorMessage(draftError));
    } finally {
      setIsDrafting(false);
    }
  }

  async function handlePublish() {
    if (!draft) {
      setError("Draft a story before publishing.");
      return;
    }

    if (!operatorApproved) {
      setError("Operator approval is required before publishing.");
      return;
    }

    setIsPublishing(true);
    setError("");
    setMessage("");

    try {
      const headers = await auth.createApiHeaders();
      const publishableDraft: Omit<NewsroomDraft, "publishStatus"> = {
        title: draft.title,
        dek: draft.dek,
        category: draft.category,
        bodyMarkdown: draftToBodyMarkdown(draft),
        sections: draft.sections,
        images: draft.images,
        sourceNotes: draft.sourceNotes,
        operatorReviewRequired: draft.operatorReviewRequired,
        complianceReview: draft.complianceReview,
      };
      const response = await publishNewsStory(
        {
          ...publishableDraft,
          bodyMarkdown: draftToBodyMarkdown(draft),
          operatorApproved: true,
          publishStatus: "published",
          status: "published",
        },
        headers,
      );

      setPublishedStory(response.story);
      setMessage("Story published from official source notes.");
    } catch (publishError) {
      setError(getLiveApiErrorMessage(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  function updateDraftField<K extends keyof Pick<NewsroomDraft, "title" | "dek" | "category">>(
    field: K,
    value: NewsroomDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateSection(index: number, patch: Partial<NewsroomSection>) {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sections: current.sections.map((section, sectionIndex) =>
          sectionIndex === index ? { ...section, ...patch } : section,
        ),
      };
    });
  }

  function addSection() {
    setDraft((current) =>
      current
        ? {
            ...current,
            sections: [...current.sections, { heading: "Additional context", body: "" }],
          }
        : current,
    );
  }

  function removeSection(index: number) {
    setDraft((current) => {
      if (!current || current.sections.length <= 1) {
        return current;
      }

      return {
        ...current,
        sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index),
      };
    });
  }

  return (
    <main className="min-h-screen bg-yuzu-night text-yuzu-cream">
      <section className="border-b border-yuzu-line/70 bg-[radial-gradient(circle_at_16%_0%,rgba(15,83,55,0.28),transparent_30rem),#030504]">
        <div className="mx-auto grid max-w-[1520px] gap-8 px-5 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)] lg:px-10">
          <div>
            <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.26em] text-yuzu-gold">
              <Sparkles className="size-4" />
              <span>YCCNewsAgent</span>
            </div>
            <h1 className="mt-4 max-w-4xl font-heading text-5xl leading-none text-yuzu-cream sm:text-6xl">
              Source-safe cigar news desk.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-yuzu-muted">
              Draft original stories from brand, company, distributor, event, regulator, or wire sources, then publish only after operator approval.
            </p>
          </div>

          <div className="border border-yuzu-line bg-yuzu-panel/80 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-yuzu-gold" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Publication Rules</h2>
                <p className="mt-3 text-sm leading-6 text-yuzu-muted">
                  The agent blocks known magazine sources, keeps drafts in review, and requires a Cognito-authorized operator to publish.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-sm text-yuzu-cream/82">
              <RuleRow label="Accepted" value={`${sourceSummary.accepted} primary sources`} tone="ok" />
              <RuleRow label="Blocked" value={`${sourceSummary.blocked} third-party or invalid sources`} tone={sourceSummary.blocked ? "warn" : "ok"} />
              <RuleRow label="Approval" value={operatorApproved ? "Ready to publish" : "Human review pending"} tone={operatorApproved ? "ok" : "warn"} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-6 px-5 py-8 lg:grid-cols-[minmax(320px,0.45fr)_minmax(0,1fr)] lg:px-10">
        <div className="grid gap-5 self-start">
          <section className="border border-yuzu-line bg-yuzu-panel/72 p-5">
            <div className="flex items-center gap-3">
              <Globe2 className="size-5 text-yuzu-gold" />
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Sources</h2>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Source URLs</span>
                <textarea
                  className="min-h-36 rounded-none border border-yuzu-line bg-yuzu-night/72 p-3 text-sm leading-6 text-yuzu-cream outline-none transition placeholder:text-yuzu-muted/70 focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                  onChange={(event) => setSourceText(event.target.value)}
                  value={sourceText}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Operator Notes</span>
                <textarea
                  className="min-h-24 rounded-none border border-yuzu-line bg-yuzu-night/72 p-3 text-sm leading-6 text-yuzu-cream outline-none transition placeholder:text-yuzu-muted/70 focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                  onChange={(event) => setSourceNoteText(event.target.value)}
                  placeholder="Release names, dates, event details, availability notes"
                  value={sourceNoteText}
                />
              </label>
            </div>

            <div className="mt-5 grid gap-2">
              {candidates.length ? (
                candidates.map((candidate) => <SourceCandidateRow key={`${candidate.url}-${candidate.input}`} candidate={candidate} />)
              ) : (
                <p className="border border-yuzu-line bg-yuzu-night/50 p-3 text-sm text-yuzu-muted">No source URLs entered.</p>
              )}
            </div>
          </section>

          <section className="border border-yuzu-line bg-yuzu-panel/72 p-5">
            <div className="flex items-center gap-3">
              <Newspaper className="size-5 text-yuzu-gold" />
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Brief</h2>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Angle</span>
                <input
                  className="h-11 rounded-none border border-yuzu-line bg-yuzu-night/72 px-3 text-sm text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                  onChange={(event) => setAngle(event.target.value)}
                  value={angle}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Timeframe</span>
                  <input
                    className="h-11 rounded-none border border-yuzu-line bg-yuzu-night/72 px-3 text-sm text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                    onChange={(event) => setTimeframe(event.target.value)}
                    value={timeframe}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Audience</span>
                  <input
                    className="h-11 rounded-none border border-yuzu-line bg-yuzu-night/72 px-3 text-sm text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                    onChange={(event) => setAudience(event.target.value)}
                    value={audience}
                  />
                </label>
              </div>
            </div>

            <Button
              className="mt-5 h-11 w-full rounded-none bg-yuzu-gold px-5 text-xs font-black uppercase tracking-[0.18em] text-yuzu-ink hover:bg-yuzu-gold-light"
              disabled={!canDraft}
              onClick={handleDraft}
              type="button"
            >
              {isDrafting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <FileText data-icon="inline-start" />}
              Draft Story
            </Button>
          </section>
        </div>

        <section className="min-w-0 border border-yuzu-line bg-yuzu-panel/68">
          <div className="flex flex-col gap-4 border-b border-yuzu-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-yuzu-gold">Editorial Draft</p>
              <h2 className="mt-2 font-heading text-3xl text-yuzu-cream">Human-reviewed story workspace</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                className="h-10 rounded-none border-yuzu-line bg-transparent px-4 text-xs font-black uppercase tracking-[0.16em] text-yuzu-cream hover:border-yuzu-gold hover:text-yuzu-gold"
                disabled={!draft}
                onClick={addSection}
                type="button"
                variant="outline"
              >
                <Plus data-icon="inline-start" />
                Section
              </Button>
              <Button
                className="h-10 rounded-none bg-yuzu-gold px-5 text-xs font-black uppercase tracking-[0.16em] text-yuzu-ink hover:bg-yuzu-gold-light"
                disabled={!canPublish}
                onClick={handlePublish}
                type="button"
              >
                {isPublishing ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Send data-icon="inline-start" />}
                Publish
              </Button>
            </div>
          </div>

          <div className="grid gap-5 p-5">
            {error ? <StatusMessage tone="error" message={error} /> : null}
            {message ? <StatusMessage tone="success" message={message} /> : null}
            {publishedStory ? <PublishedStoryNotice story={publishedStory} /> : null}

            {draft ? (
              <div className="grid gap-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Title</span>
                    <input
                      className="h-12 rounded-none border border-yuzu-line bg-yuzu-night/72 px-3 text-base text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                      onChange={(event) => updateDraftField("title", event.target.value)}
                      value={draft.title}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Category</span>
                    <input
                      className="h-12 rounded-none border border-yuzu-line bg-yuzu-night/72 px-3 text-sm text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                      onChange={(event) => updateDraftField("category", event.target.value)}
                      value={draft.category}
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Dek</span>
                  <textarea
                    className="min-h-24 rounded-none border border-yuzu-line bg-yuzu-night/72 p-3 text-sm leading-6 text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                    onChange={(event) => updateDraftField("dek", event.target.value)}
                    value={draft.dek}
                  />
                </label>

                <div className="grid gap-4">
                  {draft.sections.map((section, index) => (
                    <div key={`${section.heading}-${index}`} className="border border-yuzu-line bg-yuzu-night/42 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <label className="grid flex-1 gap-2">
                          <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Section Heading</span>
                          <input
                            className="h-11 rounded-none border border-yuzu-line bg-yuzu-night/72 px-3 text-sm text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                            onChange={(event) => updateSection(index, { heading: event.target.value })}
                            value={section.heading}
                          />
                        </label>
                        <Button
                          aria-label="Remove section"
                          className="mt-6 size-10 rounded-none border-yuzu-line bg-transparent text-yuzu-muted hover:border-yuzu-gold hover:text-yuzu-gold"
                          disabled={draft.sections.length <= 1}
                          onClick={() => removeSection(index)}
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <label className="mt-3 grid gap-2">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Body</span>
                        <textarea
                          className="min-h-36 rounded-none border border-yuzu-line bg-yuzu-night/72 p-3 text-sm leading-6 text-yuzu-cream outline-none transition focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                          onChange={(event) => updateSection(index, { body: event.target.value })}
                          value={section.body}
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 border border-yuzu-line bg-yuzu-night/52 p-4">
                  <label className="flex items-start gap-3">
                    <input
                      checked={operatorApproved}
                      className="mt-1 size-4 accent-yuzu-gold"
                      onChange={(event) => setOperatorApproved(event.target.checked)}
                      type="checkbox"
                    />
                    <span className="text-sm leading-6 text-yuzu-cream/88">
                      I verified every factual claim against the official source links, removed copied wording, and approve this story for adult readers.
                    </span>
                  </label>
                  <div className="grid gap-2">
                    {draft.sourceNotes.map((source) => (
                      <a
                        key={source.url}
                        className="inline-flex min-w-0 items-center gap-2 text-sm text-yuzu-muted transition hover:text-yuzu-gold"
                        href={source.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="size-4 shrink-0" />
                        <span className="truncate">{source.label || source.domain || source.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[420px] place-items-center border border-dashed border-yuzu-line bg-yuzu-night/32 p-8 text-center">
                <div className="max-w-md">
                  <FileText className="mx-auto size-10 text-yuzu-gold" />
                  <h3 className="mt-4 font-heading text-3xl text-yuzu-cream">No draft yet.</h3>
                  <p className="mt-3 text-sm leading-6 text-yuzu-muted">
                    The story workspace will appear here after the agent drafts from accepted primary sources.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function SourceCandidateRow({ candidate }: { candidate: NewsSourceCandidate }) {
  const isAccepted = candidate.status === "official" || candidate.status === "needs_review";
  const isBlocked = candidate.status === "blocked_secondary" || candidate.status === "invalid";

  return (
    <div className="grid gap-2 border border-yuzu-line bg-yuzu-night/42 p-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-sm font-semibold text-yuzu-cream">{candidate.domain || candidate.input}</span>
        <span
          className={cn(
            "shrink-0 border px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em]",
            isAccepted ? "border-yuzu-gold/70 text-yuzu-gold" : "border-red-400/50 text-red-200",
          )}
        >
          {candidate.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className={cn("text-xs leading-5", isBlocked ? "text-red-200/82" : "text-yuzu-muted")}>{candidate.reviewNote}</p>
    </div>
  );
}

function RuleRow({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-yuzu-line bg-yuzu-night/42 px-3 py-2">
      <span className="text-yuzu-muted">{label}</span>
      <span className={tone === "ok" ? "text-yuzu-gold" : "text-red-200"}>{value}</span>
    </div>
  );
}

function StatusMessage({ tone, message }: { tone: "success" | "error"; message: string }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={cn(
        "flex items-start gap-3 border p-4 text-sm leading-6",
        tone === "success" ? "border-yuzu-gold/70 bg-yuzu-night/60 text-yuzu-cream" : "border-red-400/60 bg-red-950/20 text-red-100",
      )}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", tone === "success" ? "text-yuzu-gold" : "text-red-200")} />
      <span>{message}</span>
    </div>
  );
}

function PublishedStoryNotice({ story }: { story: PublishNewsStoryResponse["story"] }) {
  return (
    <div className="border border-yuzu-gold/70 bg-yuzu-night/60 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">Published</p>
      <h3 className="mt-2 font-heading text-2xl text-yuzu-cream">{story.title}</h3>
      <p className="mt-2 text-sm leading-6 text-yuzu-muted">{story.dek}</p>
      <a className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-yuzu-gold" href="/cigar-flow#cigar-flow-news">
        View Cigar Flow
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

function splitLines(value: string) {
  return value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function summarizeCandidates(candidates: NewsSourceCandidate[]) {
  return candidates.reduce(
    (summary, candidate) => {
      if (candidate.status === "official" || candidate.status === "needs_review") {
        summary.accepted += 1;
      } else {
        summary.blocked += 1;
      }

      return summary;
    },
    { accepted: 0, blocked: 0 },
  );
}
