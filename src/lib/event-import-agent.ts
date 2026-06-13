import type { EventExperience } from "@/lib/data";

export type EventCoordinates = {
  latitude: number;
  longitude: number;
};

export type EventImportDraftInput = {
  sourceUrl: string;
  sourceText: string;
};

export type EventImportComplianceReview = {
  ageRestricted: true;
  sourceAttributionRequired: true;
  prohibitedClaims: string[];
  reviewFlags: string[];
};

export type EventImportDraft = EventExperience & {
  sourceUrl: string;
  sourceName: string;
  sourceTextSummary: string;
  coordinates: EventCoordinates;
  confidence: number;
  agentNotes: string[];
  operatorReviewRequired: true;
  approvalStatus: "draft";
  complianceReview: EventImportComplianceReview;
};

export type ApprovedImportedEvent = Omit<EventImportDraft, "approvalStatus"> & {
  approvalStatus: "approved";
  approvedAt: string;
  approvedBy: "operator";
};

export type EventFeedExperience = EventExperience & {
  imported?: boolean;
  sourceName?: string;
  distanceMiles?: number;
};

type KnownEventSeed = Omit<
  EventImportDraft,
  "sourceUrl" | "sourceName" | "sourceTextSummary" | "confidence" | "agentNotes" | "operatorReviewRequired" | "approvalStatus" | "complianceReview"
> & {
  sourceUrlIncludes: string;
  textSignals: string[];
};

export const approvedEventImportsStorageKey = "yuzu-approved-event-imports";
export const approvedEventImportsUpdatedEvent = "yuzu-event-imports-updated";

const phoenixFallbackCoordinates = {
  latitude: 33.4484,
  longitude: -112.074,
};

const knownFacebookEventSeeds: KnownEventSeed[] = [
  {
    sourceUrlIncludes: "2502127350222287",
    textSignals: ["fox cigar bar", "every 2nd saturday", "williams field"],
    slug: "fox-cigar-bar-second-saturday",
    title: "Cigar Night at Fox Cigar Bar - Every 2nd Saturday",
    startsAt: "2026-07-11T19:00:00-07:00",
    endsAt: "2026-07-12T00:00:00-07:00",
    date: "July 11, 2026",
    time: "7:00 PM - 12:00 AM MST",
    location: "Fox Cigar Bar, 1464 E Williams Field Rd, Gilbert, AZ 85295",
    access: "Open",
    image: "/assets/events/fox-cigar-bar-second-saturday.jpg",
    imagePosition: "50% 50%",
    deck: "A Facebook-listed second-Saturday cigar night at Fox Cigar Bar in Gilbert with cigars, drinks, and fellowship.",
    description:
      "Fox Cigar Bar's second-Saturday cigar night is a local East Valley meetup for adults looking for a relaxed lounge evening. The event listing invites guests for cigars, drinks, or fellowship and should be verified by an operator before publication.",
    host: "Brothers of Prometheus 87 at Fox Cigar Bar",
    capacity: "Open lounge",
    coordinates: {
      latitude: 33.3079,
      longitude: -111.7596,
    },
    includes: ["Second-Saturday lounge meetup", "Cigars, drinks, and fellowship", "Gilbert East Valley event signal"],
    agenda: [
      { time: "7:00 PM", label: "Cigar night begins at Fox Cigar Bar" },
      { time: "9:00 PM", label: "Second-Saturday lounge session" },
      { time: "11:30 PM", label: "Final fellowship hour" },
    ],
    goodFor: ["East Valley cigar guests", "Members looking for a casual local lounge night", "Adults scanning recurring cigar meetups"],
  },
  {
    sourceUrlIncludes: "4317156221888698",
    textSignals: ["smoke", "desert", "phx cigar week", "october 8"],
    slug: "smoke-n-the-desert-phx-cigar-week-2026",
    title: "Smoke 'N The Desert: PHX Cigar Week 2026",
    startsAt: "2026-10-08T00:00:00-07:00",
    endsAt: "2026-10-11T23:59:00-07:00",
    date: "October 8, 2026",
    time: "Oct 8 at 12:00 AM - Oct 11 at 11:59 PM MST",
    location: "Greater Phoenix Metro - Chandler, Tempe, Phoenix, and Scottsdale",
    access: "Ticketed",
    image: "/assets/events/smoke-n-the-desert-phx-cigar-week-2026.jpg",
    imagePosition: "50% 42%",
    deck: "A multi-day Phoenix-area cigar week anchored in Chandler with event signals across the Greater Phoenix metro.",
    description:
      "Smoke 'N The Desert: PHX Cigar Week 2026 is listed as a multi-day cigar week running Thursday, October 8 through Sunday, October 11, 2026. The listing anchors the event in Chandler and references Greater Phoenix Metro activity across Chandler, Tempe, Phoenix, and Scottsdale.",
    host: "Smoke 'N The Desert / PHX Cigar Week",
    capacity: "Ticketed event",
    coordinates: {
      latitude: 33.301,
      longitude: -111.842,
    },
    includes: ["Phoenix-area cigar week", "Chandler event anchor", "Greater Phoenix metro activations"],
    agenda: [
      { time: "Oct 8", label: "PHX Cigar Week opens in the Greater Phoenix metro" },
      { time: "Oct 9-10", label: "Metro cigar-week activations" },
      { time: "Oct 11", label: "Final day of Smoke 'N The Desert programming" },
    ],
    goodFor: ["Phoenix-area cigar week travelers", "Members watching regional cigar events", "Adults planning a multi-day local cigar weekend"],
  },
];

