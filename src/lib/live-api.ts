import { draftToBodyMarkdown, type NewsroomDraft, type NewsroomDraftInput, type NewsStory, type NewsStoryImage } from "@/lib/newsroom";
import type { HumidorSensorDevice } from "@/lib/humidor-devices";
import type { EventExperience } from "@/lib/data";

export type LiveApiHeaders = Record<string, string>;

export type AccountSummary = {
  account: {
    email?: string;
    name?: string;
    groups?: string[];
  };
  profile?: {
    phone?: string;
    shippingAddress?: AccountShippingAddress | null;
  };
  source: string;
  membership: {
    tier: string | null;
    status: string | null;
    role: string | null;
    groups: string[];
  };
  database: {
    persisted: boolean;
    persistence: string;
    table?: string;
    memberId?: string;
  };
};

export type AccountShippingAddress = {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type AccountProfileUpdateInput = {
  name: string;
  phone: string;
  shippingAddress: AccountShippingAddress;
};

export type AccountProfileUpdateResponse = {
  account: AccountSummary["account"];
  profile: {
    phone: string;
    shippingAddress: AccountShippingAddress;
  };
  source: string;
  membership?: AccountSummary["membership"];
  database: {
    persisted: boolean;
    persistence: string;
    table: "member_profiles";
    memberId?: string;
  };
};

export type AccountOrder = {
  id: string;
  orderNumber?: string;
  placedAt?: string;
  status: string;
  fulfillmentStatus?: string;
  total?: number;
  currency?: string;
  itemCount?: number;
};

export type AccountOrdersResponse = {
  orders: AccountOrder[];
  persistence: string;
};

export type AdminPersistence = string | {
  status: string;
  table?: string;
};

export type AdminDashboardOverview = {
  counts: {
    orders: {
      total: number;
      paid: number;
      pending: number;
      refunded: number;
    };
    subscriptions: {
      total: number;
      active: number;
      pastDue: number;
      canceled: number;
    };
    holds: {
      total: number;
      open: number;
      resolved: number;
    };
    webhooks: {
      total: number;
      processed: number;
      pending: number;
      failed: number;
    };
    audit: {
      total: number;
      last24h: number;
    };
  };
  latest: {
    orderAt: string | null;
    subscriptionAt: string | null;
    holdAt: string | null;
    webhookAt: string | null;
    auditAt: string | null;
  };
};

export type AdminRecentOrder = {
  id: string;
  orderNumber?: string;
  email?: string;
  status: string;
  fulfillmentStatus?: string;
  complianceStatus?: string;
  total?: number;
  currency?: string;
  placedAt?: string;
};

export type AdminRecentSubscription = {
  id: string;
  email?: string;
  tierKey?: string;
  billingPeriod?: string;
  status: string;
  currentPeriodEnd?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
};

export type AdminAuditEntry = {
  id: string;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  requestId?: string | null;
  stripeEventId?: string | null;
  orderId?: string | null;
  complianceHoldId?: string | null;
  createdAt: string;
};

export type AdminOrderCustomer = {
  email?: string | null;
  name?: string | null;
  role?: string | null;
  membershipTier?: string | null;
  memberStatus?: string | null;
};

export type AdminOrder = {
  id: string;
  orderNumber?: string | null;
  email?: string | null;
  status: string;
  fulfillmentStatus?: string | null;
  complianceStatus?: string | null;
  subtotal?: number;
  tax?: number;
  shipping?: number;
  total?: number;
  currency?: string;
  itemCount?: number;
  placedAt?: string;
  updatedAt?: string | null;
  customer?: AdminOrderCustomer;
};

export type AdminOrdersResponse = {
  orders: AdminOrder[];
  summary: {
    total: number;
    paid: number;
    pending: number;
    fulfilled: number;
    needsAttention: number;
  };
  persistence: AdminPersistence;
};

export type AdminOrderUpdateInput = {
  status?: string;
  fulfillmentStatus?: string;
  complianceStatus?: string;
};

export type AdminMember = {
  id: string;
  cognitoSub?: string | null;
  email: string;
  emailVerified?: boolean;
  displayName?: string | null;
  role: string;
  membershipTier?: string | null;
  memberStatus: string;
  lastSeenAt?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
  subscriptionStatus?: string | null;
  subscriptionTier?: string | null;
  subscriptionPeriod?: string | null;
  orderCount?: number;
  totalSpend?: number;
  humidorItemCount?: number;
};

export type AdminMembersResponse = {
  members: AdminMember[];
  summary: {
    total: number;
    admins: number;
    operators: number;
    members: number;
    nonMembers: number;
    banned: number;
  };
  persistence: AdminPersistence;
};

export type AdminMemberAccessUpdateInput = {
  role?: string;
  membershipTier?: string | null;
  memberStatus?: string;
};

export type AdminMembersRequestOptions = {
  limit?: number;
  q?: string;
  status?: string;
};

export type AdminComplianceHold = Record<string, unknown> & {
  caseId?: string;
  createdAt?: string;
  id?: string;
  orderId?: string;
  orderNumber?: string;
  reason?: string;
  status?: string;
  email?: string;
  orderStatus?: string;
  fulfillmentStatus?: string;
  complianceStatus?: string;
  total?: number;
  currency?: string;
  resolvedAt?: string | null;
  message?: string;
  details?: Record<string, unknown>;
};

export type AdminComplianceHoldsResponse = {
  holds: AdminComplianceHold[];
  orders: AdminRecentOrder[];
  subscriptions: AdminRecentSubscription[];
  audit: AdminAuditEntry[];
  overview: AdminDashboardOverview;
  summary: {
    total: number;
    open: number;
    resolved: number;
  };
  persistence: AdminPersistence;
};

export type AdminWebhookEvent = Record<string, unknown> & {
  createdAt?: string;
  id?: string;
  requestId?: string;
  status?: string;
  type?: string;
  processedAt?: string | null;
  processingStatus?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  orderStatus?: string | null;
  fulfillmentStatus?: string | null;
  complianceStatus?: string | null;
  actorEmail?: string | null;
  lastAction?: string | null;
};

export type AdminWebhookEventsResponse = {
  events: AdminWebhookEvent[];
  summary: {
    total: number;
    processed: number;
    pending: number;
    failed: number;
  };
  persistence: AdminPersistence;
};

export type AdminStripeCatalogPreviewItem = {
  sku: string;
  name: string;
  price: number;
  publishStatus: string;
  stripePriceId: string;
};

export type AdminStripeSyncProductsResponse = {
  sync: {
    status: string;
    seedScope: string;
    liveApprovalRequired: boolean;
    catalogReady: boolean;
    stripeConfigured: boolean;
    webhookConfigured: boolean;
    catalogSource: string;
    configuredProductCount: number;
    publishedProductCount: number;
    membershipPriceKeys: string[];
    taxStatus: string;
    apiVersion: string | null;
    sampleSkus: string[];
    catalogPreview: AdminStripeCatalogPreviewItem[];
    notes: string[];
  };
};

export type ConciergeAgentMode = "concierge" | "cigar_guide" | "support" | "humidor" | "admin" | "weekly_news";

export type ConciergeChatInput = {
  message: string;
  agent?: ConciergeAgentMode;
  conversationId?: string;
  voiceOutput?: boolean;
};

export type ConciergeSpeechOutput = {
  service: "amazon_polly" | "unavailable";
  status: "synthesized" | "disabled" | "failed";
  mimeType: string | null;
  audioBase64: string | null;
  voiceId: string | null;
};

export type ConciergeVoiceDetails = {
  inputAudio: {
    accepted: boolean;
    mimeType: string;
    bytes: number;
    durationMs: number | null;
  };
  transcription: {
    service: "amazon_transcribe" | "browser_transcript_hint" | "unavailable";
    status: "completed" | "hint_used" | "disabled" | "failed";
    transcript: string;
  };
  speech: ConciergeSpeechOutput;
};

export type AiSource = {
  title?: string;
  label?: string;
  url?: string;
  uri?: string;
  domain?: string;
  sourceType?: string;
  score?: number;
};

export type ConciergeChatResponse = {
  conversation: {
    id: string;
    persisted: boolean;
    persistence: string;
  };
  agent: string;
  ai: {
    status: string;
    modelId?: string;
    stopReason?: string | null;
    knowledgeBaseId?: string | null;
    knowledgeBaseStatus?: string;
    retrievedContextCount?: number;
    sources?: AiSource[];
    grounded?: boolean;
  };
  lex?: {
    status: string;
    intentName: string | null;
    confidence: number | null;
    dialogActionType: string | null;
    slotToElicit: string | null;
    slots: Record<string, string>;
    sessionId: string;
  };
  reply: string;
  input: {
    accepted: boolean;
    length: number;
  };
  voice?: {
    speech: ConciergeSpeechOutput;
  };
  guardrails: {
    ageRestricted: boolean;
    piiMinimized: boolean;
    tobaccoHealthClaims: string;
    humanHandoff: boolean;
  };
  nextActions: string[];
  citations?: AiSource[];
};

export type ConciergeVoiceInput = {
  audioBase64: string;
  mimeType: string;
  agent?: ConciergeAgentMode;
  conversationId?: string;
  durationMs?: number;
  fileName?: string;
  transcriptHint?: string;
  voiceOutput?: boolean;
};

export type ConciergeVoiceResponse = Omit<ConciergeChatResponse, "voice"> & {
  voice: ConciergeVoiceDetails;
};

export type HumidorItem = {
  id: string;
  name: string;
  brand: string;
  line: string;
  vitola: string;
  wrapper: string;
  origin: string;
  strength: string;
  quantity: number;
  rating: number | null;
  purchaseDate: string | null;
  agingStartDate: string | null;
  productionDate?: string | null;
  reorderReminder: string | null;
  humidorLocation: string;
  tray: string;
  tastingNotes: string;
  source: string;
  estimatedValue: number | null;
  estimatedValueCurrency: string;
  estimatedValueSource: string;
  cigarImage: HumidorCigarImage | null;
  createdAt?: string;
};

export type HumidorCigarImage = {
  dataUrl?: string;
  imageUrl?: string;
  mimeType: string;
  fileName: string;
  bytes: number;
  source: string;
};

export type HumidorItemsResponse = {
  items: HumidorItem[];
  persistence: string;
};

export type HumidorSmokeLog = {
  id: string;
  humidorItemId: string | null;
  cigarName: string;
  smokedAt: string;
  rating: number | null;
  drinkPairing: string;
  pairing: string;
  notes: string;
  durationMinutes: number | null;
  source: string;
  createdAt?: string;
};

export type HumidorSmokeLogInput = {
  humidorItemId?: string | null;
  cigarName?: string;
  smokedAt?: string | null;
  rating?: number | null;
  drinkPairing?: string;
  pairing?: string;
  notes?: string;
  durationMinutes?: number | null;
  source?: string;
};

export type HumidorSmokeLogsResponse = {
  logs: HumidorSmokeLog[];
  persistence: string;
};

export type HumidorPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type HumidorProfileLocationKind = "humidor" | "other";

export type HumidorProfileLocation = {
  name: string;
  kind: HumidorProfileLocationKind;
  trays: string[];
};

export type HumidorLocationProfile = {
  humidorName: string;
  defaultLocation: string;
  locations: HumidorProfileLocation[];
};

export type HumidorAlertPreferences = {
  pushEnabled: boolean;
  reorderRemindersEnabled: boolean;
  climateAlertsEnabled: boolean;
  pushSubscription: HumidorPushSubscription | null;
  pairedDevices: HumidorSensorDevice[];
  humidorProfile: HumidorLocationProfile;
};

export type HumidorAlertsResponse = {
  preferences: HumidorAlertPreferences;
  persistence: string;
};

export type HumidorDashboardBootstrap = {
  items: HumidorItemsResponse;
  smokes: HumidorSmokeLogsResponse;
  smokesError: string | null;
  alerts: HumidorAlertsResponse | null;
  alertsError: string | null;
};

export type HumidorAlertSettingsUpdate = {
  pushEnabled: boolean;
  reorderRemindersEnabled: boolean;
  climateAlertsEnabled: boolean;
  pushSubscription: HumidorPushSubscription | null;
  pairedDevices?: HumidorSensorDevice[];
  humidorProfile?: HumidorLocationProfile;
};

export type HumidorItemInput = Partial<Omit<HumidorItem, "id" | "createdAt">> & {
  name: string;
};

export type HumidorItemUpdateInput = {
  agingStartDate?: string;
  archived?: boolean;
  humidorLocation?: string;
  sharedNotes?: string;
  sharedQuantity?: number;
  sharedWith?: string;
  action?: "delete" | "share";
  tray?: string;
};

export type HumidorItemActionResponse = {
  item: HumidorItem;
  log?: HumidorSmokeLog;
  inventoryAction?: {
    type: "deleted" | "shared";
    quantityBefore: number;
    quantityAfter: number;
    archived: boolean;
  };
  persistence: {
    status: string;
    table: string;
  };
  tracking?: {
    status: string;
    table: string;
  };
};

export type HumidorSharedItemInput = {
  sharedQuantity?: number;
  sharedWith?: string;
  sharedNotes?: string;
};

export type CigarImageRole =
  | "band_front"
  | "band_back"
  | "secondary_band"
  | "box_front"
  | "box_back"
  | "box_label"
  | "barcode"
  | "whole_cigar"
  | "other";

export type CigarImageIdentifyImage = {
  imageBase64: string;
  mimeType: string;
  fileName?: string;
  role?: CigarImageRole;
};

export type CigarImageIdentifyInput = {
  contractVersion?: 2;
  /** Legacy single-image fields remain available while deployed clients and APIs roll forward. */
  imageBase64?: string;
  mimeType?: string;
  fileName?: string;
  images?: CigarImageIdentifyImage[];
  notes?: string;
};

export type CigarIdentificationStatus = "identified" | "ambiguous" | "insufficient_evidence";

export type CigarImageCandidate = {
  name: string;
  brand: string;
  line: string;
  vitola: string;
  wrapper: string;
  origin: string;
  confidence: "high" | "medium" | "low";
  matchScore: number;
  evidence: string[];
  distinguishingFeatures: string[];
  sourceUrls: string[];
};

export type CigarImageDetails = {
  manufacturer: string;
  country: string;
  region: string;
  factory: string;
  size: string;
  length: string;
  ringGauge: string;
  shape: string;
  wrapper: string;
  binder: string;
  filler: string;
  blend: string;
  flavorProfile: string[];
  body: string;
  finish: string;
  msrp: string;
  releaseStatus: string;
  packaging: string;
  sourceSummary: string;
  imageObservations: string[];
};

export type CigarImageSuggestion = HumidorItemInput & {
  source: "ai_cigar_image";
  confidence: "high" | "medium" | "low";
  evidence: string[];
  needsReview: string[];
  details: CigarImageDetails;
  identificationStatus?: CigarIdentificationStatus;
  candidates?: CigarImageCandidate[];
};

export type CigarImageIdentifyResponse = {
  suggestion: CigarImageSuggestion;
  identificationStatus?: CigarIdentificationStatus;
  candidates?: CigarImageCandidate[];
  sources?: AiSource[];
  ai: {
    status: string;
    modelId?: string;
    stopReason?: string | null;
    knowledgeBaseStatus?: string;
    retrievedContextCount?: number;
    sources?: AiSource[];
    rekognition?: {
      status: string;
      minConfidence: number;
      textCount: number;
      textLines: Array<{
        text: string;
        confidence: number;
      }>;
      labelStatus: string;
      minLabelConfidence: number;
      labelCount: number;
      labels: Array<{
        name: string;
        confidence: number;
        parents: string[];
        categories: string[];
        aliases: string[];
      }>;
    };
  };
  input: {
    accepted: boolean;
    imageType: string;
    imageBytes: number;
    notesLength: number;
  };
  guardrails: {
    ageRestricted: boolean;
    piiMinimized: boolean;
    tobaccoHealthClaims: string;
    humanHandoff: boolean;
  };
  nextActions: string[];
};

export type HumidorEnrichmentField = "info" | "image" | "msrp";

export type HumidorItemEnrichmentInput = {
  approved?: boolean;
  fields?: HumidorEnrichmentField[];
};

export type HumidorItemEnrichmentResponse = {
  item: HumidorItem;
  previewItem?: HumidorItem;
  enrichment: {
    status: "updated" | "complete" | "needs_review" | "pending_approval";
    requestedFields: HumidorEnrichmentField[];
    missingFields: HumidorEnrichmentField[];
    updatedFields: string[];
    evidence: string[];
    needsReview: string[];
    confidence?: "high" | "medium" | "low";
  };
  ai: {
    status: string;
    modelId?: string;
    agentId?: string;
    agentAliasId?: string;
    knowledgeBaseStatus?: string;
    retrievedContextCount?: number;
    browserSearch?: {
      status: "requested";
      query: string;
      missingFields: HumidorEnrichmentField[];
      sourcePolicy: string[];
    };
    rekognition?: {
      status: string;
      minConfidence: number;
      textCount: number;
      textLines: Array<{
        text: string;
        confidence: number;
      }>;
      labelStatus: string;
      minLabelConfidence: number;
      labelCount: number;
      labels: Array<{
        name: string;
        confidence: number;
        parents: string[];
        categories: string[];
        aliases: string[];
      }>;
    };
    stopReason?: string | null;
  };
  persistence: {
    status: string;
    table: string;
  };
};

export type LivePageEdits = Record<string, string>;

export type LivePageContentResponse = {
  page: {
    route: string;
    edits: LivePageEdits;
    updatedAt: string | null;
  };
  persistence: string;
};

export type SaveLivePageContentResponse = {
  page: {
    route: string;
    edits: LivePageEdits;
    updatedAt: string | null;
  };
  persistence: {
    status: string;
    table: "site_page_content";
  };
};

export type NewsStoryDraftInput = NewsroomDraftInput;

export type NewsStoryPublishInput = Omit<Partial<NewsroomDraft>, "publishStatus"> & {
  bodyMarkdown?: string;
  images?: NewsStoryImage[];
  storyImages?: NewsStoryImage[];
  operatorApproved: boolean;
  publishStatus?: "draft" | "published";
  status?: "draft" | "published" | "archived";
};

export type NewsStoryDraftResponse = {
  draft: NewsroomDraft;
  prompt: {
    acceptedSourceCount: number;
    blockedSourceCount: number;
  };
  ai: {
    status: string;
    modelId?: string;
    agentId?: string;
    agentAliasId?: string;
    knowledgeBaseStatus?: string;
    retrievedContextCount?: number;
  };
};

export type PublishNewsStoryResponse = {
  story: NewsStory;
  deduplicated?: boolean;
  persistence: {
    status: string;
    table: "news_stories";
  };
};

export type PublishedNewsStoriesResponse = {
  stories: NewsStory[];
  persistence: string;
};

export type LiveEventStatus = "draft" | "published" | "canceled" | "archived";
export type LiveEventVisibility = "public" | "members" | "sensei" | "daimyo";
export type LiveEventVerificationStatus = "trusted_source" | "needs_review" | "verified" | "stale";

export type LiveEventLocation = {
  name: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type LiveEventSource = {
  type: string;
  provider: string | null;
  sourceId: string | null;
  providerEventId: string | null;
  providerOccurrenceId: string | null;
  url: string | null;
};

export type LivePublishedEvent = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  host: string | null;
  status: LiveEventStatus;
  visibility: LiveEventVisibility;
  verificationStatus: LiveEventVerificationStatus;
  startsAt: string;
  endsAt: string;
  timezone: string | null;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  location: LiveEventLocation;
  source: LiveEventSource;
  ticketUrl: string | null;
  imageUrl: string | null;
  accessLevel: string | null;
  capacity: string | null;
  includes: string[];
  agenda: Array<{ time: string; label: string }>;
  goodFor: string[];
  publishedAt: string | null;
  updatedAt: string;
};

export type PublishedEventsResponse = {
  requestId?: string;
  events: LivePublishedEvent[];
  feed: {
    from: string;
    to: string;
    count: number;
    updatedAt: string | null;
    lastSuccessfulSyncAt: string | null;
  };
  persistence: string;
};

export type PublishedEventsRequestOptions = {
  from?: string;
  to?: string;
  limit?: number;
};

export type AdminEventsResponse = {
  requestId?: string;
  events: LivePublishedEvent[];
  summary?: Partial<Record<LiveEventStatus, number>>;
  persistence: string;
};

export type AdminEventsRequestOptions = {
  limit?: number;
  status?: LiveEventStatus;
};

export type AdminEventInput = {
  slug?: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  host?: string | null;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  allDay?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  location?: Partial<LiveEventLocation>;
  source?: Partial<LiveEventSource>;
  ticketUrl?: string | null;
  imageUrl?: string | null;
  accessLevel?: string | null;
  capacity?: string | null;
  includes?: string[];
  agenda?: Array<{ time: string; label: string }>;
  goodFor?: string[];
  status?: LiveEventStatus;
  visibility?: LiveEventVisibility;
  verificationStatus?: LiveEventVerificationStatus;
};

export type AdminEventUpdateInput = Partial<AdminEventInput>;

export type AdminEventMutationResponse = {
  event: LivePublishedEvent;
  persistence: {
    status: string;
    table: "events";
  };
};

export type RuntimeEventExperience = EventExperience & {
  liveId: string;
  imported: boolean;
  sourceName: string;
  sourceType: string;
  externalSource: boolean;
};

export function livePublishedEventToExperience(event: LivePublishedEvent): RuntimeEventExperience {
  const sourceUrl = event.ticketUrl || event.source.url || undefined;
  const location = formatLiveEventLocation(event.location);

  return {
    liveId: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    date: formatLiveEventDate(event),
    time: formatLiveEventTime(event),
    location,
    access: event.accessLevel || "Open",
    image: event.imageUrl || "/assets/about-lounge.png",
    imagePosition: "50% 50%",
    deck: event.summary || event.description || "See the source listing for current event details.",
    description: event.description || event.summary || "See the source listing for current event details.",
    host: event.host || event.location.name || "Yuzu Cigar Club",
    capacity: event.capacity || "See event listing",
    sourceUrl,
    coordinates:
      typeof event.location.latitude === "number" && typeof event.location.longitude === "number"
        ? { latitude: event.location.latitude, longitude: event.location.longitude }
        : undefined,
    includes: event.includes,
    agenda: event.agenda,
    goodFor: event.goodFor,
    imported: event.source.type === "operator_import",
    sourceName: event.source.provider || event.source.type,
    sourceType: event.source.type,
    externalSource: Boolean(sourceUrl),
  };
}

function formatLiveEventLocation(location: LiveEventLocation) {
  return [
    location.name,
    location.addressLine1,
    location.addressLine2,
    [location.city, location.state, location.postalCode].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ") || "Location announced with registration";
}

function formatLiveEventDate(event: LivePublishedEvent) {
  if (event.allDay && event.startDate) {
    return formatCalendarDate(event.startDate, event.timezone);
  }

  return formatCalendarDate(event.startsAt, event.timezone);
}

function formatLiveEventTime(event: LivePublishedEvent) {
  if (event.allDay) {
    return "All day";
  }

  const timeZone = safeEventTimeZone(event.timezone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });

  return `${formatter.format(new Date(event.startsAt))} - ${formatter.format(new Date(event.endsAt))}`;
}

function formatCalendarDate(value: string, requestedTimeZone: string | null) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : safeEventTimeZone(requestedTimeZone),
    year: "numeric",
  }).format(date);
}

