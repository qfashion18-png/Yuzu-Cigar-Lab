"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardCheck, MapPin, ShieldCheck, Sparkles } from "lucide-react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import {
  approveEventImportDraft,
  draftEventImportFromFacebookText,
  type ApprovedImportedEvent,
  type EventImportDraft,
} from "@/lib/event-import-agent";
import {
  createAdminEvent,
  fetchAdminEvents,
  getLiveApiErrorMessage,
  publishAdminEvent,
  type AdminEventInput,
  type LivePublishedEvent,
} from "@/lib/live-api";

const sampleFacebookText = [
  "Cigar Night at Fox Cigar Bar -Every 2nd Saturday",
  "Saturday, July 11, 2026 at 7 PM - 12 AM",
  "Fox Cigar Bar",
  "1464 E. Williams Field Rd Suite 104, Gilbert, AZ 85295",
  "Join Brothers of Prometheus 87 for Cigars, drinks, or just some fellowship. Every Second Saturday.",
].join("\n");

export function EventImportAgentPanel() {
  const auth = useBackupAuth();
  const { authSource, createApiHeaders, isReady, isSignedIn } = auth;
  const [sourceUrl, setSourceUrl] = useState("https://www.facebook.com/events/2502127350222287/");
  const [sourceText, setSourceText] = useState(sampleFacebookText);
  const [draft, setDraft] = useState<EventImportDraft | ApprovedImportedEvent | null>(null);
  const [approvedEvents, setApprovedEvents] = useState<LivePublishedEvent[]>([]);
  const [operatorApproved, setOperatorApproved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const serializedApprovedEvents = useMemo(() => JSON.stringify(approvedEvents, null, 2), [approvedEvents]);

  useEffect(() => {
    let cancelled = false;

    if (!isReady || !isSignedIn || authSource !== "cognito") {
      return () => {
        cancelled = true;
      };
    }

    window.queueMicrotask(() => {
      if (!cancelled) {
        setIsLoadingEvents(true);
      }
    });
    void createApiHeaders()
      .then((headers) => {
        if (!headers.Authorization) {
          throw new Error("A live Cognito admin session is required to load shared events.");
        }

        return fetchAdminEvents(headers, { status: "published", limit: 100 });
      })
      .then((response) => {
        if (!cancelled) {
          setApprovedEvents(response.events);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(getLiveApiErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingEvents(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authSource, createApiHeaders, isReady, isSignedIn]);

  function handleDraft() {
    const nextDraft = draftEventImportFromFacebookText({
      sourceUrl,
      sourceText,
    });

    setDraft(nextDraft);
    setOperatorApproved(false);
    setMessage("Draft ready for operator review.");
    setError("");
  }

  async function handleApprove() {
    if (!draft || draft.approvalStatus !== "draft" || !operatorApproved) {
      setError("Operator approval is required before this event can be published.");
      return;
    }

    setIsPublishing(true);
    setMessage("");
    setError("");

    try {
      const headers = await auth.createApiHeaders();

      if (!headers.Authorization) {
        throw new Error("Sign in with a live Cognito admin session before publishing events.");
      }

      const approved = approveEventImportDraft(draft, new Date().toISOString());
      const created = await createAdminEvent(buildAdminEventInput(approved), headers);
      const published = await publishAdminEvent(created.event.id, headers);
      setApprovedEvents((current) => [
        published.event,
        ...current.filter((event) => event.id !== published.event.id && event.slug !== published.event.slug),
      ]);
      setDraft(approved);
      setMessage("Event approved and published to the shared storefront feed.");
    } catch (publishError) {
      setError(getLiveApiErrorMessage(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <main className="min-h-screen bg-yuzu-night text-yuzu-cream">
      <section className="border-b border-yuzu-line/70 bg-[radial-gradient(circle_at_16%_0%,rgba(15,83,55,0.28),transparent_30rem),#030504]">
        <div className="mx-auto grid max-w-[1520px] gap-8 px-5 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)] lg:px-10">
          <div>
            <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.26em] text-yuzu-gold">
              <Sparkles className="size-4" />
              <span>YCCEventImportAgent</span>
            </div>
            <h1 className="mt-4 max-w-4xl font-heading text-5xl leading-none text-yuzu-cream sm:text-6xl">
              Local event import desk.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-yuzu-muted">
              Turn Facebook event text into operator-reviewed local cigar event records before they appear in the static storefront feed.
            </p>
          </div>

          <div className="border border-yuzu-line bg-yuzu-panel/80 p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 text-yuzu-gold" />
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Import Rules</h2>
                <p className="mt-3 text-sm leading-6 text-yuzu-muted">
                  Imports stay in draft until a human operator verifies the source, location, date, and adult-only compliance review.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-sm text-yuzu-cream/82">
              <RuleRow label="Draft" value={draft ? draft.approvalStatus : "Not started"} tone={draft ? "ok" : "warn"} />
              <RuleRow label="Approval" value={operatorApproved ? "Operator checked" : "Review required"} tone={operatorApproved ? "ok" : "warn"} />
              <RuleRow
                label="Published"
                value={isLoadingEvents ? "Loading" : `${approvedEvents.length} shared`}
                tone={approvedEvents.length ? "ok" : "warn"}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-6 px-5 py-8 lg:grid-cols-[minmax(320px,0.45fr)_minmax(0,1fr)] lg:px-10">
        <div className="grid gap-5 self-start">
          <section className="border border-yuzu-line bg-yuzu-panel/72 p-5">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="size-5 text-yuzu-gold" />
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Source Text</h2>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Source URL</span>
                <input
                  className="min-h-12 border border-yuzu-line bg-yuzu-night/72 px-3 text-sm text-yuzu-cream outline-none transition placeholder:text-yuzu-muted/70 focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                  onChange={(event) => setSourceUrl(event.target.value)}
                  value={sourceUrl}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-muted">Copied Event Text</span>
                <textarea
                  className="min-h-52 border border-yuzu-line bg-yuzu-night/72 p-3 text-sm leading-6 text-yuzu-cream outline-none transition placeholder:text-yuzu-muted/70 focus:border-yuzu-gold focus:ring-2 focus:ring-yuzu-gold/25"
                  onChange={(event) => setSourceText(event.target.value)}
                  value={sourceText}
                />
              </label>
            </div>

            <Button className="mt-5 h-11 w-full bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" type="button" onClick={handleDraft}>
              Draft Event
            </Button>
          </section>

          <section className="border border-yuzu-line bg-yuzu-panel/72 p-5">
            <label className="flex items-start gap-3 text-sm leading-6 text-yuzu-muted">
              <input
                checked={operatorApproved}
                className="mt-1 size-4 accent-yuzu-gold"
                onChange={(event) => setOperatorApproved(event.target.checked)}
                type="checkbox"
              />
              <span>
                I verified the source listing, date, venue, address, and adult-only compliance notes for this event.
              </span>
            </label>
            <Button
              className="mt-5 h-11 w-full bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
              disabled={!draft || !operatorApproved || isPublishing}
              type="button"
              onClick={handleApprove}
            >
              <CheckCircle2 className="size-4" />
              {isPublishing ? "Publishing Event" : "Approve Event"}
            </Button>
            {message ? <p className="mt-4 text-sm leading-6 text-yuzu-muted">{message}</p> : null}
            {error ? <p className="mt-4 text-sm leading-6 text-red-300" role="alert">{error}</p> : null}
          </section>
        </div>

        <div className="grid gap-5">
          <section className="border border-yuzu-line bg-yuzu-panel/72 p-5">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-5 text-yuzu-gold" />
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Draft Preview</h2>
            </div>

            {draft ? (
              <article className="mt-5 border border-yuzu-line bg-yuzu-night/60 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-heading text-3xl leading-tight text-yuzu-cream">{draft.title}</h3>
                    <p className="mt-2 text-sm font-bold text-yuzu-gold">{draft.date}</p>
                  </div>
                  <span className="w-fit border border-yuzu-gold/60 bg-yuzu-gold/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-yuzu-gold">
                    {Math.round(draft.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-yuzu-muted">{draft.deck}</p>
                <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-yuzu-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-yuzu-gold" />
                  {draft.location}
                </p>
                <div className="mt-5 grid gap-2 text-sm text-yuzu-muted">
                  {draft.agentNotes.map((note) => (
                    <p key={note} className="border border-yuzu-line/70 bg-yuzu-panel/70 p-3">
                      {note}
                    </p>
                  ))}
                </div>
              </article>
            ) : (
              <p className="mt-5 border border-yuzu-line bg-yuzu-night/60 p-5 text-sm leading-6 text-yuzu-muted">
                Paste event text and draft an import to preview the normalized event record.
              </p>
            )}
          </section>

          <section className="border border-yuzu-line bg-yuzu-panel/72 p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-yuzu-gold">Shared Published Events</h2>
            <textarea
              className="mt-5 min-h-64 w-full border border-yuzu-line bg-yuzu-night/72 p-3 font-mono text-xs leading-5 text-yuzu-cream outline-none"
              readOnly
              value={serializedApprovedEvents}
            />
          </section>
        </div>
      </section>
    </main>
  );
}

function buildAdminEventInput(event: ApprovedImportedEvent): AdminEventInput {
  return {
    slug: event.slug,
    title: event.title,
    summary: event.deck,
    description: event.description,
    host: event.host,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: "America/Phoenix",
    location: {
      name: event.location,
      latitude: event.coordinates.latitude,
      longitude: event.coordinates.longitude,
    },
    source: {
      type: "operator_import",
      provider: event.sourceName.toLowerCase().includes("facebook") ? "facebook" : event.sourceName,
      url: event.sourceUrl,
    },
    imageUrl: event.image,
    accessLevel: event.access,
    capacity: event.capacity,
    includes: event.includes,
    agenda: event.agenda,
    goodFor: event.goodFor,
    status: "draft",
    visibility: "public",
    verificationStatus: "verified",
  };
}

function RuleRow({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-yuzu-line/70 bg-yuzu-night/50 px-3 py-2">
      <span className="text-yuzu-muted">{label}</span>
      <span className={tone === "ok" ? "text-yuzu-gold" : "text-yuzu-muted"}>{value}</span>
    </div>
  );
}