export function draftEventImportFromFacebookText(input: EventImportDraftInput): EventImportDraft {
  const sourceUrl = input.sourceUrl.trim();
  const sourceText = input.sourceText.trim();
  const knownSeed = findKnownEventSeed(sourceUrl, sourceText);
  const sourceName = getSourceName(sourceUrl);
  const sourceTextSummary = summarizeSourceText(sourceText);

  if (knownSeed) {
    return {
      ...knownSeed,
      title: normalizeTitle(findTitle(sourceText) || knownSeed.title),
      sourceUrl,
      sourceName,
      sourceTextSummary,
      confidence: 0.92,
      agentNotes: buildAgentNotes(sourceName, true),
      operatorReviewRequired: true,
      approvalStatus: "draft",
      complianceReview: buildComplianceReview([]),
    };
  }

  const title = normalizeTitle(findTitle(sourceText) || "Imported Cigar Event");
  const location = findLocation(sourceText);
  const parsedSchedule = parseKnownScheduleLine(sourceText);
  const reviewFlags = [
    "Verify the date, time, venue, and host against the source before approving.",
    "Confirm this event is appropriate for adult cigar audiences.",
  ];

  return {
    slug: slugify(title),
    title,
    startsAt: parsedSchedule.startsAt,
    endsAt: parsedSchedule.endsAt,
    date: parsedSchedule.date,
    time: parsedSchedule.time,
    location,
    access: "Review",
    image: "/assets/about-lounge.png",
    imagePosition: "50% 48%",
    deck: `Imported cigar event draft from ${sourceName}.`,
    description:
      "This event was drafted from pasted source facts. An operator should verify the listing, venue, date, and audience fit before it appears in the public feed.",
    host: findHost(sourceText),
    capacity: "Review source",
    sourceUrl,
    sourceName,
    sourceTextSummary,
    coordinates: inferCoordinates(sourceText),
    confidence: calculateGenericConfidence({ sourceUrl, sourceText, location }),
    agentNotes: buildAgentNotes(sourceName, false),
    operatorReviewRequired: true,
    approvalStatus: "draft",
    complianceReview: buildComplianceReview(reviewFlags),
    includes: ["Imported event signal", "Operator review required", "Source attribution retained"],
    agenda: [{ time: parsedSchedule.date, label: "Verify event schedule before approving" }],
    goodFor: ["Adult Yuzu members scanning local cigar events", "Operators reviewing nearby event signals"],
  };
}