function safeEventTimeZone(value: string | null) {
  if (!value) {
    return "America/Phoenix";
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "America/Phoenix";
  }
}

type ErrorPayload = {
  error?: string;
  message?: string;
};

export async function fetchAccountSummary(headers: LiveApiHeaders) {
  return getLive<AccountSummary>("/account/me", headers);
}

export async function updateLiveAccountProfile(input: AccountProfileUpdateInput, headers: LiveApiHeaders) {
  return patchLive<AccountProfileUpdateResponse>("/account/me", input, headers);
}

export async function fetchAccountOrders(headers: LiveApiHeaders) {
  return getLive<AccountOrdersResponse>("/commerce/orders", headers);
}

export async function fetchAdminComplianceHolds(headers: LiveApiHeaders) {
  return getLive<AdminComplianceHoldsResponse>("/admin/commerce/compliance-holds", headers);
}

export async function fetchAdminOrders(headers: LiveApiHeaders) {
  return getLive<AdminOrdersResponse>("/admin/commerce/orders", headers);
}

export async function updateAdminOrder(orderId: string, input: AdminOrderUpdateInput, headers: LiveApiHeaders) {
  return patchLive<{ order: AdminOrder; persistence: { status: string; table: "commerce_orders" } }>(
    `/admin/commerce/orders/${encodeURIComponent(orderId)}`,
    input,
    headers
  );
}

export async function fetchAdminMembers(headers: LiveApiHeaders, options: AdminMembersRequestOptions = {}) {
  const params = new URLSearchParams();

  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  if (options.status) {
    params.set("status", options.status);
  }

  if (options.q) {
    params.set("q", options.q);
  }

  const query = params.toString();

  return getLive<AdminMembersResponse>(`/admin/members${query ? `?${query}` : ""}`, headers);
}

export async function updateAdminMemberAccess(memberId: string, input: AdminMemberAccessUpdateInput, headers: LiveApiHeaders) {
  return patchLive<{ member: AdminMember; persistence: { status: string; table: "members" } }>(
    `/admin/members/${encodeURIComponent(memberId)}/access`,
    input,
    headers
  );
}

export async function fetchAdminWebhookEvents(headers: LiveApiHeaders) {
  return getLive<AdminWebhookEventsResponse>("/admin/commerce/webhook-events", headers);
}

export async function syncAdminStripeProducts(headers: LiveApiHeaders) {
  return postLive<AdminStripeSyncProductsResponse>("/admin/commerce/stripe-sync-products", {}, headers);
}

export async function sendConciergeChat(input: ConciergeChatInput, headers: LiveApiHeaders) {
  return postLive<ConciergeChatResponse>("/concierge/chat", input, headers);
}