export function approveEventImportDraft(draft: EventImportDraft, approvedAt = new Date().toISOString()): ApprovedImportedEvent {
  return {
    ...draft,
    approvalStatus: "approved",
    approvedAt,
    approvedBy: "operator",
  };
}

export function serializeApprovedEventImports(events: readonly ApprovedImportedEvent[]) {
  return JSON.stringify(events);
}

export function readApprovedEventImports(serializedValue: string | null | undefined): ApprovedImportedEvent[] {
  if (!serializedValue) {
    return [];
  }

  try {
    const value = JSON.parse(serializedValue);

    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter(isApprovedImportedEvent);
  } catch {
    return [];
  }
}

export function approvedImportToEventExperience(event: ApprovedImportedEvent): EventFeedExperience {
  return {
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    date: event.date,
    time: event.time,
    location: event.location,
    access: event.access,
    image: event.image,
    imagePosition: event.imagePosition,
    deck: event.deck,
    description: event.description,
    host: event.host,
    capacity: event.capacity,
    sourceUrl: event.sourceUrl,
    coordinates: event.coordinates,
    includes: event.includes,
    agenda: event.agenda,
    goodFor: event.goodFor,
    imported: true,
    sourceName: event.sourceName,
  };
}

export function mergeEventsWithApprovedImports(
  staticEvents: readonly EventExperience[],
  approvedImports: readonly ApprovedImportedEvent[],
): EventFeedExperience[] {
  const staticSourceUrls = new Set(staticEvents.map((event) => event.sourceUrl).filter(Boolean));
  const staticSlugs = new Set(staticEvents.map((event) => event.slug));
  const importedEvents = approvedImports
    .filter((event) => !staticSlugs.has(event.slug) && !staticSourceUrls.has(event.sourceUrl))
    .map(approvedImportToEventExperience);

  return [...staticEvents, ...importedEvents];
}

export function rankEventsForLocation<TEvent extends EventExperience | ApprovedImportedEvent | EventFeedExperience>(
  events: readonly TEvent[],
  coordinates: EventCoordinates,
): Array<TEvent & { distanceMiles?: number }> {
  return events
    .map((event) => ({
      ...event,
      distanceMiles: event.coordinates ? getDistanceMiles(coordinates, event.coordinates) : undefined,
    }))
    .sort((left, right) => {
      const leftDistance = left.distanceMiles ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distanceMiles ?? Number.POSITIVE_INFINITY;

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      const leftStart = new Date(left.startsAt).getTime();
      const rightStart = new Date(right.startsAt).getTime();

      if (leftStart !== rightStart) {
        return leftStart - rightStart;
      }

      return left.title.localeCompare(right.title);
    });
}

export function getDistanceMiles(origin: EventCoordinates, destination: EventCoordinates) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function findKnownEventSeed(sourceUrl: string, sourceText: string) {
  const normalizedText = sourceText.toLowerCase();

  return knownFacebookEventSeeds.find(
    (event) =>
      sourceUrl.includes(event.sourceUrlIncludes) ||
      event.textSignals.every((signal) => normalizedText.includes(signal.toLowerCase())),
  );
}

function getSourceName(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);

    if (url.hostname.includes("facebook.com")) {
      return "Facebook Events";
    }

    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function summarizeSourceText(sourceText: string) {
  return sourceText
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 42)
    .join(" ");
}

function findTitle(sourceText: string) {
  return splitSourceLines(sourceText).find((line) => {
    const lowerLine = line.toLowerCase();

    return !lowerLine.includes(" at ") && !lowerLine.includes("going") && !lowerLine.match(/\b(am|pm)\b/) && !lowerLine.match(/\baz\b/);
  });
}

function findLocation(sourceText: string) {
  const lines = splitSourceLines(sourceText);
  const addressLine = lines.find((line) => /\bAZ\b|Arizona|\d{5}/i.test(line));
  const venueLine = lines.find((line) => /bar|lounge|cigar|club|venue/i.test(line));

  if (venueLine && addressLine && venueLine !== addressLine) {
    return `${normalizeAddressLine(venueLine)}, ${normalizeAddressLine(addressLine)}`;
  }

  return normalizeAddressLine(addressLine || venueLine || "Phoenix Metro");
}