export async function sendConciergeVoiceMessage(input: ConciergeVoiceInput, headers: LiveApiHeaders) {
  return postLive<ConciergeVoiceResponse>("/concierge/voice", input, headers);
}

export async function fetchHumidorItems(headers: LiveApiHeaders) {
  return getLive<HumidorItemsResponse>("/humidor/items", headers);
}

export async function fetchHumidorSmokeLogs(headers: LiveApiHeaders) {
  return getLive<HumidorSmokeLogsResponse>("/humidor/smokes", headers);
}

export async function fetchHumidorAlertPreferences(headers: LiveApiHeaders) {
  return getLive<HumidorAlertsResponse>("/humidor/alerts", headers);
}

export async function fetchHumidorDashboardBootstrap(headers: LiveApiHeaders): Promise<HumidorDashboardBootstrap> {
  const [itemsResult, smokesResult, alertsResult] = await Promise.allSettled([
    fetchHumidorItems(headers),
    fetchHumidorSmokeLogs(headers),
    fetchHumidorAlertPreferences(headers),
  ]);

  if (itemsResult.status === "rejected") {
    throw itemsResult.reason;
  }

  if (alertsResult.status === "rejected") {
    return {
      items: itemsResult.value,
      smokes:
        smokesResult.status === "fulfilled"
          ? smokesResult.value
          : {
              logs: [],
              persistence: "",
            },
      smokesError: smokesResult.status === "rejected" ? getLiveApiErrorMessage(smokesResult.reason) : null,
      alerts: null,
      alertsError: getLiveApiErrorMessage(alertsResult.reason),
    };
  }

  return {
    items: itemsResult.value,
    smokes:
      smokesResult.status === "fulfilled"
        ? smokesResult.value
        : {
            logs: [],
            persistence: "",
          },
    smokesError: smokesResult.status === "rejected" ? getLiveApiErrorMessage(smokesResult.reason) : null,
    alerts: alertsResult.value,
    alertsError: null,
  };
}

export async function updateHumidorAlertPreferences(input: HumidorAlertSettingsUpdate, headers: LiveApiHeaders) {
  return postLive<HumidorAlertsResponse>("/humidor/alerts", input, headers);
}

export async function createHumidorItem(input: HumidorItemInput, headers: LiveApiHeaders) {
  return postLive<{ item: HumidorItem; persistence: { status: string; table: string } }>("/humidor/items", input, headers);
}

export async function createSmokeLog(input: HumidorSmokeLogInput, headers: LiveApiHeaders) {
  return postLive<{ log: HumidorSmokeLog; persistence: { status: string; table: string } }>("/humidor/smokes", input, headers);
}

export async function updateHumidorItem(itemId: string, input: HumidorItemUpdateInput, headers: LiveApiHeaders) {
  return patchLive<{ item: HumidorItem; persistence: { status: string; table: string } }>(
    `/humidor/items/${encodeURIComponent(itemId)}`,
    input,
    headers,
  );
}

export async function shareHumidorItem(itemId: string, input: HumidorSharedItemInput, headers: LiveApiHeaders) {
  return patchLive<HumidorItemActionResponse>(
    `/humidor/items/${encodeURIComponent(itemId)}`,
    {
      action: "share",
      sharedQuantity: input.sharedQuantity ?? 1,
      sharedWith: input.sharedWith,
      sharedNotes: input.sharedNotes,
    },
    headers,
  );
}