function findHost(sourceText: string) {
  const line = splitSourceLines(sourceText).find((sourceLine) => /host|presented by|brothers of/i.test(sourceLine));

  return line ? normalizeTitle(line.replace(/^hosted by\s*/i, "")) : "Source-listed host";
}

function parseKnownScheduleLine(sourceText: string) {
  if (/july 11,\s*2026.*7\s*pm.*12\s*am/i.test(sourceText)) {
    return {
      startsAt: "2026-07-11T19:00:00-07:00",
      endsAt: "2026-07-12T00:00:00-07:00",
      date: "July 11, 2026",
      time: "7:00 PM - 12:00 AM MST",
    };
  }

  if (/oct(?:ober)?\s*8.*oct(?:ober)?\s*11|october\s*8th\s*-\s*11th/i.test(sourceText)) {
    return {
      startsAt: "2026-10-08T00:00:00-07:00",
      endsAt: "2026-10-11T23:59:00-07:00",
      date: "October 8, 2026",
      time: "Oct 8 at 12:00 AM - Oct 11 at 11:59 PM MST",
    };
  }

  return {
    startsAt: "2026-06-13T12:00:00-07:00",
    endsAt: "2026-06-13T14:00:00-07:00",
    date: "Review date",
    time: "Review time",
  };
}

function inferCoordinates(sourceText: string): EventCoordinates {
  const lowerText = sourceText.toLowerCase();

  if (lowerText.includes("gilbert") || lowerText.includes("williams field")) {
    return {
      latitude: 33.3079,
      longitude: -111.7596,
    };
  }

  if (lowerText.includes("chandler") || lowerText.includes("hamilton") || lowerText.includes("boston st")) {
    return {
      latitude: 33.301,
      longitude: -111.842,
    };
  }

  return phoenixFallbackCoordinates;
}

function calculateGenericConfidence(input: { sourceUrl: string; sourceText: string; location: string }) {
  let confidence = 0.45;

  if (/facebook\.com\/events\/\d+/i.test(input.sourceUrl)) {
    confidence += 0.15;
  }

  if (/\b(am|pm|2026|2027)\b/i.test(input.sourceText)) {
    confidence += 0.15;
  }

  if (/\bAZ\b|Arizona|\d{5}/i.test(input.location)) {
    confidence += 0.12;
  }

  if (/cigar|lounge|bar/i.test(input.sourceText)) {
    confidence += 0.1;
  }

  return Math.min(0.86, Number(confidence.toFixed(2)));
}

function buildAgentNotes(sourceName: string, matchedKnownEvent: boolean) {
  return [
    matchedKnownEvent
      ? `Matched a known ${sourceName} event pattern from the operator-provided source facts.`
      : `Drafted from operator-provided ${sourceName} source facts.`,
    "Human approval is required before this event appears in the public location feed.",
    "Keep the source link attached so members can verify the original listing.",
  ];
}

function buildComplianceReview(reviewFlags: string[]): EventImportComplianceReview {
  return {
    ageRestricted: true,
    sourceAttributionRequired: true,
    prohibitedClaims: ["health", "cessation", "medical", "therapeutic", "disease", "safety"],
    reviewFlags: ["21+ audience framing required", "No tobacco health or safety claims", ...reviewFlags],
  };
}

function isApprovedImportedEvent(value: unknown): value is ApprovedImportedEvent {
  const candidate = value as Partial<ApprovedImportedEvent>;

  return (
    Boolean(candidate) &&
    candidate.approvalStatus === "approved" &&
    typeof candidate.slug === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.sourceUrl === "string" &&
    typeof candidate.startsAt === "string" &&
    typeof candidate.endsAt === "string"
  );
}

function normalizeTitle(value: string) {
  return value
    .replace(/\s*-Every\b/i, " - Every")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddressLine(value: string) {
  return value
    .replace(/\bE\.\s*/g, "E ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSourceLines(sourceText: string) {
  return sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/['']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "imported-cigar-event"
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