export async function deleteHumidorItem(itemId: string, headers: LiveApiHeaders) {
  return patchLive<HumidorItemActionResponse>(
    `/humidor/items/${encodeURIComponent(itemId)}`,
    {
      action: "delete",
      archived: true,
    },
    headers,
  );
}

export async function enrichHumidorItem(itemId: string, input: HumidorItemEnrichmentInput, headers: LiveApiHeaders) {
  return patchLive<HumidorItemEnrichmentResponse>(`/humidor/items/${encodeURIComponent(itemId)}/enrich`, input, headers);
}

export async function identifyCigarFromImage(input: CigarImageIdentifyInput, headers: LiveApiHeaders) {
  return postLive<CigarImageIdentifyResponse>("/humidor/identify-cigar", input, headers);
}

export async function fetchLivePageContent(route: string) {
  return getPublicLive<LivePageContentResponse>(`/content/pages?route=${encodeURIComponent(route)}`);
}

export async function saveLivePageContent(route: string, edits: LivePageEdits, headers: LiveApiHeaders) {
  return postLive<SaveLivePageContentResponse>("/content/pages", { route, edits }, headers);
}

export async function fetchPublishedNewsStories(limit = 12) {
  const normalizedLimit = Math.min(Math.max(Math.trunc(limit) || 12, 1), 50);
  return getPublicLive<PublishedNewsStoriesResponse>(`/news/stories?limit=${normalizedLimit}`);
}

export async function fetchPublishedEvents(options: PublishedEventsRequestOptions = {}) {
  const params = new URLSearchParams();

  if (options.from) {
    params.set("from", options.from);
  }

  if (options.to) {
    params.set("to", options.to);
  }

  if (options.limit) {
    params.set("limit", String(Math.min(Math.max(Math.trunc(options.limit), 1), 250)));
  }

  const query = params.toString();
  return getPublicLive<PublishedEventsResponse>(`/events${query ? `?${query}` : ""}`);
}

export async function fetchAdminEvents(headers: LiveApiHeaders, options: AdminEventsRequestOptions = {}) {
  const params = new URLSearchParams();

  if (options.status) {
    params.set("status", options.status);
  }

  if (options.limit) {
    params.set("limit", String(Math.min(Math.max(Math.trunc(options.limit), 1), 250)));
  }

  const query = params.toString();
  return getLive<AdminEventsResponse>(`/admin/events${query ? `?${query}` : ""}`, headers);
}

export async function createAdminEvent(input: AdminEventInput, headers: LiveApiHeaders) {
  return postLive<AdminEventMutationResponse>("/admin/events", input, headers);
}

export async function updateAdminEvent(eventId: string, input: AdminEventUpdateInput, headers: LiveApiHeaders) {
  return patchLive<AdminEventMutationResponse>(`/admin/events/${encodeURIComponent(eventId)}`, input, headers);
}

export async function publishAdminEvent(eventId: string, headers: LiveApiHeaders) {
  return postLive<AdminEventMutationResponse>(`/admin/events/${encodeURIComponent(eventId)}/publish`, {}, headers);
}

export async function archiveAdminEvent(eventId: string, headers: LiveApiHeaders) {
  return postLive<AdminEventMutationResponse>(`/admin/events/${encodeURIComponent(eventId)}/archive`, {}, headers);
}

export async function draftNewsStory(input: NewsStoryDraftInput, headers: LiveApiHeaders) {
  return postLive<NewsStoryDraftResponse>("/news/story-drafts", input, headers);
}

export async function publishNewsStory(input: NewsStoryPublishInput, headers: LiveApiHeaders) {
  const body = {
    ...input,
    bodyMarkdown: input.bodyMarkdown || (input.sections ? draftToBodyMarkdown({ sections: input.sections }) : ""),
    publishStatus: input.publishStatus || input.status || "published",
  };

  return postLive<PublishNewsStoryResponse>("/news/stories", body, headers);
}

export function getLiveApiErrorMessage(error: unknown) {
  const code = getLiveApiErrorCode(error);
  const fallback = error instanceof Error ? error.message : "The live Yuzu API is temporarily unavailable.";
  const messages: Record<string, string> = {
    admin_forbidden: "Only admins and concierge operators can publish live page edits.",
    invalid_live_page_route: "This page is not configured for live editing.",
    live_api_not_configured: "The live Yuzu API URL is not configured for this deployment.",
    live_auth_required: "Sign in with Cognito before loading live account data.",
    live_page_content_unavailable: "Live page publishing is not configured for this environment yet.",
    missing_message: "Enter a message for the Yuzu concierge.",
    missing_voice_audio: "Record a voice message before sending it to the Yuzu concierge.",
    invalid_voice_audio: "The recorded voice message could not be decoded.",
    unsupported_voice_audio_type: "Record a WebM, Ogg, MP4, MPEG, WAV, or M4A voice message.",
    voice_audio_too_large: "Record a voice message under 6 MB.",
    missing_voice_transcript: "The voice message could not be transcribed. Try again or send it as text.",
    voice_services_not_configured: "Voice transcription is not configured yet. Try sending the message as text.",
    live_api_network_error: "The live Yuzu API could not be reached from this site. Try again once the API route and CORS access are available.",
    missing_cigar_image: "Upload or take a cigar photo before asking the humidor agent to identify it.",
    invalid_profile: "Enter a display name before saving your account profile.",
    invalid_cigar_image: "The uploaded cigar image could not be decoded.",
    unsupported_cigar_image_type: "Upload a PNG, JPEG, GIF, or WebP cigar image.",
    cigar_image_too_large: "Keep each cigar photo under 3.75 MB and 8000 pixels per side, and the full set under 4 MB. Crop tightly around the band or label and try again.",
    database_writes_not_ready: "The live member database is not ready for updates yet.",
    humidor_item_not_found: "That humidor cigar could not be found for this account.",
    invalid_humidor_enrichment_fields: "Choose info, image, or MSRP for humidor enrichment.",
    invalid_humidor_item_update: "Save one humidor inventory action at a time.",
    invalid_shared_quantity: "Shared cigar quantity must be at least 1.",
    missing_humidor_item_id: "Open a saved cigar before asking the humidor agent to update it.",
    missing_humidor_location: "Enter a humidor location before updating this cigar.",
    shared_quantity_exceeds_inventory: "You cannot share more cigars than are currently in this humidor record.",
    admin_agent_forbidden: "Only admins and concierge operators can use the admin agent.",
    news_agent_forbidden: "Only admins and concierge operators can use the weekly news agent.",
    news_agent_not_configured: "The weekly news agent is not configured for this environment yet.",
    news_publish_forbidden: "Only admins and concierge operators can publish news stories.",
    official_source_required: "Add at least one official source before drafting or publishing.",
    verified_source_evidence_required:
      "Publishing needs a specific official release, product, event, regulator, or wire page—not a homepage or unverified source.",
    invalid_news_slug: "Use a story title or slug containing letters or numbers.",
    unverified_news_image:
      "Use a Yuzu-owned image or an image from the cited official maker page; remove unrelated or unverified image URLs.",
    internal_error: "The live Yuzu API is temporarily unavailable.",
    live_api_error: "The live Yuzu API is temporarily unavailable.",
    news_story_placeholder_body: "The draft still contains placeholder scaffold copy. Regenerate or replace it with a real story before publishing.",
    operator_approval_required: "Review and approve the story before publishing.",
    missing_news_title: "Add a title before publishing the news story.",
    missing_news_body: "Add story body copy before publishing.",
    missing_push_subscription: "Save your browser's push subscription to enable mobile alerts.",
    push_not_supported: "Push alerts are not available on this browser.",
    push_permission_denied: "Notification permission is required to enable push alerts.",
    push_update_failed: "We could not save your push alert preference right now.",
    unauthorized: "Your Cognito session expired. Please sign in again.",
    forbidden: "Your Cognito account is not authorized for this live API action.",
  };

  return code ? messages[code] ?? fallback : fallback;
}

function getLiveApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_YCC_API_BASE_URL || "").replace(/\/$/, "");
}

async function getLive<T>(path: string, headers: LiveApiHeaders) {
  return requestLive<T>(path, {
    method: "GET",
    headers: buildHeaders(headers),
  });
}

async function getPublicLive<T>(path: string) {
  return requestLive<T>(path, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });
}

async function postLive<T>(path: string, body: unknown, headers: LiveApiHeaders) {
  return requestLive<T>(path, {
    method: "POST",
    headers: buildHeaders(headers, { "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

async function patchLive<T>(path: string, body: unknown, headers: LiveApiHeaders) {
  return requestLive<T>(path, {
    method: "PATCH",
    headers: buildHeaders(headers, { "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
}

async function requestLive<T>(path: string, init: RequestInit) {
  const apiBaseUrl = getLiveApiBaseUrl();

  if (!apiBaseUrl) {
    throw createLiveApiError("live_api_not_configured", "NEXT_PUBLIC_YCC_API_BASE_URL is not configured.");
  }

  const response = await fetchLiveWithNetworkRetry(`${apiBaseUrl}${path}`, init);
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload | T;

  if (!response.ok) {
    const errorPayload = payload && typeof payload === "object" ? (payload as ErrorPayload) : {};
    const statusCode = getLiveApiStatusErrorCode(response.status);
    throw createLiveApiError(errorPayload.error || statusCode || "live_api_error", errorPayload.message || "Live API request failed.");
  }

  return payload as T;
}

async function fetchLiveWithNetworkRetry(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (!isNetworkFetchError(error)) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      return await fetch(url, init);
    } catch (retryError) {
      if (isNetworkFetchError(retryError)) {
        throw createLiveApiError("live_api_network_error", "Live API request failed at the network boundary.");
      }

      throw retryError;
    }
  }
}

function buildHeaders(headers: LiveApiHeaders, extra: LiveApiHeaders = {}) {
  if (!headers.Authorization) {
    throw createLiveApiError("live_auth_required", "Cognito Authorization header is required.");
  }

  return {
    accept: "application/json",
    ...headers,
    ...extra,
  };
}

function createLiveApiError(code: string, message: string) {
  const error = new Error(message);
  Object.assign(error, { code, error: code });
  return error;
}

function getLiveApiStatusErrorCode(status: number) {
  if (status === 401) {
    return "unauthorized";
  }

  if (status === 403) {
    return "forbidden";
  }

  return "";
}

function isNetworkFetchError(error: unknown) {
  return error instanceof TypeError;
}

function getLiveApiErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const value = error as { code?: unknown; error?: unknown };
    return String(value.code || value.error || "");
  }

  return "";
}
