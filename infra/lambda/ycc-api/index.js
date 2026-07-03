"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const tls = require("node:tls");
const webPush = require("web-push");
const { invalidAgeVerificationTokens, validateCheckoutReadiness } = require("./commerce-rules");
const {
  createCognitoSignupCustomer,
  buildCustomerPortalSessionParams,
  createCommerceCheckoutSession,
  createFriendsFamilyCustomer,
  createMembershipCheckoutSession,
  createStripeClient,
  getHandledStripeEventAction,
  mapCheckoutSessionStatus,
  shouldProcessStripeEvent,
  verifyStripeWebhook,
} = require("./stripe-commerce");

const MAX_MESSAGE_LENGTH = 4000;
const MAX_SUPPORT_MESSAGE_LENGTH = 6000;
const MAX_FIELD_LENGTH = 500;
const MAX_EMAIL_BODY_LENGTH = 10000;
const MAX_EMAIL_HTML_LENGTH = 20000;
const MAX_LIVE_PAGE_EDIT_FIELDS = 80;
const MAX_LIVE_PAGE_EDIT_FIELD_LENGTH = 2000;
const MAX_CIGAR_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VOICE_AUDIO_BYTES = 6 * 1024 * 1024;
const MAX_PUBLIC_JSON_BODY_BYTES = 16 * 1024;
const MAX_CHECKOUT_JSON_BODY_BYTES = 64 * 1024;
const MAX_DEFAULT_JSON_BODY_BYTES = 9 * 1024 * 1024;
const DEFAULT_SUPPORT_EMAIL_FROM = "support@yuzucigarclub.com";
const DEFAULT_SUPPORT_EMAIL_RAW_PREFIX = "ycc/support-email/raw/";
const TRANSACTIONAL_EMAIL_PROVIDERS = new Set([
  "ses",
  "brevo",
  "godaddy_m365_smtp",
  "m365_smtp",
  "mailgun",
  "office365_smtp",
  "postmark",
  "sendgrid",
]);
const MICROSOFT_365_SMTP_PROVIDERS = new Set(["godaddy_m365_smtp", "m365_smtp", "office365_smtp"]);

class EmailProviderConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmailProviderConfigurationError";
  }
}

const DEFAULT_BEDROCK_MODEL_ID = "amazon.nova-lite-v1:0";
const DEFAULT_CONCIERGE_POLLY_VOICE_ID = "Joanna";
const DEFAULT_CONCIERGE_VOICE_PREFIX = "ycc/concierge-voice/";
const DEFAULT_HUMIDOR_IMAGE_PREFIX = "ycc/humidor-images/";
const HUMIDOR_IMAGE_SIGNED_URL_EXPIRES_SECONDS = 60 * 60;
const DEFAULT_LEX_ROUTER_LOCALE_ID = "en_US";
const CONCIERGE_RESPONSE_STYLE_INSTRUCTION =
  "Answer the member's question directly first. Keep replies concise: one short paragraph or up to three bullets. Do not include broad background, internal implementation details, or extra next steps unless the member asks or a safety, compliance, or account handoff requires it.";
const ADULT_CIGAR_21_PLUS_CONTEXT_INSTRUCTION =
  "Yuzu Cigar Club is a 21+ adult cigar website. Adult cigar education, product, storage, flavor, pairing, buying, and ritual questions are allowed. Do not refuse just because the member mentions cigars, tobacco, smoking, nicotine, or age-restricted products. Refuse only underage access, age-check bypass, illegal purchase/shipping evasion, or requests for medical, cessation, or safety claims.";
const CIGAR_IMAGE_MIME_FORMATS = new Map([
  ["image/jpeg", "jpeg"],
  ["image/jpg", "jpeg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
]);
const HUMIDOR_ENRICHMENT_MAX_AUTO_UNIT_VALUE = 75;
const HUMIDOR_RENDERABLE_REFERENCE_IMAGE_PATHS = [
  ["classroom2.s3.us-east-1.amazonaws.com", "/ycc/humidor-images/"],
  ["swwest.com", "/Images/SunsetItems/"],
  ["halfwheel.com", "/wp-content/uploads/"],
  ["cigardojo.com", "/wp-content/uploads/"],
];
const REKOGNITION_TEXT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
const REKOGNITION_TEXT_READY_VALUES = new Set(["detect_text_ready", "image_understanding_ready", "ready"]);
const REKOGNITION_LABEL_READY_VALUES = new Set(["detect_labels_ready", "image_understanding_ready", "ready"]);
const DEFAULT_REKOGNITION_MIN_TEXT_CONFIDENCE = 70;
const DEFAULT_REKOGNITION_MIN_LABEL_CONFIDENCE = 70;
const MAX_REKOGNITION_TEXT_LINES = 12;
const MAX_REKOGNITION_LABELS = 10;
const VOICE_AUDIO_MIME_FORMATS = new Map([
  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
  ["audio/oga", "ogg"],
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/mp4", "mp4"],
  ["audio/m4a", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/wav", "wav"],
  ["audio/wave", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/flac", "flac"],
]);
const LIVE_PAGE_ROUTES = new Set(["/", "/membership", "/education"]);
const HUMIDOR_ROUTES = new Set([
  "GET /humidor/items",
  "GET /humidor/smokes",
  "GET /humidor/alerts",
  "POST /humidor/identify-cigar",
  "POST /humidor/alerts",
  "POST /humidor/items",
  "POST /humidor/smokes",
  "PATCH /humidor/items/{id}",
  "PATCH /humidor/items/{id}/enrich",
]);
const HUMIDOR_ALERT_DISPATCH_ROUTE = "POST /humidor/alerts/dispatch";
const HUMIDOR_ALERT_DISPATCH_SECRET_HEADER = "x-humidor-alert-dispatch-secret";
const HUMIDOR_REORDER_REMINDER_DISPATCH_MARKER = "humidorReorderReminderDispatchedOn";
const HUMIDOR_ALERT_DISPATCH_NOTIFICATION_TAG = "digital-humidor-alert";
const HUMIDOR_DISPATCH_ACTOR_SUB = "system.humidor-dispatch";
const ADMIN_OPERATIONAL_ALERT_NOTIFICATION_TAG = "admin-operational-alert";
const ADMIN_OPERATIONAL_ALERT_URL = "/admin/console";
const ADMIN_OPERATIONAL_SMS_BRAND = "Company Quon LLC";
const ADMIN_OPERATIONAL_SMS_OPT_OUT_TEXT = "Reply STOP to opt out.";
const HUMIDOR_IOT_TELEMETRY_SOURCE = "ycc.humidor.iot.telemetry";
const HUMIDOR_IOT_TELEMETRY_TOPIC_PREFIX = "ycc/humidor/";
const HUMIDOR_IOT_TELEMETRY_TOPIC_SUFFIX = "/telemetry";
const HUMIDOR_IOT_ACTOR_SUB = "system.humidor-iot";
const ADMIN_ROUTES = new Set([
  "GET /admin/commerce/orders",
  "PATCH /admin/commerce/orders/{id}",
  "POST /admin/commerce/stripe-sync-products",
  "GET /admin/commerce/webhook-events",
  "GET /admin/commerce/compliance-holds",
  "GET /admin/members",
  "PATCH /admin/members/{id}/access",
  "POST /content/pages",
  "POST /news/story-drafts",
  "POST /news/stories",
  "POST /support/email-send",
]);
const COMMERCE_MIGRATION_CONFIRM = "APPLY_YCC_COMMERCE_SCHEMA";
const SITE_CONTENT_MIGRATION_CONFIRM = "APPLY_YCC_SITE_CONTENT_SCHEMA";
const NEWSROOM_MIGRATION_CONFIRM = "APPLY_YCC_NEWSROOM_SCHEMA";
const MEMBER_STRIPE_CUSTOMER_LINK_MIGRATION_CONFIRM = "APPLY_YCC_MEMBER_STRIPE_CUSTOMER_LINK_SCHEMA";
const ADMIN_ORDER_STATUSES = new Set(["pending", "open", "processing", "requires_review", "paid", "complete", "completed", "succeeded", "refunded", "refund_pending", "partially_refunded", "failed", "canceled", "cancelled"]);
const ADMIN_FULFILLMENT_STATUSES = new Set(["not_started", "pending", "packed", "shipped", "delivered", "fulfilled", "blocked", "cancelled", "canceled"]);
const ADMIN_COMPLIANCE_STATUSES = new Set(["pending", "verified", "review", "hold", "rejected", "cleared", "blocked"]);
const ADMIN_MEMBER_ROLES = new Set(["customer", "operator", "admin"]);
const ADMIN_MEMBER_STATUSES = new Set(["non_member", "active", "paused", "cancelled", "banned"]);
const ADMIN_MEMBERSHIP_TIERS = new Set(["box_access_pass", "kisha", "sensei", "daimyo"]);
const ADMIN_LIST_DEFAULT_LIMIT = 50;
const ADMIN_LIST_MAX_LIMIT = 250;
const ADMIN_AGENT_USER_REPLY_LIMIT = 50;
const OFFICIAL_CIGAR_NEWS_DOMAINS = new Set([
  "arturofuente.com",
  "cigarworld.com",
  "drewestate.com",
  "foundationcigarcompany.com",
  "fratellocigar.com",
  "habanos.com",
  "jcnewman.com",
  "laaurora.com.do",
  "olivacigar.com",
  "oettingerdavidoff.com",
  "perdomocigars.com",
  "prnewswire.com",
  "rockypatel.com",
  "warpedcigars.com",
]);
const BLOCKED_SECONDARY_NEWS_DOMAINS = new Set([
  "blindmanspuff.com",
  "cigar-coop.com",
  "cigaraficionado.com",
  "cigardojo.com",
  "cigarcoop.com",
  "cigarjournal.com",
  "cigarsnobmag.com",
  "developingpalates.com",
  "halfwheel.com",
  "stogieguys.com",
  "tobaccobusiness.com",
]);
const FALLBACK_NEWS_BODY_PATTERNS = [
  "keep this section factual and concise until an operator verifies each detail against the source urls.",
  "frame the update around release timing, availability, craftsmanship, events, or education value.",
  "verify every product name, date, quote, msrp, distributor note, and availability claim before publication.",
];
const BEDROCK_AGENT_NAMES = new Set([
  "YCCConcierge",
  "YCCCigarGuide",
  "YCCSupportAgent",
  "YCCHumidorAgent",
  "YCCAdminAgent",
  "YCCNewsAgent",
]);
const DIRECT_BEDROCK_RUNTIME_AGENTS = new Set(["YCCCigarGuide"]);
const CIGAR_WRAPPER_TERMS = [
  "maduro",
  "connecticut",
  "habano",
  "cameroon",
  "sumatra",
  "broadleaf",
  "corojo",
  "candela",
  "rosado",
];
const CIGAR_GUIDE_TERMS = [
  "cigar",
  "cigars",
  "tobacco",
  "nicotine",
  "vitola",
  "wrapper",
  ...CIGAR_WRAPPER_TERMS,
  "robusto",
  "toro",
  "churchill",
  "lonsdale",
  "gordo",
  "torpedo",
  "binder",
  "filler",
  "blend",
  "humidor",
  "humidity",
  "pairing",
  "strength",
  "draw",
  "cut",
  "light",
  "ash",
  "retrohale",
  "smoke",
];
const HUMIDOR_AGENT_TERMS = ["humidor", "humidity", "hygrometer", "temperature", "aging", "reorder", "inventory"];
const HUMIDOR_WEB_SEARCH_READY_VALUES = new Set(["1", "true", "ready", "enabled", "on"]);
const HUMIDOR_WEB_SEARCH_BLOCKED_DOMAINS = new Set([
  "duckduckgo.com",
  "google.com",
  "bing.com",
  "yahoo.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "reddit.com",
  "pinterest.com",
  "youtube.com",
]);
const HUMIDOR_VITOLA_TERMS = [
  "Toro Box Press",
  "Corona Gorda",
  "Churchill",
  "Robusto",
  "Belicoso",
  "Torpedo",
  "Lonsdale",
  "Corona",
  "Gordo",
  "Toro",
];
const LEX_DIALOG_ACTION_TYPES = new Set(["ElicitIntent", "ElicitSlot", "ConfirmIntent"]);
const DEFAULT_HUMIDOR_ALERT_PREFERENCES = Object.freeze({
  pushEnabled: false,
  reorderRemindersEnabled: true,
  climateAlertsEnabled: false,
  pushSubscription: null,
  pairedDevices: [],
  humidorProfile: {
    humidorName: "",
    defaultLocation: "",
    locations: [],
  },
});
const HUMIDOR_CLIMATE_ALERT_TARGET = Object.freeze({
  minHumidity: 65,
  maxHumidity: 72,
  minTemperature: 64,
  maxTemperature: 74,
});
const HUMIDOR_ENRICHMENT_FIELDS = new Set(["info", "image", "msrp"]);
const CHECKOUT_AGE_TOKEN_VERSION = "yccav1";
const CHECKOUT_AGE_TOKEN_TTL_SECONDS = 30 * 60;
const AGECHECKER_DEFAULT_BASE_URL = "https://api.agechecker.net";
const MEMBERSHIP_ENTITLEMENT_TOKEN_VERSION = "yccmem1";
const MEMBERSHIP_ENTITLEMENT_TOKEN_TTL_SECONDS = 30 * 60;
const CHECKOUT_STATUS_TOKEN_PREFIX = "chkst_";
const DEFAULT_CORS_ALLOW_ORIGINS = ["https://yuzucigarclub.com", "https://www.yuzucigarclub.com"];
const COMMERCE_SECRET_ENV_KEYS = [
  "COMMERCE_PROVIDER_SECRET_ARN",
  "COMMERCE_PROVIDER_SECRET_ID",
  "YCC_COMMERCE_SECRET_ARN",
  "YCC_COMMERCE_SECRET_ID",
];
const COMMERCE_RUNTIME_SECRET_CACHE_TTL_MS = 5 * 60 * 1000;
const COMMERCE_SECRET_FLAT_KEY_PATTERNS = [
  /^STRIPE_(SECRET_KEY|WEBHOOK_SECRET|API_VERSION|CUSTOMER_PORTAL_CONFIGURATION_ID|LAUNCH_CATALOG_READY|LAUNCH_CATALOG_JSON|LAUNCH_CATALOG_PATH|LAUNCH_CATALOG_S3_URI|TOBACCO_APPROVAL_CONFIRMED)$/,
  /^STRIPE_PRICE_[A-Z0-9_]+$/,
  /^AGE_VERIFICATION_(VENDOR|API_KEY|API_SECRET|ACCOUNT_SECRET|CLIENT_ID|CLIENT_SECRET|BASE_URL|WEBHOOK_SECRET|SIGNING_SECRET)$/,
  /^MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET$/,
  /^FEATURE_STRIPE_TAX$/,
  /^TAX_(PROVIDER|API_KEY|API_SECRET|CLIENT_ID|CLIENT_SECRET|ACCOUNT_ID|BASE_URL|WEBHOOK_SECRET)$/,
  /^SHIPPING_(PROVIDER|API_KEY|API_SECRET|CLIENT_ID|CLIENT_SECRET|ACCOUNT_ID|ADULT_SIGNATURE_ACCOUNT_ID|BASE_URL)$/,
  /^AVALARA_[A-Z0-9_]+$/,
  /^TAXJAR_[A-Z0-9_]+$/,
  /^UPS_[A-Z0-9_]+$/,
  /^USPS_[A-Z0-9_]+$/,
];
let commerceRuntimeSecretCache = null;
let activeRequestOrigin = "";

exports.handler = async function handler(event = {}, context = {}) {
  const startedAt = Date.now();
  const requestId = getRequestId(event, context);
  const routeKey = getRouteKey(event);
  activeRequestOrigin = sanitizeText(getHeader(event, "origin"), 240);

  try {
    if (
      event.source === "ycc.phase3.migration" ||
      event.source === "ycc.commerce.migration" ||
      event.source === "ycc.site_content.migration" ||
      event.source === "ycc.newsroom.migration"
    ) {
      const response = await handlePhase3Migration(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (isCognitoPostConfirmationSignUpEvent(event)) {
      const response = await handleCognitoPostConfirmationSignUp(event, requestId);
      logCompleted(event, `COGNITO ${event.triggerSource}`, 200, startedAt, requestId);
      return response;
    }

    if (isSesReceiptEvent(event)) {
      const response = await handleSesReceipt(event, requestId);
      logCompleted(event, "SES_RECEIPT support-email", response.statusCode, startedAt, requestId);
      return response;
    }

    if (isHumidorIotTelemetryEvent(event)) {
      const response = await handleHumidorIotTelemetry(event, requestId);
      logCompleted(event, "IOT_HUMIDOR_TELEMETRY", response.statusCode, startedAt, requestId);
      return response;
    }

    if (isBedrockActionGroupEvent(event)) {
      const response = await handleBedrockActionGroup(event, requestId);
      logCompleted(event, `BEDROCK_ACTION ${event.actionGroup}.${event.function || event.apiPath}`, getActionResponseStatus(response), startedAt, requestId);
      return response;
    }

    if (getMethod(event) === "OPTIONS") {
      return empty(204, requestId);
    }

    if (routeKey === "GET /health") {
      const response = await handleHealth(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === "POST /newsletter/subscribe") {
      const response = await handleNewsletterSubscribe(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === "POST /support/contact") {
      const response = await handlePublicSupportContact(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === "POST /commerce/checkout-session") {
      const response = await handleCommerceCheckoutSession(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === "POST /commerce/age-verification-token") {
      const response = await handleCommerceAgeVerificationToken(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === "POST /commerce/membership-session") {
      const response = await handleCommerceMembershipSession(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === "POST /commerce/webhook/stripe") {
      const response = await handleStripeWebhook(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === HUMIDOR_ALERT_DISPATCH_ROUTE) {
      const response = await handleHumidorAlertDispatch(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (isCheckoutSessionStatusRoute(routeKey)) {
      const response = await handleCheckoutSessionStatus(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === "GET /content/pages") {
      const response = await handleLivePageContent(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    if (routeKey === "GET /news/stories") {
      const response = await handlePublicNewsStories(event, requestId);
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    const actor = getActor(event);
    if (!actor) {
      const response = json(401, requestId, {
        error: "unauthorized",
        message: "A valid Cognito JWT is required for this route.",
      });
      logCompleted(event, routeKey, response.statusCode, startedAt, requestId);
      return response;
    }

    let response;
    if (routeKey === "GET /account/me") {
      response = await handleAccountMe(event, actor, requestId);
    } else if (routeKey === "PATCH /account/me") {
      response = await handleAccountProfileUpdate(event, actor, requestId);
    } else if (routeKey === "POST /commerce/customer-portal-session") {
      response = await handleCustomerPortalSession(event, actor, requestId);
    } else if (routeKey === "GET /commerce/membership") {
      response = await handleCommerceMembership(event, actor, requestId);
    } else if (routeKey === "GET /commerce/orders") {
      response = await handleCommerceOrders(event, actor, requestId);
    } else if (isCommerceOrderRoute(routeKey)) {
      response = await handleCommerceOrderStatus(event, actor, requestId);
    } else if (isAdminRoute(routeKey)) {
      if (routeKey === "GET /admin/commerce/orders") {
        response = await handleAdminOrders(event, actor, requestId);
      } else if (isAdminCommerceOrderMutationRoute(routeKey)) {
        response = await handleAdminOrderUpdate(event, actor, requestId);
      } else if (routeKey === "POST /admin/commerce/stripe-sync-products") {
        response = await handleAdminStripeSyncProducts(event, actor, requestId);
      } else if (routeKey === "GET /admin/commerce/webhook-events") {
        response = await handleAdminWebhookEvents(event, actor, requestId);
      } else if (routeKey === "GET /admin/commerce/compliance-holds") {
        response = await handleAdminComplianceHolds(event, actor, requestId);
      } else if (routeKey === "GET /admin/members") {
        response = await handleAdminMembers(event, actor, requestId);
      } else if (isAdminMemberAccessMutationRoute(routeKey)) {
        response = await handleAdminMemberAccessUpdate(event, actor, requestId);
      } else if (routeKey === "POST /content/pages") {
        response = await handleLivePagePublish(event, actor, requestId);
      } else if (routeKey === "POST /news/story-drafts") {
        response = await handleNewsStoryDraft(event, actor, requestId);
      } else if (routeKey === "POST /news/stories") {
        response = await handleNewsStoryPublish(event, actor, requestId);
      } else if (routeKey === "POST /support/email-send") {
        response = await handleSupportEmailSend(event, actor, requestId);
      } else {
        response = json(404, requestId, {
          error: "not_found",
          message: `No YCC API route is registered for ${routeKey}.`,
        });
      }
    } else if (routeKey === "POST /concierge/chat") {
      response = await handleConciergeChat(event, actor, requestId);
    } else if (routeKey === "POST /concierge/voice") {
      response = await handleConciergeVoice(event, actor, requestId);
    } else if (routeKey === "POST /support/email-draft") {
      response = await handleSupportEmailDraft(event, actor, requestId);
    } else if (routeKey === "POST /support/email-send") {
      response = await handleSupportEmailSend(event, actor, requestId);
    } else if (isHumidorRoute(routeKey)) {
      const humidorMembershipDenied = buildHumidorMembershipDeniedPayload(actor);
      if (humidorMembershipDenied) {
        response = json(403, requestId, humidorMembershipDenied);
      } else if (routeKey === "GET /humidor/items") {
        response = await handleHumidorItems(event, actor, requestId);
      } else if (routeKey === "GET /humidor/smokes") {
        response = await handleHumidorSmokeLogs(event, actor, requestId);
      } else if (routeKey === "GET /humidor/alerts") {
        response = await handleHumidorAlertPreferences(event, actor, requestId);
      } else if (routeKey === "POST /humidor/identify-cigar") {
        response = await handleHumidorCigarIdentification(event, actor, requestId);
      } else if (routeKey === "POST /humidor/alerts") {
        response = await handleHumidorAlertPreferencesUpdate(event, actor, requestId);
      } else if (routeKey === "PATCH /humidor/items/{id}") {
        response = await handleHumidorItemUpdate(event, actor, requestId);
      } else if (routeKey === "PATCH /humidor/items/{id}/enrich") {
        response = await handleHumidorItemEnrichment(event, actor, requestId);
      } else if (routeKey === "POST /humidor/items") {
        response = await handleHumidorItem(event, actor, requestId);
      } else if (routeKey === "POST /humidor/smokes") {
        response = await handleHumidorSmokeLog(event, actor, requestId);
      }
    } else {
      response = json(404, requestId, {
        error: "not_found",
        message: `No YCC API route is registered for ${routeKey}.`,
      });
    }

    logCompleted(event, routeKey, response.statusCode, startedAt, requestId, actor);
    return response;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "request_failed",
        requestId,
        routeKey,
        name: error instanceof Error ? error.name : null,
        code: error && typeof error === "object" ? error.code : null,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      })
    );

    return json(500, requestId, {
      error: "internal_error",
      message: "The YCC API handler could not complete the request.",
    });
  } finally {
    activeRequestOrigin = "";
  }
};

async function handleHealth(event, requestId) {
  const deep = event.queryStringParameters?.deep === "1" || event.queryStringParameters?.deep === "true";
  const dbProxyEndpoint = process.env.DB_PROXY_ENDPOINT || "";
  const dbPort = Number(process.env.DB_PORT || "5432");
  const ssl = getPgSslReadiness();
  const db = {
    proxyConfigured: Boolean(dbProxyEndpoint),
    secretConfigured: Boolean(process.env.DB_SECRET_ARN),
    databaseConfigured: Boolean(process.env.DB_NAME),
    deepCheck: deep ? "requested" : "skipped",
    ssl,
  };

  if (deep) {
    db.proxyReachable = dbProxyEndpoint ? await canOpenTcpConnection(dbProxyEndpoint, dbPort, 1400) : false;
  }

  const databaseReady = !shouldPersistDatabaseWrites() || ssl.ready;
  const healthy = databaseReady && (!deep || db.proxyReachable === true);

  return json(healthy ? 200 : 503, requestId, {
    status: healthy ? "ok" : "degraded",
    service: "ycc-api",
    environment: process.env.APP_ENV || "unknown",
    timestamp: new Date().toISOString(),
    db,
    capabilities: {
      account: true,
      conciergeContract: true,
      conciergeVoiceContract: true,
      cigarGuideContract: true,
      supportDraftContract: true,
      humidorItemContract: true,
      cigarImageIdentificationContract: true,
      databaseWrites: process.env.FEATURE_DB_WRITES || "pending_schema",
      bedrock: process.env.FEATURE_BEDROCK || "pending_agent",
      ses: process.env.FEATURE_SES || "pending_identity",
      emailProvider: getOutboundEmailStatus(),
      newsletterSubscribe: true,
      publicSupportContact: true,
    },
  });
}

async function handleCognitoPostConfirmationSignUp(event, requestId) {
  const details = getCognitoWelcomeEmailDetails(event);
  const persistence = await maybePersistCognitoPostConfirmationAccount(event, requestId);
  const effectiveDetails = applyCognitoPostConfirmationPersistenceToDetails(details, persistence);
  if (!persistence?.membershipClaim) {
    await maybeSendCognitoWelcomeEmail(event, requestId, effectiveDetails);
  }
  await maybeDispatchAdminOperationalAlert(buildAdminNewUserAlert(effectiveDetails), requestId);
  return event;
}

async function maybePersistCognitoPostConfirmationAccount(event, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return {
      member: null,
      membershipClaim: null,
      stripeCustomerId: null,
    };
  }

  const actor = getCognitoPostConfirmationActor(event);
  if (!actor) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "cognito_post_confirmation_missing_actor",
        requestId,
        userPoolId: sanitizeText(event.userPoolId, 120),
      })
    );
    return {
      member: null,
      membershipClaim: null,
      stripeCustomerId: null,
    };
  }

  return withDatabaseClient("ycc-api-cognito-post-confirmation", async (client) => {
    let member = await upsertMember(client, actor, requestId);
    const membershipOffer = resolveCognitoPostConfirmationMembershipOffer(event);
    let membershipClaim = null;
    let stripeCustomerId = member.stripeCustomerId;

    if (membershipOffer) {
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      member = await grantFriendsFamilyBoxPass(
        client,
        {
          actor,
          customer: {
            email: actor.email,
            fullName: actor.name,
          },
          membershipOffer,
        },
        requestId,
        expiresAt
      );
      stripeCustomerId =
        member.stripeCustomerId ||
        (await createAndLinkFriendsFamilyStripeCustomer(
          client,
          member,
          {
            customer: {
              email: actor.email,
              fullName: actor.name,
            },
            membershipOffer,
          },
          expiresAt
        ));
      member = {
        ...member,
        stripeCustomerId,
      };

      const memberWelcomeEmail = await maybeSendMemberWelcomeEmail(
        {
          email: member.email,
          displayName: member.displayName || actor.name,
          membershipTier: "box_access_pass",
          memberStatus: "active",
          source: membershipOffer.source,
          campaign: membershipOffer.campaign,
          expiresAt,
          stripeCustomerId,
        },
        requestId
      );

      membershipClaim = {
        tierKey: "box_access_pass",
        memberStatus: "active",
        expiresAt,
        stripeCustomerId,
        memberWelcomeEmail,
      };
    } else if (!stripeCustomerId) {
      stripeCustomerId = await createAndLinkCognitoSignupStripeCustomer(client, member, actor);
      member = {
        ...member,
        stripeCustomerId,
      };
    }

    console.info(
      JSON.stringify({
        level: "info",
        event: "cognito_post_confirmation_account_persisted",
        requestId,
        memberId: member.id,
        actorHash: hashActor(actor.sub),
        stripeCustomerLinked: Boolean(stripeCustomerId),
        membershipClaimed: Boolean(membershipClaim),
      })
    );

    return {
      member,
      membershipClaim,
      stripeCustomerId,
    };
  });
}

function getCognitoPostConfirmationActor(event) {
  const attrs = event.request?.userAttributes && typeof event.request.userAttributes === "object" ? event.request.userAttributes : {};
  const email = normalizeEmailAddresses(attrs.email || event.userName, 1)[0] || "";
  const sub = sanitizeText(attrs.sub || event.userName, 160);
  if (!sub) {
    return null;
  }

  return {
    sub,
    email,
    emailVerified: Boolean(email) && (attrs.email_verified === true || attrs.email_verified === "true" || event.triggerSource === "PostConfirmation_ConfirmSignUp"),
    name: sanitizeText(attrs.name || [attrs.given_name, attrs.family_name].filter(Boolean).join(" ") || attrs.nickname || "", 160),
    username: sanitizeText(event.userName, 160),
    groups: parseGroups(attrs["cognito:groups"] || attrs.groups || attrs["custom:groups"]),
    membershipTier: optionalString(attrs["custom:membership_tier"] || attrs.membership_tier),
    memberStatus: optionalString(attrs["custom:member_status"] || attrs.member_status),
    stripeCustomerId: optionalString(attrs["custom:stripe_customer_id"] || attrs.stripe_customer_id),
  };
}

function resolveCognitoPostConfirmationMembershipOffer(event) {
  const attrs = event.request?.userAttributes && typeof event.request.userAttributes === "object" ? event.request.userAttributes : {};
  const metadata = event.request?.clientMetadata && typeof event.request.clientMetadata === "object" ? event.request.clientMetadata : {};
  const code = sanitizeText(metadata.ycc_invite_code || metadata.membership_offer_code || attrs["custom:ycc_invite_code"] || attrs.ycc_invite_code, 80).toLowerCase();
  const access = sanitizeText(metadata.ycc_offer_access || metadata.membership_offer_access || attrs["custom:ycc_offer_access"] || attrs.ycc_offer_access, 80).toLowerCase();

  if (code !== "friends-family-box-pass" || (access && access !== "box_access_pass_1_year")) {
    return null;
  }

  return {
    code,
    source: sanitizeText(metadata.ycc_offer_source || metadata.membership_offer_source, 80) || "friends-family-page",
    campaign: sanitizeText(metadata.ycc_offer_campaign || metadata.membership_offer_campaign, 80) || "friends-family-1-year-box-pass",
    landingPath: sanitizeText(metadata.ycc_landing_path || metadata.membership_offer_landing_path, 120) || "/friends-family",
    access: access || "box_access_pass_1_year",
    trialPeriodDays: 365,
  };
}

async function createAndLinkCognitoSignupStripeCustomer(client, member, actor) {
  const commerceEnv = await getCommerceRuntimeEnv();
  if (!commerceEnv.STRIPE_SECRET_KEY) {
    return null;
  }

  const stripe = createStripeClient(commerceEnv);
  const customer = await createCognitoSignupCustomer(
    stripe,
    {
      customer: {
        email: member.email,
        fullName: member.displayName || actor.name,
      },
      cognitoSub: member.cognitoSub || actor.sub,
      membershipTier: member.membershipTier,
      memberStatus: member.memberStatus,
    },
    {
      idempotencyKey: `ycc-cognito-signup-${hashActor(member.cognitoSub || actor.sub || member.email)}`,
    }
  );

  const stripeCustomerId = sanitizeText(customer?.id, 160);
  if (!stripeCustomerId) {
    throw new Error("Stripe did not return a Customer ID for the Cognito signup.");
  }

  const linkedMember = await linkMemberStripeCustomer(client, member.id, stripeCustomerId);
  if (!linkedMember) {
    throw new Error("Cognito signup Stripe Customer could not be linked to the member row.");
  }

  return sanitizeText(linkedMember.stripe_customer_id, 160) || stripeCustomerId;
}

function applyCognitoPostConfirmationPersistenceToDetails(details, persistence) {
  const member = persistence?.member;
  if (!member) {
    return details;
  }

  return {
    ...details,
    displayName: member.displayName || details.displayName,
    memberStatus: member.memberStatus ? formatWelcomeAccountLabel(member.memberStatus) : details.memberStatus,
    membershipTier: member.membershipTier ? formatWelcomeAccountLabel(member.membershipTier) : details.membershipTier,
  };
}

async function maybeSendCognitoWelcomeEmail(event, requestId, details = getCognitoWelcomeEmailDetails(event)) {
  console.info(
    JSON.stringify({
      level: "info",
      event: "cognito_customer_welcome_deferred_until_membership",
      requestId,
      email: details.email ? hashActor(details.email) : null,
      userPoolId: sanitizeText(event.userPoolId, 120),
    })
  );

  return {
    status: "deferred_until_membership",
    sesMessageId: null,
  };
}

function getCognitoWelcomeEmailDetails(event) {
  const attrs = event.request?.userAttributes && typeof event.request.userAttributes === "object" ? event.request.userAttributes : {};
  const email = normalizeEmailAddresses(attrs.email || event.userName, 1)[0] || "";
  const displayName = sanitizeText(
    attrs.name || [attrs.given_name, attrs.family_name].filter(Boolean).join(" ") || attrs.nickname || "",
    160
  );
  const rawMemberStatus = sanitizeText(attrs["custom:member_status"] || attrs.member_status, 80);
  const rawMembershipTier = sanitizeText(attrs["custom:membership_tier"] || attrs.membership_tier, 80);

  return {
    email,
    displayName,
    username: sanitizeText(event.userName, 160),
    memberStatus: formatWelcomeAccountLabel(rawMemberStatus || "non_member"),
    membershipTier: rawMembershipTier ? formatWelcomeAccountLabel(rawMembershipTier) : "",
    accountUrl: resolveNewsletterEmailUrl("/account/"),
    membershipUrl: resolveNewsletterEmailUrl("/membership/"),
    shopUrl: resolveNewsletterEmailUrl("/shop/"),
    humidorUrl: resolveNewsletterEmailUrl("/humidor/"),
  };
}

function buildAdminNewUserAlert(details) {
  if (!details?.email) {
    return null;
  }

  const displayName = sanitizeText(details.displayName, 160);
  const memberLabel = displayName ? `${displayName} (${details.email})` : details.email;
  const smsMemberLabel = sanitizeText(details.email, 160);
  const statusLabel = details.membershipTier || details.memberStatus || "new account";

  return {
    type: "new_user",
    title: "New Yuzu user",
    body: `${memberLabel} confirmed a Yuzu account. Status: ${statusLabel}.`,
    smsMessage: `${ADMIN_OPERATIONAL_SMS_BRAND} admin alert: Account confirmed for ${smsMemberLabel}. Status: ${statusLabel}. Open the private admin console. ${ADMIN_OPERATIONAL_SMS_OPT_OUT_TEXT}`,
    url: ADMIN_OPERATIONAL_ALERT_URL,
  };
}

function buildAdminNewOrderAlert(stripeEvent, action, processing) {
  if (action !== "record_checkout_completion" || processing?.duplicate || !processing?.orderId) {
    return null;
  }

  const session = stripeEvent?.data?.object;
  if (!session || typeof session !== "object") {
    return null;
  }

  if (sanitizeText(session.payment_status, 40).toLowerCase() !== "paid") {
    return null;
  }

  const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
  const email =
    normalizeEmailAddresses(session.customer_details?.email, 1)[0] ||
    normalizeEmailAddresses(session.customer_email, 1)[0] ||
    normalizeEmailAddresses(metadata.customer_email, 1)[0] ||
    "unknown customer";
  const total = formatCurrencyCents(session.amount_total, session.currency);
  const checkoutSessionId = sanitizeText(session.id, 120);

  return {
    type: "new_order",
    title: "New Yuzu order",
    body: `${total} paid order from ${email}. Fulfillment review is ready in admin.`,
    smsMessage: `${ADMIN_OPERATIONAL_SMS_BRAND} admin alert: Fulfillment review task${checkoutSessionId ? ` ${checkoutSessionId}` : ""} for ${email}. Open the private admin console. ${ADMIN_OPERATIONAL_SMS_OPT_OUT_TEXT}`,
    url: ADMIN_OPERATIONAL_ALERT_URL,
  };
}

async function maybeDispatchAdminOperationalAlert(alert, requestId) {
  if (!alert) {
    return {
      sms: { sent: 0, failed: 0, skipped: true },
      push: { sent: 0, failed: 0, skipped: true },
    };
  }

  const sms = await maybeSendAdminOperationalSmsAlerts(alert, requestId);
  const push = await maybeSendAdminOperationalPushAlerts(alert, requestId);
  console.info(
    JSON.stringify({
      level: "info",
      event: "admin_operational_alert_dispatched",
      requestId,
      alertType: alert.type,
      sms,
      push,
    })
  );

  return { sms, push };
}

async function maybeSendAdminOperationalSmsAlerts(alert, requestId) {
  const phoneNumbers = getConfiguredAdminAlertPhoneNumbers();
  if (!phoneNumbers.length) {
    return { sent: 0, failed: 0, skipped: true, reason: "no_admin_alert_phone_configured" };
  }

  let sns;
  try {
    sns = require("@aws-sdk/client-sns");
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "admin_operational_sms_dependency_missing",
        requestId,
        alertType: alert.type,
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return { sent: 0, failed: phoneNumbers.length, skipped: true, reason: "sns_dependency_missing" };
  }

  const client = new sns.SNSClient({ region: getAdminAlertSmsRegion() });
  const message = sanitizeText(alert.smsMessage || alert.body, 1400);
  let sent = 0;
  let failed = 0;

  for (const phoneNumber of phoneNumbers) {
    try {
      await client.send(
        new sns.PublishCommand({
          Message: message,
          MessageAttributes: getAdminAlertSmsMessageAttributes(),
          PhoneNumber: phoneNumber,
        })
      );
      sent += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "admin_operational_sms_failed",
          requestId,
          alertType: alert.type,
          phoneHash: hashActor(phoneNumber),
          name: error instanceof Error ? error.name : "UnknownError",
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  return { sent, failed, skipped: false };
}

async function maybeSendAdminOperationalPushAlerts(alert, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return { sent: 0, failed: 0, skipped: true, reason: getDatabasePersistenceStatus() };
  }

  const vapidPublicKey = sanitizeText(process.env.VAPID_PUBLIC_KEY || "", 900);
  const vapidPrivateKey = sanitizeText(process.env.VAPID_PRIVATE_KEY || "", 900);
  const vapidSubject = sanitizeText(process.env.VAPID_SUBJECT || "", 320);
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return { sent: 0, failed: 0, skipped: true, reason: "vapid_not_configured" };
  }

  try {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    return await withDatabaseClient("ycc-api-admin-operational-alerts", async (client) => {
      const recipients = await loadAdminOperationalAlertRecipients(client);
      const payload = JSON.stringify(buildAdminOperationalPushPayload(alert));
      const seenEndpoints = new Set();
      let sent = 0;
      let failed = 0;

      for (const recipient of recipients) {
        const pushSubscription = normalizeHumidorPushSubscription(recipient.pushSubscription);
        if (!pushSubscription || seenEndpoints.has(pushSubscription.endpoint)) {
          continue;
        }

        seenEndpoints.add(pushSubscription.endpoint);
        try {
          await webPush.sendNotification(pushSubscription, payload);
          sent += 1;
        } catch (error) {
          failed += 1;
          console.warn(
            JSON.stringify({
              level: "warn",
              event: "admin_operational_push_failed",
              requestId,
              alertType: alert.type,
              memberId: recipient.memberId,
              pushEndpointHash: hashActor(pushSubscription.endpoint),
              statusCode: Number.isFinite(Number(error?.statusCode)) ? Number(error.statusCode) : null,
              name: error instanceof Error ? error.name : "UnknownError",
            })
          );
        }
      }

      return { sent, failed, skipped: false, recipients: recipients.length };
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "admin_operational_push_dispatch_failed",
        requestId,
        alertType: alert.type,
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return { sent: 0, failed: 0, skipped: true, reason: "push_dispatch_failed" };
  }
}

async function loadAdminOperationalAlertRecipients(client) {
  const recipientEmails = getConfiguredAdminAlertRecipientEmails();
  const result = await client.query(
    `
      select /* admin_operational_alert_recipients */
        m.id as member_id,
        m.email,
        m.role,
        mp.preferences->'pushSubscription' as push_subscription
      from public.members m
      join public.member_profiles mp on mp.member_id = m.id
      where lower(m.role) in ('admin', 'operator')
        and coalesce((mp.preferences->>'pushEnabled')::boolean, false) = true
        and mp.preferences->'pushSubscription' is not null
        and (cardinality($1::text[]) = 0 or lower(m.email) = any($1::text[]))
      order by
        case lower(m.role) when 'admin' then 0 else 1 end,
        m.email
    `,
    [recipientEmails]
  );

  return result.rows.map((row) => ({
    memberId: String(row.member_id || ""),
    email: normalizeEmailAddresses(row.email, 1)[0] || "",
    role: sanitizeText(row.role, 40).toLowerCase(),
    pushSubscription: row.push_subscription,
  }));
}

function buildAdminOperationalPushPayload(alert) {
  return {
    title: alert.title || "Yuzu admin alert",
    body: alert.body || "A Yuzu admin event needs review.",
    data: {
      tag: ADMIN_OPERATIONAL_ALERT_NOTIFICATION_TAG,
      type: alert.type || "admin_alert",
      url: sanitizeSameOriginRelativeUrl(alert.url, ADMIN_OPERATIONAL_ALERT_URL),
    },
  };
}

function getConfiguredAdminAlertRecipientEmails() {
  return normalizeEmailAddresses(process.env.YCC_ADMIN_ALERT_RECIPIENT_EMAILS || "", 25);
}

function getConfiguredAdminAlertPhoneNumbers() {
  const raw = [
    process.env.YCC_ADMIN_ALERT_PHONE_E164,
    process.env.YCC_ADMIN_ALERT_PHONE_NUMBERS,
    process.env.ADMIN_ALERT_PHONE_E164,
  ]
    .filter(Boolean)
    .join(",");
  const phoneNumbers = raw
    .split(/[,\s;]+/)
    .map(normalizeE164PhoneNumber)
    .filter(Boolean);

  return [...new Set(phoneNumbers)].slice(0, 5);
}

function normalizeE164PhoneNumber(value) {
  const normalized = sanitizeText(String(value || ""), 40).replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return normalized;
  }

  const digits = normalized.replace(/\D/g, "");
  if (/^\d{10}$/.test(digits)) {
    return `+1${digits}`;
  }

  if (/^1\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  return "";
}

function getAdminAlertSmsRegion() {
  return sanitizeText(process.env.YCC_ADMIN_ALERT_SMS_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1", 80);
}

function getAdminAlertSmsMessageAttributes() {
  const attributes = {
    "AWS.SNS.SMS.SMSType": {
      DataType: "String",
      StringValue: "Transactional",
    },
  };
  const maxPrice = sanitizeText(process.env.YCC_ADMIN_ALERT_SMS_MAX_PRICE_USD || "", 20);
  if (/^\d+(?:\.\d{1,2})?$/.test(maxPrice)) {
    attributes["AWS.SNS.SMS.MaxPrice"] = {
      DataType: "Number",
      StringValue: maxPrice,
    };
  }

  return attributes;
}

function sanitizeSameOriginRelativeUrl(value, fallback) {
  const text = sanitizeText(value, 300);
  if (/^\/[A-Za-z0-9/_?=&%#.-]*$/.test(text)) {
    return text;
  }

  return fallback;
}

function formatCurrencyCents(value, currency) {
  const cents = Number(value);
  if (!Number.isFinite(cents)) {
    return "total pending";
  }

  const currencyCode = sanitizeText(currency, 12).toUpperCase() || "USD";
  return new Intl.NumberFormat("en-US", {
    currency: currencyCode,
    style: "currency",
  }).format(Math.max(0, cents) / 100);
}

function formatWelcomeAccountLabel(value) {
  const text = sanitizeText(value, 120).replace(/[_-]+/g, " ");
  if (!text) {
    return "";
  }

  return text
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\bNon Member\b/g, "Non-member");
}

async function maybeSendMemberWelcomeEmail(details, requestId) {
  const email = normalizeEmailAddresses(details?.email, 1)[0] || "";
  if (!email) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "member_welcome_email_missing_email",
        requestId,
      })
    );
    return {
      kind: "member_welcome",
      status: "skipped",
      sesMessageId: null,
    };
  }

  if (!isOutboundEmailReady()) {
    console.info(
      JSON.stringify({
        level: "info",
        event: "member_welcome_email_pending_sender",
        requestId,
        emailProvider: getOutboundEmailStatus(),
        featureSes: process.env.FEATURE_SES || "pending_identity",
      })
    );
    return addOutboundEmailProviderFields({
      kind: "member_welcome",
      status: getOutboundEmailPendingStatus(),
      sesMessageId: null,
    });
  }

  try {
    const normalizedDetails = normalizeMemberWelcomeEmailDetails({
      ...details,
      email,
    });
    const emailContent = buildMemberWelcomeEmailContent(normalizedDetails, requestId);
    const sesMessageId = await sendSupportEmail({
      bodyHtml: emailContent.bodyHtml,
      bodyText: emailContent.bodyText,
      fromAddress: getSupportEmailFrom(),
      replyToAddresses: [getSupportInboundReplyToAddress()],
      subject: emailContent.subject,
      toAddresses: [email],
    });

    return addOutboundEmailProviderFields({
      kind: "member_welcome",
      status: "sent",
      sesMessageId,
    }, sesMessageId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "member_welcome_email_failed",
        requestId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return addOutboundEmailProviderFields({
      kind: "member_welcome",
      status: "failed",
      sesMessageId: null,
    });
  }
}

function normalizeMemberWelcomeEmailDetails(details) {
  const tierKey = normalizeMembershipEntitlementTier(details.membershipTier || details.tierKey) || "box_access_pass";
  const tierLabel = formatWelcomeAccountLabel(tierKey);
  const firstName = splitFirstName(details.displayName || details.fullName || details.name);

  return {
    email: normalizeEmailAddresses(details.email, 1)[0] || "",
    displayName: sanitizeText(details.displayName || details.fullName || details.name, 160),
    firstName,
    tierKey,
    tierLabel,
    memberStatus: formatWelcomeAccountLabel(details.memberStatus || "active"),
    billingPeriod: formatWelcomeAccountLabel(details.billingPeriod || ""),
    source: sanitizeText(details.source, 80),
    campaign: sanitizeText(details.campaign, 120),
    expiresAt: sanitizeText(details.expiresAt || details.currentPeriodEnd, 120),
    stripeCustomerId: sanitizeText(details.stripeCustomerId, 160),
    accountUrl: resolveNewsletterEmailUrl("/account/"),
    humidorUrl: resolveNewsletterEmailUrl("/humidor/"),
    memberDropsUrl: resolveNewsletterEmailUrl("/member-drops/"),
    shopUrl: resolveNewsletterEmailUrl("/shop/"),
    supportUrl: resolveNewsletterEmailUrl("/contact/"),
  };
}

function buildMemberWelcomeEmailContent(details, requestId) {
  return {
    kind: "member_welcome",
    subject: `Welcome to Yuzu Cigar Club. Your ${details.tierLabel} is active.`,
    bodyText: buildMemberWelcomeEmailText(details, requestId),
    bodyHtml: buildMemberWelcomeEmailHtml(details, requestId),
  };
}

function buildMemberWelcomeEmailText(details, requestId) {
  const greeting = details.firstName ? `Welcome inside, ${details.firstName}.` : "Welcome inside.";
  const benefits = getMemberWelcomeBenefits(details.tierKey, details.expiresAt);
  const tips = getMemberWelcomeTips(details.tierKey);
  const detailLines = [
    `Membership: ${details.tierLabel}`,
    `Status: ${details.memberStatus}`,
    details.billingPeriod ? `Billing: ${details.billingPeriod}` : "",
    details.expiresAt ? `Access through: ${formatWelcomeDate(details.expiresAt)}` : "",
    details.stripeCustomerId ? `Stripe customer: ${details.stripeCustomerId}` : "",
  ].filter(Boolean);

  const lines = [
    greeting,
    "",
    `Your ${details.tierLabel} membership is active. Member-cost boxes, private drops, and your digital humidor are ready.`,
    "",
    "Member details",
    ...detailLines,
    "",
    "Benefits now open",
    ...benefits.map((benefit) => `- ${benefit}`),
    "",
    "First box tips",
    ...tips.map((tip) => `- ${tip}`),
    "",
    `Browse member drops: ${details.memberDropsUrl}`,
    `Open your digital humidor: ${details.humidorUrl}`,
    `Shop boxes: ${details.shopUrl}`,
    `Need help choosing? ${details.supportUrl}`,
    "",
    "Yuzu Cigar Club is for adults 21+. Product availability, pricing, shipping, and compliance checks can vary by location and inventory.",
    `Request ID: ${requestId}`,
  ];

  return sanitizeMultilineText(lines.join("\n"), MAX_EMAIL_BODY_LENGTH);
}

function buildMemberWelcomeEmailHtml(details, requestId) {
  const logoUrl = resolveNewsletterEmailUrl("/assets/yuzu-logo.png");
  const greeting = details.firstName ? `Welcome inside, ${details.firstName}.` : "Welcome inside.";
  const benefits = getMemberWelcomeBenefits(details.tierKey, details.expiresAt);
  const tips = getMemberWelcomeTips(details.tierKey);
  const benefitRows = benefits.map((benefit, index) => buildMemberWelcomeListRow(benefit, index + 1)).join("");
  const tipRows = tips.map((tip, index) => buildMemberWelcomeListRow(tip, index + 1)).join("");
  const accessLabel = details.expiresAt ? `Access through ${formatWelcomeDate(details.expiresAt)}` : "Membership active";
  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#030504;color:#f8edd7;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Member-cost boxes, private drops, and your digital humidor are ready.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#030504;">
      <tr>
        <td align="center" style="padding:34px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid #6f5323;background:#101812;">
            <tr>
              <td style="padding:30px 28px 24px;border-bottom:1px solid #6f5323;background:#07110d;">
                <img src="${escapeHtmlAttribute(logoUrl)}" width="88" alt="Yuzu Cigar Club" style="display:block;margin:0 0 18px;border:0;outline:none;text-decoration:none;">
                <p style="margin:0 0 10px;color:#dca93a;font-size:11px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">Yuzu Cigar Club</p>
                <h1 style="margin:0;color:#f8edd7;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.05;font-weight:700;">${escapeHtml(greeting)}</h1>
                <p style="margin:16px 0 0;color:#b8aa8f;font-size:16px;line-height:1.65;">Your <strong style="color:#f8edd7;">${escapeHtml(details.tierLabel)}</strong> membership is active. Member-cost cigar boxes, private drops, and your digital humidor are ready.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #6f5323;background:#030504;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0 0 6px;color:#dca93a;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">Member status</p>
                      <p style="margin:0;color:#f8edd7;font-size:22px;line-height:1.25;font-weight:800;">${escapeHtml(details.tierLabel)}</p>
                      <p style="margin:8px 0 0;color:#b8aa8f;font-size:13px;line-height:1.5;">${escapeHtml(accessLabel)}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;">
                <p style="margin:0 0 12px;color:#dca93a;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">Benefits now open</p>
                ${benefitRows}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 28px 8px;">
                <p style="margin:0 0 12px;color:#dca93a;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">First box tips</p>
                ${tipRows}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 28px;">
                <a href="${escapeHtmlAttribute(details.memberDropsUrl)}" style="display:block;margin:0 0 12px;padding:14px 18px;background:#dca93a;color:#07110d;font-size:13px;font-weight:800;letter-spacing:0.14em;text-align:center;text-decoration:none;text-transform:uppercase;">Browse member drops</a>
                <a href="${escapeHtmlAttribute(details.humidorUrl)}" style="display:block;margin:0;padding:13px 18px;border:1px solid #6f5323;color:#f8edd7;font-size:13px;font-weight:800;letter-spacing:0.14em;text-align:center;text-decoration:none;text-transform:uppercase;">Open digital humidor</a>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 28px;background:#07110d;border-top:1px solid #6f5323;">
                <p style="margin:0 0 10px;color:#f8edd7;font-size:14px;line-height:1.6;">Need help choosing your first member-cost box? Reply to this email or visit <a href="${escapeHtmlAttribute(details.supportUrl)}" style="color:#dca93a;">concierge support</a>.</p>
                <p style="margin:0;color:#8f846f;font-size:12px;line-height:1.6;">Yuzu Cigar Club is for adults 21+. Availability, pricing, shipping, and compliance checks can vary. Request ID: ${escapeHtml(requestId)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return sanitizeEmailHtml(html);
}

function buildMemberWelcomeListRow(text, index) {
  return `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 10px;border-bottom:1px solid rgba(111,83,35,0.55);">
                  <tr>
                    <td width="34" style="padding:0 12px 12px 0;vertical-align:top;">
                      <div style="width:28px;height:28px;border:1px solid #dca93a;color:#dca93a;font-size:12px;font-weight:800;line-height:28px;text-align:center;">${index}</div>
                    </td>
                    <td style="padding:0 0 12px;color:#f8edd7;font-size:14px;line-height:1.6;">${escapeHtml(text)}</td>
                  </tr>
                </table>`;
}

function getMemberWelcomeBenefits(tierKey, expiresAt) {
  const common = [
    "Member-cost pricing on full cigar boxes.",
    "Access to private box catalog and member drops.",
    "Digital humidor tools to track, age, and reorder.",
  ];

  if (tierKey === "box_access_pass") {
    return [
      ...common,
      expiresAt ? `Friends & Family Box Access through ${formatWelcomeDate(expiresAt)}.` : "Friends & Family Box Access is active.",
      "Email support from the Yuzu team.",
    ];
  }

  if (tierKey === "sensei") {
    return [
      ...common,
      "Monthly selection window with curated cigar access.",
      "Concierge recommendations and priority drop allocations.",
    ];
  }

  if (tierKey === "daimyo") {
    return [
      ...common,
      "VIP concierge support and first access to member-only drops.",
      "Premium allocation priority for limited releases.",
    ];
  }

  return [
    ...common,
    "Monthly curated cigar access based on your tier.",
    "Member support for recommendations and account questions.",
  ];
}

function getMemberWelcomeTips(tierKey) {
  const tips = [
    "Start with one box you already know you enjoy, then branch into member drops.",
    "Let shipped boxes rest before smoking so humidity and temperature can settle.",
    "Keep your humidor around 65%-72% relative humidity and log notes after the first smoke.",
  ];

  if (tierKey !== "box_access_pass") {
    tips.push("Use your monthly selection window early so preferred picks are not gone before you choose.");
  }

  return tips;
}

function formatWelcomeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return sanitizeText(value, 80);
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

async function handleNewsletterSubscribe(event, requestId) {
  const body = parseJsonBody(event, { maxBytes: MAX_PUBLIC_JSON_BODY_BYTES });
  if (body.error) {
    return body.error;
  }

  const email = normalizeEmailAddresses(body.value.email, 1)[0];
  if (!email) {
    return json(400, requestId, {
      error: "missing_newsletter_email",
      message: "Send a valid email address for the newsletter signup.",
    });
  }

  if (body.value.consent !== true) {
    return json(400, requestId, {
      error: "missing_marketing_consent",
      message: "Newsletter signup requires email marketing consent.",
    });
  }

  const preferredTier = normalizeMembershipTier(body.value.preferredTier || body.value.tier, []);
  const wantsMonthlyMembership = Boolean(
    body.value.wantsMonthlyMembership ||
      body.value.monthlyMember ||
      body.value.membershipInterest ||
      preferredTier
  );
  const brandPreferences = normalizeNewsletterBrandPreferences(
    body.value.brandPreferences || body.value.favoriteBrands || body.value.topBrands
  );
  const promotedCigars = normalizeNewsletterPromotedCigars(
    body.value.promotedCigars || body.value.selectedCigars || body.value.cigarPromotions
  );
  const signup = {
    email,
    firstName: sanitizeText(body.value.firstName, 80),
    lastName: sanitizeText(body.value.lastName, 80),
    fullName: sanitizeText(body.value.fullName || body.value.name, 160),
    phone: sanitizeText(body.value.phone, 40),
    source: sanitizeText(body.value.source, 80) || "website",
    pagePath: sanitizeText(body.value.pagePath || body.value.path, 180),
    wantsMonthlyMembership,
    preferredTier: wantsMonthlyMembership ? preferredTier : null,
    brandPreferences,
    promotedCigars,
  };

  let persistedSubscriber = null;
  if (shouldPersistDatabaseWrites()) {
    persistedSubscriber = await persistNewsletterSubscriber(event, requestId, signup);
  }

  const brandPreferenceEmail = await maybeSendNewsletterBrandPreferenceEmail(signup, requestId);
  const preferenceAction = promotedCigars.length ? "send_selected_cigar_promotions" : "collect_brand_preferences";
  const nextActions = wantsMonthlyMembership
    ? ["send_newsletter", "send_monthly_membership_info", "invite_to_choose_plan", preferenceAction]
    : ["send_newsletter", "offer_membership_education", preferenceAction];

  return json(200, requestId, {
    subscriber: {
      id: persistedSubscriber?.id || null,
      email,
      persisted: Boolean(persistedSubscriber),
      persistence: persistedSubscriber ? "stored" : getDatabasePersistenceStatus(),
      wantsMonthlyMembership,
      preferredTier: signup.preferredTier,
      brandPreferences,
      promotedCigars,
      updatedAt: persistedSubscriber?.updatedAt || null,
      brandPreferenceEmail,
    },
    nextActions,
  });
}

async function maybeSendNewsletterBrandPreferenceEmail(signup, requestId) {
  if (!isOutboundEmailReady()) {
    return addOutboundEmailProviderFields({
      status: getOutboundEmailPendingStatus(),
      sesMessageId: null,
    });
  }

  try {
    const emailContent = buildNewsletterFollowupEmailContent(signup, requestId);
    const sesMessageId = await sendSupportEmail({
      bodyHtml: emailContent.bodyHtml,
      bodyText: emailContent.bodyText,
      fromAddress: getSupportEmailFrom(),
      replyToAddresses: [getSupportInboundReplyToAddress()],
      subject: emailContent.subject,
      toAddresses: [signup.email],
    });

    return addOutboundEmailProviderFields({
      kind: emailContent.kind,
      status: "sent",
      sesMessageId,
    }, sesMessageId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "newsletter_brand_preference_email_failed",
        requestId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return addOutboundEmailProviderFields({
      status: "failed",
      sesMessageId: null,
    });
  }
}

function buildNewsletterFollowupEmailContent(signup, requestId) {
  if (Array.isArray(signup.promotedCigars) && signup.promotedCigars.length > 0) {
    return buildSelectedCigarPromotionEmailContent(signup, requestId);
  }

  return {
    kind: "brand_preferences_request",
    subject: "Tell us your top cigar brands",
    bodyText: buildNewsletterBrandPreferenceEmailBody(signup, requestId),
    bodyHtml: buildNewsletterBrandPreferenceEmailHtml(signup, requestId),
  };
}

function buildNewsletterBrandPreferenceEmailBody(signup, requestId) {
  const firstName = sanitizeText(signup.firstName || splitFirstName(signup.fullName), 80);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const lines = [
    greeting,
    "",
    "Welcome to Yuzu Cigar Club.",
    "",
    "To help us promote cigars you actually want to hear about, reply with your top 3-5 cigar brands.",
    "",
    "A simple reply is perfect, for example: Padron, Arturo Fuente, Davidoff, Drew Estate, My Father.",
    "If you have favorite wrappers, strength, vitolas, or brands you never want promoted, include those too.",
    "",
    "Yuzu Cigar Club is for adults 21+. We use your reply to personalize Yuzu recommendations and promotional follow-ups.",
    `Request ID: ${requestId}`,
  ];

  return sanitizeMultilineText(lines.join("\n"), MAX_EMAIL_BODY_LENGTH);
}

function buildSelectedCigarPromotionEmailContent(signup, requestId) {
  const firstName = sanitizeText(signup.firstName || splitFirstName(signup.fullName), 80);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const brandLabels = formatNewsletterBrandPreferenceLabels(signup.brandPreferences);
  const brandSummary = brandLabels.length ? brandLabels.join(", ") : "your selected brands";
  const productLines = signup.promotedCigars.flatMap((cigar, index) => [
    `${index + 1}. ${cigar.name}`,
    `Brand: ${cigar.brand}`,
    cigar.packageLabel ? `Package: ${cigar.packageLabel}` : "",
    `Public cost: ${formatNewsletterMoney(cigar.nonMemberPrice)}`,
    `Member cost: ${formatNewsletterMoney(cigar.memberPrice)}`,
    `View: ${resolveNewsletterEmailUrl(cigar.storeHref)}`,
    "",
  ]).filter(Boolean);
  const bodyText = sanitizeMultilineText(
    [
      greeting,
      "",
      `Based on ${brandSummary}, here are selected cigar picks with current Yuzu costs.`,
      "",
      ...productLines,
      "Reply with another brand any time and we will tune future newsletters.",
      "Yuzu Cigar Club is for adults 21+. Pricing can change with inventory, availability, and member status.",
      `Request ID: ${requestId}`,
    ].join("\n"),
    MAX_EMAIL_BODY_LENGTH
  );

  return {
    kind: "cigar_cost_promotions",
    subject: "Your selected Yuzu cigar picks and pricing",
    bodyText,
    bodyHtml: buildSelectedCigarPromotionEmailHtml(signup, requestId, brandSummary),
  };
}

function buildNewsletterBrandPreferenceEmailHtml(signup, requestId) {
  const firstName = sanitizeText(signup.firstName || splitFirstName(signup.fullName), 80);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const logoUrl = resolveNewsletterEmailUrl("/assets/yuzu-logo.png");
  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#11100d;color:#f8f0df;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#11100d;">
      <tr>
        <td align="center" style="padding:32px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #4f3b21;background:#18130f;">
            <tr>
              <td style="padding:28px 28px 18px;border-bottom:1px solid #4f3b21;">
                <img src="${escapeHtmlAttribute(logoUrl)}" width="84" alt="Yuzu Cigar Club" style="display:block;margin:0 0 18px;border:0;outline:none;text-decoration:none;">
                <p style="margin:0 0 10px;color:#d8a84f;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Yuzu Cigar Club</p>
                <h1 style="margin:0;color:#f8f0df;font-size:32px;line-height:1.1;font-weight:800;">Tell us your top cigar brands</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#d9cfbd;font-size:16px;line-height:1.65;">
                <p style="margin:0 0 18px;">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 18px;">Welcome to Yuzu Cigar Club. Reply with your top 3-5 cigar brands and we will tune future newsletters around cigars you actually want to see.</p>
                <p style="margin:0 0 18px;color:#f8f0df;">Padron, Arturo Fuente, Davidoff, Drew Estate, and My Father are perfect examples.</p>
                <p style="margin:0;color:#b7aa96;font-size:13px;line-height:1.6;">Yuzu Cigar Club is for adults 21+. Request ID: ${escapeHtml(requestId)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return sanitizeEmailHtml(html);
}

function buildSelectedCigarPromotionEmailHtml(signup, requestId, brandSummary) {
  const firstName = sanitizeText(signup.firstName || splitFirstName(signup.fullName), 80);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const logoUrl = resolveNewsletterEmailUrl("/assets/yuzu-logo.png");
  const productRows = signup.promotedCigars
    .map((cigar, index) => buildSelectedCigarPromotionProductHtml(cigar, index))
    .join("");
  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#11100d;color:#f8f0df;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#11100d;">
      <tr>
        <td align="center" style="padding:32px 18px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid #4f3b21;background:#18130f;">
            <tr>
              <td style="padding:28px 28px 22px;border-bottom:1px solid #4f3b21;background:#1d1711;">
                <img src="${escapeHtmlAttribute(logoUrl)}" width="88" alt="Yuzu Cigar Club" style="display:block;margin:0 0 18px;border:0;outline:none;text-decoration:none;">
                <p style="margin:0 0 10px;color:#d8a84f;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Yuzu Cigar Club</p>
                <h1 style="margin:0;color:#f8f0df;font-size:34px;line-height:1.08;font-weight:800;">Selected cigars for your shelf</h1>
                <p style="margin:16px 0 0;color:#d9cfbd;font-size:16px;line-height:1.6;">${escapeHtml(greeting)} Based on ${escapeHtml(brandSummary)}, here are current Yuzu picks with public and member pricing.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 28px 0;">
                ${productRows}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 30px;background:#211911;border-top:1px solid #4f3b21;">
                <p style="margin:0 0 10px;color:#f8f0df;font-size:15px;line-height:1.6;">Reply with another brand any time and we will tune future newsletters.</p>
                <p style="margin:0;color:#b7aa96;font-size:12px;line-height:1.6;">Yuzu Cigar Club is for adults 21+. Pricing can change with inventory, availability, and member status. Request ID: ${escapeHtml(requestId)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return sanitizeEmailHtml(html);
}

function buildSelectedCigarPromotionProductHtml(cigar, index) {
  const productUrl = resolveNewsletterEmailUrl(cigar.storeHref);
  const imageUrl = resolveNewsletterEmailUrl(cigar.image);
  const imageCell = imageUrl
    ? `<td width="128" style="padding:20px 18px 20px 0;vertical-align:top;"><img src="${escapeHtmlAttribute(imageUrl)}" width="118" alt="${escapeHtmlAttribute(cigar.name)}" style="display:block;width:118px;max-width:118px;border:1px solid #4f3b21;background:#11100d;"></td>`
    : `<td width="128" style="padding:20px 18px 20px 0;vertical-align:top;"><div style="width:118px;height:118px;border:1px solid #4f3b21;background:#211911;color:#d8a84f;font-size:34px;line-height:118px;text-align:center;font-weight:800;">${index + 1}</div></td>`;

  return `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-bottom:1px solid #352719;">
                  <tr>
                    ${imageCell}
                    <td style="padding:20px 0;vertical-align:top;">
                      <p style="margin:0 0 6px;color:#d8a84f;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(cigar.brand)}</p>
                      <h2 style="margin:0 0 8px;color:#f8f0df;font-size:21px;line-height:1.25;font-weight:800;">${escapeHtml(cigar.name)}</h2>
                      ${cigar.packageLabel ? `<p style="margin:0 0 14px;color:#b7aa96;font-size:13px;line-height:1.5;">${escapeHtml(cigar.packageLabel)}</p>` : ""}
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;">
                        <tr>
                          <td style="padding:10px 14px;border:1px solid #4f3b21;background:#11100d;">
                            <p style="margin:0 0 4px;color:#b7aa96;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Public cost</p>
                            <p style="margin:0;color:#f8f0df;font-size:18px;font-weight:800;">${escapeHtml(formatNewsletterMoney(cigar.nonMemberPrice))}</p>
                          </td>
                          <td width="10"></td>
                          <td style="padding:10px 14px;border:1px solid #d8a84f;background:#2b2114;">
                            <p style="margin:0 0 4px;color:#d8a84f;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Member cost</p>
                            <p style="margin:0;color:#f8f0df;font-size:18px;font-weight:800;">${escapeHtml(formatNewsletterMoney(cigar.memberPrice))}</p>
                          </td>
                        </tr>
                      </table>
                      <a href="${escapeHtmlAttribute(productUrl)}" style="display:inline-block;background:#d8a84f;color:#11100d;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;padding:12px 16px;">View cigar</a>
                    </td>
                  </tr>
                </table>`;
}

function splitFirstName(value) {
  return sanitizeText(value, 160).split(/\s+/).filter(Boolean)[0] || "";
}

const NEWSLETTER_BRAND_LABELS = {
  arturo_fuente: "Arturo Fuente",
  davidoff: "Davidoff",
  drew_estate: "Drew Estate",
  my_father: "My Father",
  oliva: "Oliva",
  padron: "Padron",
  perdomo: "Perdomo",
  rocky_patel: "Rocky Patel",
};

const NEWSLETTER_BRAND_ALIASES = {
  arturo_fuente: "arturo_fuente",
  arturofuente: "arturo_fuente",
  davidoff: "davidoff",
  drew_estate: "drew_estate",
  drewestate: "drew_estate",
  my_father: "my_father",
  myfather: "my_father",
  oliva: "oliva",
  padron: "padron",
  perdomo: "perdomo",
  rocky_patel: "rocky_patel",
  rockypatel: "rocky_patel",
};

function normalizeNewsletterBrandPreferences(value, maxItems = 5) {
  const candidates = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n;]/) : [];
  const preferences = [];

  for (const candidate of candidates) {
    const normalized = NEWSLETTER_BRAND_ALIASES[normalizeNewsletterBrandKey(candidate)];
    if (normalized && !preferences.includes(normalized)) {
      preferences.push(normalized);
    }

    if (preferences.length >= maxItems) {
      break;
    }
  }

  return preferences;
}

function normalizeNewsletterBrandKey(value) {
  return sanitizeText(value, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeNewsletterPromotedCigars(value, maxItems = 4) {
  const candidates = Array.isArray(value) ? value : [];
  const promotedCigars = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const slug = slugify(sanitizeText(candidate.slug, 180));
    const name = sanitizeText(candidate.name, 180);
    const brand = sanitizeText(candidate.brand, 80);
    const nonMemberPrice = normalizeNewsletterMoney(candidate.nonMemberPrice ?? candidate.publicPrice ?? candidate.price);
    const memberPrice = normalizeNewsletterMoney(candidate.memberPrice) || nonMemberPrice;
    const storeHref = sanitizeNewsletterRelativeOrAbsoluteUrl(candidate.storeHref || candidate.href, slug ? `/shop/${slug}/` : "");
    const image = sanitizeNewsletterRelativeOrAbsoluteUrl(candidate.image || candidate.imageUrl, "");
    const packageLabel = sanitizeText(candidate.packageLabel, 80);

    if (slug && name && brand && storeHref && nonMemberPrice > 0) {
      promotedCigars.push({
        slug,
        name,
        brand,
        storeHref,
        nonMemberPrice,
        memberPrice,
        ...(packageLabel ? { packageLabel } : {}),
        ...(image ? { image } : {}),
      });
    }

    if (promotedCigars.length >= maxItems) {
      break;
    }
  }

  return promotedCigars;
}

function normalizeNewsletterMoney(value) {
  const amount = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
}

function formatNewsletterMoney(value) {
  const amount = normalizeNewsletterMoney(value);
  return amount > 0
    ? `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "Ask";
}

function formatNewsletterBrandPreferenceLabels(value) {
  return normalizeNewsletterBrandPreferences(value).map((preference) => NEWSLETTER_BRAND_LABELS[preference] || preference);
}

function sanitizeNewsletterRelativeOrAbsoluteUrl(value, fallback) {
  const text = sanitizeText(value, 1000);
  if (/^https?:\/\//i.test(text) || text.startsWith("/")) {
    return text;
  }

  return fallback;
}

function resolveNewsletterEmailUrl(value) {
  const text = sanitizeNewsletterRelativeOrAbsoluteUrl(value, "");
  if (!text) {
    return "";
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return `${getNewsletterSiteBaseUrl()}${text.startsWith("/") ? text : `/${text}`}`;
}

function getNewsletterSiteBaseUrl() {
  const baseUrl = sanitizeText(process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://www.yuzucigarclub.com", 240);
  return (baseUrl || "https://www.yuzucigarclub.com").replace(/\/+$/, "");
}

function sanitizeEmailHtml(value) {
  return typeof value === "string" ? value.trim().slice(0, MAX_EMAIL_HTML_LENGTH) : "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value);
}

async function handlePublicSupportContact(event, requestId) {
  const body = parseJsonBody(event, { maxBytes: MAX_PUBLIC_JSON_BODY_BYTES });
  if (body.error) {
    return body.error;
  }

  const name = sanitizeText(body.value.name, 160);
  if (!name) {
    return json(400, requestId, {
      error: "missing_contact_name",
      message: "Send your name with the support request.",
    });
  }

  const email = normalizeEmailAddresses(body.value.email, 1)[0];
  if (!email) {
    return json(400, requestId, {
      error: "missing_contact_email",
      message: "Send a valid email address with the support request.",
    });
  }

  const message = sanitizeMultilineText(body.value.message || body.value.body || body.value.text, MAX_SUPPORT_MESSAGE_LENGTH);
  if (message.length < 10) {
    return json(400, requestId, {
      error: "missing_contact_message",
      message: "Send a support message with at least 10 characters.",
    });
  }

  const topic = sanitizeText(body.value.topic, 80) || "General question";
  const orderNumber = sanitizeText(body.value.orderNumber || body.value.order || body.value.orderId, 80);
  const pagePath = sanitizeText(body.value.pagePath || body.value.path, 180);
  const subject = `Yuzu Contact - ${topic}${orderNumber ? ` - ${orderNumber}` : ""}`;
  const fromAddress = getSupportEmailFrom();
  const supportRecipient = getSupportContactEmailTo();
  const bodyText = buildPublicSupportContactEmailBody({
    email,
    message,
    name,
    orderNumber,
    pagePath,
    requestId,
    topic,
  });
  let deliveryStatus = getOutboundEmailPendingStatus();
  let sesMessageId = null;
  if (isOutboundEmailReady()) {
    try {
      sesMessageId = await sendSupportEmail({
        bodyText,
        fromAddress,
        replyToAddresses: [email],
        subject,
        toAddresses: [supportRecipient],
      });
      deliveryStatus = "sent";
    } catch (error) {
      deliveryStatus = "failed";
      console.error(
        JSON.stringify({
          level: "warn",
          event: "public_support_contact_email_failed",
          requestId,
          name: error instanceof Error ? error.name : null,
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  let persistedCase = null;
  if (shouldPersistDatabaseWrites()) {
    persistedCase = await persistPublicSupportContact(event, requestId, {
      bodyText,
      deliveryStatus,
      email,
      message,
      name,
      orderNumber,
      pagePath,
      sesMessageId,
      subject,
      topic,
      toAddresses: [supportRecipient],
    });
  }

  return json(200, requestId, {
    contact: {
      status: deliveryStatus,
      email,
      persisted: Boolean(persistedCase),
      persistence: persistedCase ? "stored" : getDatabasePersistenceStatus(),
      caseId: persistedCase?.caseId || null,
      caseNumber: persistedCase?.caseNumber || null,
      messageId: persistedCase?.emailMessageId || null,
      sesMessageId,
      ...getOutboundEmailProviderResponseFields(sesMessageId),
    },
    nextActions:
      deliveryStatus === "sent"
        ? ["support_team_review", "reply_to_customer_email"]
        : ["support_team_review", "send_support_email_when_provider_ready"],
  });
}

function buildPublicSupportContactEmailBody(details) {
  const lines = [
    "New Yuzu Cigar Club support contact form submission.",
    "",
    `Name: ${details.name}`,
    `Email: ${details.email}`,
    `Topic: ${details.topic}`,
    details.orderNumber ? `Order: ${details.orderNumber}` : "",
    details.pagePath ? `Page: ${details.pagePath}` : "",
    `Request ID: ${details.requestId}`,
    "",
    "Message:",
    details.message,
  ].filter(Boolean);

  return sanitizeMultilineText(lines.join("\n"), MAX_EMAIL_BODY_LENGTH);
}

async function handleCommerceCheckoutSession(event, requestId) {
  const body = parseJsonBody(event, { maxBytes: MAX_CHECKOUT_JSON_BODY_BYTES });
  if (body.error) {
    return body.error;
  }

  const commerceEnv = await getCommerceRuntimeEnv();

  const items = Array.isArray(body.value.items) ? body.value.items : [];
  const customer = normalizeCheckoutCustomer(body.value.customer);
  const shippingAddress = normalizeCheckoutShippingAddress(body.value.shippingAddress);
  if (items.length === 0) {
    return json(400, requestId, {
      error: "empty_cart",
      message: "Add at least one item before checkout.",
    });
  }

  if (!customer.email) {
    return json(400, requestId, {
      error: "missing_customer_email",
      message: "A valid customer email is required before checkout.",
    });
  }

  if (!shippingAddress.address1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
    return json(400, requestId, {
      error: "missing_shipping_address",
      message: "Complete the required shipping address fields before checkout.",
    });
  }

  if (!commerceEnv.STRIPE_SECRET_KEY) {
    return json(409, requestId, {
      error: "stripe_not_ready",
      message: "Stripe checkout is not configured for this environment.",
    });
  }

  if (!commerceEnv.STRIPE_LAUNCH_CATALOG_READY) {
    return json(409, requestId, {
      error: "commerce_not_configured",
      message: "The approved Stripe launch catalog has not been synced for checkout.",
    });
  }

  const launchCatalog = loadStripeLaunchCatalog(commerceEnv);
  if (launchCatalog.error || launchCatalog.catalog.length === 0) {
    return json(409, requestId, {
      error: launchCatalog.error || "commerce_not_configured",
      message: launchCatalog.message || "The approved Stripe launch catalog has no checkout-ready products configured.",
      catalogSource: launchCatalog.source,
    });
  }

  const checkoutAgeIdentity = buildCheckoutAgeIdentityBinding(customer, shippingAddress);
  const ageVerification = resolveCheckoutAgeVerification(body.value.compliance?.ageVerificationToken, commerceEnv, checkoutAgeIdentity);
  if (!ageVerification.ok) {
    return json(400, requestId, {
      error: ageVerification.error || "age_verification_required",
      message: ageVerification.message || "Complete verified 21+ identity review before checkout.",
    });
  }

  const membership = resolveCheckoutMembershipEntitlement(body.value.membership?.entitlementToken, customer, commerceEnv);
  const compliance = validateCheckoutReadiness({
    items,
    quote: body.value.quote,
    catalog: launchCatalog.catalog,
    ageVerification: ageVerification.value,
    membership,
    destination: shippingAddress,
    shippingMethodId: body.value.shippingMethodId,
    shippingProvider: commerceEnv.SHIPPING_PROVIDER,
    tax: {
      status: commerceEnv.FEATURE_STRIPE_TAX === "ready" ? "ready" : "unavailable",
      provider: "stripe_tax",
    },
  });

  if (!compliance.ok) {
    const firstError = compliance.errors[0] || {
      code: "checkout_not_ready",
      message: "Checkout is not ready.",
    };

    return json(400, requestId, {
      error: firstError.code,
      message: firstError.message,
      errors: compliance.errors,
      holdReasons: compliance.holdReasons,
    });
  }

  const stripe = createStripeClient(commerceEnv);
  const statusToken = createCheckoutStatusToken();
  let session;
  try {
    session = await createCommerceCheckoutSession(stripe, {
      cartId: body.value.cartId,
      customer,
      items: compliance.normalizedItems,
      statusToken,
      shipping: {
        methodId: compliance.shipping.methodId,
        title: compliance.shipping.title,
        carrier: compliance.shipping.carrier,
        adultSignatureRequired: compliance.shipping.adultSignatureRequired,
        deliveryAmountCents: compliance.shipping.deliveryAmountCents,
        handlingFeeCents: compliance.shipping.handlingFeeCents,
        amountCents: compliance.shipping.amountCents,
        address: shippingAddress,
      },
      compliance: {
        ageVerificationId: ageVerification.value.vendorTransactionId,
        verifiedAt: ageVerification.value.verifiedAt,
        policyVersion: "2026-05-07",
      },
    }, commerceEnv);
  } catch (error) {
    if (isStripeAccountNotReadyError(error)) {
      return json(409, requestId, {
        error: "stripe_account_not_ready",
        message: "Yuzu checkout is temporarily unavailable while payment activation finishes.",
      });
    }

    throw error;
  }

  return json(200, requestId, {
    id: session.id,
    url: session.url,
  });
}

async function handleCommerceAgeVerificationToken(event, requestId) {
  const body = parseJsonBody(event, { maxBytes: MAX_PUBLIC_JSON_BODY_BYTES });
  if (body.error) {
    return body.error;
  }

  const commerceEnv = await getCommerceRuntimeEnv();
  const uuid = normalizeAgeCheckerUuid(
    body.value.vendorTransactionId || body.value.uuid || body.value.ageCheckerUuid || body.value.agecheckerUuid
  );

  if (!uuid) {
    return json(400, requestId, {
      error: "age_verification_required",
      message: "Complete verified 21+ identity review before checkout.",
    });
  }

  if (!commerceEnv.AGE_VERIFICATION_API_KEY || !getAgeCheckerAccountSecret(commerceEnv) || !getCheckoutAgeSigningSecret(commerceEnv)) {
    return json(409, requestId, {
      error: "age_verification_not_configured",
      message: "AgeChecker.Net checkout verification is not configured for this environment.",
    });
  }

  const checkoutAgeIdentity = normalizeCheckoutAgeVerificationIdentity(body.value);
  if (checkoutAgeIdentity.error) {
    return json(400, requestId, checkoutAgeIdentity.error);
  }

  const verification = await validateAgeCheckerVerification(uuid, commerceEnv);
  const status = sanitizeText(verification.status, 40).toLowerCase();

  if (status !== "accepted") {
    const failedStatuses = new Set(["denied", "not_created", "failed", "blocked"]);
    return json(failedStatuses.has(status) || verification.blocked || verification.error ? 400 : 409, requestId, {
      error: failedStatuses.has(status) || verification.blocked || verification.error ? "age_verification_failed" : "age_verification_pending",
      message:
        failedStatuses.has(status) || verification.blocked || verification.error
          ? "AgeChecker.Net could not approve this identity review."
          : "AgeChecker.Net identity review is still pending.",
      status: status || null,
    });
  }

  const vendorTransactionId = `age_txn_${uuid}`;
  const verifiedAt = toValidIsoTimestamp(verification.verifiedAt || verification.verified_at || verification.updatedAt || verification.createdAt) || new Date().toISOString();

  return json(200, requestId, {
    vendor: "AgeChecker.Net",
    vendorTransactionId,
    verifiedAt,
    ageVerificationToken: createSignedCheckoutAgeToken(
      {
        vendorTransactionId,
        verifiedAt,
        identityHash: checkoutAgeIdentity.value.identityHash,
      },
      commerceEnv
    ),
  });
}

async function handleCommerceMembershipSession(event, requestId) {
  const body = parseJsonBody(event, { maxBytes: MAX_PUBLIC_JSON_BODY_BYTES });
  if (body.error) {
    return body.error;
  }

  const tierKey = slugify(body.value.tierName || body.value.tierKey);
  const billingPeriod = sanitizeText(body.value.billingPeriod, 40) || "monthly";
  const customerEmail = normalizeEmailAddresses(body.value.customer?.email, 1)[0] || "";
  if (!customerEmail) {
    return json(400, requestId, {
      error: "missing_customer_email",
      message: "A valid customer email is required before membership checkout.",
    });
  }

  const membershipOffer = resolveMembershipCheckoutOffer(body.value.membershipOffer, {
    tierKey,
    billingPeriod,
  });

  if (membershipOffer?.code === "friends-family-box-pass") {
    const actor = getActor(event);
    const claimActor = validateFriendsFamilyClaimActor(actor, customerEmail, requestId);
    if (claimActor.error) {
      return claimActor.error;
    }

    return handleFriendsFamilyBoxPassClaim(
      {
        actor: claimActor.value,
        customer: {
          ...body.value.customer,
          email: customerEmail,
        },
        membershipOffer,
      },
      requestId
    );
  }

  const priceEnvKey = `STRIPE_PRICE_${tierKey.replace(/-/g, "_").toUpperCase()}_${billingPeriod.toUpperCase()}`;
  const commerceEnv = await getCommerceRuntimeEnv();
  const stripePriceId = commerceEnv[priceEnvKey];

  if (!commerceEnv.STRIPE_SECRET_KEY || !stripePriceId) {
    return json(409, requestId, {
      error: "stripe_not_ready",
      message: "Stripe membership checkout is not configured for this environment.",
      priceEnvKey,
    });
  }

  const stripe = createStripeClient(commerceEnv);
  const statusToken = createCheckoutStatusToken();
  let session;
  try {
    session = await createMembershipCheckoutSession(stripe, {
      tierKey,
      billingPeriod,
      stripePriceId,
      statusToken,
      customer: {
        ...body.value.customer,
        email: customerEmail,
      },
      membershipOffer,
    }, commerceEnv);
  } catch (error) {
    if (isStripeAccountNotReadyError(error)) {
      return json(409, requestId, {
        error: "stripe_account_not_ready",
        message: "Yuzu checkout is temporarily unavailable while payment activation finishes.",
      });
    }

    throw error;
  }

  return json(200, requestId, {
    id: session.id,
    url: session.url,
  });
}

function validateFriendsFamilyClaimActor(actor, customerEmail, requestId) {
  if (!actor) {
    return {
      error: json(401, requestId, {
        error: "membership_claim_auth_required",
        message: "Sign in with your verified Yuzu account before activating this Friends & Family pass.",
      }),
    };
  }

  if (!actor.email || !actor.emailVerified) {
    return {
      error: json(403, requestId, {
        error: "membership_claim_email_unverified",
        message: "Confirm your Yuzu account email before activating this Friends & Family pass.",
      }),
    };
  }

  const actorEmail = normalizeEmailAddresses(actor.email, 1)[0] || "";
  if (!actorEmail || actorEmail !== customerEmail) {
    return {
      error: json(403, requestId, {
        error: "membership_claim_email_mismatch",
        message: "The Friends & Family pass can only be activated for the signed-in account email.",
      }),
    };
  }

  return { value: actor };
}

async function handleFriendsFamilyBoxPassClaim(input, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return json(409, requestId, {
      error: "membership_claim_not_ready",
      message: "Friends & Family pass activation is not available until member persistence is ready.",
      persistence: getDatabasePersistenceStatus(),
    });
  }

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  return withDatabaseClient("ycc-api-friends-family-pass-claim", async (client) => {
    const member = await grantFriendsFamilyBoxPass(client, input, requestId, expiresAt);
    const stripeCustomerId =
      member.stripeCustomerId || (await createAndLinkFriendsFamilyStripeCustomer(client, member, input, expiresAt));
    const memberWelcomeEmail = await maybeSendMemberWelcomeEmail(
      {
        email: member.email,
        displayName: member.displayName || input.customer?.fullName || input.customer?.name,
        membershipTier: "box_access_pass",
        memberStatus: "active",
        source: input.membershipOffer.source,
        campaign: input.membershipOffer.campaign,
        expiresAt,
        stripeCustomerId,
      },
      requestId
    );

    return json(200, requestId, {
      id: `ff_box_pass_${hashActor(input.customer.email)}`,
      url: "/account?friends_family=claimed",
      membershipClaim: {
        tier: "Box Access Pass",
        tierKey: "box_access_pass",
        status: "member",
        memberStatus: "active",
        source: input.membershipOffer.source,
        campaign: input.membershipOffer.campaign,
        expiresAt,
        memberId: member.id,
        stripeCustomerId,
        memberWelcomeEmail,
      },
    });
  });
}

async function createAndLinkFriendsFamilyStripeCustomer(client, member, input, expiresAt) {
  const commerceEnv = await getCommerceRuntimeEnv();
  if (!commerceEnv.STRIPE_SECRET_KEY) {
    return null;
  }

  const stripe = createStripeClient(commerceEnv);
  const customer = await createFriendsFamilyCustomer(
    stripe,
    {
      customer: {
        email: member.email,
        fullName: member.displayName || input.customer?.fullName || input.customer?.name,
      },
      membershipOffer: input.membershipOffer,
      expiresAt,
    },
    {
      idempotencyKey: `ycc-ff-box-pass-${hashActor(member.email)}`,
    }
  );

  const stripeCustomerId = sanitizeText(customer?.id, 160);
  if (!stripeCustomerId) {
    throw new Error("Stripe did not return a Customer ID for the Friends & Family claim.");
  }

  const linkedMember = await linkMemberStripeCustomer(client, member.id, stripeCustomerId);
  return sanitizeText(linkedMember?.stripe_customer_id, 160) || stripeCustomerId;
}

async function grantFriendsFamilyBoxPass(client, input, requestId, expiresAt) {
  const email = normalizeEmailAddresses(input.customer?.email, 1)[0] || "";
  const displayName = sanitizeText(input.customer?.fullName || input.customer?.name || input.actor?.name, 160);
  const actorId = sanitizeText(input.actor?.sub, 160);
  if (!actorId) {
    throw new Error("Friends & Family pass claim requires an authenticated Cognito actor.");
  }

  const metadata = JSON.stringify({
    friendsFamilyBoxPass: {
      code: input.membershipOffer.code,
      actorSub: actorId,
      source: input.membershipOffer.source,
      campaign: input.membershipOffer.campaign,
      landingPath: input.membershipOffer.landingPath,
      access: input.membershipOffer.access,
      grantedAt: new Date().toISOString(),
      expiresAt,
    },
  });

  const updated = await client.query(
    `
      update public.members
      set email_verified = true,
          display_name = coalesce(nullif(display_name, ''), $2),
          role = coalesce(role, 'customer'),
          membership_tier = 'box_access_pass',
          member_status = 'active',
          joined_at = coalesce(joined_at, now()),
          last_seen_at = now(),
          metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
          actor_id = $4,
          request_id = $5,
          updated_at = now()
      where lower(email) = lower($1)
      returning id, cognito_sub, email, display_name, role, membership_tier, member_status, stripe_customer_id
    `,
    [email, nullable(displayName), metadata, actorId, requestId]
  );

  if (updated.rows[0]) {
    return mapMemberRow(updated.rows[0]);
  }

  const cognitoSub = actorId;
  const inserted = await client.query(
    `
      insert into public.members (
        cognito_sub,
        email,
        email_verified,
        display_name,
        role,
        membership_tier,
        member_status,
        joined_at,
        last_seen_at,
        metadata,
        actor_id,
        request_id
      )
      values ($1, $2, true, $3, 'customer', 'box_access_pass', 'active', now(), now(), $4::jsonb, $5, $6)
      on conflict (cognito_sub) do update
      set email = excluded.email,
          email_verified = true,
          display_name = coalesce(public.members.display_name, excluded.display_name),
          membership_tier = 'box_access_pass',
          member_status = 'active',
          joined_at = coalesce(public.members.joined_at, now()),
          last_seen_at = now(),
          metadata = coalesce(public.members.metadata, '{}'::jsonb) || excluded.metadata,
          actor_id = excluded.actor_id,
          request_id = excluded.request_id,
          updated_at = now()
      returning id, cognito_sub, email, display_name, role, membership_tier, member_status, stripe_customer_id
    `,
    [cognitoSub, email, nullable(displayName), metadata, actorId, requestId]
  );

  if (!inserted.rows[0]) {
    throw new Error("Friends & Family pass claim did not return a member row.");
  }

  return mapMemberRow(inserted.rows[0]);
}

function mapMemberRow(row) {
  return {
    id: row.id,
    cognitoSub: row.cognito_sub,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    membershipTier: row.membership_tier,
    memberStatus: row.member_status,
    stripeCustomerId: row.stripe_customer_id || null,
  };
}

function resolveMembershipCheckoutOffer(value, context = {}) {
  const offer = value && typeof value === "object" ? value : {};
  const code = sanitizeText(offer.code || offer.offerCode, 80).toLowerCase();
  const access = sanitizeText(offer.access, 80).toLowerCase();
  const isFriendsFamilyBoxPass =
    code === "friends-family-box-pass" &&
    access === "box_access_pass_1_year" &&
    context.tierKey === "box-access-pass" &&
    context.billingPeriod === "yearly";

  if (!isFriendsFamilyBoxPass) {
    return null;
  }

  return {
    code,
    source: "friends-family-page",
    campaign: "friends-family-1-year-box-pass",
    landingPath: "/friends-family",
    access,
    trialPeriodDays: 365,
  };
}

function isStripeAccountNotReadyError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  const code = error && typeof error === "object" ? String(error.code || error.type || "") : "";

  return code.includes("account") || /cannot currently make live charges|charges.*disabled|account.*not.*ready/i.test(message);
}

async function handleStripeWebhook(event, requestId) {
  const signature = getHeader(event, "stripe-signature");
  if (!signature) {
    return json(400, requestId, {
      error: "missing_stripe_signature",
      message: "Stripe webhook events require a Stripe-Signature header.",
    });
  }

  const commerceEnv = await getCommerceRuntimeEnv();
  if (!commerceEnv.STRIPE_WEBHOOK_SECRET || !commerceEnv.STRIPE_SECRET_KEY) {
    return json(409, requestId, {
      error: "stripe_webhook_not_configured",
      message: "Stripe webhook verification is not configured for this environment.",
    });
  }

  try {
    const stripe = createStripeClient(commerceEnv);
    const rawBody = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
    const stripeEvent = verifyStripeWebhook({
      stripe,
      rawBody,
      signature,
      webhookSecret: commerceEnv.STRIPE_WEBHOOK_SECRET,
    });
    const action = getHandledStripeEventAction(stripeEvent.type);
    let processing = {
      duplicate: false,
      eventStored: false,
      orderId: null,
      processingStatus: "not_persisted",
    };

    if (shouldPersistDatabaseWrites()) {
      processing = await processStripeWebhookEvent(event, requestId, stripeEvent, action, stripe);
    }

    const orderAlert = buildAdminNewOrderAlert(stripeEvent, action, processing);
    if (orderAlert) {
      await maybeDispatchAdminOperationalAlert(orderAlert, requestId);
    }

    if (shouldSendStripeOrderConfirmationEmail(stripeEvent, action, processing)) {
      const orderEmail = await maybeSendStripeOrderConfirmationEmail(stripeEvent, processing, requestId);
      processing = {
        ...processing,
        orderEmail,
      };
    }

    if (shouldSendStripeMemberWelcomeEmail(stripeEvent, action, processing)) {
      const memberWelcomeEmail = await maybeSendMemberWelcomeEmail(
        {
          email: processing.subscription.email,
          membershipTier: processing.subscription.tierKey,
          memberStatus: processing.subscription.status,
          billingPeriod: processing.subscription.billingPeriod,
          expiresAt: processing.subscription.currentPeriodEnd,
          stripeCustomerId: processing.subscription.stripeCustomerId,
          source: "stripe-subscription",
          campaign: stripeEvent.type,
        },
        requestId
      );
      processing = {
        ...processing,
        subscription: {
          ...processing.subscription,
          memberWelcomeEmail,
        },
      };
    }

    return json(200, requestId, {
      received: true,
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      action,
      persistence: shouldPersistDatabaseWrites() ? "stored" : getDatabasePersistenceStatus(),
      processing,
    });
  } catch (error) {
    const errorCode = error && typeof error === "object" ? error.code : null;
    return json(400, requestId, {
      error: errorCode || "invalid_stripe_signature",
      message: "Stripe webhook signature verification failed.",
    });
  }
}

async function handleCheckoutSessionStatus(event, requestId) {
  const sessionId = extractLastPathSegment(event);
  const suppliedStatusToken = getQueryParam(event, "status_token");
  const commerceEnv = await getCommerceRuntimeEnv();

  if (!commerceEnv.STRIPE_SECRET_KEY) {
    return json(409, requestId, {
      error: "stripe_not_ready",
      message: "Stripe checkout status is not configured for this environment.",
    });
  }

  const stripe = createStripeClient(commerceEnv);
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    const mappedError = mapStripeCheckoutSessionRetrieveError(error);
    if (mappedError) {
      return json(mappedError.statusCode, requestId, {
        error: mappedError.error,
        message: mappedError.message,
      });
    }

    throw error;
  }
  const expectedStatusToken = session?.metadata?.checkout_status_token || session?.metadata?.checkoutStatusToken || "";
  if (!isValidCheckoutStatusToken(suppliedStatusToken, expectedStatusToken)) {
    return json(403, requestId, {
      error: "checkout_status_forbidden",
      message: "Checkout session status requires the verification token returned from Stripe Checkout.",
    });
  }

  const status = mapCheckoutSessionStatus(session);
  const persistedOrder = shouldPersistDatabaseWrites() ? await findCommerceOrderByCheckoutSessionId(sessionId) : null;
  const effectiveStatus = applyPersistedOrderToCheckoutStatus(status, persistedOrder);

  return json(200, requestId, {
    ...effectiveStatus,
    id: effectiveStatus.id || sessionId,
  });
}

function mapStripeCheckoutSessionRetrieveError(error) {
  const code = sanitizeText(error?.code, 80).toLowerCase();
  const type = sanitizeText(error?.type, 80).toLowerCase();
  const statusCode = Number(error?.statusCode || error?.status || 0);

  if (statusCode === 404 || code === "resource_missing") {
    return {
      statusCode: 404,
      error: "checkout_session_not_found",
      message: "The requested checkout session was not found.",
    };
  }

  if (statusCode === 400 || type === "stripeinvalidrequesterror") {
    return {
      statusCode: 400,
      error: "invalid_checkout_session",
      message: "The checkout session id is invalid.",
    };
  }

  return null;
}

function loadStripeLaunchCatalog(env = process.env) {
  const source = readStripeLaunchCatalogSource(env);
  if (!source.content) {
    return { catalog: [], source: source.name };
  }

  let parsed;
  try {
    parsed = JSON.parse(source.content);
  } catch {
    return {
      catalog: [],
      error: "commerce_catalog_invalid",
      message: "The configured Stripe launch catalog is not valid JSON.",
      source: source.name,
    };
  }

  const entries = Array.isArray(parsed) ? parsed : Array.isArray(parsed.products) ? parsed.products : [];
  if (!Array.isArray(entries)) {
    return {
      catalog: [],
      error: "commerce_catalog_invalid",
      message: "The configured Stripe launch catalog must be an array or a products array.",
      source: source.name,
    };
  }

  return {
    catalog: entries.map(normalizeLaunchCatalogProduct).filter(Boolean),
    source: source.name,
  };
}

function readStripeLaunchCatalogSource(env) {
  if (env.STRIPE_LAUNCH_CATALOG_JSON) {
    return { name: "STRIPE_LAUNCH_CATALOG_JSON", content: env.STRIPE_LAUNCH_CATALOG_JSON };
  }

  if (env.STRIPE_LAUNCH_CATALOG_PATH) {
    const configuredPath = String(env.STRIPE_LAUNCH_CATALOG_PATH);
    const catalogPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(__dirname, configuredPath);

    try {
      return { name: "STRIPE_LAUNCH_CATALOG_PATH", content: fsSync.readFileSync(catalogPath, "utf8") };
    } catch {
      return { name: "STRIPE_LAUNCH_CATALOG_PATH", content: "" };
    }
  }

  return { name: "unset", content: "" };
}

function normalizeLaunchCatalogProduct(product) {
  if (!product || typeof product !== "object") {
    return null;
  }

  const sku = String(product.sku || "").trim().toUpperCase();
  const price = Number(product.price ?? product.unitPrice);
  const stripePriceId = sanitizeText(product.stripePriceId, 200);
  if (!sku || !Number.isFinite(price) || !stripePriceId) {
    return null;
  }

  return {
    sku,
    slug: slugify(product.slug || product.name || sku),
    name: sanitizeText(product.name || sku, 200) || sku,
    brand: sanitizeText(product.brand || product.vendor || product.manufacturer, 120),
    category: sanitizeText(product.category || product.productCategory || product.product_category, 140),
    description: sanitizeText(product.description || product.summary || product.shortDescription, 400),
    imageUrl: sanitizeHumidorImageUrl(
      product.imageUrl ||
        product.image_url ||
        product.productImageUrl ||
        product.product_image_url ||
        product.primaryImageUrl ||
        product.primary_image_url ||
        product.thumbnailUrl ||
        product.thumbnail_url ||
        product.image
    ),
    wrapper: sanitizeText(product.wrapper || product.wrapperType || product.wrapper_type, 120),
    origin: sanitizeText(product.origin || product.country || product.countryOfOrigin || product.country_of_origin, 120),
    strength: sanitizeText(product.strength || product.body, 120),
    vitola: sanitizeText(product.vitola || product.shape || product.size, 120),
    price,
    publishStatus: sanitizeText(product.publishStatus || product.status || "published", 40),
    inventoryPolicy: sanitizeText(product.inventoryPolicy || (product.managedStock === false ? "manual" : "track"), 40),
    sourceQuantity: product.sourceQuantity ?? product.quantity ?? product.inventory ?? null,
    shippable: product.shippable !== false,
    memberOnly: product.memberOnly === true || product.member_only === true || product.requiresMembership === true,
    adultSignatureRequired: product.adultSignatureRequired !== false,
    stripeProductId: sanitizeText(product.stripeProductId, 200) || null,
    stripePriceId,
  };
}

async function handleCustomerPortalSession(event, actor, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const requestedCustomerId = sanitizeText(body.value.stripeCustomerId, 160);
  const resolvedStripeCustomerId = await resolveMemberStripeCustomerId(actor, requestId);
  if (requestedCustomerId && resolvedStripeCustomerId && requestedCustomerId !== resolvedStripeCustomerId) {
    return json(403, requestId, {
      error: "customer_portal_forbidden",
      message: "Customer Portal access is limited to the authenticated member billing profile.",
    });
  }

  if (requestedCustomerId && !resolvedStripeCustomerId) {
    return json(403, requestId, {
      error: "customer_portal_forbidden",
      message: "Customer Portal access is limited to the authenticated member billing profile.",
    });
  }

  const stripeCustomerId = resolvedStripeCustomerId;
  const commerceEnv = await getCommerceRuntimeEnv();
  if (!commerceEnv.STRIPE_SECRET_KEY || !stripeCustomerId) {
    return json(409, requestId, {
      error: "stripe_not_ready",
      message: "Stripe Customer Portal is not configured for this member yet.",
    });
  }

  const stripe = createStripeClient(commerceEnv);
  const session = await stripe.billingPortal.sessions.create(
    buildCustomerPortalSessionParams({ stripeCustomerId }, commerceEnv)
  );

  return json(200, requestId, {
    url: session.url,
  });
}

async function handleCommerceMembership(event, actor, requestId) {
  const commerceEnv = await getCommerceRuntimeEnv();

  if (!shouldPersistDatabaseWrites()) {
    const membership = getMembershipSnapshot(actor, null);
    return json(200, requestId, {
      membership,
      source: "cognito-jwt",
      subscription: {
        status: "pending_backend_sync",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
      membershipEntitlementToken: createMembershipEntitlementTokenForCheckout(actor, membership, commerceEnv),
    });
  }

  return withDatabaseClient("ycc-api-commerce-membership", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const subscription = await findMemberSubscriptionForCheckout(client, member.id, actor.email || member.email);
    const membership = getMembershipSnapshotFromSubscription(actor, member, subscription);

    return json(200, requestId, {
      membership,
      source: subscription ? "postgres" : "cognito-jwt",
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            stripeCustomerId: subscription.stripeCustomerId,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            stripePriceId: subscription.stripePriceId,
            checkoutSessionId: subscription.checkoutSessionId,
            tierKey: subscription.tierKey,
            billingPeriod: subscription.billingPeriod,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : {
            status: "pending_backend_sync",
            stripeCustomerId: null,
            stripeSubscriptionId: null,
          },
      membershipEntitlementToken: createMembershipEntitlementTokenForCheckout(actor, membership, commerceEnv),
    });
  });
}

async function findMemberSubscriptionForCheckout(client, memberId, email) {
  const result = await client.query(
    `
      select
        id,
        email,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        stripe_checkout_session_id,
        tier_key,
        billing_period,
        status,
        current_period_end,
        created_at,
        updated_at
      from public.member_subscriptions
      where member_id = $1
         or lower(email) = lower($2)
      order by
        case when lower(status) in ('active', 'trialing') then 0 else 1 end,
        coalesce(updated_at, created_at) desc
      limit 1
    `,
    [memberId, email || ""]
  );

  const row = result.rows[0];
  return row ? mapMemberSubscriptionForCheckout(row) : null;
}

function mapMemberSubscriptionForCheckout(row) {
  return {
    id: row.id,
    email: row.email || null,
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionId: row.stripe_subscription_id || null,
    stripePriceId: row.stripe_price_id || null,
    checkoutSessionId: row.stripe_checkout_session_id || null,
    tierKey: row.tier_key || null,
    billingPeriod: row.billing_period || null,
    status: sanitizeText(row.status, 40).toLowerCase() || null,
    currentPeriodEnd: row.current_period_end ? toIsoString(row.current_period_end) : null,
  };
}

function getMembershipSnapshotFromSubscription(actor, member, subscription) {
  const snapshot = getMembershipSnapshot(actor, member);
  if (!subscription || !doesSubscriptionConferMembership(subscription.status)) {
    return snapshot;
  }

  return {
    ...snapshot,
    tier: subscription.tierKey || snapshot.tier,
    status: "active",
  };
}

function doesSubscriptionConferMembership(status) {
  return ["active", "trialing"].includes(sanitizeText(status, 40).toLowerCase());
}

async function handleCommerceOrderStatus(event, actor, requestId) {
  const orderId = extractLastPathSegment(event);
  if (!orderId) {
    return json(400, requestId, {
      error: "missing_order_id",
      message: "Commerce order id is required in the request path.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      order: {
        id: orderId,
        status: "pending_backend_sync",
        actor: actor.email,
      },
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-commerce-order", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const order = await findCommerceOrderByIdForActor(client, orderId, member.id, actor.email);
    if (!order) {
      return json(404, requestId, {
        error: "order_not_found",
        message: "The requested order was not found or is not visible to this account.",
      });
    }

    return json(200, requestId, {
      order,
      persistence: "stored",
    });
  });
}

async function handleCommerceOrders(event, actor, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      orders: [],
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-commerce-orders", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const result = await client.query(
      `
        select
          o.id,
          o.stripe_checkout_session_id,
          o.status,
          o.fulfillment_status,
          o.total_cents,
          o.currency,
          o.created_at,
          coalesce(sum(i.quantity), 0)::integer as item_count
        from public.commerce_orders o
        left join public.commerce_order_items i on i.order_id = o.id
        where o.member_id = $1 or lower(o.email) = lower($2)
        group by o.id
        order by o.created_at desc
        limit 25
      `,
      [member.id, actor.email]
    );

    return json(200, requestId, {
      orders: result.rows.map((row) => ({
        id: row.id,
        orderNumber: row.stripe_checkout_session_id,
        placedAt: toIsoString(row.created_at),
        status: row.status,
        fulfillmentStatus: row.fulfillment_status,
        total: Number(row.total_cents || 0) / 100,
        currency: row.currency || "usd",
        itemCount: Number(row.item_count || 0),
      })),
      persistence: "stored",
    });
  });
}

async function handleAdminOrders(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Customer order administration requires an admin or concierge operator group.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      orders: [],
      summary: buildEmptyAdminOrdersSummary(),
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-admin-orders", async (client) => {
    const summary = await loadAdminOrdersSummary(client);
    const orders = await loadAdminOrderRows(client, {
      status: sanitizeText(getQueryParam(event, "status"), 40),
      q: sanitizeText(getQueryParam(event, "q"), 120),
    });

    return json(200, requestId, {
      orders,
      summary,
      persistence: "stored",
    });
  });
}

async function handleAdminOrderUpdate(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Customer order administration requires an admin or concierge operator group.",
    });
  }

  const orderId = getPathId(event, "id");
  if (!orderId || !isUuid(orderId)) {
    return json(400, requestId, {
      error: "missing_order_id",
      message: "A valid order id is required in the admin order path.",
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const status = normalizeOptionalStatus(body.value.status, ADMIN_ORDER_STATUSES);
  const fulfillmentStatus = normalizeOptionalStatus(body.value.fulfillmentStatus, ADMIN_FULFILLMENT_STATUSES);
  const complianceStatus = normalizeOptionalStatus(body.value.complianceStatus, ADMIN_COMPLIANCE_STATUSES);

  if (status.error || fulfillmentStatus.error || complianceStatus.error) {
    return json(400, requestId, {
      error: "invalid_admin_order_update",
      message: status.error || fulfillmentStatus.error || complianceStatus.error,
    });
  }

  if (!status.supplied && !fulfillmentStatus.supplied && !complianceStatus.supplied) {
    return json(400, requestId, {
      error: "empty_admin_order_update",
      message: "Provide status, fulfillmentStatus, or complianceStatus to update an order.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(409, requestId, {
      error: "database_writes_not_ready",
      message: "Admin order updates require the commerce database schema.",
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-admin-order-update", async (client) => {
    const order = await updateAdminOrderRow(client, {
      orderId,
      status: status.value,
      fulfillmentStatus: fulfillmentStatus.value,
      complianceStatus: complianceStatus.value,
      actor,
      requestId,
    });

    if (!order) {
      return json(404, requestId, {
        error: "order_not_found",
        message: "The requested customer order was not found.",
      });
    }

    await insertCommerceAuditLog(client, {
      actor,
      requestId,
      action: "admin.order.update",
      targetType: "commerce_order",
      targetId: order.id,
      orderId: order.id,
      payload: {
        status: status.value,
        fulfillmentStatus: fulfillmentStatus.value,
        complianceStatus: complianceStatus.value,
      },
    });

    return json(200, requestId, {
      order,
      persistence: {
        status: "stored",
        table: "commerce_orders",
      },
    });
  });
}

async function handleAdminMembers(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "User access administration requires an admin or concierge operator group.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      members: [],
      summary: buildEmptyAdminMembersSummary(),
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-admin-members", async (client) => {
    const summary = await loadAdminMembersSummary(client);
    const members = await loadAdminMemberRows(client, {
      status: sanitizeText(getQueryParam(event, "status"), 40),
      q: sanitizeText(getQueryParam(event, "q"), 120),
      limit: resolveAdminListLimit(getQueryParam(event, "limit")),
    });

    return json(200, requestId, {
      members,
      summary,
      persistence: "stored",
    });
  });
}

async function handleAdminMemberAccessUpdate(event, actor, requestId) {
  if (!canAdministerMemberAccess(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "User access administration requires an admin group.",
    });
  }

  const memberId = getPathId(event, "id");
  if (!memberId || !isUuid(memberId)) {
    return json(400, requestId, {
      error: "missing_member_id",
      message: "A valid member id is required in the admin member access path.",
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const role = normalizeOptionalStatus(body.value.role, ADMIN_MEMBER_ROLES);
  const memberStatus = normalizeOptionalStatus(body.value.memberStatus, ADMIN_MEMBER_STATUSES);
  const membershipTier = normalizeOptionalNullableStatus(body.value.membershipTier, ADMIN_MEMBERSHIP_TIERS);

  if (role.error || memberStatus.error || membershipTier.error) {
    return json(400, requestId, {
      error: "invalid_admin_member_access_update",
      message: role.error || memberStatus.error || membershipTier.error,
    });
  }

  if (!role.supplied && !memberStatus.supplied && !membershipTier.supplied) {
    return json(400, requestId, {
      error: "empty_admin_member_access_update",
      message: "Provide role, memberStatus, or membershipTier to update user access.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(409, requestId, {
      error: "database_writes_not_ready",
      message: "Admin member access updates require the member database schema.",
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-admin-member-access-update", async (client) => {
    const member = await updateAdminMemberAccessRow(client, {
      memberId,
      role: role.value,
      memberStatus: memberStatus.value,
      membershipTier: membershipTier.value,
      actor,
      requestId,
    });

    if (!member) {
      return json(404, requestId, {
        error: "member_not_found",
        message: "The requested member was not found.",
      });
    }

    await insertAuditLog(client, event, {
      actor,
      requestId,
      memberId,
      action: "admin.member_access.update",
      resourceType: "member",
      resourceId: memberId,
      afterData: {
        role: role.value,
        memberStatus: memberStatus.value,
        membershipTier: membershipTier.value,
      },
    });

    return json(200, requestId, {
      member,
      persistence: {
        status: "stored",
        table: "members",
      },
    });
  });
}

async function handleAdminStripeSyncProducts(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Stripe catalog sync requires an admin or concierge operator group.",
    });
  }

  const commerceEnv = await getCommerceRuntimeEnv();
  return json(202, requestId, {
    sync: buildAdminStripeSyncSnapshot(commerceEnv),
  });
}

async function handleAdminWebhookEvents(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Webhook event history requires an admin or concierge operator group.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      events: [],
      summary: buildEmptyAdminOverview().counts.webhooks,
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-admin-webhook-events", async (client) => {
    const overview = await loadAdminOperationsOverview(client);
    const events = await loadAdminWebhookEventRows(client);

    return json(200, requestId, {
      events,
      summary: overview.counts.webhooks,
      persistence: "stored",
    });
  });
}

async function handleAdminComplianceHolds(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Compliance hold review requires an admin or concierge operator group.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      holds: [],
      orders: [],
      subscriptions: [],
      audit: [],
      overview: buildEmptyAdminOverview(),
      summary: buildEmptyAdminOverview().counts.holds,
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-admin-compliance-holds", async (client) => {
    const overview = await loadAdminOperationsOverview(client);
    const holds = await loadAdminComplianceHoldRows(client);
    const orders = await loadRecentAdminOrders(client);
    const subscriptions = await loadRecentAdminSubscriptions(client);
    const audit = await loadRecentAdminAuditEntries(client);

    return json(200, requestId, {
      holds,
      orders,
      subscriptions,
      audit,
      overview,
      summary: overview.counts.holds,
      persistence: "stored",
    });
  });
}

function buildEmptyAdminOverview() {
  return {
    counts: {
      orders: {
        total: 0,
        paid: 0,
        pending: 0,
        refunded: 0,
      },
      subscriptions: {
        total: 0,
        active: 0,
        pastDue: 0,
        canceled: 0,
      },
      holds: {
        total: 0,
        open: 0,
        resolved: 0,
      },
      webhooks: {
        total: 0,
        processed: 0,
        pending: 0,
        failed: 0,
      },
      audit: {
        total: 0,
        last24h: 0,
      },
    },
    latest: {
      orderAt: null,
      subscriptionAt: null,
      holdAt: null,
      webhookAt: null,
      auditAt: null,
    },
  };
}

function buildEmptyAdminOrdersSummary() {
  return {
    total: 0,
    paid: 0,
    pending: 0,
    fulfilled: 0,
    needsAttention: 0,
  };
}

function buildEmptyAdminMembersSummary() {
  return {
    total: 0,
    admins: 0,
    operators: 0,
    members: 0,
    nonMembers: 0,
    banned: 0,
  };
}

async function loadAdminOrdersSummary(client) {
  const result = await client.query(
    `
      select /* admin_orders_summary */
        (select count(*)::integer from public.commerce_orders) as orders_total,
        (
          select count(*)::integer
          from public.commerce_orders
          where lower(status) in ('paid', 'complete', 'completed', 'succeeded')
        ) as orders_paid,
        (
          select count(*)::integer
          from public.commerce_orders
          where lower(status) in ('pending', 'open', 'processing', 'requires_review')
        ) as orders_pending,
        (
          select count(*)::integer
          from public.commerce_orders
          where lower(fulfillment_status) in ('shipped', 'delivered', 'fulfilled')
        ) as orders_fulfilled,
        (
          select count(*)::integer
          from public.commerce_orders
          where lower(compliance_status) in ('pending', 'review', 'hold', 'blocked')
             or lower(fulfillment_status) in ('not_started', 'pending', 'blocked')
        ) as orders_needs_attention
    `
  );
  const row = result.rows[0] || {};

  return {
    total: Number(row.orders_total || 0),
    paid: Number(row.orders_paid || 0),
    pending: Number(row.orders_pending || 0),
    fulfilled: Number(row.orders_fulfilled || 0),
    needsAttention: Number(row.orders_needs_attention || 0),
  };
}

async function loadAdminOrderRows(client, filters = {}) {
  const result = await client.query(
    `
      select /* admin_orders_list */
        o.id,
        o.stripe_checkout_session_id,
        o.email,
        o.status,
        o.fulfillment_status,
        o.compliance_status,
        o.subtotal_cents,
        o.tax_cents,
        o.shipping_cents,
        o.total_cents,
        o.currency,
        o.shipping_snapshot,
        o.created_at,
        o.updated_at,
        coalesce(sum(i.quantity), 0)::integer as item_count,
        m.display_name as customer_name,
        m.role as member_role,
        m.membership_tier,
        m.member_status
      from public.commerce_orders o
      left join public.members m on m.id = o.member_id
      left join public.commerce_order_items i on i.order_id = o.id
      where (
        $1 = ''
        or lower(o.status) = lower($1)
        or lower(o.fulfillment_status) = lower($1)
        or lower(o.compliance_status) = lower($1)
      )
      and (
        $2 = ''
        or lower(o.email) like lower('%' || $2 || '%')
        or lower(o.stripe_checkout_session_id) like lower('%' || $2 || '%')
      )
      group by
        o.id,
        o.stripe_checkout_session_id,
        o.email,
        o.status,
        o.fulfillment_status,
        o.compliance_status,
        o.subtotal_cents,
        o.tax_cents,
        o.shipping_cents,
        o.total_cents,
        o.currency,
        o.shipping_snapshot,
        o.created_at,
        o.updated_at,
        m.display_name,
        m.role,
        m.membership_tier,
        m.member_status
      order by o.created_at desc
      limit 50
    `,
    [filters.status || "", filters.q || ""]
  );

  return result.rows.map(mapAdminOrderRow);
}

async function updateAdminOrderRow(client, details) {
  const result = await client.query(
    `
      with updated as (
        update public.commerce_orders
        set status = coalesce($2, status),
            fulfillment_status = coalesce($3, fulfillment_status),
            compliance_status = coalesce($4, compliance_status),
            updated_at = now()
        where id = $1
        returning *
      )
      select /* admin_order_update */
        u.id,
        u.stripe_checkout_session_id,
        u.email,
        u.status,
        u.fulfillment_status,
        u.compliance_status,
        u.subtotal_cents,
        u.tax_cents,
        u.shipping_cents,
        u.total_cents,
        u.currency,
        u.shipping_snapshot,
        u.created_at,
        u.updated_at,
        coalesce((select sum(quantity) from public.commerce_order_items where order_id = u.id), 0)::integer as item_count,
        m.display_name as customer_name,
        m.role as member_role,
        m.membership_tier,
        m.member_status
      from updated u
      left join public.members m on m.id = u.member_id
      limit 1
    `,
    [details.orderId, details.status, details.fulfillmentStatus, details.complianceStatus]
  );

  return result.rows[0] ? mapAdminOrderRow(result.rows[0]) : null;
}

function mapAdminOrderRow(row) {
  const shippingSnapshot = row.shipping_snapshot && typeof row.shipping_snapshot === "object" ? row.shipping_snapshot : {};
  const customerName = row.customer_name || shippingSnapshot.name || null;

  return {
    id: row.id,
    orderNumber: row.stripe_checkout_session_id || null,
    email: row.email || null,
    status: row.status,
    fulfillmentStatus: row.fulfillment_status,
    complianceStatus: row.compliance_status,
    subtotal: Number(row.subtotal_cents || 0) / 100,
    tax: Number(row.tax_cents || 0) / 100,
    shipping: Number(row.shipping_cents || 0) / 100,
    total: Number(row.total_cents || 0) / 100,
    currency: row.currency || "usd",
    itemCount: Number(row.item_count || 0),
    placedAt: toIsoString(row.created_at),
    updatedAt: row.updated_at ? toIsoString(row.updated_at) : null,
    customer: {
      email: row.email || null,
      name: customerName,
      role: row.member_role || null,
      membershipTier: row.membership_tier || null,
      memberStatus: row.member_status || null,
    },
  };
}

async function loadAdminMembersSummary(client) {
  const result = await client.query(
    `
      select /* admin_members_summary */
        (select count(*)::integer from public.members) as members_total,
        (
          select count(*)::integer
          from public.members
          where lower(role) = 'admin'
        ) as members_admins,
        (
          select count(*)::integer
          from public.members
          where lower(role) = 'operator'
        ) as members_operators,
        (
          select count(*)::integer
          from public.members
          where lower(member_status) in ('active', 'paused')
        ) as members_active,
        (
          select count(*)::integer
          from public.members
          where lower(member_status) = 'non_member'
        ) as members_non_member,
        (
          select count(*)::integer
          from public.members
          where lower(member_status) = 'banned'
        ) as members_banned
    `
  );
  const row = result.rows[0] || {};

  return {
    total: Number(row.members_total || 0),
    admins: Number(row.members_admins || 0),
    operators: Number(row.members_operators || 0),
    members: Number(row.members_active || 0),
    nonMembers: Number(row.members_non_member || 0),
    banned: Number(row.members_banned || 0),
  };
}

async function loadAdminMemberRows(client, filters = {}) {
  const limit = resolveAdminListLimit(filters.limit);
  const result = await client.query(
    `
      select /* admin_members_list */
        m.id,
        m.cognito_sub,
        m.email,
        m.email_verified,
        m.display_name,
        m.role,
        m.membership_tier,
        m.member_status,
        m.last_seen_at,
        m.created_at,
        m.updated_at,
        sub.status as subscription_status,
        sub.tier_key as subscription_tier,
        sub.billing_period as subscription_period,
        coalesce(orders.order_count, 0)::integer as order_count,
        coalesce(orders.total_spend_cents, 0)::integer as total_spend_cents,
        coalesce(humidor.humidor_item_count, 0)::integer as humidor_item_count
      from public.members m
      left join lateral (
        select status, tier_key, billing_period
        from public.member_subscriptions
        where member_id = m.id or lower(email) = lower(m.email)
        order by coalesce(updated_at, created_at) desc
        limit 1
      ) sub on true
      left join lateral (
        select count(*)::integer as order_count, coalesce(sum(total_cents), 0)::integer as total_spend_cents
        from public.commerce_orders
        where member_id = m.id or lower(email) = lower(m.email)
      ) orders on true
      left join lateral (
        select count(*)::integer as humidor_item_count
        from public.humidor_items
        where member_id = m.id and archived_at is null
      ) humidor on true
      where (
        $1 = ''
        or lower(m.role) = lower($1)
        or lower(m.member_status) = lower($1)
        or lower(coalesce(m.membership_tier, '')) = lower($1)
      )
      and (
        $2 = ''
        or lower(m.email) like lower('%' || $2 || '%')
        or lower(coalesce(m.display_name, '')) like lower('%' || $2 || '%')
      )
      order by coalesce(m.last_seen_at, m.updated_at, m.created_at) desc
      limit $3
    `,
    [filters.status || "", filters.q || "", limit]
  );

  return result.rows.map(mapAdminMemberRow);
}

async function updateAdminMemberAccessRow(client, details) {
  const clearMembershipTier = details.membershipTier === null;
  const result = await client.query(
    `
      with updated as (
        update public.members
        set role = coalesce($2, role),
            membership_tier = case when $4 then null else coalesce($3, membership_tier) end,
            member_status = coalesce($5, member_status),
            actor_id = $6,
            request_id = $7,
            updated_at = now()
        where id = $1
        returning *
      )
      select /* admin_member_access_update */
        id,
        cognito_sub,
        email,
        email_verified,
        display_name,
        role,
        membership_tier,
        member_status,
        last_seen_at,
        created_at,
        updated_at
      from updated
      limit 1
    `,
    [details.memberId, details.role, details.membershipTier, clearMembershipTier, details.memberStatus, details.actor.sub, details.requestId]
  );

  return result.rows[0] ? mapAdminMemberRow(result.rows[0]) : null;
}

function mapAdminMemberRow(row) {
  return {
    id: row.id,
    cognitoSub: row.cognito_sub || null,
    email: row.email,
    emailVerified: Boolean(row.email_verified),
    displayName: row.display_name || null,
    role: row.role,
    membershipTier: row.membership_tier || null,
    memberStatus: row.member_status,
    lastSeenAt: row.last_seen_at ? toIsoString(row.last_seen_at) : null,
    createdAt: row.created_at ? toIsoString(row.created_at) : null,
    updatedAt: row.updated_at ? toIsoString(row.updated_at) : null,
    subscriptionStatus: row.subscription_status || null,
    subscriptionTier: row.subscription_tier || null,
    subscriptionPeriod: row.subscription_period || null,
    orderCount: Number(row.order_count || 0),
    totalSpend: Number(row.total_spend_cents || 0) / 100,
    humidorItemCount: Number(row.humidor_item_count || 0),
  };
}

function resolveAdminListLimit(value, fallback = ADMIN_LIST_DEFAULT_LIMIT) {
  const parsed = Number.parseInt(String(value || ""), 10);
  const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;

  return Math.min(Math.max(requested, 1), ADMIN_LIST_MAX_LIMIT);
}

async function loadAdminOperationsOverview(client) {
  const result = await client.query(
    `
      select
        (select count(*)::integer from public.commerce_orders) as orders_total,
        (
          select count(*)::integer
          from public.commerce_orders
          where lower(status) in ('paid', 'complete', 'completed', 'succeeded')
        ) as orders_paid,
        (
          select count(*)::integer
          from public.commerce_orders
          where lower(status) in ('pending', 'open', 'processing', 'requires_review')
        ) as orders_pending,
        (
          select count(*)::integer
          from public.commerce_orders
          where lower(status) in ('refunded', 'refund_pending', 'partially_refunded')
        ) as orders_refunded,
        (select max(created_at) from public.commerce_orders) as latest_order_at,
        (select count(*)::integer from public.member_subscriptions) as subscriptions_total,
        (
          select count(*)::integer
          from public.member_subscriptions
          where lower(status) in ('active', 'trialing')
        ) as subscriptions_active,
        (
          select count(*)::integer
          from public.member_subscriptions
          where lower(status) = 'past_due'
        ) as subscriptions_past_due,
        (
          select count(*)::integer
          from public.member_subscriptions
          where lower(status) in ('canceled', 'cancelled', 'unpaid', 'incomplete_expired')
        ) as subscriptions_canceled,
        (select max(coalesce(updated_at, created_at)) from public.member_subscriptions) as latest_subscription_at,
        (select count(*)::integer from public.commerce_compliance_holds) as holds_total,
        (
          select count(*)::integer
          from public.commerce_compliance_holds
          where lower(status) not in ('resolved', 'closed')
        ) as holds_open,
        (
          select count(*)::integer
          from public.commerce_compliance_holds
          where lower(status) in ('resolved', 'closed')
        ) as holds_resolved,
        (select max(created_at) from public.commerce_compliance_holds) as latest_hold_at,
        (select count(*)::integer from public.stripe_events) as webhooks_total,
        (
          select count(*)::integer
          from public.stripe_events
          where processed_at is not null or lower(processing_status) = 'processed'
        ) as webhooks_processed,
        (
          select count(*)::integer
          from public.stripe_events
          where lower(processing_status) in ('failed', 'error')
        ) as webhooks_failed,
        (select max(received_at) from public.stripe_events) as latest_webhook_at,
        (select count(*)::integer from public.commerce_audit_log) as audit_total,
        (
          select count(*)::integer
          from public.commerce_audit_log
          where created_at >= now() - interval '24 hours'
        ) as audit_last_24h,
        (select max(created_at) from public.commerce_audit_log) as latest_audit_at
    `
  );

  const row = result.rows[0] || {};
  const webhookTotal = Number(row.webhooks_total || 0);
  const webhookProcessed = Number(row.webhooks_processed || 0);
  const webhookFailed = Number(row.webhooks_failed || 0);

  return {
    counts: {
      orders: {
        total: Number(row.orders_total || 0),
        paid: Number(row.orders_paid || 0),
        pending: Number(row.orders_pending || 0),
        refunded: Number(row.orders_refunded || 0),
      },
      subscriptions: {
        total: Number(row.subscriptions_total || 0),
        active: Number(row.subscriptions_active || 0),
        pastDue: Number(row.subscriptions_past_due || 0),
        canceled: Number(row.subscriptions_canceled || 0),
      },
      holds: {
        total: Number(row.holds_total || 0),
        open: Number(row.holds_open || 0),
        resolved: Number(row.holds_resolved || 0),
      },
      webhooks: {
        total: webhookTotal,
        processed: webhookProcessed,
        pending: Math.max(0, webhookTotal - webhookProcessed - webhookFailed),
        failed: webhookFailed,
      },
      audit: {
        total: Number(row.audit_total || 0),
        last24h: Number(row.audit_last_24h || 0),
      },
    },
    latest: {
      orderAt: row.latest_order_at ? toIsoString(row.latest_order_at) : null,
      subscriptionAt: row.latest_subscription_at ? toIsoString(row.latest_subscription_at) : null,
      holdAt: row.latest_hold_at ? toIsoString(row.latest_hold_at) : null,
      webhookAt: row.latest_webhook_at ? toIsoString(row.latest_webhook_at) : null,
      auditAt: row.latest_audit_at ? toIsoString(row.latest_audit_at) : null,
    },
  };
}

async function loadAdminComplianceHoldRows(client) {
  const result = await client.query(
    `
      select
        h.id,
        h.order_id,
        h.reason,
        h.status,
        h.details,
        h.created_at,
        h.resolved_at,
        o.email,
        o.status as order_status,
        o.fulfillment_status,
        o.compliance_status,
        o.stripe_checkout_session_id,
        o.total_cents,
        o.currency
      from public.commerce_compliance_holds h
      left join public.commerce_orders o on o.id = h.order_id
      order by
        case when lower(h.status) in ('open', 'pending') then 0 else 1 end,
        h.created_at desc
      limit 12
    `
  );

  return result.rows.map((row) => {
    const details = row.details && typeof row.details === "object" ? row.details : {};

    return {
      id: row.id,
      caseId: row.id,
      orderId: row.order_id,
      orderNumber: row.stripe_checkout_session_id,
      reason: row.reason,
      status: row.status,
      email: row.email,
      orderStatus: row.order_status,
      fulfillmentStatus: row.fulfillment_status,
      complianceStatus: row.compliance_status,
      total: Number(row.total_cents || 0) / 100,
      currency: row.currency || "usd",
      createdAt: toIsoString(row.created_at),
      resolvedAt: row.resolved_at ? toIsoString(row.resolved_at) : null,
      message: buildAdminDetailsPreview(details) || "Compliance review pending.",
      details,
    };
  });
}

async function loadAdminWebhookEventRows(client) {
  const result = await client.query(
    `
      select
        e.id,
        e.type,
        e.received_at,
        e.processed_at,
        e.processing_status,
        o.id as order_id,
        o.stripe_checkout_session_id,
        o.status as order_status,
        o.fulfillment_status,
        o.compliance_status,
        audit.request_id,
        audit.action as audit_action,
        audit.actor_email
      from public.stripe_events e
      left join public.commerce_orders o on o.stripe_event_id = e.id
      left join lateral (
        select request_id, action, actor_email, created_at
        from public.commerce_audit_log
        where stripe_event_id = e.id
        order by created_at desc
        limit 1
      ) audit on true
      order by e.received_at desc
      limit 12
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    requestId: row.request_id || null,
    status: row.processing_status || "received",
    processingStatus: row.processing_status || "received",
    orderId: row.order_id || null,
    orderNumber: row.stripe_checkout_session_id || null,
    orderStatus: row.order_status || null,
    fulfillmentStatus: row.fulfillment_status || null,
    complianceStatus: row.compliance_status || null,
    actorEmail: row.actor_email || null,
    lastAction: row.audit_action || null,
    createdAt: toIsoString(row.received_at),
    processedAt: row.processed_at ? toIsoString(row.processed_at) : null,
  }));
}

async function loadRecentAdminOrders(client) {
  const result = await client.query(
    `
      select
        id,
        stripe_checkout_session_id,
        email,
        status,
        fulfillment_status,
        compliance_status,
        total_cents,
        currency,
        created_at
      from public.commerce_orders
      order by created_at desc
      limit 8
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    orderNumber: row.stripe_checkout_session_id,
    email: row.email,
    status: row.status,
    fulfillmentStatus: row.fulfillment_status,
    complianceStatus: row.compliance_status,
    total: Number(row.total_cents || 0) / 100,
    currency: row.currency || "usd",
    placedAt: toIsoString(row.created_at),
  }));
}

async function loadRecentAdminSubscriptions(client) {
  const result = await client.query(
    `
      select
        id,
        email,
        tier_key,
        billing_period,
        status,
        current_period_end,
        created_at,
        updated_at
      from public.member_subscriptions
      order by coalesce(updated_at, created_at) desc
      limit 8
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    tierKey: row.tier_key,
    billingPeriod: row.billing_period,
    status: row.status,
    currentPeriodEnd: row.current_period_end ? toIsoString(row.current_period_end) : null,
    createdAt: toIsoString(row.created_at),
    updatedAt: row.updated_at ? toIsoString(row.updated_at) : null,
  }));
}

async function loadRecentAdminAuditEntries(client) {
  const result = await client.query(
    `
      select
        id,
        actor_email,
        action,
        target_type,
        target_id,
        request_id,
        stripe_event_id,
        order_id,
        compliance_hold_id,
        created_at
      from public.commerce_audit_log
      order by created_at desc
      limit 10
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    actorEmail: row.actor_email || null,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id || null,
    requestId: row.request_id || null,
    stripeEventId: row.stripe_event_id || null,
    orderId: row.order_id || null,
    complianceHoldId: row.compliance_hold_id || null,
    createdAt: toIsoString(row.created_at),
  }));
}

function buildAdminDetailsPreview(details) {
  if (!details || typeof details !== "object") {
    return "";
  }

  const preferredKeys = ["message", "summary", "note", "notes", "reason"];
  for (const key of preferredKeys) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const fragments = [];
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string" && value.trim()) {
      fragments.push(`${humanizeStatus(key)}: ${value.trim()}`);
    } else if (typeof value === "number" || typeof value === "boolean") {
      fragments.push(`${humanizeStatus(key)}: ${String(value)}`);
    }

    if (fragments.length === 3) {
      break;
    }
  }

  return fragments.join("; ");
}

function humanizeStatus(value) {
  return String(value || "")
    .trim()
    .replace(/_/g, " ");
}

function buildAdminStripeSyncSnapshot(env = process.env) {
  const launchCatalog = loadStripeLaunchCatalog(env);
  const catalog = Array.isArray(launchCatalog.catalog) ? launchCatalog.catalog : [];
  const membershipPriceKeys = Object.entries(env)
    .filter(([key, value]) => /^STRIPE_PRICE_[A-Z0-9_]+$/.test(key) && Boolean(value))
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
  const notes = [];

  if (!env.STRIPE_SECRET_KEY) {
    notes.push("Stripe secret key is missing.");
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    notes.push("Stripe webhook signing secret is missing.");
  }
  if (!env.STRIPE_LAUNCH_CATALOG_READY) {
    notes.push("Approved launch catalog is not marked ready.");
  }
  if (launchCatalog.error) {
    notes.push(launchCatalog.message || "Launch catalog needs review.");
  } else if (!catalog.length) {
    notes.push("Launch catalog has no checkout-ready products.");
  }
  if (!membershipPriceKeys.length) {
    notes.push("No membership Stripe price environment keys are configured.");
  }
  if (env.FEATURE_STRIPE_TAX !== "ready") {
    notes.push("Stripe Tax is not marked ready.");
  }

  let status = "queued";
  if (launchCatalog.error) {
    status = "catalog_invalid";
  } else if (!env.STRIPE_SECRET_KEY) {
    status = "stripe_not_ready";
  } else if (!env.STRIPE_LAUNCH_CATALOG_READY || !catalog.length) {
    status = "catalog_review_required";
  } else if (!membershipPriceKeys.length) {
    status = "membership_prices_pending";
  }

  const seedScope =
    catalog.length && membershipPriceKeys.length
      ? "featured_products_and_memberships"
      : catalog.length
        ? "featured_products"
        : membershipPriceKeys.length
          ? "memberships_only"
          : "pending_configuration";

  return {
    status,
    seedScope,
    liveApprovalRequired: !isSecretFlagEnabled(env.STRIPE_TOBACCO_APPROVAL_CONFIRMED),
    catalogReady: Boolean(env.STRIPE_LAUNCH_CATALOG_READY),
    stripeConfigured: Boolean(env.STRIPE_SECRET_KEY),
    webhookConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
    catalogSource: launchCatalog.source,
    configuredProductCount: catalog.length,
    publishedProductCount: catalog.filter((product) => String(product.publishStatus || "").toLowerCase() === "published").length,
    membershipPriceKeys,
    taxStatus: env.FEATURE_STRIPE_TAX === "ready" ? "ready" : sanitizeText(env.FEATURE_STRIPE_TAX, 60) || "unavailable",
    apiVersion: sanitizeText(env.STRIPE_API_VERSION, 80) || null,
    sampleSkus: catalog.slice(0, 4).map((product) => product.sku),
    catalogPreview: catalog.slice(0, 6).map((product) => ({
      sku: product.sku,
      name: product.name,
      price: product.price,
      publishStatus: product.publishStatus,
      stripePriceId: product.stripePriceId,
    })),
    notes,
  };
}

function shouldUseLocalAdminSummary(message) {
  const normalized = String(message || "").toLowerCase();
  return /(backend health|admin follow|queue|summary|webhook|hold|stripe sync|catalog|orders|memberships|audit)/.test(normalized);
}

function shouldUseLocalAdminUserList(message) {
  const normalized = String(message || "").toLowerCase();
  const mentionsUserRoster = /\b(users?|members?|accounts?|operators?|admins?)\b/.test(normalized) || normalized.includes("user access");
  const asksToList = /\b(list|show|see|view|display|get|pull)\b/.test(normalized) || /\ball\b/.test(normalized);

  return mentionsUserRoster && asksToList;
}

function getAdminQueueFromMessage(message) {
  const normalized = String(message || "").toLowerCase();
  if (normalized.includes("compliance") || normalized.includes("hold")) {
    return "compliance";
  }
  if (normalized.includes("webhook") || normalized.includes("stripe")) {
    return "webhooks";
  }
  if (normalized.includes("catalog")) {
    return "catalog";
  }
  if (normalized.includes("membership") || normalized.includes("subscription")) {
    return "memberships";
  }
  if (normalized.includes("audit")) {
    return "audit";
  }
  if (normalized.includes("billing")) {
    return "billing";
  }
  return "support";
}

async function buildAdminUserListSnapshot() {
  if (!shouldPersistDatabaseWrites()) {
    const summary = buildEmptyAdminMembersSummary();
    const persistence = getDatabasePersistenceStatus();
    const lines = buildAdminUserListLines({
      summary,
      members: [],
      persistence,
    });

    return {
      members: [],
      summary,
      persistence,
      reply: lines.join("\n"),
      nextActions: ["Enable schema-backed writes before expecting live user records."],
    };
  }

  return withDatabaseClient("ycc-api-admin-agent-users", async (client) => {
    const summary = await loadAdminMembersSummary(client);
    const members = await loadAdminMemberRows(client, {
      limit: ADMIN_LIST_MAX_LIMIT,
    });
    const persistence = "stored";
    const lines = buildAdminUserListLines({
      summary,
      members,
      persistence,
    });

    return {
      members,
      summary,
      persistence,
      reply: lines.join("\n"),
      nextActions: buildAdminUserListFollowUps({ summary, members }),
    };
  });
}

function buildAdminUserListLines(details) {
  const { members, persistence, summary } = details;
  const lines = [
    `User access roster: ${summary.total} users (${summary.admins} admins, ${summary.operators} operators, ${summary.members} active members, ${summary.banned} banned).`,
  ];

  if (!members.length) {
    lines.push("No user access records are currently visible in the live backend.");
  } else {
    for (const [index, member] of members.slice(0, ADMIN_AGENT_USER_REPLY_LIMIT).entries()) {
      const label = member.displayName || member.email || member.id;
      const tier = member.membershipTier || member.subscriptionTier || "no tier";
      const subscription = member.subscriptionStatus ? `, ${humanizeStatus(member.subscriptionStatus)} subscription` : "";
      lines.push(
        `${index + 1}. ${label} <${member.email}> - ${humanizeStatus(member.role || "customer")} / ` +
          `${humanizeStatus(member.memberStatus || "non_member")} / ${humanizeStatus(tier)}; ` +
          `${member.orderCount || 0} orders, ${formatAdminMoney(member.totalSpend)} spend, ${member.humidorItemCount || 0} humidor items${subscription}.`
      );
    }
  }

  if (members.length < summary.total) {
    lines.push(`Showing ${members.length} of ${summary.total} users. Open User Access for the live roster view and targeted actions.`);
  }

  if (persistence !== "stored") {
    lines.push(`Persistence status is ${humanizeStatus(persistence)} until schema-backed writes are enabled.`);
  }

  return lines;
}

function buildAdminUserListFollowUps(details) {
  const actions = ["Open User Access to promote operators, activate members, pause access, or review individual records."];

  if (details.summary.banned > 0) {
    actions.push("Review banned accounts before restoring access.");
  }

  if (details.members.length < details.summary.total) {
    actions.push("Use the admin members endpoint with filters when the roster exceeds the loaded limit.");
  }

  return actions;
}

function formatAdminMoney(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return `$${amount.toFixed(2)}`;
}

function isAdminGuardrailReply(reply) {
  return isAgentGuardrailRefusalReply(reply);
}

function isAgentGuardrailRefusalReply(reply) {
  const normalized = String(reply || "").toLowerCase();
  const tobaccoComparisonRefusal =
    normalized.includes("facilitate") &&
    normalized.includes("tobacco product") &&
    (normalized.includes("can't provide information") ||
      normalized.includes("cannot provide information") ||
      normalized.includes("can not provide information"));
  const tobaccoHealthRefusal =
    normalized.includes("tobacco") &&
    (normalized.includes("misleading") ||
      normalized.includes("health effects") ||
      normalized.includes("can't give") ||
      normalized.includes("cannot give") ||
      normalized.includes("can not give")) &&
    (normalized.includes("can't provide information") ||
      normalized.includes("cannot provide information") ||
      normalized.includes("can not provide information") ||
      normalized.includes("can't give") ||
      normalized.includes("cannot give") ||
      normalized.includes("can not give"));
  const generatedTextBlocked =
    normalized.includes("generated text has been blocked") || normalized.includes("blocked by our content filters");

  return (
    normalized.includes("cannot help with that request") ||
    normalized.includes("concierge operator can review") ||
    generatedTextBlocked ||
    tobaccoComparisonRefusal ||
    tobaccoHealthRefusal
  );
}

async function buildAdminQueueSummarySnapshot(queue) {
  const normalizedQueue = sanitizeText(queue, 40) || "support";
  const commerceEnv = await getCommerceRuntimeEnv();
  const sync = buildAdminStripeSyncSnapshot(commerceEnv);

  if (!shouldPersistDatabaseWrites()) {
    const overview = buildEmptyAdminOverview();
    const persistence = getDatabasePersistenceStatus();
    const summary = buildAdminQueueSummaryLines({
      queue: normalizedQueue,
      overview,
      holds: [],
      events: [],
      orders: [],
      subscriptions: [],
      audit: [],
      persistence,
      sync,
    });

    return {
      queue: normalizedQueue,
      overview,
      holds: [],
      events: [],
      orders: [],
      subscriptions: [],
      audit: [],
      persistence,
      sync,
      summary,
      reply: summary.join("\n"),
      nextActions: buildAdminQueueFollowUps({ overview, sync, persistence }),
    };
  }

  return withDatabaseClient("ycc-api-admin-summary", async (client) => {
    const overview = await loadAdminOperationsOverview(client);
    const holds = await loadAdminComplianceHoldRows(client);
    const events = await loadAdminWebhookEventRows(client);
    const orders = await loadRecentAdminOrders(client);
    const subscriptions = await loadRecentAdminSubscriptions(client);
    const audit = await loadRecentAdminAuditEntries(client);
    const persistence = "stored";
    const summary = buildAdminQueueSummaryLines({
      queue: normalizedQueue,
      overview,
      holds,
      events,
      orders,
      subscriptions,
      audit,
      persistence,
      sync,
    });

    return {
      queue: normalizedQueue,
      overview,
      holds,
      events,
      orders,
      subscriptions,
      audit,
      persistence,
      sync,
      summary,
      reply: summary.join("\n"),
      nextActions: buildAdminQueueFollowUps({ overview, sync, persistence }),
    };
  });
}

function buildAdminQueueSummaryLines(details) {
  const queueLabel = humanizeStatus(details.queue || "support");
  const openHold = details.holds.find((hold) => String(hold.status || "").toLowerCase() !== "resolved");
  const pendingEvent = details.events.find((event) => !["processed", "succeeded"].includes(String(event.status || "").toLowerCase()));
  const latestOrder = details.orders[0] || null;
  const latestSubscription = details.subscriptions[0] || null;
  const latestAudit = details.audit[0] || null;
  const lines = [];

  lines.push(
    `${queueLabel} queue health: ${details.overview.counts.holds.open} open compliance holds, ` +
      `${details.overview.counts.webhooks.pending} pending webhook events, ` +
      `${details.overview.counts.orders.pending} pending orders, and ` +
      `${details.overview.counts.subscriptions.pastDue} past-due memberships.`
  );

  if (openHold) {
    lines.push(
      `Top hold: ${openHold.orderNumber || openHold.caseId || openHold.id} ` +
        `for ${openHold.email || "unknown customer"} is ${humanizeStatus(openHold.status || "open")} because ${openHold.reason || "review is pending"}.`
    );
  } else {
    lines.push("No open compliance holds are currently visible in the live backend.");
  }

  if (pendingEvent) {
    lines.push(
      `Webhook follow-up: ${pendingEvent.type || pendingEvent.id} is ${humanizeStatus(pendingEvent.status || "received")}` +
        `${pendingEvent.orderNumber ? ` for ${pendingEvent.orderNumber}` : ""}.`
    );
  } else {
    lines.push("Webhook backlog is clear based on the latest persisted Stripe events.");
  }

  if (latestOrder) {
    lines.push(
      `Latest order: ${latestOrder.orderNumber || latestOrder.id} for ${latestOrder.email || "unknown customer"} ` +
        `is ${humanizeStatus(latestOrder.status || "pending")} with ${humanizeStatus(latestOrder.fulfillmentStatus || "not_started")} fulfillment.`
    );
  }

  if (latestSubscription) {
    lines.push(
      `Latest membership: ${latestSubscription.email || "unknown member"} is ${humanizeStatus(latestSubscription.status || "unknown")} ` +
        `on ${humanizeStatus(latestSubscription.tierKey || "membership")} ${humanizeStatus(latestSubscription.billingPeriod || "plan")}.`
    );
  }

  if (details.sync.notes.length) {
    lines.push(`Stripe sync follow-up: ${details.sync.notes[0]}`);
  } else {
    lines.push(
      `Stripe sync configuration shows ${details.sync.configuredProductCount} launch products and ` +
        `${details.sync.membershipPriceKeys.length} membership price keys ready for review.`
    );
  }

  if (latestAudit) {
    lines.push(
      `Latest audited action: ${humanizeStatus(latestAudit.action || "unknown")} by ${latestAudit.actorEmail || "system"} ` +
        `at ${toIsoString(latestAudit.createdAt)}.`
    );
  }

  if (details.persistence !== "stored") {
    lines.push(`Persistence status is ${humanizeStatus(details.persistence)} until schema-backed writes are enabled.`);
  }

  return lines.slice(0, 7);
}

function buildAdminQueueFollowUps(details) {
  const actions = [];

  if (details.persistence !== "stored") {
    actions.push("Enable schema-backed writes before expecting live queue records.");
  }
  if (details.overview.counts.holds.open > 0) {
    actions.push("Review open compliance holds before releasing fulfillment.");
  }
  if (details.overview.counts.webhooks.pending > 0) {
    actions.push("Inspect pending Stripe webhook events and reconcile order status.");
  }
  if (details.overview.counts.subscriptions.pastDue > 0) {
    actions.push("Follow up on past-due memberships before the next billing reminder.");
  }
  if (details.sync.notes.length) {
    actions.push(details.sync.notes[0]);
  }
  if (!actions.length) {
    actions.push("No immediate blockers were detected in the current backend snapshot.");
  }

  return actions.slice(0, 4);
}

async function handleLivePageContent(event, requestId) {
  const route = normalizeLivePageRoute(event.queryStringParameters?.route || event.queryStringParameters?.path || "/");
  if (!route) {
    return json(400, requestId, {
      error: "invalid_live_page_route",
      message: "This route is not registered for live page editing.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      page: buildEmptyLivePageContent(route),
      persistence: getDatabasePersistenceStatus(),
    });
  }

  const page = await fetchLivePageContent(route);
  return json(200, requestId, {
    page,
    persistence: "stored",
  });
}

async function handleLivePagePublish(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Live page publishing requires an admin or concierge operator group.",
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const route = normalizeLivePageRoute(body.value.route || body.value.path);
  if (!route) {
    return json(400, requestId, {
      error: "invalid_live_page_route",
      message: "This route is not registered for live page editing.",
    });
  }

  const edits = normalizeLivePageEdits(body.value.edits);
  if (!shouldPersistDatabaseWrites()) {
    return json(202, requestId, {
      page: {
        route,
        edits,
        updatedAt: null,
      },
      persistence: {
        status: getDatabasePersistenceStatus(),
        table: "site_page_content",
      },
    });
  }

  const page = await persistLivePageContent(event, actor, requestId, { route, edits });
  return json(200, requestId, {
    page,
    persistence: {
      status: "stored",
      table: "site_page_content",
    },
  });
}

async function handlePublicNewsStories(event, requestId) {
  const limit = Math.min(Math.max(Number(event.queryStringParameters?.limit || "12") || 12, 1), 50);

  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      stories: [],
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return json(200, requestId, {
    stories: await fetchPublishedNewsStories(limit),
    persistence: "stored",
  });
}

async function handleNewsStoryDraft(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "news_agent_forbidden",
      message: "News story drafting requires an admin or concierge operator group.",
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const input = normalizeNewsDraftInput(body.value);
  const acceptedSources = input.sourceUrls.map(normalizeNewsSourceCandidate).filter((source) => source.status === "official" || source.status === "needs_review");
  if (!acceptedSources.length) {
    return json(400, requestId, {
      error: "official_source_required",
      message: "Add at least one official brand, company, event, distributor, regulator, or wire source before drafting.",
    });
  }

  const conversationId = `news_${crypto.randomUUID()}`;
  const basePrompt = buildNewsAgentPrompt(input);
  const strictPrompt = buildNewsAgentPrompt(input, { strictNoPlaceholder: true });
  let bedrock = await maybeBuildBedrockReply("YCCNewsAgent", actor, basePrompt, conversationId);
  let draft = normalizeNewsDraftFromAgentReply(bedrock.reply || "", input);

  if (!hasUsableNewsDraftReply(bedrock.reply || "") || isPlaceholderNewsBodyMarkdown(draft.bodyMarkdown)) {
    const retryConversationId = `${conversationId}_retry`;
    const strictDraft = await maybeBuildBedrockReply("YCCNewsAgent", actor, strictPrompt, retryConversationId);
    const strictNormalizedDraft = normalizeNewsDraftFromAgentReply(strictDraft.reply || "", input);
    if (hasUsableNewsDraftReply(strictDraft.reply || "") && !isPlaceholderNewsBodyMarkdown(strictNormalizedDraft.bodyMarkdown)) {
      bedrock = strictDraft;
      draft = strictNormalizedDraft;
    }
  }

  if (!hasUsableNewsDraftReply(bedrock.reply || "") || isPlaceholderNewsBodyMarkdown(draft.bodyMarkdown)) {
    const directDraft = await maybeBuildNewsDraftRuntimeReply(actor, strictPrompt);
    const directNormalizedDraft = normalizeNewsDraftFromAgentReply(directDraft.reply || "", input);
    bedrock = directDraft;
    draft = directNormalizedDraft;
    if (hasUsableNewsDraftReply(directDraft.reply || "") && !isPlaceholderNewsBodyMarkdown(directNormalizedDraft.bodyMarkdown)) {
      draft = directNormalizedDraft;
    }
  }

  if (!hasUsableNewsDraftReply(bedrock.reply || "") || isPlaceholderNewsBodyMarkdown(draft.bodyMarkdown)) {
    return json(502, requestId, {
      error: "news_story_generation_failed",
      message: "YCCNewsAgent did not return a publication-ready story draft. Add concrete source details or try again before publishing.",
      prompt: {
        acceptedSourceCount: acceptedSources.length,
        blockedSourceCount: input.sourceUrls.length - acceptedSources.length,
      },
      ai: {
        status: bedrock.status,
        modelId: bedrock.modelId,
        agentId: bedrock.agentId,
        agentAliasId: bedrock.agentAliasId,
        knowledgeBaseStatus: bedrock.knowledgeBaseStatus,
        retrievedContextCount: bedrock.retrievedContextCount,
      },
    });
  }

  return json(200, requestId, {
    draft,
    prompt: {
      acceptedSourceCount: acceptedSources.length,
      blockedSourceCount: input.sourceUrls.length - acceptedSources.length,
    },
    ai: {
      status: bedrock.status,
      modelId: bedrock.modelId,
      agentId: bedrock.agentId,
      agentAliasId: bedrock.agentAliasId,
      knowledgeBaseStatus: bedrock.knowledgeBaseStatus,
      retrievedContextCount: bedrock.retrievedContextCount,
    },
  });
}

async function handleNewsStoryPublish(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "news_publish_forbidden",
      message: "Publishing news stories requires an admin or concierge operator group.",
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const story = normalizeNewsStoryInput(body.value);
  if (story.error) {
    return json(400, requestId, story.error);
  }

  if (body.value.operatorApproved !== true) {
    return json(400, requestId, {
      error: "operator_approval_required",
      message: "Human operator approval is required before a news story can be posted.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(202, requestId, {
      story: story.value,
      persistence: {
        status: getDatabasePersistenceStatus(),
        table: "news_stories",
      },
    });
  }

  const persistedStory = await persistNewsStory(event, actor, requestId, story.value);

  return json(201, requestId, {
    story: persistedStory,
    persistence: {
      status: "stored",
      table: "news_stories",
    },
  });
}

async function handleAccountMe(event, actor, requestId) {
  const accountRecord = await maybePersistAccount(event, actor, requestId);
  const member = accountRecord?.member || null;
  const membership = getMembershipSnapshot(actor, member);

  return json(200, requestId, {
    account: {
      ...actor,
      name: member?.displayName || actor.name,
    },
    profile: accountRecord?.profile || {
      phone: "",
      shippingAddress: null,
    },
    source: "cognito-jwt",
    membership,
    database: member
      ? {
          persisted: true,
          persistence: "stored",
          table: "members",
          memberId: member.id,
        }
      : {
          persisted: false,
          persistence: getDatabasePersistenceStatus(),
        },
  });
}

async function handleAccountProfileUpdate(event, actor, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(503, requestId, {
      error: "database_writes_not_ready",
      message: "Live account profile persistence is not ready yet.",
      persistence: getDatabasePersistenceStatus(),
    });
  }

  const name = sanitizeText(body.value.name, 160);
  if (!name) {
    return json(400, requestId, {
      error: "invalid_profile",
      message: "Enter a display name before saving the account profile.",
    });
  }

  const phone = sanitizeText(body.value.phone, 40);
  const shippingAddress = normalizeCheckoutShippingAddress(body.value.shippingAddress || {});
  const updatedActor = {
    ...actor,
    name,
  };
  const saved = await persistAccountProfileUpdate(event, updatedActor, requestId, {
    phone,
    shippingAddress,
  });

  return json(200, requestId, {
    account: {
      ...actor,
      name: saved.member.displayName || name,
    },
    profile: saved.profile,
    source: "cognito-jwt",
    membership: getMembershipSnapshot(updatedActor, saved.member),
    database: {
      persisted: true,
      persistence: "stored",
      table: "member_profiles",
      memberId: saved.member.id,
    },
  });
}

async function handleConciergeChat(event, actor, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const message = sanitizeText(body.value.message || body.value.prompt, MAX_MESSAGE_LENGTH);
  if (!message) {
    return json(400, requestId, {
      error: "missing_message",
      message: "Send a non-empty message for the YCC concierge.",
    });
  }

  const exchange = await buildConciergeExchange(event, actor, requestId, {
    conversationId: body.value.conversationId || body.value.threadId,
    message,
    requestedAgent: body.value.agent || body.value.mode,
    source: "text",
  });
  if (exchange.error) {
    return exchange.error;
  }

  const payload = exchange.payload;
  if (body.value.voiceOutput === true) {
    payload.voice = {
      speech: await synthesizeConciergeSpeech(payload.reply),
    };
  }

  return json(200, requestId, payload);
}

async function handleConciergeVoice(event, actor, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const audio = parseConciergeVoiceAudio(body.value);
  if (audio.error) {
    return json(400, requestId, audio.error);
  }

  const transcriptHint = sanitizeText(body.value.transcriptHint || body.value.transcript, MAX_MESSAGE_LENGTH);
  let transcription = {
    service: "browser_transcript_hint",
    status: "hint_used",
    transcript: transcriptHint,
  };

  if (process.env.FEATURE_CONCIERGE_VOICE === "ready") {
    const transcribed = await maybeTranscribeConciergeVoice(audio, requestId);
    if (transcribed.transcript) {
      transcription = transcribed;
    } else if (!transcriptHint) {
      return json(503, requestId, {
        error: "missing_voice_transcript",
        message: "The YCC concierge could not transcribe that voice message. Please try again or send the request as text.",
      });
    }
  } else if (!transcriptHint) {
    return json(503, requestId, {
      error: "voice_services_not_configured",
      message: "Concierge voice transcription is not configured for this environment.",
    });
  }

  if (!transcription.transcript) {
    return json(400, requestId, {
      error: "missing_voice_transcript",
      message: "The YCC concierge needs a voice transcript before routing the message.",
    });
  }

  const exchange = await buildConciergeExchange(event, actor, requestId, {
    conversationId: body.value.conversationId || body.value.threadId,
    message: transcription.transcript,
    requestedAgent: body.value.agent || body.value.mode,
    source: "voice",
  });
  if (exchange.error) {
    return exchange.error;
  }

  return json(200, requestId, {
    ...exchange.payload,
    voice: {
      inputAudio: {
        accepted: true,
        mimeType: audio.mimeType,
        bytes: audio.bytes.length,
        durationMs: audio.durationMs,
      },
      transcription,
      speech: body.value.voiceOutput === false ? buildDisabledSpeechOutput() : await synthesizeConciergeSpeech(exchange.payload.reply),
    },
  });
}

async function buildConciergeExchange(event, actor, requestId, details) {
  const message = details.message;
  const requestedAgent = sanitizeText(details.requestedAgent, 80);
  const conversationId = sanitizeText(details.conversationId, 120) || `conv_${crypto.randomUUID()}`;
  const lexRouting = shouldUseLexRouterForRequest(requestedAgent)
    ? await maybeRecognizeLexRoute(actor, message, conversationId)
    : null;
  const agent = chooseAgent(message, requestedAgent, lexRouting);
  if (agent === "YCCAdminAgent" && !canUseAdminAgent(actor)) {
    return {
      error: json(403, requestId, {
        error: "admin_agent_forbidden",
        message: "The YCC admin agent requires an admin or concierge operator Cognito group.",
      }),
    };
  }

  if (agent === "YCCNewsAgent" && !canUseAdminAgent(actor)) {
    return {
      error: json(403, requestId, {
        error: "news_agent_forbidden",
        message: "The YCC news agent requires an admin or concierge operator Cognito group.",
      }),
    };
  }

  if (agent === "YCCNewsAgent" && !resolveBedrockAgentTarget(agent)) {
    return {
      error: json(503, requestId, {
        error: "news_agent_not_configured",
        message: "The YCC news agent is disabled until a live Bedrock agent alias is configured.",
      }),
    };
  }

  if (shouldHonorLexDialogTurn(agent, message, lexRouting)) {
    const reply = buildLexDialogReply(lexRouting);
    let persistedConversation = null;
    const bedrock = {
      status: "lex_dialog",
      reply,
    };

    if (shouldPersistDatabaseWrites()) {
      persistedConversation = await persistConciergeChat(event, actor, requestId, {
        agent,
        bedrock,
        conversationId,
        lex: lexRouting,
        message,
        reply,
        source: details.source,
      });
    }

    return {
      payload: {
        conversation: {
          id: persistedConversation?.conversationId || conversationId,
          persisted: Boolean(persistedConversation),
          persistence: persistedConversation ? "stored" : getDatabasePersistenceStatus(),
        },
        agent,
        ai: {
          status: bedrock.status,
        },
        lex: buildLexResponsePayload(lexRouting),
        reply,
        input: {
          accepted: true,
          length: message.length,
        },
        guardrails: {
          ageRestricted: true,
          piiMinimized: true,
          tobaccoHealthClaims: "not_provided",
          humanHandoff: agent === "YCCSupportAgent" || messageNeedsHumanSupport(message),
        },
        nextActions: getLexDialogNextActions(agent, lexRouting),
      },
    };
  }

  let adminSummary = null;
  let bedrock;

  if (agent === "YCCAdminAgent" && shouldUseLocalAdminUserList(message)) {
    adminSummary = await buildAdminUserListSnapshot();
    bedrock = {
      status: "admin_user_list",
      reply: adminSummary.reply,
    };
  } else if (agent === "YCCAdminAgent" && shouldUseLocalAdminSummary(message)) {
    adminSummary = await buildAdminQueueSummarySnapshot(getAdminQueueFromMessage(message));
    bedrock = {
      status: "admin_queue_summary",
      reply: adminSummary.reply,
    };
  } else {
    bedrock = await maybeBuildBedrockReply(agent, actor, message, conversationId, {
      includeMemberHumidorContext: true,
      requestId,
    });

    if (agent === "YCCAdminAgent" && isAdminGuardrailReply(bedrock.reply)) {
      adminSummary = await buildAdminQueueSummarySnapshot(getAdminQueueFromMessage(message));
      bedrock = {
        ...bedrock,
        status: "admin_queue_summary_fallback",
        reply: adminSummary.reply,
      };
    } else if (bedrock.status === "bedrock_agent_runtime" && isAgentGuardrailRefusalReply(bedrock.reply)) {
      bedrock = await maybeBuildBedrockReply(agent, actor, message, conversationId, {
        forceDirectRuntime: true,
        includeMemberHumidorContext: true,
        requestId,
      });
    }
  }

  const reply = bedrock.reply || buildConciergeReply(agent, actor);

  let persistedConversation = null;
  if (shouldPersistDatabaseWrites()) {
    persistedConversation = await persistConciergeChat(event, actor, requestId, {
      agent,
      bedrock,
      conversationId,
      lex: lexRouting,
      message,
      reply,
      source: details.source,
    });
  }

  return {
    payload: {
      conversation: {
        id: persistedConversation?.conversationId || conversationId,
        persisted: Boolean(persistedConversation),
        persistence: persistedConversation ? "stored" : getDatabasePersistenceStatus(),
      },
      agent,
      ai: {
        status: bedrock.status,
      },
      ...(lexRouting ? { lex: buildLexResponsePayload(lexRouting) } : {}),
      reply,
      input: {
        accepted: true,
        length: message.length,
      },
      guardrails: {
        ageRestricted: true,
        piiMinimized: true,
        tobaccoHealthClaims: "not_provided",
        humanHandoff: agent === "YCCSupportAgent" || messageNeedsHumanSupport(message),
      },
      nextActions: adminSummary?.nextActions || getAgentNextActions(agent, bedrock.status),
    },
  };
}

async function handleSupportEmailDraft(event, actor, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const message = sanitizeText(body.value.message || body.value.issue || body.value.notes, MAX_SUPPORT_MESSAGE_LENGTH);
  if (!message) {
    return json(400, requestId, {
      error: "missing_support_message",
      message: "Send the customer issue or notes to draft a support email.",
    });
  }

  const subject = sanitizeText(body.value.subject, 140) || "Yuzu Cigar Club support follow-up";
  const customerName = actor.name || "there";
  const caseId = sanitizeText(body.value.caseId, 120) || `case_${crypto.randomUUID()}`;
  const draftBody =
    `Hi ${customerName},\n\n` +
    "Thanks for reaching out to Yuzu Cigar Club. We received your note and are reviewing the account, membership, order, or humidor details tied to your request.\n\n" +
    "A concierge operator can personalize this draft before it is sent.\n\n" +
    "Best,\nYuzu Cigar Club Support";

  let persistedCase = null;
  if (shouldPersistDatabaseWrites()) {
    persistedCase = await persistSupportEmailDraft(event, actor, requestId, {
      caseId,
      draftBody,
      message,
      subject,
    });
  }

  return json(200, requestId, {
    case: {
      id: persistedCase?.caseId || caseId,
      caseNumber: persistedCase?.caseNumber || null,
      persisted: Boolean(persistedCase),
      persistence: persistedCase ? "stored" : getDatabasePersistenceStatus(),
    },
    draft: {
      subject,
      body: draftBody,
      persisted: Boolean(persistedCase),
      messageId: persistedCase?.emailMessageId || null,
      sendStatus: "draft_only",
    },
    sourceMessage: {
      accepted: true,
      length: message.length,
    },
    nextActions: [
      "verify_ses_identity",
      "store_inbound_email_raw_s3",
      "enable_operator_review_queue",
    ],
  });
}

async function handleSupportEmailSend(event, actor, requestId) {
  if (!canSendSupportEmail(actor)) {
    return json(403, requestId, {
      error: "support_send_forbidden",
      message: "Sending support email requires an admin or concierge operator Cognito group.",
    });
  }

  if (!isOutboundEmailReady()) {
    return json(409, requestId, {
      error: "email_provider_not_ready",
      message: "Outbound email sending is disabled until the selected YCC email provider is configured and smoke-tested.",
      emailProvider: getOutboundEmailStatus(),
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const toAddresses = normalizeEmailAddresses(body.value.to || body.value.toAddresses || body.value.recipient, 10);
  if (toAddresses.length === 0) {
    return json(400, requestId, {
      error: "missing_recipient",
      message: "Send at least one valid recipient email address.",
    });
  }

  const subject = sanitizeText(body.value.subject, 140) || "Yuzu Cigar Club support follow-up";
  const bodyText = sanitizeMultilineText(body.value.body || body.value.message || body.value.text, MAX_EMAIL_BODY_LENGTH);
  if (!bodyText) {
    return json(400, requestId, {
      error: "missing_email_body",
      message: "Send non-empty support email body text.",
    });
  }

  const caseId = sanitizeText(body.value.caseId, 120) || `case_${crypto.randomUUID()}`;
  const fromAddress = getSupportEmailFrom();
  let sesMessageId;
  try {
    sesMessageId = await sendSupportEmail({
      bodyText,
      fromAddress,
      subject,
      toAddresses,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "support_email_send_failed",
        requestId,
        emailProvider: getOutboundEmailStatus(),
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );
    if (error instanceof EmailProviderConfigurationError) {
      return json(409, requestId, {
        error: "email_provider_not_configured",
        message: "The selected YCC email provider is marked ready but is missing its SMTP/API credential configuration.",
        emailProvider: getOutboundEmailStatus(),
      });
    }

    return json(502, requestId, {
      error: "email_provider_send_failed",
      message: "The selected YCC email provider rejected or failed the send attempt.",
      emailProvider: getOutboundEmailStatus(),
    });
  }

  let persistedCase = null;
  if (shouldPersistDatabaseWrites()) {
    persistedCase = await persistSentSupportEmail(event, actor, requestId, {
      bodyText,
      caseId,
      fromAddress,
      message: bodyText,
      sesMessageId,
      subject,
      toAddresses,
    });
  }

  return json(200, requestId, {
    case: {
      id: persistedCase?.caseId || caseId,
      caseNumber: persistedCase?.caseNumber || null,
      persisted: Boolean(persistedCase),
      persistence: persistedCase ? "stored" : getDatabasePersistenceStatus(),
    },
    send: {
      status: "sent",
      sesMessageId,
      ...getOutboundEmailProviderResponseFields(sesMessageId),
      from: fromAddress,
      to: toAddresses,
      persisted: Boolean(persistedCase),
      messageId: persistedCase?.emailMessageId || null,
    },
  });
}

async function handleSesReceipt(event, requestId) {
  const records = Array.isArray(event.Records) ? event.Records.filter((record) => record?.eventSource === "aws:ses") : [];
  const stored = [];

  for (const record of records) {
    const mail = record.ses?.mail || {};
    const receipt = record.ses?.receipt || {};
    const sesMessageId = sanitizeText(mail.messageId, 240);
    if (!sesMessageId) {
      continue;
    }

    const rawBucket = getSupportEmailRawBucket();
    const rawKey = `${getSupportEmailRawPrefix()}${sesMessageId}`;
    const rawEmail = await getRawEmailFromS3(rawBucket, rawKey);
    const parsed = parseRawEmail(rawEmail);
    const commonHeaders = mail.commonHeaders || {};
    const subject = sanitizeText(commonHeaders.subject || parsed.subject, 240) || "Yuzu Cigar Club support email";
    const fromAddress = normalizeEmailAddresses(commonHeaders.from || parsed.from, 1)[0] || "unknown@example.invalid";
    const toAddresses = normalizeEmailAddresses(commonHeaders.to || receipt.recipients || parsed.to, 25);
    const bodyText = sanitizeMultilineText(parsed.bodyText, MAX_EMAIL_BODY_LENGTH);
    const agentDraft = await buildInboundSupportEmailAgentDraft({
      bodyText,
      fromAddress,
      rawKey,
      sesMessageId,
      subject,
      toAddresses,
    });

    let persisted = null;
    if (shouldPersistDatabaseWrites()) {
      persisted = await persistInboundSupportEmail(event, requestId, {
        agentDraft,
        bodyText,
        fromAddress,
        receivedAt: sanitizeText(mail.timestamp, 80) || new Date().toISOString(),
        rawKey,
        sesMessageId,
        subject,
        toAddresses,
      });
    }

    stored.push({
      caseId: persisted?.caseId || null,
      caseNumber: persisted?.caseNumber || null,
      emailMessageId: persisted?.emailMessageId || null,
      from: fromAddress,
      rawKey,
      sesMessageId,
      status: persisted ? "stored" : getDatabasePersistenceStatus(),
      subject,
      to: toAddresses,
      agent: {
        name: agentDraft.agent,
        status: agentDraft.status,
        handled: true,
        draftPersisted: Boolean(persisted?.agentDraftMessageId),
        draftMessageId: persisted?.agentDraftMessageId || null,
      },
    });
  }

  return json(200, requestId, {
    inbound: stored[0] || {
      status: "ignored",
      sesMessageId: null,
    },
    processed: stored.length,
  });
}

async function buildInboundSupportEmailAgentDraft(details) {
  const actor = buildInboundSupportEmailAgentActor(details.fromAddress);
  const prompt = buildInboundSupportEmailAgentPrompt(details);
  const conversationId = `ses_${sanitizeText(details.sesMessageId, 120) || crypto.randomUUID()}`;
  const bedrock = await maybeBuildBedrockReply("YCCSupportAgent", actor, prompt, conversationId, {
    maxTokens: 900,
    temperature: 0.25,
    topP: 0.85,
  });
  const reply = sanitizeMultilineText(bedrock.reply || buildInboundSupportEmailFallbackDraft(details), MAX_EMAIL_BODY_LENGTH);

  return {
    agent: "YCCSupportAgent",
    agentAliasId: bedrock.agentAliasId || null,
    agentId: bedrock.agentId || null,
    handled: true,
    modelId: bedrock.modelId || null,
    reply,
    status: bedrock.status,
  };
}

function buildInboundSupportEmailAgentActor(fromAddress) {
  const email = normalizeEmailAddresses(fromAddress, 1)[0] || "";
  return {
    sub: "ses-inbound",
    email,
    emailVerified: false,
    name: email ? "Inbound email sender" : "SES inbound email",
    username: "ses-inbound",
    groups: [],
    membershipTier: null,
    memberStatus: null,
  };
}

function buildInboundSupportEmailAgentPrompt(details) {
  const toAddresses = normalizeEmailAddresses(details.toAddresses, 25);
  const bodyText = sanitizeMultilineText(details.bodyText, 3500) || "(No message body was available in the raw email.)";

  return sanitizeMultilineText(
    [
      "Inbound SES support email.",
      "Task: YCCSupportAgent must triage this inbound email and draft an operator-review-only support reply. Do not send email, do not collect payment data, and call out anything that needs a human concierge check.",
      `SES message ID: ${sanitizeText(details.sesMessageId, 240)}`,
      `Raw S3 key: ${sanitizeText(details.rawKey, 500)}`,
      `From: ${normalizeEmailAddresses(details.fromAddress, 1)[0] || "unknown"}`,
      `To: ${toAddresses.join(", ") || "unknown"}`,
      `Subject: ${sanitizeText(details.subject, 240) || "Yuzu Cigar Club support email"}`,
      "Body:",
      bodyText,
    ].join("\n"),
    5000
  );
}

function buildInboundSupportEmailFallbackDraft(details) {
  const subject = sanitizeText(details.subject, 180) || "Yuzu Cigar Club support email";
  const bodyPreview = sanitizeMultilineText(details.bodyText, 700) || "No body text was available in the raw inbound email.";

  return sanitizeMultilineText(
    [
      `Operator review draft for inbound support email: ${subject}`,
      "",
      "Hi there,",
      "",
      "Thanks for reaching out to Yuzu Cigar Club. We received your note and a concierge operator is reviewing the order, membership, account, or humidor context tied to your request.",
      "",
      "We will follow up with the next useful step after that review.",
      "",
      "Best,",
      "Yuzu Cigar Club Support",
      "",
      "Operator notes:",
      `- Inbound preview: ${bodyPreview}`,
      `- SES message ID: ${sanitizeText(details.sesMessageId, 240) || "unavailable"}`,
      `- Raw S3 key: ${sanitizeText(details.rawKey, 500) || "unavailable"}`,
    ].join("\n"),
    MAX_EMAIL_BODY_LENGTH
  );
}

async function handleBedrockActionGroup(event, requestId) {
  const actionName = sanitizeText(event.function || event.apiPath, 120);
  const params = getActionParameters(event);
  const actor = getActionActor(event);

  if (!actionName) {
    return bedrockFunctionResponse(event, {
      error: "missing_action",
      message: "The YCC action group requires a function name.",
    }, "REPROMPT");
  }

  if (actionName === "GetMemberProfile") {
    return bedrockFunctionResponse(event, {
      account: actor
        ? {
            email: actor.email,
            name: actor.name,
            groups: actor.groups,
            membership: getMembershipSnapshot(actor, null),
          }
        : null,
      persistence: {
        status: actor ? "session_context" : "identity_required",
      },
    });
  }

  if (actionName === "DraftSupportReply") {
    const message = sanitizeText(params.message || params.issue || event.inputText, MAX_SUPPORT_MESSAGE_LENGTH);
    const subject = sanitizeText(params.subject, 140) || "Yuzu Cigar Club support follow-up";

    if (!message) {
      return bedrockFunctionResponse(event, {
        error: "missing_support_message",
        message: "Ask for the member issue before drafting a support reply.",
      }, "REPROMPT");
    }

    const draftBody =
      `Hi ${actor?.name || "there"},\n\n` +
      "Thanks for reaching out to Yuzu Cigar Club. We received your note and are reviewing the account, membership, order, or humidor details tied to your request.\n\n" +
      "A concierge operator can personalize this draft before it is sent.\n\n" +
      "Best,\nYuzu Cigar Club Support";

    let persistedCase = null;
    if (actor && shouldPersistDatabaseWrites()) {
      persistedCase = await persistSupportEmailDraft(event, actor, requestId, {
        caseId: sanitizeText(params.caseId, 120) || `case_${crypto.randomUUID()}`,
        draftBody,
        message,
        subject,
      });
    }

    return bedrockFunctionResponse(event, {
      action: "support_draft",
      subject,
      draftBody,
      operatorReviewRequired: true,
      case: persistedCase
        ? {
            id: persistedCase.caseId,
            caseNumber: persistedCase.caseNumber,
            emailMessageId: persistedCase.emailMessageId,
          }
        : null,
      persistence: {
        status: persistedCase ? "stored" : actor ? getDatabasePersistenceStatus() : "identity_required",
      },
    });
  }

  if (actionName === "DraftWeeklyNews") {
    if (!actor || !canUseAdminAgent(actor)) {
      return bedrockFunctionResponse(event, {
        error: "news_agent_forbidden",
        message: "Weekly news drafts require an admin or concierge operator session group.",
      }, "REPROMPT");
    }

    const topic = sanitizeText(params.topic || params.theme || event.inputText, 240) || "weekly cigar industry news";
    const timeframe = sanitizeText(params.timeframe || params.week, 80) || "this week";
    const audience = sanitizeText(params.audience, 120) || "adult YCC members of legal tobacco age";
    const titleTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
    const draftInput = normalizeNewsDraftInput({
      angle: topic,
      timeframe,
      audience,
      sourceUrls: [],
      sourceNotes: [],
    });
    const weeklyDraftPrompt = buildWeeklyNewsAgentPrompt(draftInput);
    const conversationId = `weekly_${crypto.randomUUID()}`;
    const bedrock = await maybeBuildBedrockReply("YCCNewsAgent", actor, weeklyDraftPrompt, conversationId);
    const weeklyArticle = normalizeNewsDraftFromAgentReply(bedrock.reply || "", draftInput);
    const defaultSourceNotes = [
      "Placeholder: add verified source URLs or internal notes for each factual news item before approval.",
      "Placeholder: confirm dates, brands, releases, events, and quoted claims against primary or reputable trade sources.",
      "Placeholder: record the reviewing operator and approval timestamp before publication.",
    ];

    return bedrockFunctionResponse(event, {
      action: "weekly_news_draft",
      topic,
      timeframe,
      audience,
      publishStatus: "draft",
      operatorReviewRequired: true,
      educationArticle: {
        title: weeklyArticle.title,
        dek: weeklyArticle.dek,
        category: weeklyArticle.category,
        bodyMarkdown: weeklyArticle.bodyMarkdown,
        sections: weeklyArticle.sections,
      },
      newsletter: {
        subjectLine: `YCC weekly cigar brief: ${titleTopic}`,
        previewText: "Operator-reviewed cigar education notes for adult members.",
        body: `This draft is ready for operator review. Verify the source notes for ${topic}, remove any unverified claims, and approve before sending to adult members of legal tobacco age.\n\n${sanitizeText(
          weeklyArticle.bodyMarkdown,
          180
        )}`,
      },
      sourceNotes: weeklyArticle.sourceNotes.length ? weeklyArticle.sourceNotes : defaultSourceNotes,
      complianceReview: {
        ageRestricted: true,
        humanApprovalRequired: true,
        prohibitedClaims: ["health", "cessation", "medical", "therapeutic", "disease", "safe tobacco use"],
        prohibitedRequests: ["underage tobacco", "age-check bypass", "payment-card collection", "explicit off-domain sexual content"],
      },
    });
  }

  if (actionName === "AddHumidorItem") {
    if (!actor) {
      return bedrockFunctionResponse(event, {
        error: "identity_required",
        message: "Humidor writes require authenticated member session attributes.",
      }, "REPROMPT");
    }
    const humidorMembershipDenied = buildHumidorMembershipDeniedPayload(actor);
    if (humidorMembershipDenied) {
      return bedrockFunctionResponse(event, humidorMembershipDenied, "REPROMPT");
    }

    const item = normalizeHumidorItem({
      name: params.name || params.cigarName,
      brand: params.brand,
      line: params.line,
      vitola: params.vitola,
      wrapper: params.wrapper,
      origin: params.origin,
      strength: params.strength,
      quantity: params.quantity,
      rating: params.rating,
      purchaseDate: params.purchaseDate,
      agingStartDate: params.agingStartDate,
      productionDate: params.productionDate || params.producedDate || params.boxDate,
      reorderReminder: params.reorderReminder,
      humidorLocation: params.humidorLocation || params.location,
      tray: params.tray,
      tastingNotes: params.tastingNotes || params.notes,
      source: "bedrock_action_group",
    });

    if (!item.name) {
      return bedrockFunctionResponse(event, {
        error: "missing_humidor_item",
        message: "Ask for at least a cigar name, brand, or line before adding a humidor item.",
      }, "REPROMPT");
    }

    const persistedItem = shouldPersistDatabaseWrites() ? await persistHumidorItem(event, actor, requestId, item) : null;

    return bedrockFunctionResponse(event, {
      action: "humidor_item",
      item: {
        ...item,
        id: persistedItem?.itemId || null,
      },
      persistence: {
        status: persistedItem ? "stored" : getDatabasePersistenceStatus(),
      },
    });
  }

  if (actionName === "GetAdminQueueSummary") {
    if (!actor || !canUseAdminAgent(actor)) {
      return bedrockFunctionResponse(event, {
        error: "admin_agent_forbidden",
        message: "Admin queue summaries require an admin or concierge operator session group.",
      }, "REPROMPT");
    }

    const summary = await buildAdminQueueSummarySnapshot(params.queue);

    return bedrockFunctionResponse(event, {
      action: "admin_queue_summary",
      queue: summary.queue,
      summary: summary.summary,
      reply: summary.reply,
      nextActions: summary.nextActions,
      overview: summary.overview,
      sync: summary.sync,
      persistence: summary.persistence,
      destructiveActionsAllowed: false,
      operatorReviewRequired: true,
    });
  }

  return bedrockFunctionResponse(event, {
    error: "unknown_action",
    message: `The YCC action group does not support ${actionName}.`,
  }, "REPROMPT");
}

async function handleHumidorItem(event, actor, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const cigarImage = normalizeHumidorCigarImageAttachment(body.value.cigarImage || body.value);
  if (cigarImage.error) {
    return json(400, requestId, cigarImage.error);
  }

  const normalizedInput = { ...body.value };
  if (cigarImage.value) {
    normalizedInput.cigarImage = cigarImage.value;
  }

  let item = normalizeHumidorItem(normalizedInput);
  if (!item.name) {
    return json(400, requestId, {
      error: "missing_humidor_item_name",
      message: "Send at least a cigar name, or brand and line, to create a humidor item.",
    });
  }

  item = {
    ...item,
    cigarImage: await prepareHumidorCigarImageForStorage(cigarImage.value || item.cigarImage, actor, requestId, item.name),
  };

  let persistedItem = null;
  if (shouldPersistDatabaseWrites()) {
    persistedItem = await persistHumidorItem(event, actor, requestId, item);
  }
  const clientImage = await resolveHumidorCigarImageForClient(item.cigarImage);

  return json(persistedItem ? 201 : 202, requestId, {
    item: {
      id: persistedItem?.itemId || `humidor_${crypto.randomUUID()}`,
      ownerSub: actor.sub,
      ...item,
      cigarImage: clientImage,
      createdAt: persistedItem?.createdAt || new Date().toISOString(),
    },
    persistence: {
      status: persistedItem ? "stored" : getDatabasePersistenceStatus(),
      table: "humidor_items",
    },
    nextActions: [
      "support_photo_intake",
      "generate_reorder_and_aging_recommendations",
    ],
  });
}

async function handleHumidorSmokeLog(event, actor, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const smokeLog = normalizeHumidorSmokeLog(body.value);
  if (!smokeLog.humidorItemId && !smokeLog.cigarName) {
    return json(400, requestId, {
      error: "missing_smoke_log_cigar",
      message: "Choose a saved humidor cigar or send a cigar name before logging a smoke.",
    });
  }

  if (smokeLog.invalidRating) {
    return json(400, requestId, {
      error: "invalid_smoke_log_rating",
      message: "Smoke ratings must be a number between 0 and 100.",
    });
  }

  if (smokeLog.invalidDuration) {
    return json(400, requestId, {
      error: "invalid_smoke_duration",
      message: "Smoke duration must be a positive number of minutes.",
    });
  }

  if (smokeLog.invalidSmokedAt) {
    return json(400, requestId, {
      error: "invalid_smoked_at",
      message: "Send a valid smoked-at date and time.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(202, requestId, {
      log: {
        id: `smoke_${crypto.randomUUID()}`,
        ...mapHumidorSmokeLogForResponse({
          ...smokeLog,
          id: "",
          createdAt: new Date().toISOString(),
        }),
      },
      persistence: {
        status: getDatabasePersistenceStatus(),
        table: "smoke_logs",
      },
    });
  }

  return withDatabaseTransaction("ycc-api-humidor-smoke-log", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    let linkedHumidorItem = null;
    if (smokeLog.humidorItemId) {
      linkedHumidorItem = await loadHumidorItemRowForMember(client, smokeLog.humidorItemId, member.id);
      if (!linkedHumidorItem) {
        return json(404, requestId, {
          error: "humidor_item_not_found",
          message: "The selected humidor cigar was not found or is not visible to this member.",
        });
      }
    }

    const logToPersist = {
      ...smokeLog,
      cigarName: linkedHumidorItem?.name || smokeLog.cigarName,
    };
    const row = await insertHumidorSmokeLog(client, {
      actor,
      log: logToPersist,
      memberId: member.id,
      requestId,
    });
    const log = mapHumidorSmokeLogRow(row);

    await insertAuditLog(client, event, {
      action: "smoke_log.created",
      actor,
      afterData: {
        cigarName: log.cigarName,
        drinkPairing: log.drinkPairing,
        durationMinutes: log.durationMinutes,
        humidorItemId: log.humidorItemId,
        rating: log.rating,
        smokedAt: log.smokedAt,
      },
      memberId: member.id,
      requestId,
      resourceId: log.id,
      resourceType: "smoke_log",
    });

    return json(201, requestId, {
      log,
      persistence: {
        status: "stored",
        table: "smoke_logs",
      },
    });
  });
}

async function handleHumidorItemUpdate(event, actor, requestId) {
  const itemId = getPathId(event, "id");
  if (!itemId || !isUuid(itemId)) {
    return json(400, requestId, {
      error: "missing_humidor_item_id",
      message: "A valid humidor item id is required before updating a saved cigar.",
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const hasHumidorLocationUpdate =
    Object.prototype.hasOwnProperty.call(body.value, "humidorLocation") ||
    Object.prototype.hasOwnProperty.call(body.value, "location");
  const hasAgingStartDateUpdate = Object.prototype.hasOwnProperty.call(body.value, "agingStartDate");
  const hasTrayUpdate = Object.prototype.hasOwnProperty.call(body.value, "tray");
  const action = sanitizeText(body.value.action, 40).toLowerCase();
  const hasArchiveUpdate = action === "delete" || body.value.archived === true || body.value.deleted === true;
  const rawSharedQuantity = body.value.sharedQuantity ?? body.value.shareQuantity ?? body.value.quantityShared;
  const hasSharedUpdate = action === "share" || rawSharedQuantity !== undefined;
  const humidorLocation = sanitizeText(body.value.humidorLocation || body.value.location, MAX_FIELD_LENGTH);
  const agingStartDate = hasAgingStartDateUpdate ? normalizeDateOnly(body.value.agingStartDate) : undefined;
  const tray = hasTrayUpdate ? sanitizeText(body.value.tray, MAX_FIELD_LENGTH) : undefined;
  const sharedQuantity = hasSharedUpdate ? normalizeHumidorSharedQuantity(rawSharedQuantity) : 0;
  const sharedWith = sanitizeText(body.value.sharedWith || body.value.recipient, MAX_FIELD_LENGTH);
  const sharedNotes = sanitizeText(body.value.sharedNotes || body.value.notes, 1000);

  if (!hasHumidorLocationUpdate && !hasAgingStartDateUpdate && !hasTrayUpdate && !hasArchiveUpdate && !hasSharedUpdate) {
    return json(400, requestId, {
      error: "missing_humidor_item_update",
      message: "Send a humidor location, tray, aging start date, shared action, or delete action before updating this saved cigar.",
    });
  }

  if ((hasArchiveUpdate || hasSharedUpdate) && (hasHumidorLocationUpdate || hasAgingStartDateUpdate || hasTrayUpdate)) {
    return json(400, requestId, {
      error: "invalid_humidor_item_update",
      message: "Inventory share and delete actions must be saved separately from location or aging edits.",
    });
  }

  if (hasArchiveUpdate && hasSharedUpdate) {
    return json(400, requestId, {
      error: "invalid_humidor_item_update",
      message: "Choose either shared or delete for this inventory action.",
    });
  }

  if (hasHumidorLocationUpdate && !humidorLocation) {
    return json(400, requestId, {
      error: "missing_humidor_location",
      message: "Send a humidor location before updating this saved cigar.",
    });
  }

  if (hasAgingStartDateUpdate && !agingStartDate) {
    return json(400, requestId, {
      error: "invalid_aging_start_date",
      message: "Send a valid aging start date before updating this saved cigar.",
    });
  }

  if (hasSharedUpdate && !sharedQuantity) {
    return json(400, requestId, {
      error: "invalid_shared_quantity",
      message: "Shared cigar quantity must be at least 1.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(409, requestId, {
      error: "database_writes_not_ready",
      message: "Humidor item updates require the member humidor database.",
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseTransaction("ycc-api-humidor-item-update", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const currentRow = await loadHumidorItemRowForMember(client, itemId, member.id);

    if (!currentRow) {
      return json(404, requestId, {
        error: "humidor_item_not_found",
        message: "The requested humidor item was not found or is not visible to this member.",
      });
    }

    const currentItem = await mapHumidorItemRowForClient(client, currentRow, member.id, actor, requestId);

    if (hasArchiveUpdate) {
      const archivedRow = await archiveHumidorItem(client, {
        actor,
        itemId,
        memberId: member.id,
        requestId,
      });
      const archivedItem = await mapHumidorItemRowForClient(client, archivedRow, member.id, actor, requestId);

      await insertAuditLog(client, event, {
        action: "humidor_item.deleted",
        actor,
        afterData: {
          archived: true,
          itemId,
          quantity: 0,
        },
        beforeData: {
          quantity: currentItem.quantity,
        },
        memberId: member.id,
        requestId,
        resourceId: itemId,
        resourceType: "humidor_item",
      });

      return json(200, requestId, {
        item: archivedItem,
        inventoryAction: {
          type: "deleted",
          quantityBefore: currentItem.quantity,
          quantityAfter: 0,
          archived: true,
        },
        persistence: {
          status: "stored",
          table: "humidor_items",
        },
      });
    }

    if (hasSharedUpdate) {
      if (sharedQuantity > currentItem.quantity) {
        return json(400, requestId, {
          error: "shared_quantity_exceeds_inventory",
          message: "You cannot share more cigars than are currently in this humidor record.",
        });
      }

      const sharedRow = await updateHumidorItemSharedQuantity(client, {
        actor,
        itemId,
        memberId: member.id,
        quantity: sharedQuantity,
        requestId,
      });
      const updatedItem = await mapHumidorItemRowForClient(client, sharedRow, member.id, actor, requestId);
      const logRow = await insertHumidorSmokeLog(client, {
        actor,
        log: buildHumidorSharedInventoryLog(currentItem, {
          quantity: sharedQuantity,
          sharedNotes,
          sharedWith,
        }),
        memberId: member.id,
        requestId,
      });
      const log = mapHumidorSmokeLogRow(logRow);

      await insertAuditLog(client, event, {
        action: "humidor_item.shared",
        actor,
        afterData: {
          archived: updatedItem.quantity <= 0,
          itemId,
          quantity: updatedItem.quantity,
          sharedLogId: log.id,
          sharedQuantity,
          sharedWith,
        },
        beforeData: {
          quantity: currentItem.quantity,
        },
        memberId: member.id,
        requestId,
        resourceId: itemId,
        resourceType: "humidor_item",
      });

      return json(200, requestId, {
        item: updatedItem,
        log,
        inventoryAction: {
          type: "shared",
          quantityBefore: currentItem.quantity,
          quantityAfter: updatedItem.quantity,
          archived: updatedItem.quantity <= 0,
        },
        persistence: {
          status: "stored",
          table: "humidor_items",
        },
        tracking: {
          status: "stored",
          table: "smoke_logs",
        },
      });
    }

    const updatedRow = await updateHumidorItemLocation(client, {
      agingStartDate,
      actor,
      humidorLocation,
      itemId,
      memberId: member.id,
      requestId,
      tray,
      updateTray: hasTrayUpdate,
    });
    const updatedItem = await mapHumidorItemRowForClient(client, updatedRow, member.id, actor, requestId);

    await insertAuditLog(client, event, {
      action:
        hasHumidorLocationUpdate && hasAgingStartDateUpdate
          ? "humidor_item.updated"
          : hasAgingStartDateUpdate
            ? "humidor_item.aging_start_updated"
            : "humidor_item.location_updated",
      actor,
      afterData: {
        agingStartDate: updatedItem.agingStartDate,
        humidorLocation: updatedItem.humidorLocation,
        itemId,
        tray: updatedItem.tray,
      },
      beforeData: {
        agingStartDate: currentItem.agingStartDate,
        humidorLocation: currentItem.humidorLocation,
        tray: currentItem.tray,
      },
      memberId: member.id,
      requestId,
      resourceId: itemId,
      resourceType: "humidor_item",
    });

    return json(200, requestId, {
      item: updatedItem,
      persistence: {
        status: "stored",
        table: "humidor_items",
      },
    });
  });
}

async function handleHumidorItemEnrichment(event, actor, requestId) {
  const itemId = getPathId(event, "id");
  if (!itemId || !isUuid(itemId)) {
    return json(400, requestId, {
      error: "missing_humidor_item_id",
      message: "A valid humidor item id is required before the humidor agent can update it.",
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const requestedFields = normalizeHumidorEnrichmentFields(body.value.fields);
  if (requestedFields.error) {
    return json(400, requestId, {
      error: "invalid_humidor_enrichment_fields",
      message: requestedFields.error,
    });
  }
  const approved = body.value.approved === true;

  if (!shouldPersistDatabaseWrites()) {
    return json(409, requestId, {
      error: "database_writes_not_ready",
      message: "Humidor enrichment updates require the member humidor database.",
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseTransaction("ycc-api-humidor-item-enrichment", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const currentRow = await loadHumidorItemRowForMember(client, itemId, member.id);

    if (!currentRow) {
      return json(404, requestId, {
        error: "humidor_item_not_found",
        message: "The requested humidor item was not found or is not visible to this member.",
      });
    }

    const currentItem = await mapHumidorItemRowForClient(client, currentRow, member.id, actor, requestId);
    const missingFields = getMissingHumidorEnrichmentFields(currentItem);
    const fieldsToEnrich = requestedFields.value.length
      ? requestedFields.value.filter((field) => missingFields.includes(field))
      : missingFields;

    if (!fieldsToEnrich.length) {
      return json(200, requestId, {
        item: currentItem,
        enrichment: {
          status: "complete",
          requestedFields: requestedFields.value,
          missingFields: [],
          updatedFields: [],
          evidence: [],
          needsReview: [],
        },
        ai: {
          status: "not_needed",
        },
        persistence: {
          status: "stored",
          table: "humidor_items",
        },
      });
    }

    const ai = await maybeEnrichHumidorItem(currentItem, fieldsToEnrich, actor, requestId);
    const merge = mergeHumidorEnrichment(currentItem, ai.suggestion, fieldsToEnrich);

    if (!merge.updatedFields.length) {
      if (!approved) {
        return json(200, requestId, {
          item: currentItem,
          previewItem: currentItem,
          enrichment: {
            status: "needs_review",
            requestedFields: fieldsToEnrich,
            missingFields,
            updatedFields: [],
            evidence: ai.suggestion.evidence,
            needsReview: ai.suggestion.needsReview.length
              ? ai.suggestion.needsReview
              : ["The humidor agent did not find enough verified detail to update this cigar automatically."],
            confidence: ai.suggestion.confidence,
          },
          ai: buildHumidorEnrichmentAiSummary(ai),
          persistence: {
            status: "pending_member_review",
            table: "humidor_items",
          },
        });
      }

      return json(200, requestId, {
        item: currentItem,
        enrichment: {
          status: "needs_review",
          requestedFields: fieldsToEnrich,
          missingFields,
          updatedFields: [],
          evidence: ai.suggestion.evidence,
          needsReview: ai.suggestion.needsReview.length
            ? ai.suggestion.needsReview
            : ["The humidor agent did not find enough verified detail to update this cigar automatically."],
          confidence: ai.suggestion.confidence,
        },
        ai: buildHumidorEnrichmentAiSummary(ai),
        persistence: {
          status: "stored",
          table: "humidor_items",
        },
      });
    }

    if (!approved) {
      return json(200, requestId, {
        item: currentItem,
        previewItem: merge.item,
        enrichment: {
          status: "pending_approval",
          requestedFields: fieldsToEnrich,
          missingFields,
          updatedFields: merge.updatedFields,
          evidence: ai.suggestion.evidence,
          needsReview: ai.suggestion.needsReview,
          confidence: ai.suggestion.confidence,
        },
        ai: buildHumidorEnrichmentAiSummary(ai),
        persistence: {
          status: "pending_member_approval",
          table: "humidor_items",
        },
      });
    }

    const updatedRow = await updateHumidorItemEnrichment(client, {
      actor,
      enrichment: ai.suggestion,
      item: merge.item,
      itemId,
      memberId: member.id,
      requestId,
      updatedFields: merge.updatedFields,
    });
    const updatedItem = await mapHumidorItemRowForClient(client, updatedRow, member.id, actor, requestId);

    await insertAuditLog(client, event, {
      action: "humidor_item.enriched",
      actor,
      afterData: {
        itemId,
        requestedFields: fieldsToEnrich,
        updatedFields: merge.updatedFields,
        evidence: ai.suggestion.evidence,
        confidence: ai.suggestion.confidence,
      },
      memberId: member.id,
      requestId,
      resourceId: itemId,
      resourceType: "humidor_item",
    });

    return json(200, requestId, {
      item: updatedItem,
      enrichment: {
        status: "updated",
        requestedFields: fieldsToEnrich,
        missingFields: getMissingHumidorEnrichmentFields(updatedItem),
        updatedFields: merge.updatedFields,
        evidence: ai.suggestion.evidence,
        needsReview: ai.suggestion.needsReview,
        confidence: ai.suggestion.confidence,
      },
      ai: buildHumidorEnrichmentAiSummary(ai),
      persistence: {
        status: "stored",
        table: "humidor_items",
      },
    });
  });
}

async function handleHumidorCigarIdentification(event, actor, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const image = normalizeCigarImageInput(body.value);
  if (image.error) {
    return json(400, requestId, image.error);
  }

  const notes = sanitizeText(body.value.notes || body.value.description || body.value.caption, 1000);
  const ai = await maybeIdentifyCigarFromImage(actor, image, notes);
  logCigarIdentificationSummary(event, requestId, actor, ai, image, notes);

  return json(200, requestId, {
    suggestion: ai.suggestion,
    ai: {
      status: ai.status,
      modelId: ai.modelId,
      stopReason: ai.stopReason || null,
      rekognition: summarizeRekognitionForClient(ai.rekognition),
    },
    input: {
      accepted: true,
      imageType: image.mimeType,
      imageBytes: image.bytes.length,
      notesLength: notes.length,
    },
    guardrails: {
      ageRestricted: true,
      piiMinimized: true,
      tobaccoHealthClaims: "not_provided",
      humanHandoff: ai.suggestion.confidence === "low",
    },
    nextActions: ["review_identified_fields", "confirm_add_to_humidor"],
  });
}

async function handleHumidorAlertDispatch(event, requestId) {
  const dispatchSecret = sanitizeText(process.env.HUMIDOR_ALERT_DISPATCH_SECRET || "", 240);
  const providedSecret = getHeader(event, HUMIDOR_ALERT_DISPATCH_SECRET_HEADER);
  if (!dispatchSecret || !isValidDispatchSecret(providedSecret, dispatchSecret)) {
    return json(403, requestId, {
      error: "humidor_dispatch_forbidden",
      message: "Dispatch secret is required and must match the configured humidor dispatch secret.",
    });
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(503, requestId, {
      error: "humidor_dispatch_not_ready",
      message: "Humidor dispatch requires schema-ready writes for reminder evaluation and status persistence.",
      persistence: getDatabasePersistenceStatus(),
    });
  }

  const vapidPublicKey = sanitizeText(process.env.VAPID_PUBLIC_KEY || "", 900);
  const vapidPrivateKey = sanitizeText(process.env.VAPID_PRIVATE_KEY || "", 900);
  const vapidSubject = sanitizeText(process.env.VAPID_SUBJECT || "", 320);
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return json(503, requestId, {
      error: "humidor_dispatch_not_ready",
      message: "Push dispatch is waiting for VAPID settings (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT).",
    });
  }

  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const dispatchDate = new Date().toISOString().slice(0, 10);

  return withDatabaseClient("ycc-api-humidor-alert-dispatch", async (client) => {
    const dueResult = await client.query(
      `
        select
          m.id as member_id,
          m.cognito_sub as member_sub,
          mp.preferences->'pushSubscription' as push_subscription,
          hi.id as humidor_item_id,
          hi.name,
          hi.brand,
          hi.line,
          hi.vitola,
          hi.reorder_reminder
        from public.members m
        join public.member_profiles mp on mp.member_id = m.id
        join public.humidor_items hi on hi.member_id = m.id
        where coalesce((mp.preferences->>'pushEnabled')::boolean, false) = true
          and coalesce((mp.preferences->>'reorderRemindersEnabled')::boolean, true) = true
          and mp.preferences->'pushSubscription' is not null
          and hi.reorder_reminder is not null
          and hi.reorder_reminder::date <= $1::date
          and coalesce(hi.metadata#>>'{${HUMIDOR_REORDER_REMINDER_DISPATCH_MARKER}}', '') <> $1::text
          and hi.archived_at is null
        order by m.id, hi.reorder_reminder asc
      `,
      [dispatchDate]
    );

    const climateResult = await client.query(
      `
        select
          m.id as member_id,
          m.cognito_sub as member_sub,
          mp.preferences
        from public.members m
        join public.member_profiles mp on mp.member_id = m.id
        where coalesce((mp.preferences->>'pushEnabled')::boolean, false) = true
          and coalesce((mp.preferences->>'climateAlertsEnabled')::boolean, false) = true
          and mp.preferences->'pushSubscription' is not null
          and jsonb_array_length(coalesce(mp.preferences->'pairedDevices', '[]'::jsonb)) > 0
        order by m.id
      `
    );
    const climateGroups = buildHumidorClimateAlertGroups(climateResult.rows);

    if (dueResult.rows.length === 0 && climateGroups.length === 0) {
      return json(200, requestId, {
        status: "no_due_items",
        summary: {
          notificationDate: dispatchDate,
          dueItems: 0,
          climateDevices: 0,
          sentNotifications: 0,
          sentClimateNotifications: 0,
          failedNotifications: 0,
          failedClimateNotifications: 0,
          sentItems: 0,
        },
      });
    }

    const systemActor = buildHumidorDispatchActor();
    const memberGroups = new Map();
    const failedMembers = [];
    let sentNotifications = 0;
    let failedNotifications = 0;
    let sentItems = 0;
    let invalidSubscriptionItems = 0;
    let climateDevices = 0;
    let sentClimateNotifications = 0;
    let failedClimateNotifications = 0;

    for (const row of dueResult.rows) {
      const memberId = String(row.member_id || "");
      if (!memberId) {
        continue;
      }

      const item = {
        itemId: String(row.humidor_item_id || ""),
        name: buildHumidorItemDisplayName(row),
      };

      if (!item.itemId) {
        continue;
      }

      let group = memberGroups.get(memberId);
      if (!group) {
        const pushSubscription = normalizeHumidorPushSubscription(row.push_subscription);
        group = {
          memberId,
          memberSub: String(row.member_sub || ""),
          pushSubscription,
          items: [],
          hasInvalidSubscription: !pushSubscription,
        };
        memberGroups.set(memberId, group);
      }

      group.items.push(item);
    }

    for (const group of memberGroups.values()) {
      if (group.items.length === 0) {
        continue;
      }

      if (group.hasInvalidSubscription || !group.pushSubscription) {
        invalidSubscriptionItems += group.items.length;
        failedNotifications += 1;
        failedMembers.push({
          memberId: group.memberId,
          reason: "invalid_push_subscription",
          itemCount: group.items.length,
          action: "subscription_invalid",
        });
        continue;
      }

      const payload = buildHumidorReorderReminderPayload(group, dispatchDate);
      try {
        await webPush.sendNotification(group.pushSubscription, JSON.stringify(payload));
        sentNotifications += 1;

        for (const item of group.items) {
          await markHumidorReminderDispatched(client, item.itemId, dispatchDate, requestId);
          sentItems += 1;
        }

        await insertAuditLog(client, event, {
          action: "humidor_reorder_reminder.dispatched",
          actor: systemActor,
          afterData: {
            memberSub: group.memberSub,
            notificationDate: dispatchDate,
            itemCount: group.items.length,
          },
          memberId: group.memberId,
          requestId,
          resourceId: group.memberId,
          resourceType: "humidor_item",
        });
      } catch (error) {
        failedNotifications += 1;
        const statusCode = Number(error instanceof Error ? error.statusCode : NaN);
        const pushErrorStatus = Number.isFinite(statusCode) ? statusCode : null;
        failedMembers.push({
          memberId: group.memberId,
          reason: pushErrorStatus ? `push_send_status_${pushErrorStatus}` : "push_send_error",
          statusCode: pushErrorStatus,
          itemCount: group.items.length,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });

        if (pushErrorStatus === 404 || pushErrorStatus === 410) {
          await upsertHumidorAlertPreferences(client, systemActor, requestId, group.memberId, { pushEnabled: false });
          await insertAuditLog(client, event, {
            action: "humidor_alert_preferences.push_subscription_disabled",
            actor: systemActor,
            afterData: {
              reason: "invalid_push_subscription",
              statusCode: pushErrorStatus,
              notificationDate: dispatchDate,
            },
            memberId: group.memberId,
            requestId,
            resourceId: group.memberId,
            resourceType: "member_profile",
          });
        }
      }
    }

    for (const group of climateGroups) {
      if (group.alerts.length === 0 || !group.pushSubscription) {
        continue;
      }

      climateDevices += group.alerts.length;
      const payload = buildHumidorClimateAlertPayload(group);
      try {
        await webPush.sendNotification(group.pushSubscription, JSON.stringify(payload));
        sentClimateNotifications += 1;

        await insertAuditLog(client, event, {
          action: "humidor_climate_alert.dispatched",
          actor: systemActor,
          afterData: {
            memberSub: group.memberSub,
            itemCount: group.alerts.length,
            locations: group.alerts.map((alert) => alert.location),
          },
          memberId: group.memberId,
          requestId,
          resourceId: group.memberId,
          resourceType: "member_profile",
        });
      } catch (error) {
        failedClimateNotifications += 1;
        const statusCode = Number(error instanceof Error ? error.statusCode : NaN);
        const pushErrorStatus = Number.isFinite(statusCode) ? statusCode : null;
        failedMembers.push({
          memberId: group.memberId,
          reason: pushErrorStatus ? `climate_push_send_status_${pushErrorStatus}` : "climate_push_send_error",
          statusCode: pushErrorStatus,
          itemCount: group.alerts.length,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });

        if (pushErrorStatus === 404 || pushErrorStatus === 410) {
          await upsertHumidorAlertPreferences(client, systemActor, requestId, group.memberId, { pushEnabled: false });
        }
      }
    }

    return json(200, requestId, {
      status: "dispatched",
      summary: {
        notificationDate: dispatchDate,
        dueItems: dueResult.rows.length,
        climateDevices,
        attemptedMembers: memberGroups.size,
        attemptedClimateMembers: climateGroups.length,
        sentNotifications,
        sentClimateNotifications,
        failedNotifications,
        failedClimateNotifications,
        sentItems,
        invalidSubscriptionItems,
      },
      failed: failedMembers,
    });
  });
}

function buildHumidorClimateAlertGroups(rows) {
  return rows.flatMap((row) => {
    const memberId = String(row.member_id || "");
    if (!memberId) {
      return [];
    }

    const preferences = normalizeHumidorAlertPreferences(row.preferences);
    const pushSubscription = preferences.pushEnabled ? preferences.pushSubscription : null;
    const alerts = getHumidorClimateDeviceAlerts(preferences.pairedDevices);

    if (!preferences.climateAlertsEnabled || !pushSubscription || alerts.length === 0) {
      return [];
    }

    return [
      {
        memberId,
        memberSub: String(row.member_sub || ""),
        pushSubscription,
        alerts,
      },
    ];
  });
}

function getHumidorClimateDeviceAlerts(devices) {
  return normalizeHumidorPairedDevices(devices).flatMap((device) => {
    const humidityOutOfRange = device.humidity < HUMIDOR_CLIMATE_ALERT_TARGET.minHumidity || device.humidity > HUMIDOR_CLIMATE_ALERT_TARGET.maxHumidity;
    const temperatureOutOfRange =
      device.temperature < HUMIDOR_CLIMATE_ALERT_TARGET.minTemperature || device.temperature > HUMIDOR_CLIMATE_ALERT_TARGET.maxTemperature;

    if (!humidityOutOfRange && !temperatureOutOfRange) {
      return [];
    }

    const issues = [];
    if (humidityOutOfRange) {
      issues.push(`${device.humidity}% RH`);
    }

    if (temperatureOutOfRange) {
      issues.push(`${device.temperature} F`);
    }

    return [
      {
        deviceId: device.id,
        deviceName: device.name,
        location: device.location,
        humidity: device.humidity,
        temperature: device.temperature,
        message: `${device.name} at ${device.location}: ${issues.join(" and ")}.`,
      },
    ];
  });
}

function buildHumidorClimateAlertPayload(group) {
  const preview = group.alerts
    .slice(0, 2)
    .map((alert) => alert.message)
    .join(" ");
  const extraCount = Math.max(0, group.alerts.length - 2);

  return {
    title: "Humidor climate alert",
    body: extraCount ? `${preview} ${extraCount} more paired device${extraCount === 1 ? "" : "s"} need attention.` : preview,
    data: {
      tag: HUMIDOR_ALERT_DISPATCH_NOTIFICATION_TAG,
      url: "/humidor?section=alerts",
    },
  };
}

async function handleHumidorIotTelemetry(event, requestId) {
  const telemetry = normalizeHumidorIotTelemetry(event);
  if (telemetry.error) {
    return json(400, requestId, telemetry.error);
  }

  if (!shouldPersistDatabaseWrites()) {
    return json(202, requestId, {
      status: "accepted",
      message: "Humidor IoT telemetry was accepted, but schema-backed writes are not enabled.",
      persistence: getDatabasePersistenceStatus(),
      summary: {
        thingName: telemetry.value.thingName,
        matchedProfiles: 0,
        updatedDevices: 0,
      },
    });
  }

  const actor = buildHumidorIotActor();
  return withDatabaseClient("ycc-api-humidor-iot-telemetry", async (client) => {
    const profileResult = await client.query(
      `
        select
          id,
          member_id,
          preferences
        from public.member_profiles
        where jsonb_array_length(coalesce(preferences->'pairedDevices', '[]'::jsonb)) > 0
        order by updated_at desc
      `
    );
    let matchedProfiles = 0;
    let updatedDevices = 0;

    for (const row of profileResult.rows) {
      const preferences = normalizeHumidorAlertPreferences(row.preferences);
      const update = applyHumidorTelemetryToPairedDevices(preferences, telemetry.value);

      if (update.updatedDevices === 0) {
        continue;
      }

      matchedProfiles += 1;
      updatedDevices += update.updatedDevices;
      const memberId = String(row.member_id || "");
      const savedPreferences = await upsertHumidorAlertPreferences(client, actor, requestId, memberId, update.preferences);

      await insertAuditLog(client, event, {
        action: "humidor_device.telemetry_ingested",
        actor,
        afterData: {
          thingName: telemetry.value.thingName,
          topic: telemetry.value.topic,
          humidity: telemetry.value.humidity,
          temperature: telemetry.value.temperature,
          batteryPercent: telemetry.value.batteryPercent,
          recordedAt: telemetry.value.recordedAt,
          updatedDevices: update.updatedDeviceIds,
          pairedDeviceCount: savedPreferences.pairedDevices.length,
        },
        memberId,
        requestId,
        resourceId: telemetry.value.thingName,
        resourceType: "humidor_iot_thing",
      });
    }

    return json(200, requestId, {
      status: "ingested",
      persistence: "stored",
      summary: {
        thingName: telemetry.value.thingName,
        matchedProfiles,
        updatedDevices,
      },
    });
  });
}

function isHumidorIotTelemetryEvent(event) {
  if (!event || typeof event !== "object") {
    return false;
  }

  if (event.source === HUMIDOR_IOT_TELEMETRY_SOURCE) {
    return true;
  }

  const topic = sanitizeText(event.topic || event.mqttTopic || event.topicName, 240);
  return topic.startsWith(HUMIDOR_IOT_TELEMETRY_TOPIC_PREFIX) && topic.endsWith(HUMIDOR_IOT_TELEMETRY_TOPIC_SUFFIX);
}

function normalizeHumidorIotTelemetry(event) {
  const topic = sanitizeText(event.topic || event.mqttTopic || event.topicName, 240);
  const topicThingName = parseHumidorIotThingNameFromTopic(topic);
  const thingName = sanitizeText(
    topicThingName || firstDefined(event.thingName, event.thing, event.clientId, event.clientID),
    128
  );
  const identifier = sanitizeText(firstDefined(event.identifier, event.deviceIdentifier, event.device_id), 180);
  const deviceId = sanitizeText(firstDefined(event.deviceId, event.id), 220);
  const humidity = normalizeIotNumber(firstDefined(event.humidity, event.relativeHumidity, event.humidityPercent, event.rh));
  const temperature = normalizeIotNumber(firstDefined(event.temperature, event.temperatureF, event.tempF));
  const batteryPercent = normalizeIotOptionalPercent(firstDefined(event.batteryPercent, event.battery, event.batteryLevel));
  const recordedAt = normalizeIotTimestamp(firstDefined(event.recordedAt, event.timestamp, event.ts, event.receivedAt));

  if (!thingName) {
    return {
      error: {
        error: "missing_iot_thing_name",
        message: "Humidor IoT telemetry must include a thingName or a ycc/humidor/{thingName}/telemetry topic.",
      },
    };
  }

  if (!isValidHumidorDeviceClimate(humidity, temperature)) {
    return {
      error: {
        error: "invalid_iot_climate_reading",
        message: "Humidor IoT telemetry must include humidity from 1-100 and temperature from 40-95 F.",
      },
    };
  }

  return {
    value: {
      topic,
      thingName,
      identifier,
      deviceId,
      humidity,
      temperature,
      batteryPercent,
      recordedAt,
    },
  };
}

function parseHumidorIotThingNameFromTopic(topic) {
  const normalized = sanitizeText(topic, 240);
  if (!normalized.startsWith(HUMIDOR_IOT_TELEMETRY_TOPIC_PREFIX) || !normalized.endsWith(HUMIDOR_IOT_TELEMETRY_TOPIC_SUFFIX)) {
    return "";
  }

  return normalized.slice(HUMIDOR_IOT_TELEMETRY_TOPIC_PREFIX.length, -HUMIDOR_IOT_TELEMETRY_TOPIC_SUFFIX.length);
}

function normalizeIotNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : NaN;
}

function normalizeIotOptionalPercent(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = normalizeIotNumber(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function normalizeIotTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 1000000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  const text = sanitizeText(value, 80);
  if (text) {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      return normalizeIotTimestamp(numeric);
    }

    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

function applyHumidorTelemetryToPairedDevices(preferences, telemetry) {
  const authoritativeThingName = sanitizeText(telemetry.thingName, 220).toLowerCase();
  const updatedDeviceIds = [];
  const pairedDevices = preferences.pairedDevices.map((device) => {
    const deviceCandidates = normalizeHumidorTelemetryDeviceCandidates(device);
    const matches = Boolean(authoritativeThingName && deviceCandidates.has(authoritativeThingName));

    if (!matches) {
      return device;
    }

    updatedDeviceIds.push(device.id);
    return {
      ...device,
      humidity: telemetry.humidity,
      temperature: telemetry.temperature,
      status: "Connected",
      lastSyncedAt: telemetry.recordedAt,
    };
  });

  return {
    preferences: {
      ...preferences,
      pairedDevices,
    },
    updatedDevices: updatedDeviceIds.length,
    updatedDeviceIds,
  };
}

function normalizeHumidorTelemetryDeviceCandidates(value) {
  const candidates = new Set();
  for (const candidate of [value.thingName, value.identifier, value.deviceIdentifier, value.deviceId, value.id]) {
    const normalized = sanitizeText(candidate, 220).toLowerCase();
    if (normalized) {
      candidates.add(normalized);
    }
  }

  return candidates;
}

function buildHumidorIotActor() {
  return {
    sub: HUMIDOR_IOT_ACTOR_SUB,
    email: "",
    name: "YCC Humidor IoT",
    groups: [],
    username: HUMIDOR_IOT_ACTOR_SUB,
    role: "system",
    membership: {
      tier: null,
      status: null,
      role: "system",
      groups: [],
    },
  };
}

async function maybeIdentifyCigarFromImage(actor, image, notes) {
  const modelId = process.env.BEDROCK_VISION_MODEL_ID || process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID;
  const rekognition = await maybeDetectCigarImageText(image);

  if (process.env.FEATURE_BEDROCK !== "runtime_ready") {
    return {
      status: process.env.FEATURE_BEDROCK || "pending_agent",
      modelId,
      stopReason: null,
      rekognition,
      suggestion: buildFallbackCigarSuggestion(notes, "low"),
    };
  }

  try {
    const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: "user",
          content: [
            { text: buildCigarImageIdentificationPrompt(notes, rekognition) },
            {
              image: {
                format: image.format,
                source: {
                  bytes: image.bytes,
                },
              },
            },
          ],
        },
      ],
      system: [{ text: buildCigarVisionSystemPrompt(actor) }],
      inferenceConfig: {
        maxTokens: 1400,
        temperature: 0.2,
        topP: 0.9,
      },
    });
    const result = await client.send(command);
    const reply = extractConverseText(result);

    return {
      status: reply ? "bedrock_runtime" : "fallback",
      modelId,
      stopReason: result.stopReason || null,
      rekognition,
      suggestion: parseCigarIdentificationReply(reply, notes),
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "bedrock_cigar_image_identification_fallback",
        modelId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return {
      status: "fallback",
      modelId,
      stopReason: null,
      rekognition,
      suggestion: buildFallbackCigarSuggestion(notes, "low"),
    };
  }
}

async function maybeEnrichHumidorItem(item, requestedFields, actor, requestId) {
  const conversationId = `humidor_enrich_${item.id}_${requestId}`;
  const rekognition = await maybeAnalyzeHumidorItemImageForEnrichment(item);
  const knowledgeBaseRetrieval =
    process.env.FEATURE_BEDROCK === "runtime_ready"
      ? await maybeRetrieveKnowledgeBaseContext(
          process.env.BEDROCK_KNOWLEDGE_BASE_ID || null,
          buildHumidorEnrichmentRetrievalQuery(item, requestedFields, rekognition)
        )
      : null;
  const browserSearch = buildHumidorEnrichmentBrowserSearchPlan(item, requestedFields, rekognition);
  const prompt = buildHumidorEnrichmentPrompt(item, requestedFields, browserSearch, rekognition);
  let bedrock = await maybeBuildBedrockReply("YCCHumidorAgent", actor, prompt, conversationId, {
    knowledgeBaseRetrieval,
    maxTokens: 1400,
    temperature: 0.2,
  });
  let suggestion = parseHumidorEnrichmentReply(bedrock.reply || "", item, requestedFields);
  let webSearch = {
    status: "not_run",
    query: browserSearch.query,
    resultCount: 0,
    sources: [],
  };

  if (shouldRetryHumidorEnrichmentWithDirectRuntime(item, bedrock.reply, suggestion, requestedFields)) {
    const directBedrock = await maybeBuildBedrockReply("YCCHumidorAgent", actor, prompt, `${conversationId}_direct`, {
      forceDirectRuntime: true,
      knowledgeBaseRetrieval,
      maxTokens: 1400,
      temperature: 0.2,
    });
    const directSuggestion = parseHumidorEnrichmentReply(directBedrock.reply || "", item, requestedFields);
    if (hasSaveableHumidorEnrichmentSuggestion(item, directSuggestion, requestedFields) || isAgentGuardrailRefusalReply(bedrock.reply)) {
      bedrock = directBedrock;
      suggestion = directSuggestion;
    }
  }

  if (!hasSaveableHumidorEnrichmentSuggestion(item, suggestion, requestedFields)) {
    const webReference = await maybeBuildHumidorWebEnrichmentSuggestion(item, requestedFields, browserSearch);
    webSearch = summarizeHumidorWebSearchResult(webReference, browserSearch);
    if (webReference.suggestion && hasSaveableHumidorEnrichmentSuggestion(item, webReference.suggestion, requestedFields)) {
      suggestion = webReference.suggestion;
    } else if (webReference.suggestion && !hasSaveableHumidorEnrichmentSuggestion(item, suggestion, requestedFields)) {
      suggestion = webReference.suggestion;
    }
  }

  if (!hasSaveableHumidorEnrichmentSuggestion(item, suggestion, requestedFields)) {
    const catalogReference = await maybeBuildHumidorCatalogEnrichmentSuggestion(item, requestedFields);
    if (catalogReference) {
      bedrock = {
        ...bedrock,
        catalogReferenceStatus: catalogReference.status,
        catalogReferenceCount: catalogReference.count,
      };
      suggestion = catalogReference.suggestion;
    }
  }

  return {
    ...bedrock,
    browserSearch,
    rekognition,
    webSearchStatus: webSearch.status,
    webSearchQuery: webSearch.query,
    webSearchResultCount: webSearch.resultCount,
    webSearchSources: webSearch.sources,
    suggestion,
  };
}

function shouldRetryHumidorEnrichmentWithDirectRuntime(item, reply, suggestion, requestedFields) {
  if (hasSaveableHumidorEnrichmentSuggestion(item, suggestion, requestedFields)) {
    return false;
  }

  return isAgentGuardrailRefusalReply(reply) || !parseFirstJsonObject(reply || "");
}

function hasSaveableHumidorEnrichmentSuggestion(item, suggestion, requestedFields) {
  if (!suggestion) {
    return false;
  }

  return mergeHumidorEnrichment(item, suggestion, requestedFields).updatedFields.length > 0;
}

function buildHumidorEnrichmentRetrievalQuery(item, requestedFields, rekognition = null) {
  const identity = [
    item.name,
    item.brand && item.brand !== item.name ? item.brand : "",
    item.line && item.line !== item.name ? item.line : "",
    item.vitola,
  ]
    .map((value) => sanitizeText(value, MAX_FIELD_LENGTH))
    .filter(Boolean)
    .join(" ");
  const imageTerms = getRekognitionSearchTerms(rekognition);

  return [
    "YCC humidor cigar reference lookup for missing member inventory fields.",
    `Cigar identity: ${identity || sanitizeText(item.name, MAX_FIELD_LENGTH) || "unknown cigar"}`,
    imageTerms.length ? `Saved image OCR/label terms: ${imageTerms.join(", ")}` : "",
    `Requested missing groups: ${requestedFields.join(", ")}`,
    "Retrieve product reference facts for brand, line, vitola, wrapper, origin, strength, tasting notes, MSRP or retail price, and stable product image URLs.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildHumidorEnrichmentBrowserSearchPlan(item, requestedFields, rekognition = null) {
  const identityParts = [
    item.name,
    item.brand && item.brand !== item.name ? item.brand : "",
    item.line && item.line !== item.name ? item.line : "",
    item.vitola,
  ]
    .map((value) => sanitizeText(value, MAX_FIELD_LENGTH))
    .filter(Boolean);
  const uniqueIdentityParts = identityParts.filter((value, index, list) => {
    const normalized = value.toLowerCase();
    return list.findIndex((candidate) => candidate.toLowerCase() === normalized) === index;
  });
  const fieldTerms = [];

  if (requestedFields.includes("info")) {
    fieldTerms.push("wrapper", "origin", "strength");
  }

  if (requestedFields.includes("msrp")) {
    fieldTerms.push("MSRP");
  }

  if (requestedFields.includes("image")) {
    fieldTerms.push("product image");
  }

  const plan = {
    status: "requested",
    query: [...uniqueIdentityParts, "cigar", ...fieldTerms].filter(Boolean).join(" "),
    missingFields: requestedFields,
    sourcePolicy: [
      "Prefer official brand or manufacturer pages.",
      "Use reputable cigar retailers or cigar reference pages when official pages do not expose every requested field.",
      "Every returned value needs a source URL in evidence or sourceSummary.",
    ],
  };

  const imageTerms = getRekognitionSearchTerms(rekognition);
  if (imageTerms.length) {
    plan.query = [...uniqueIdentityParts, ...imageTerms, "cigar", ...fieldTerms].filter(Boolean).join(" ");
    plan.sourcePolicy = [
      ...plan.sourcePolicy,
      "Use saved-image OCR and labels as search hints only; verify any product identity against inspected source pages.",
    ];
  }

  return plan;
}

function buildHumidorEnrichmentPrompt(item, requestedFields, browserSearch = null, rekognition = null) {
  const browserSearchBlock = browserSearch?.query
    ? [
        "Browser search required before needsReview:",
        `Search query: ${browserSearch.query}`,
        "Use an available browser/search tool to inspect public manufacturer, retailer, or reputable cigar reference pages for the missing groups.",
        "Do not invent values from search snippets alone; inspect result pages before using facts.",
        "Every non-null filled field must be supported by evidence with a source URL or by details.sourceSummary naming the source URL.",
        "If browser search is unavailable or no reliable source is found, leave the field empty and add the search query plus source gap to needsReview.",
      ]
    : [];
  const rekognitionBlock = buildHumidorEnrichmentRekognitionPromptEvidence(rekognition);

  return [
    "Locate missing reference data for this member humidor cigar and return only strict JSON.",
    "Do not overwrite member-entered values. Fill only the requested missing groups: info, image, and/or MSRP.",
    "Use this top-level schema exactly: brand, line, vitola, wrapper, origin, strength, tastingNotes, estimatedValue, estimatedValueCurrency, estimatedValueSource, cigarImage, confidence, evidence, needsReview, details.",
    "cigarImage must be an object with imageUrl, mimeType, fileName, and source. Use only renderable Yuzu-hosted humidor image URLs, or leave imageUrl empty if no reliable renderable image is known. Do not use third-party retailer image URLs.",
    "details must be an object with this schema exactly: manufacturer, country, region, factory, size, length, ringGauge, shape, wrapper, binder, filler, blend, flavorProfile, body, finish, msrp, releaseStatus, packaging, sourceSummary, imageObservations.",
    "Set estimatedValue to the best per-cigar retail/MSRP number when known, otherwise null. Set estimatedValueCurrency to USD unless another currency is explicit.",
    "Evidence and needsReview must be arrays of short strings. Avoid health, cessation, medical, safety, or underage tobacco claims.",
    ...browserSearchBlock,
    rekognitionBlock,
    `Requested missing groups: ${requestedFields.join(", ")}`,
    `Current humidor item: ${JSON.stringify({
      name: item.name,
      brand: item.brand,
      line: item.line,
      vitola: item.vitola,
      wrapper: item.wrapper,
      origin: item.origin,
      strength: item.strength,
      estimatedValue: item.estimatedValue,
      estimatedValueCurrency: item.estimatedValueCurrency,
      estimatedValueSource: item.estimatedValueSource,
      hasImageMetadata: hasHumidorRenderableImageMetadata(item),
      tastingNotes: item.tastingNotes ? "present" : "",
    })}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function maybeAnalyzeHumidorItemImageForEnrichment(item) {
  const featureStatus = sanitizeText(process.env.FEATURE_REKOGNITION || "pending_service", 80);
  const rekognitionReady = REKOGNITION_TEXT_READY_VALUES.has(featureStatus) || REKOGNITION_LABEL_READY_VALUES.has(featureStatus);
  if (!rekognitionReady) {
    return buildSkippedRekognitionAnalysis(featureStatus);
  }

  const image = await maybeLoadHumidorItemImageForRekognition(item?.cigarImage);
  if (!image) {
    return buildSkippedRekognitionAnalysis("no_member_image");
  }

  return maybeDetectCigarImageText(image);
}

async function maybeLoadHumidorItemImageForRekognition(cigarImage) {
  const s3Image = normalizeHumidorS3Image(cigarImage);
  if (s3Image) {
    try {
      const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
      const client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
      const result = await client.send(
        new GetObjectCommand({
          Bucket: s3Image.s3Bucket,
          Key: s3Image.s3Key,
        })
      );
      const bytes = await readAwsSdkBodyAsBuffer(result.Body);
      return normalizeHumidorImageBytesForRekognition(bytes, s3Image.mimeType, s3Image.fileName);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "warn",
          event: "humidor_enrichment_rekognition_image_load_failed",
          name: error instanceof Error ? error.name : null,
          message: error instanceof Error ? error.message : String(error),
        })
      );

      return null;
    }
  }

  const attachment = normalizeHumidorCigarImageAttachment(cigarImage).value;
  if (!attachment?.dataUrl) {
    return null;
  }

  const parsed = parseImageDataUrl(attachment.dataUrl);
  if (!parsed.base64) {
    return null;
  }

  return normalizeHumidorImageBytesForRekognition(Buffer.from(parsed.base64, "base64"), attachment.mimeType, attachment.fileName);
}

function normalizeHumidorImageBytesForRekognition(bytes, mimeType, fileName) {
  const normalizedMimeType = sanitizeText(mimeType, 80).toLowerCase().split(";", 1)[0];
  const format = CIGAR_IMAGE_MIME_FORMATS.get(normalizedMimeType);
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);

  if (!format || !buffer.length || buffer.length > MAX_CIGAR_IMAGE_BYTES) {
    return null;
  }

  return {
    bytes: buffer,
    format,
    mimeType: normalizedMimeType,
    fileName: sanitizeText(fileName, 180),
  };
}

function buildSkippedRekognitionAnalysis(status) {
  const normalizedStatus = sanitizeText(status || "not_run", 80);
  return {
    status: normalizedStatus,
    minConfidence: normalizeRekognitionMinTextConfidence(process.env.REKOGNITION_MIN_TEXT_CONFIDENCE),
    textLines: [],
    labelStatus: normalizedStatus,
    minLabelConfidence: normalizeRekognitionMinLabelConfidence(process.env.REKOGNITION_MIN_LABEL_CONFIDENCE),
    labels: [],
  };
}

function buildHumidorEnrichmentRekognitionPromptEvidence(rekognition) {
  const evidence = buildRekognitionPromptEvidence(rekognition);
  if (!evidence) {
    return "";
  }

  return [
    "Saved member image Rekognition evidence from the current humidor item's cigar photo:",
    evidence,
    "Use saved-image text and visual labels to improve brand, line, vitola, wrapper, origin, strength, and image-review notes. Do not overwrite member-entered fields, and do not infer brand, line, vitola, MSRP, or product-image URLs from generic labels alone.",
  ].join("\n");
}

function getRekognitionSearchTerms(rekognition) {
  const terms = [];
  const addTerm = (value, maxLength = 120) => {
    const term = sanitizeText(value, maxLength);
    const normalized = term.toLowerCase();
    if (term && !terms.some((existing) => existing.toLowerCase() === normalized)) {
      terms.push(term);
    }
  };

  for (const line of Array.isArray(rekognition?.textLines) ? rekognition.textLines : []) {
    addTerm(line.text, 180);
    if (terms.length >= 3) {
      break;
    }
  }

  for (const label of Array.isArray(rekognition?.labels) ? rekognition.labels : []) {
    addTerm(label.name, 80);
    if (terms.length >= 5) {
      break;
    }
  }

  return terms;
}

async function handleHumidorItems(event, actor, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      items: [],
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-humidor-items", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const result = await client.query(
      `
        select
          id,
          name,
          brand,
          line,
          vitola,
          wrapper,
          origin,
          strength,
          quantity,
          rating,
          purchase_date,
          aging_start_date,
          reorder_reminder,
          humidor_location,
          tray,
          tasting_notes,
          source,
          metadata,
          created_at
        from public.humidor_items
        where member_id = $1 and archived_at is null
        order by created_at desc
        limit 100
      `,
      [member.id]
    );

    const items = [];
    for (const row of result.rows) {
      items.push(await mapHumidorItemRowForClient(client, row, member.id, actor, requestId));
    }

    return json(200, requestId, {
      items,
      persistence: "stored",
    });
  });
}

async function handleHumidorSmokeLogs(event, actor, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      logs: [],
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-humidor-smoke-logs", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const result = await client.query(
      `
        /* smoke_log_recent_list */
        select
          sl.id,
          sl.humidor_item_id,
          sl.cigar_name,
          sl.smoked_at,
          sl.rating,
          sl.pairing,
          sl.notes,
          sl.duration_minutes,
          sl.metadata,
          sl.created_at
        from public.smoke_logs sl
        left join public.humidor_items hi on hi.id = sl.humidor_item_id and hi.member_id = sl.member_id
        where sl.member_id = $1
        order by sl.smoked_at desc, sl.created_at desc
        limit 50
      `,
      [member.id]
    );

    return json(200, requestId, {
      logs: result.rows.map(mapHumidorSmokeLogRow),
      persistence: "stored",
    });
  });
}

async function handleHumidorAlertPreferences(event, actor, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return json(200, requestId, {
      preferences: DEFAULT_HUMIDOR_ALERT_PREFERENCES,
      persistence: getDatabasePersistenceStatus(),
    });
  }

  return withDatabaseClient("ycc-api-humidor-alerts-read", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const result = await client.query(
      "select preferences from public.member_profiles where member_id = $1",
      [member.id]
    );

    const row = result.rows[0];
    const savedPreferences = row?.preferences || {};
    const preferences = normalizeHumidorAlertPreferences(savedPreferences);

    return json(200, requestId, {
      preferences,
      persistence: "stored",
    });
  });
}

async function handleHumidorAlertPreferencesUpdate(event, actor, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return json(202, requestId, {
      preferences: DEFAULT_HUMIDOR_ALERT_PREFERENCES,
      persistence: getDatabasePersistenceStatus(),
    });
  }

  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const settings = normalizeHumidorAlertPreferencesInput(body.value);
  if (settings.pushEnabled && !settings.pushSubscription) {
    return json(400, requestId, {
      error: "missing_push_subscription",
      message: "Push subscription details are required when push alerts are enabled.",
    });
  }

  return withDatabaseTransaction("ycc-api-humidor-alerts-write", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const preferences = await upsertHumidorAlertPreferences(client, actor, requestId, member.id, settings);

    await insertAuditLog(client, event, {
      action: "humidor_alert_preferences.updated",
      actor,
      afterData: {
        pushEnabled: preferences.pushEnabled,
        reorderRemindersEnabled: preferences.reorderRemindersEnabled,
        climateAlertsEnabled: preferences.climateAlertsEnabled,
        hasPushSubscription: Boolean(preferences.pushSubscription),
        defaultHumidorLocation: preferences.humidorProfile.defaultLocation,
      },
      memberId: member.id,
      requestId,
      resourceId: member.id,
      resourceType: "member_profile",
    });

    return json(200, requestId, {
      preferences,
      persistence: "stored",
    });
  });
}

function buildHumidorDispatchActor() {
  return {
    sub: HUMIDOR_DISPATCH_ACTOR_SUB,
    email: "system@yuzucigarclub.com",
    emailVerified: true,
    name: "Yuzu Digital Humidor Dispatcher",
    username: "humidor-dispatch",
    groups: [],
    membershipTier: null,
    memberStatus: null,
    stripeCustomerId: null,
  };
}

function buildHumidorReorderReminderPayload(group, dispatchDate) {
  const itemCount = group.items.length;
  const preview = group.items
    .slice(0, 2)
    .map((item) => item.name)
    .filter(Boolean)
    .join(", ");

  return {
    title: itemCount === 1 ? "Humidor reorder reminder" : "Humidor reorder reminders",
    body:
      itemCount === 1
        ? `${preview} is due for reorder review as of ${dispatchDate}.`
        : `${preview}${itemCount > 2 ? ` and ${itemCount - 2} more` : ""} are due for reorder reminders as of ${dispatchDate}.`,
    data: {
      tag: HUMIDOR_ALERT_DISPATCH_NOTIFICATION_TAG,
      url: "/humidor?section=alerts",
    },
  };
}

function buildHumidorItemDisplayName(row) {
  const brand = sanitizeText(row.brand || "", 120);
  const line = sanitizeText(row.line || "", 120);
  const vitola = sanitizeText(row.vitola || "", 120);
  const fallback = sanitizeText(row.name || "", 200);

  return [brand, line, vitola].filter(Boolean).join(" ") || fallback || "Unnamed cigar";
}

function isValidDispatchSecret(providedSecret, expectedSecret) {
  const supplied = Buffer.from(String(providedSecret || ""), "utf8");
  const expected = Buffer.from(String(expectedSecret || ""), "utf8");

  if (!supplied.length || !expected.length || supplied.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(supplied, expected);
}

function createCheckoutStatusToken() {
  return `${CHECKOUT_STATUS_TOKEN_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
}

function isValidCheckoutStatusToken(suppliedToken, expectedToken) {
  const supplied = sanitizeText(suppliedToken, 120);
  const expected = sanitizeText(expectedToken, 120);

  if (!supplied || !expected || !supplied.startsWith(CHECKOUT_STATUS_TOKEN_PREFIX) || !expected.startsWith(CHECKOUT_STATUS_TOKEN_PREFIX)) {
    return false;
  }

  const suppliedBuffer = Buffer.from(supplied, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (suppliedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

async function markHumidorReminderDispatched(client, itemId, dispatchDate, requestId) {
  const result = await client.query(
    `
      update public.humidor_items
      set metadata = coalesce(metadata, '{}'::jsonb) || $1::jsonb,
          updated_at = now()
      where id = $2
      returning id, metadata
    `,
    [
      JSON.stringify({
        [HUMIDOR_REORDER_REMINDER_DISPATCH_MARKER]: dispatchDate,
      }),
      itemId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Humidor reminder dispatch marker update failed for item ${itemId}.`);
  }

  return {
    id: row.id,
    metadata: row.metadata,
    requestId,
  };
}

async function handlePhase3Migration(event, requestId) {
  if (event.action === "verify_phase3_schema") {
    return verifyPhase3Schema(requestId);
  }

  if (event.action === "verify_site_content_schema") {
    return verifySiteContentSchema(requestId);
  }

  if (event.action === "verify_commerce_schema") {
    return verifyCommerceSchema(requestId);
  }

  if (event.action === "apply_commerce_schema") {
    return applyCommerceSchema(event, requestId);
  }

  if (event.action === "apply_site_content_schema") {
    return applySiteContentSchema(event, requestId);
  }

  if (event.action === "verify_newsroom_schema") {
    return verifyNewsroomSchema(requestId);
  }

  if (event.action === "apply_newsroom_schema") {
    return applyNewsroomSchema(event, requestId);
  }

  if (event.action === "verify_member_stripe_customer_link_schema") {
    return verifyMemberStripeCustomerLinkSchema(requestId);
  }

  if (event.action === "apply_member_stripe_customer_link_schema") {
    return applyMemberStripeCustomerLinkSchema(event, requestId);
  }

  if (event.action !== "apply_phase3_schema") {
    return json(400, requestId, {
      error: "invalid_migration_action",
      message: "Use apply_phase3_schema, verify_phase3_schema, apply_commerce_schema, verify_commerce_schema, apply_site_content_schema, verify_site_content_schema, apply_newsroom_schema, verify_newsroom_schema, apply_member_stripe_customer_link_schema, or verify_member_stripe_customer_link_schema.",
    });
  }

  if (event.confirm !== "APPLY_YCC_PHASE3_SCHEMA") {
    return json(403, requestId, {
      error: "migration_confirmation_required",
      message: "Direct migration invokes must include the Phase 3 confirmation token.",
    });
  }

  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  await ensureDatabaseExists(databaseName, secret);

  const sql = await readMigrationSql("0001_phase3_app_schema.sql");
  const client = createPgClient(databaseName, secret, "ycc-phase3-migration");

  await client.connect();
  try {
    await client.query("set statement_timeout = '45s'");
    await client.query(sql);
  } finally {
    await client.end();
  }

  const verification = await collectPhase3Verification(databaseName, secret);

  return json(200, requestId, {
    status: "applied",
    database: databaseName,
    migration: "0001_phase3_app_schema",
    ...verification,
  });
}

async function verifyPhase3Schema(requestId) {
  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  const verification = await collectPhase3Verification(databaseName, secret);

  return json(200, requestId, {
    status: "verified",
    database: databaseName,
    migration: "0001_phase3_app_schema",
    ...verification,
  });
}

async function applyCommerceSchema(event, requestId) {
  if (event.confirm !== COMMERCE_MIGRATION_CONFIRM) {
    return json(403, requestId, {
      error: "migration_confirmation_required",
      message: "Direct migration invokes must include the commerce confirmation token.",
    });
  }

  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  await ensureDatabaseExists(databaseName, secret);

  const sql = await readMigrationSql("0002_commerce_schema.sql");
  const client = createPgClient(databaseName, secret, "ycc-commerce-migration");

  await client.connect();
  try {
    await client.query("set statement_timeout = '45s'");
    await client.query(sql);
  } finally {
    await client.end();
  }

  const verification = await collectCommerceVerification(databaseName, secret);

  return json(200, requestId, {
    status: "applied",
    database: databaseName,
    migration: "0002_commerce_schema",
    ...verification,
  });
}

async function verifyCommerceSchema(requestId) {
  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  const verification = await collectCommerceVerification(databaseName, secret);

  return json(200, requestId, {
    status: "verified",
    database: databaseName,
    migration: "0002_commerce_schema",
    ...verification,
  });
}

async function applySiteContentSchema(event, requestId) {
  if (event.confirm !== SITE_CONTENT_MIGRATION_CONFIRM) {
    return json(403, requestId, {
      error: "migration_confirmation_required",
      message: "Direct migration invokes must include the site content confirmation token.",
    });
  }

  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  await ensureDatabaseExists(databaseName, secret);

  const sql = await readMigrationSql("0003_site_content_schema.sql");
  const client = createPgClient(databaseName, secret, "ycc-site-content-migration");

  await client.connect();
  try {
    await client.query("set statement_timeout = '45s'");
    await client.query(sql);
  } finally {
    await client.end();
  }

  const verification = await collectSiteContentVerification(databaseName, secret);

  return json(200, requestId, {
    status: "applied",
    database: databaseName,
    migration: "0003_site_content_schema",
    ...verification,
  });
}

async function verifySiteContentSchema(requestId) {
  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  const verification = await collectSiteContentVerification(databaseName, secret);

  return json(200, requestId, {
    status: "verified",
    database: databaseName,
    migration: "0003_site_content_schema",
    ...verification,
  });
}

async function applyNewsroomSchema(event, requestId) {
  if (event.confirm !== NEWSROOM_MIGRATION_CONFIRM) {
    return json(403, requestId, {
      error: "migration_confirmation_required",
      message: "Direct migration invokes must include the newsroom confirmation token.",
    });
  }

  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  await ensureDatabaseExists(databaseName, secret);

  const sql = await readMigrationSql("0004_newsroom_schema.sql");
  const client = createPgClient(databaseName, secret, "ycc-newsroom-migration");

  await client.connect();
  try {
    await client.query("set statement_timeout = '45s'");
    await client.query(sql);
  } finally {
    await client.end();
  }

  const verification = await collectNewsroomVerification(databaseName, secret);

  return json(200, requestId, {
    status: "applied",
    database: databaseName,
    migration: "0004_newsroom_schema",
    ...verification,
  });
}

async function verifyNewsroomSchema(requestId) {
  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  const verification = await collectNewsroomVerification(databaseName, secret);

  return json(200, requestId, {
    status: "verified",
    database: databaseName,
    migration: "0004_newsroom_schema",
    ...verification,
  });
}

async function applyMemberStripeCustomerLinkSchema(event, requestId) {
  if (event.confirm !== MEMBER_STRIPE_CUSTOMER_LINK_MIGRATION_CONFIRM) {
    return json(403, requestId, {
      error: "migration_confirmation_required",
      message: "Direct migration invokes must include the member Stripe customer link confirmation token.",
    });
  }

  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  await ensureDatabaseExists(databaseName, secret);

  const sql = await readMigrationSql("0005_member_stripe_customer_link.sql");
  const client = createPgClient(databaseName, secret, "ycc-member-stripe-link-migration");

  await client.connect();
  try {
    await client.query("set statement_timeout = '45s'");
    await client.query(sql);
  } finally {
    await client.end();
  }

  const verification = await collectMemberStripeCustomerLinkVerification(databaseName, secret);

  return json(200, requestId, {
    status: "applied",
    database: databaseName,
    migration: "0005_member_stripe_customer_link",
    ...verification,
  });
}

async function verifyMemberStripeCustomerLinkSchema(requestId) {
  const secret = await getDatabaseSecret();
  const databaseName = getDatabaseName();
  const verification = await collectMemberStripeCustomerLinkVerification(databaseName, secret);

  return json(200, requestId, {
    status: "verified",
    database: databaseName,
    migration: "0005_member_stripe_customer_link",
    ...verification,
  });
}

async function readMigrationSql(fileName) {
  const candidates = [
    path.join(__dirname, "migrations", fileName),
    path.join(__dirname, "..", "..", "database", "migrations", fileName),
  ];

  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf8");
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error(`Migration file not found: ${fileName}`);
}

async function collectCommerceVerification(databaseName, secret) {
  const expectedTables = getCommerceTables();
  const client = createPgClient(databaseName, secret, "ycc-commerce-verify");

  await client.connect();
  try {
    const tableResult = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
        order by table_name
      `,
      [expectedTables]
    );
    const migrationResult = await client.query(
      `
        select version, name, applied_at
        from public.schema_migrations
        where version = '0002'
      `
    );
    const indexResult = await client.query(
      `
        select count(*)::int as index_count
        from pg_indexes
        where schemaname = 'public'
          and (
            indexname like 'commerce_%'
            or indexname like 'member_subscriptions_%'
            or indexname like 'stripe_events_%'
          )
      `
    );

    const tables = tableResult.rows.map((row) => row.table_name);
    const missingTables = expectedTables.filter((table) => !tables.includes(table));

    return {
      tables,
      missingTables,
      tableCount: tables.length,
      indexCount: indexResult.rows[0]?.index_count || 0,
      migrationRow: migrationResult.rows[0] || null,
    };
  } finally {
    await client.end();
  }
}

async function collectSiteContentVerification(databaseName, secret) {
  const client = createPgClient(databaseName, secret, "ycc-site-content-verify");

  await client.connect();
  try {
    const tableResult = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'site_page_content'
      `
    );
    const migrationResult = await client.query(
      `
        select version, name, applied_at
        from public.schema_migrations
        where version = '0003'
      `
    );
    const indexResult = await client.query(
      `
        select count(*)::int as index_count
        from pg_indexes
        where schemaname = 'public'
          and indexname like 'site_page_%'
      `
    );

    const tables = tableResult.rows.map((row) => row.table_name);

    return {
      tables,
      missingTables: tables.includes("site_page_content") ? [] : ["site_page_content"],
      tableCount: tables.length,
      indexCount: indexResult.rows[0]?.index_count || 0,
      migrationRow: migrationResult.rows[0] || null,
    };
  } finally {
    await client.end();
  }
}

async function collectNewsroomVerification(databaseName, secret) {
  const client = createPgClient(databaseName, secret, "ycc-newsroom-verify");

  await client.connect();
  try {
    const tableResult = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'news_stories'
      `
    );
    const migrationResult = await client.query(
      `
        select version, name, applied_at
        from public.schema_migrations
        where version = '0004'
      `
    );
    const indexResult = await client.query(
      `
        select count(*)::int as index_count
        from pg_indexes
        where schemaname = 'public'
          and indexname like 'news_stories_%'
      `
    );
    const tables = tableResult.rows.map((row) => row.table_name);

    return {
      tables,
      missingTables: tables.includes("news_stories") ? [] : ["news_stories"],
      tableCount: tables.length,
      indexCount: indexResult.rows[0]?.index_count || 0,
      migrationRow: migrationResult.rows[0] || null,
    };
  } finally {
    await client.end();
  }
}

async function collectMemberStripeCustomerLinkVerification(databaseName, secret) {
  const client = createPgClient(databaseName, secret, "ycc-member-stripe-link-verify");

  await client.connect();
  try {
    const columnResult = await client.query(
      `
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'members'
          and column_name = 'stripe_customer_id'
      `
    );
    const migrationResult = await client.query(
      `
        select version, name, applied_at
        from public.schema_migrations
        where version = '0005'
      `
    );
    const indexResult = await client.query(
      `
        select count(*)::int as index_count
        from pg_indexes
        where schemaname = 'public'
          and indexname = 'members_stripe_customer_id_uidx'
      `
    );
    const linkedResult = await client.query(
      `
        select count(*)::int as linked_member_count
        from public.members
        where stripe_customer_id is not null
      `
    );
    const columns = columnResult.rows.map((row) => row.column_name);

    return {
      columns,
      missingColumns: columns.includes("stripe_customer_id") ? [] : ["stripe_customer_id"],
      indexCount: indexResult.rows[0]?.index_count || 0,
      linkedMemberCount: linkedResult.rows[0]?.linked_member_count || 0,
      migrationRow: migrationResult.rows[0] || null,
    };
  } finally {
    await client.end();
  }
}

async function collectPhase3Verification(databaseName, secret) {
  const expectedTables = getPhase3Tables();
  const client = createPgClient(databaseName, secret, "ycc-phase3-verify");

  await client.connect();
  try {
    const tableResult = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
        order by table_name
      `,
      [expectedTables]
    );
    const migrationResult = await client.query(
      `
        select version, name, applied_at
        from public.schema_migrations
        where version = '0001'
      `
    );
    const indexResult = await client.query(
      `
        select count(*)::int as index_count
        from pg_indexes
        where schemaname = 'public'
          and (
            indexname like 'members_%'
            or indexname like 'conversations_%'
            or indexname like 'conversation_messages_%'
            or indexname like 'support_%'
            or indexname like 'humidor_%'
            or indexname like 'smoke_%'
            or indexname like 'site_page_%'
            or indexname like 'audit_%'
            or indexname like 'provider_%'
          )
      `
    );

    const tables = tableResult.rows.map((row) => row.table_name);
    const missingTables = expectedTables.filter((table) => !tables.includes(table));

    return {
      tables,
      missingTables,
      tableCount: tables.length,
      indexCount: indexResult.rows[0]?.index_count || 0,
      migrationRow: migrationResult.rows[0] || null,
    };
  } finally {
    await client.end();
  }
}

async function ensureDatabaseExists(databaseName, secret) {
  if (databaseName === "postgres") {
    return;
  }

  const adminClient = createPgClient("postgres", secret, "ycc-phase3-db-bootstrap");
  await adminClient.connect();
  try {
    const result = await adminClient.query("select 1 from pg_database where datname = $1", [databaseName]);
    if (result.rowCount > 0) {
      return;
    }

    await adminClient.query(`create database ${quoteIdentifier(databaseName)} owner ${quoteIdentifier(secret.username)}`);
  } finally {
    await adminClient.end();
  }
}

async function getDatabaseSecret() {
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error("DB_SECRET_ARN is not configured.");
  }

  const parsed = await readJsonSecretFromSecretsManager(secretArn, "Database");
  if (!parsed.username || !parsed.password) {
    throw new Error("Database secret must include username and password.");
  }

  return {
    username: String(parsed.username),
    password: String(parsed.password),
  };
}

async function getCommerceRuntimeEnv() {
  const secretId = getCommerceSecretId();
  if (!secretId) {
    return process.env;
  }

  const nowMs = Date.now();
  if (
    !commerceRuntimeSecretCache ||
    commerceRuntimeSecretCache.secretId !== secretId ||
    commerceRuntimeSecretCache.expiresAtMs <= nowMs
  ) {
    const parsed = await readJsonSecretFromSecretsManager(secretId, "Commerce provider");
    const values = normalizeCommerceProviderSecret(parsed);
    if (values.STRIPE_LAUNCH_CATALOG_S3_URI && !values.STRIPE_LAUNCH_CATALOG_JSON) {
      values.STRIPE_LAUNCH_CATALOG_JSON = await readS3TextObject(values.STRIPE_LAUNCH_CATALOG_S3_URI);
    }

    commerceRuntimeSecretCache = {
      expiresAtMs: nowMs + COMMERCE_RUNTIME_SECRET_CACHE_TTL_MS,
      secretId,
      values,
    };
  }

  return {
    ...process.env,
    ...commerceRuntimeSecretCache.values,
  };
}

function getCommerceSecretId() {
  for (const key of COMMERCE_SECRET_ENV_KEYS) {
    const value = sanitizeText(process.env[key], 400);
    if (value) {
      return value;
    }
  }

  return "";
}

async function readJsonSecretFromSecretsManager(secretId, description) {
  const { GetSecretValueCommand, SecretsManagerClient } = require("@aws-sdk/client-secrets-manager");
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const rawSecret = result.SecretString || (result.SecretBinary ? Buffer.from(result.SecretBinary).toString("utf8") : "{}");

  try {
    const parsed = JSON.parse(rawSecret || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("secret_json_object_required");
    }

    return parsed;
  } catch (error) {
    const wrapped = new Error(`${description} secret must be valid JSON.`);
    wrapped.cause = error;
    throw wrapped;
  }
}

function normalizeCommerceProviderSecret(secret) {
  const env = {};
  const source = asPlainObject(secret);
  if (!source) {
    return env;
  }

  copyFlatCommerceSecretEnv(source, env);

  const providers = asPlainObject(source.providers) || {};
  const stripe = asPlainObject(firstDefined(source.stripe, source.Stripe, providers.stripe, providers.Stripe)) || {};
  const ageVerification =
    asPlainObject(firstDefined(source.ageVerification, source.age_verification, source.age, providers.ageVerification, providers.age_verification, providers.age)) ||
    {};
  const tax = asPlainObject(firstDefined(source.tax, source.stripeTax, source.stripe_tax, providers.tax, providers.stripeTax, providers.stripe_tax)) || {};
  const shipping = asPlainObject(firstDefined(source.shipping, providers.shipping)) || {};
  const membership = asPlainObject(firstDefined(source.membership, source.entitlements, providers.membership)) || {};

  putSecretEnv(env, "STRIPE_SECRET_KEY", firstDefined(stripe.secretKey, stripe.secret_key, stripe.apiKey, stripe.api_key));
  putSecretEnv(env, "STRIPE_WEBHOOK_SECRET", firstDefined(stripe.webhookSecret, stripe.webhook_secret, stripe.signingSecret, stripe.signing_secret));
  putSecretEnv(env, "STRIPE_API_VERSION", firstDefined(stripe.apiVersion, stripe.api_version));
  putSecretEnv(
    env,
    "STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID",
    firstDefined(stripe.customerPortalConfigurationId, stripe.customer_portal_configuration_id, stripe.portalConfigurationId)
  );
  putSecretFlagEnv(env, "STRIPE_LAUNCH_CATALOG_READY", firstDefined(stripe.launchCatalogReady, stripe.launch_catalog_ready, stripe.catalogReady));
  putSecretFlagEnv(
    env,
    "STRIPE_TOBACCO_APPROVAL_CONFIRMED",
    firstDefined(
      stripe.tobaccoApprovalConfirmed,
      stripe.tobacco_approval_confirmed,
      stripe.approvalConfirmed,
      stripe.approval_confirmed,
      source.stripeTobaccoApprovalConfirmed,
      source.stripe_tobacco_approval_confirmed
    )
  );
  putSecretEnv(env, "STRIPE_LAUNCH_CATALOG_PATH", firstDefined(stripe.launchCatalogPath, stripe.launch_catalog_path));
  putSecretEnv(env, "STRIPE_LAUNCH_CATALOG_S3_URI", firstDefined(stripe.launchCatalogS3Uri, stripe.launch_catalog_s3_uri, stripe.catalogS3Uri));
  putSecretJsonEnv(
    env,
    "STRIPE_LAUNCH_CATALOG_JSON",
    firstDefined(stripe.launchCatalogJson, stripe.launch_catalog_json, stripe.launchCatalog, stripe.launch_catalog, stripe.catalog, stripe.products)
  );
  mergeStripePriceIds(env, firstDefined(stripe.priceIds, stripe.price_ids, stripe.prices, source.stripePriceIds, source.stripe_price_ids));

  putSecretEnv(env, "AGE_VERIFICATION_VENDOR", firstDefined(ageVerification.vendor, ageVerification.provider, source.ageVerificationVendor));
  const ageVerificationAccountSecret = firstDefined(
    ageVerification.accountSecret,
    ageVerification.account_secret,
    ageVerification.secret,
    ageVerification.apiSecret,
    ageVerification.api_secret
  );
  putSecretEnv(env, "AGE_VERIFICATION_API_KEY", firstDefined(ageVerification.apiKey, ageVerification.api_key));
  putSecretEnv(env, "AGE_VERIFICATION_API_SECRET", ageVerificationAccountSecret);
  putSecretEnv(env, "AGE_VERIFICATION_ACCOUNT_SECRET", firstDefined(ageVerification.accountSecret, ageVerification.account_secret));
  putSecretEnv(env, "AGE_VERIFICATION_CLIENT_ID", firstDefined(ageVerification.clientId, ageVerification.client_id));
  putSecretEnv(env, "AGE_VERIFICATION_CLIENT_SECRET", firstDefined(ageVerification.clientSecret, ageVerification.client_secret));
  putSecretEnv(env, "AGE_VERIFICATION_BASE_URL", firstDefined(ageVerification.baseUrl, ageVerification.base_url));
  putSecretEnv(env, "AGE_VERIFICATION_WEBHOOK_SECRET", firstDefined(ageVerification.webhookSecret, ageVerification.webhook_secret));
  putSecretEnv(env, "AGE_VERIFICATION_SIGNING_SECRET", firstDefined(ageVerification.signingSecret, ageVerification.signing_secret, ageVerificationAccountSecret));

  putSecretEnv(env, "TAX_PROVIDER", firstDefined(tax.provider, source.taxProvider));
  putSecretEnv(env, "TAX_API_KEY", firstDefined(tax.apiKey, tax.api_key));
  putSecretEnv(env, "TAX_API_SECRET", firstDefined(tax.apiSecret, tax.api_secret));
  putSecretEnv(env, "TAX_CLIENT_ID", firstDefined(tax.clientId, tax.client_id));
  putSecretEnv(env, "TAX_CLIENT_SECRET", firstDefined(tax.clientSecret, tax.client_secret));
  putSecretEnv(env, "TAX_ACCOUNT_ID", firstDefined(tax.accountId, tax.account_id));
  putSecretEnv(env, "TAX_BASE_URL", firstDefined(tax.baseUrl, tax.base_url));
  putSecretEnv(env, "TAX_WEBHOOK_SECRET", firstDefined(tax.webhookSecret, tax.webhook_secret));
  putSecretTaxStatus(env, firstDefined(tax.status, tax.ready, tax.featureStripeTax, source.featureStripeTax));

  putSecretEnv(env, "SHIPPING_PROVIDER", firstDefined(shipping.provider, source.shippingProvider));
  putSecretEnv(env, "SHIPPING_API_KEY", firstDefined(shipping.apiKey, shipping.api_key));
  putSecretEnv(env, "SHIPPING_API_SECRET", firstDefined(shipping.apiSecret, shipping.api_secret));
  putSecretEnv(env, "SHIPPING_CLIENT_ID", firstDefined(shipping.clientId, shipping.client_id));
  putSecretEnv(env, "SHIPPING_CLIENT_SECRET", firstDefined(shipping.clientSecret, shipping.client_secret));
  putSecretEnv(env, "SHIPPING_ACCOUNT_ID", firstDefined(shipping.accountId, shipping.account_id));
  putSecretEnv(
    env,
    "SHIPPING_ADULT_SIGNATURE_ACCOUNT_ID",
    firstDefined(shipping.adultSignatureAccountId, shipping.adult_signature_account_id)
  );
  putSecretEnv(env, "SHIPPING_BASE_URL", firstDefined(shipping.baseUrl, shipping.base_url));

  putSecretEnv(
    env,
    "MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET",
    firstDefined(membership.entitlementSigningSecret, membership.entitlement_signing_secret, membership.signingSecret, membership.signing_secret)
  );

  return env;
}

function copyFlatCommerceSecretEnv(source, env) {
  for (const [key, value] of Object.entries(source)) {
    const envKey = String(key).trim().toUpperCase();
    if (!COMMERCE_SECRET_FLAT_KEY_PATTERNS.some((pattern) => pattern.test(envKey))) {
      continue;
    }

    if (envKey === "STRIPE_LAUNCH_CATALOG_READY") {
      putSecretFlagEnv(env, envKey, value);
    } else if (envKey === "FEATURE_STRIPE_TAX") {
      putSecretTaxStatus(env, value);
    } else if (envKey === "STRIPE_LAUNCH_CATALOG_JSON") {
      putSecretJsonEnv(env, envKey, value);
    } else {
      putSecretEnv(env, envKey, value);
    }
  }
}

function mergeStripePriceIds(env, priceIds) {
  const prices = asPlainObject(priceIds);
  if (!prices) {
    return;
  }

  for (const [rawKey, rawValue] of Object.entries(prices)) {
    const nestedPrices = asPlainObject(rawValue);
    if (nestedPrices) {
      for (const [period, priceId] of Object.entries(nestedPrices)) {
        putSecretEnv(env, `STRIPE_PRICE_${toEnvKeySegment(rawKey)}_${toEnvKeySegment(period)}`, priceId);
      }
      continue;
    }

    const normalizedKey = String(rawKey || "").trim().toUpperCase();
    const envKey = normalizedKey.startsWith("STRIPE_PRICE_") ? normalizedKey : `STRIPE_PRICE_${toEnvKeySegment(rawKey)}`;
    putSecretEnv(env, envKey, rawValue);
  }
}

function putSecretEnv(env, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  env[key] = toSecretEnvString(value);
}

function putSecretJsonEnv(env, key, value) {
  if (value === undefined || value === null || value === "") {
    return;
  }

  env[key] = typeof value === "string" ? value : JSON.stringify(value);
}

function putSecretFlagEnv(env, key, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === "boolean") {
    env[key] = value ? "1" : "";
    return;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "ready", "yes", "y"].includes(normalized)) {
    env[key] = "1";
  } else if (["", "0", "false", "no", "n", "pending", "unavailable"].includes(normalized)) {
    env[key] = "";
  } else {
    env[key] = String(value);
  }
}

function isSecretFlagEnabled(value) {
  return ["1", "true", "ready", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

function putSecretTaxStatus(env, value) {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === "boolean") {
    env.FEATURE_STRIPE_TAX = value ? "ready" : "";
    return;
  }

  const normalized = String(value).trim().toLowerCase();
  env.FEATURE_STRIPE_TAX = ["1", "true", "yes", "ready"].includes(normalized) ? "ready" : String(value);
}

function toSecretEnvString(value) {
  if (typeof value === "boolean") {
    return value ? "1" : "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (Array.isArray(value) || (value && typeof value === "object")) {
    return JSON.stringify(value);
  }

  return String(value);
}

function toEnvKeySegment(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function readS3TextObject(s3Uri) {
  const parsed = parseS3Uri(s3Uri);
  if (!parsed) {
    throw new Error("STRIPE_LAUNCH_CATALOG_S3_URI must be an s3://bucket/key URI.");
  }

  const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
  const client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  const result = await client.send(new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
  return streamToString(result.Body);
}

function parseS3Uri(value) {
  const uri = sanitizeText(value, 1200);
  const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(uri);
  if (!match) {
    return null;
  }

  return {
    bucket: match[1],
    key: match[2],
  };
}

async function streamToString(body) {
  if (!body) {
    return "";
  }

  if (typeof body.transformToString === "function") {
    return body.transformToString("utf8");
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

function createPgClient(databaseName, secret, applicationName) {
  const { Client } = require("pg");

  return new Client({
    application_name: applicationName,
    connectionTimeoutMillis: 8000,
    database: databaseName,
    host: requireEnv("DB_PROXY_ENDPOINT"),
    password: secret.password,
    port: Number(process.env.DB_PORT || "5432"),
    ssl: getPgSslConfig(),
    user: secret.username,
  });
}

function getPgSslConfig() {
  const readiness = getPgSslReadiness();
  const sslMode = readiness.mode;
  if (sslMode === "disable") {
    return false;
  }

  const sslConfig = {
    rejectUnauthorized: sslMode !== "require",
  };
  const rootCertPath = getPgSslRootCertPath();

  if (rootCertPath) {
    if (!readiness.rootCertReadable) {
      const error = new Error(`Configured PostgreSQL SSL root certificate is not readable: ${rootCertPath}`);
      error.code = "db_ssl_root_cert_missing";
      throw error;
    }

    sslConfig.ca = tls.rootCertificates.concat(fsSync.readFileSync(resolveLambdaPath(rootCertPath), "utf8"));
  }

  return sslConfig;
}

function getPgSslReadiness() {
  const sslMode = (process.env.DB_SSLMODE || process.env.RDS_SSLMODE || "verify-full").toLowerCase();
  const rootCertPath = getPgSslRootCertPath();
  const rootCertReadable = rootCertPath ? fsSync.existsSync(resolveLambdaPath(rootCertPath)) : null;

  return {
    mode: sslMode,
    rootCertConfigured: Boolean(rootCertPath),
    rootCertReadable,
    ready: sslMode === "disable" || !rootCertPath || rootCertReadable === true,
  };
}

function getPgSslRootCertPath() {
  return process.env.DB_SSLROOTCERT || process.env.RDS_SSLROOTCERT || process.env.PGSSLROOTCERT || "";
}

function resolveLambdaPath(value) {
  return path.isAbsolute(value) ? value : path.join(__dirname, value);
}

function getDatabaseName() {
  const databaseName = process.env.DB_NAME || "postgres";
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(databaseName)) {
    throw new Error(`Invalid DB_NAME: ${databaseName}`);
  }

  return databaseName;
}

function quoteIdentifier(value) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

function getPhase3Tables() {
  return [
    "schema_migrations",
    "members",
    "member_profiles",
    "conversations",
    "conversation_messages",
    "support_cases",
    "support_email_messages",
    "newsletter_subscribers",
    "humidor_items",
    "smoke_logs",
    "site_page_content",
    "audit_log",
    "provider_connections",
  ];
}

function getCommerceTables() {
  return [
    "stripe_events",
    "commerce_orders",
    "commerce_order_items",
    "member_subscriptions",
    "commerce_compliance_holds",
    "commerce_audit_log",
  ];
}

async function maybePersistAccount(event, actor, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return {
      member: null,
      profile: null,
    };
  }

  return withDatabaseClient("ycc-api-account", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const profile = await fetchMemberProfile(client, member.id);

    return {
      member,
      profile,
    };
  });
}

async function fetchMemberProfile(client, memberId) {
  const result = await client.query(
    `
      select phone, shipping_profile
      from public.member_profiles
      where member_id = $1
      limit 1
    `,
    [memberId]
  );

  return mapMemberProfileRow(result.rows[0]);
}

function mapMemberProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    phone: sanitizeText(row.phone, 40),
    shippingAddress: normalizeAccountShippingProfile(row.shipping_profile),
  };
}

function normalizeAccountShippingProfile(value) {
  const address = normalizeCheckoutShippingAddress(value || {});
  const hasShippingDetails = Boolean(address.address1 || address.address2 || address.city || address.state || address.postalCode);

  return hasShippingDetails ? address : null;
}

async function persistAccountProfileUpdate(event, actor, requestId, profile) {
  return withDatabaseTransaction("ycc-api-account-profile", async (client) => {
    await upsertMember(client, actor, requestId);
    const normalized = normalizeActorForMember(actor);
    const metadata = JSON.stringify({
      cognitoGroups: actor.groups,
      cognitoUsername: actor.username,
      emailMissingInToken: !actor.email,
      source: "cognito-jwt",
      profileUpdate: true,
    });
    const memberResult = await client.query(
      `
        update public.members
        set cognito_sub = $2,
            email_verified = $3,
            display_name = coalesce($4, public.members.display_name),
            role = $5,
            membership_tier = $6,
            member_status = $7,
            stripe_customer_id = coalesce($8, public.members.stripe_customer_id),
            last_seen_at = now(),
            metadata = coalesce(public.members.metadata, '{}'::jsonb) || $9::jsonb,
            actor_id = $10,
            request_id = $11,
            updated_at = now()
        where lower(email) = lower($1)
        returning id, cognito_sub, email, display_name, role, membership_tier, member_status, stripe_customer_id
      `,
      [
        normalized.email,
        actor.sub,
        actor.emailVerified,
        nullable(actor.name),
        normalized.role,
        normalized.membershipTier,
        normalized.memberStatus,
        normalized.stripeCustomerId,
        metadata,
        actor.sub,
        requestId,
      ]
    );
    const memberRow = memberResult.rows[0];
    if (!memberRow) {
      throw new Error("Member profile update did not return a member row.");
    }
    const member = {
      id: memberRow.id,
      cognitoSub: memberRow.cognito_sub,
      displayName: memberRow.display_name,
      email: memberRow.email,
      memberStatus: memberRow.member_status,
      membershipTier: memberRow.membership_tier,
      role: memberRow.role,
      stripeCustomerId: memberRow.stripe_customer_id || null,
    };

    const profileResult = await client.query(
      `
        insert into public.member_profiles (
          member_id,
          phone,
          shipping_profile,
          actor_id,
          request_id
        )
        values ($1, $2, $3::jsonb, $4, $5)
        on conflict (member_id) do update
        set phone = $2,
            shipping_profile = $3::jsonb,
            actor_id = excluded.actor_id,
            request_id = excluded.request_id,
            updated_at = now()
        returning id, phone, shipping_profile
      `,
      [member.id, nullable(profile.phone), JSON.stringify(profile.shippingAddress), actor.sub, requestId]
    );
    const profileRow = profileResult.rows[0];
    const savedProfile = profileRow && ("phone" in profileRow || "shipping_profile" in profileRow) ? mapMemberProfileRow(profileRow) : null;
    const responseProfile = savedProfile || {
      phone: profile.phone,
      shippingAddress: profile.shippingAddress,
    };

    await insertAuditLog(client, event, {
      action: "account.profile.updated",
      actor,
      afterData: {
        name: actor.name,
        phone: profile.phone,
        shippingAddress: profile.shippingAddress,
      },
      memberId: member.id,
      requestId,
      resourceId: profileResult.rows[0]?.id || member.id,
      resourceType: "member_profile",
    });

    return {
      member,
      profile: {
        phone: responseProfile.phone,
        shippingAddress: responseProfile.shippingAddress || profile.shippingAddress,
      },
    };
  });
}

async function persistConciergeChat(event, actor, requestId, details) {
  return withDatabaseTransaction("ycc-api-concierge-chat", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const conversation = await upsertConversation(client, member.id, actor, requestId, details);
    const userMessage = await insertConversationMessage(client, member.id, actor, requestId, {
      conversationId: conversation.id,
      role: "user",
      content: details.message,
      metadata: {
        source: details.source || "api",
      },
    });
    const assistantMessage = await insertConversationMessage(client, member.id, actor, requestId, {
      conversationId: conversation.id,
      role: "assistant",
      content: details.reply,
      model: details.bedrock?.status === "bedrock_runtime" ? details.bedrock.modelId : null,
      metadata: {
        agent: details.agent,
        guardrailId: details.bedrock?.guardrailId || null,
        guardrailVersion: details.bedrock?.guardrailVersion || null,
        source: details.bedrock?.status || "scaffold",
      },
    });

    await insertAuditLog(client, event, {
      action: "concierge.chat.created",
      actor,
      afterData: {
        agent: details.agent,
        assistantMessageId: assistantMessage.id,
        replySource: details.bedrock?.status || "scaffold",
        userMessageId: userMessage.id,
      },
      memberId: member.id,
      requestId,
      resourceId: conversation.id,
      resourceType: "conversation",
    });

    return {
      conversationId: conversation.id,
      memberId: member.id,
      assistantMessageId: assistantMessage.id,
      userMessageId: userMessage.id,
    };
  });
}

async function persistSupportEmailDraft(event, actor, requestId, details) {
  return withDatabaseTransaction("ycc-api-support-email-draft", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const supportCase = await insertSupportCase(client, member.id, actor, requestId, details);
    const emailMessage = await insertSupportEmailMessage(client, supportCase.id, actor, requestId, details);

    await insertAuditLog(client, event, {
      action: "support.email_draft.created",
      actor,
      afterData: {
        caseNumber: supportCase.caseNumber,
        emailMessageId: emailMessage.id,
        sendStatus: "draft_only",
      },
      memberId: member.id,
      requestId,
      resourceId: supportCase.id,
      resourceType: "support_case",
    });

    return {
      caseId: supportCase.id,
      caseNumber: supportCase.caseNumber,
      emailMessageId: emailMessage.id,
      memberId: member.id,
    };
  });
}

async function persistSentSupportEmail(event, actor, requestId, details) {
  return withDatabaseTransaction("ycc-api-support-email-send", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const supportCase = await insertSupportCase(client, member.id, actor, requestId, {
      caseId: details.caseId,
      message: details.bodyText,
      subject: details.subject,
    });
    const emailMessage = await insertSentSupportEmailMessage(client, supportCase.id, actor, requestId, details);

    await insertAuditLog(client, event, {
      action: "support.email.sent",
      actor,
      afterData: {
        caseNumber: supportCase.caseNumber,
        emailMessageId: emailMessage.id,
        sesMessageId: details.sesMessageId,
      },
      memberId: member.id,
      requestId,
      resourceId: supportCase.id,
      resourceType: "support_case",
    });

    return {
      caseId: supportCase.id,
      caseNumber: supportCase.caseNumber,
      emailMessageId: emailMessage.id,
      memberId: member.id,
    };
  });
}

async function persistInboundSupportEmail(event, requestId, details) {
  const actor = {
    sub: "ses-inbound",
    email: null,
    emailVerified: false,
    name: "SES inbound email",
    username: "ses-inbound",
    groups: [],
    membershipTier: null,
    memberStatus: null,
  };

  return withDatabaseTransaction("ycc-api-support-email-inbound", async (client) => {
    const supportCase = await insertInboundSupportCase(client, requestId, details);
    const emailMessage = await insertInboundSupportEmailMessage(client, supportCase.id, requestId, details);
    const agentDraftMessage = details.agentDraft?.reply
      ? await insertInboundSupportAgentDraftMessage(client, supportCase.id, requestId, details)
      : null;

    await insertAuditLog(client, event, {
      action: "support.email.received",
      actor,
      afterData: {
        caseNumber: supportCase.caseNumber,
        emailMessageId: emailMessage.id,
        agentDraftMessageId: agentDraftMessage?.id || null,
        agentStatus: details.agentDraft?.status || null,
        sesMessageId: details.sesMessageId,
        s3RawKey: details.rawKey,
      },
      memberId: null,
      requestId,
      resourceId: supportCase.id,
      resourceType: "support_case",
    });

    return {
      caseId: supportCase.id,
      caseNumber: supportCase.caseNumber,
      emailMessageId: emailMessage.id,
      agentDraftMessageId: agentDraftMessage?.id || null,
    };
  });
}

async function persistPublicSupportContact(event, requestId, details) {
  const actor = {
    sub: "support-contact-public",
    email: details.email,
    emailVerified: false,
    name: details.name || details.email,
    username: "support-contact-public",
    groups: [],
    membershipTier: null,
    memberStatus: null,
  };
  const receivedAt = new Date().toISOString();

  return withDatabaseTransaction("ycc-api-public-support-contact", async (client) => {
    const supportCase = await insertInboundSupportCase(client, requestId, {
      bodyText: details.bodyText,
      fromAddress: details.email,
      message: details.message,
      name: details.name,
      orderNumber: details.orderNumber,
      pagePath: details.pagePath,
      rawKey: null,
      sesMessageId: details.sesMessageId,
      source: "contact_form",
      subject: details.subject,
      toAddresses: details.toAddresses,
      topic: details.topic,
      deliveryStatus: details.deliveryStatus,
    });
    const emailMessage = await insertInboundSupportEmailMessage(client, supportCase.id, requestId, {
      bodyText: details.bodyText,
      fromAddress: details.email,
      rawKey: null,
      receivedAt,
        sesMessageId: details.sesMessageId,
        source: "contact_form",
        subject: details.subject,
        toAddresses: details.toAddresses,
        deliveryStatus: details.deliveryStatus,
      });

    await insertAuditLog(client, event, {
      action: details.deliveryStatus === "sent" ? "support.contact.sent" : "support.contact.received",
      actor,
      afterData: {
        caseNumber: supportCase.caseNumber,
        deliveryStatus: details.deliveryStatus,
        email: details.email,
        emailMessageId: emailMessage.id,
        sesMessageId: details.sesMessageId,
        topic: details.topic,
      },
      memberId: null,
      requestId,
      resourceId: supportCase.id,
      resourceType: "support_case",
    });

    return {
      caseId: supportCase.id,
      caseNumber: supportCase.caseNumber,
      emailMessageId: emailMessage.id,
    };
  });
}

async function persistNewsletterSubscriber(event, requestId, details) {
  const actor = {
    sub: "newsletter-public",
    email: details.email,
    emailVerified: false,
    name: details.fullName || details.email,
    username: "newsletter-public",
    groups: [],
    membershipTier: null,
    memberStatus: null,
  };

  return withDatabaseTransaction("ycc-api-newsletter-subscribe", async (client) => {
    const subscriber = await upsertNewsletterSubscriber(client, requestId, details);

    await insertAuditLog(client, event, {
      action: "newsletter.subscriber.upserted",
      actor,
      afterData: {
        email: details.email,
        brandPreferences: details.brandPreferences,
        promotedCigarCount: details.promotedCigars.length,
        preferredTier: details.preferredTier,
        source: details.source,
        wantsMonthlyMembership: details.wantsMonthlyMembership,
      },
      memberId: null,
      requestId,
      resourceId: subscriber.id,
      resourceType: "newsletter_subscriber",
    });

    return subscriber;
  });
}

async function fetchLivePageContent(route) {
  return withDatabaseClient("ycc-api-live-page-content", async (client) => {
    const result = await client.query(
      `
        select route, edits, published_at, updated_at
        from public.site_page_content
        where route = $1
      `,
      [route]
    );

    return mapSitePageContentRow(result.rows[0], route);
  });
}

async function persistLivePageContent(event, actor, requestId, details) {
  return withDatabaseTransaction("ycc-api-live-page-publish", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const page = await upsertSitePageContent(client, member.id, actor, requestId, details);

    await insertAuditLog(client, event, {
      action: "site_page_content.published",
      actor,
      afterData: {
        fieldCount: Object.keys(details.edits).length,
        route: details.route,
      },
      memberId: member.id,
      requestId,
      resourceId: details.route,
      resourceType: "site_page_content",
    });

    return page;
  });
}

async function fetchPublishedNewsStories(limit) {
  return withDatabaseClient("ycc-api-news-stories", async (client) => {
    const result = await client.query(
      `
        select id, slug, title, dek, category, body_markdown, source_notes, official_sources, metadata, status, published_at, updated_at
        from public.news_stories
        where status = 'published'
          and published_at is not null
        order by published_at desc, updated_at desc
        limit $1
      `,
      [limit]
    );

    return result.rows.map(mapNewsStoryRow);
  });
}

async function persistNewsStory(event, actor, requestId, story) {
  return withDatabaseTransaction("ycc-api-news-story-publish", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const persistedStory = await upsertNewsStory(client, member.id, actor, requestId, story);

    await insertAuditLog(client, event, {
      action: "news_story.published",
      actor,
      afterData: {
        slug: persistedStory.slug,
        sourceCount: persistedStory.sourceNotes.length,
        status: persistedStory.status,
        title: persistedStory.title,
      },
      memberId: member.id,
      requestId,
      resourceId: persistedStory.id || persistedStory.slug,
      resourceType: "news_story",
    });

    return persistedStory;
  });
}

async function loadHumidorItemRowForMember(client, itemId, memberId) {
  const result = await client.query(
    `
      /* humidor_item_enrichment_lookup */
      select
        id,
        name,
        brand,
        line,
        vitola,
        wrapper,
        origin,
        strength,
        quantity,
        rating,
        purchase_date,
        aging_start_date,
        reorder_reminder,
        humidor_location,
        tray,
        tasting_notes,
        source,
        metadata,
        created_at
      from public.humidor_items
      where id = $1 and member_id = $2 and archived_at is null
      limit 1
    `,
    [itemId, memberId]
  );

  return result.rows[0] || null;
}

async function updateHumidorItemEnrichment(client, details) {
  const metadata = buildHumidorEnrichmentMetadata(details);
  const result = await client.query(
    `
      /* humidor_item_enrichment_update */
      update public.humidor_items
      set brand = $3,
          line = $4,
          vitola = $5,
          wrapper = $6,
          origin = $7,
          strength = $8,
          tasting_notes = $9,
          metadata = coalesce(metadata, '{}'::jsonb) || $10::jsonb,
          actor_id = $11,
          request_id = $12,
          updated_at = now()
      where id = $1 and member_id = $2 and archived_at is null
      returning
        id,
        name,
        brand,
        line,
        vitola,
        wrapper,
        origin,
        strength,
        quantity,
        rating,
        purchase_date,
        aging_start_date,
        reorder_reminder,
        humidor_location,
        tray,
        tasting_notes,
        source,
        metadata,
        created_at
    `,
    [
      details.itemId,
      details.memberId,
      nullable(details.item.brand),
      nullable(details.item.line),
      nullable(details.item.vitola),
      nullable(details.item.wrapper),
      nullable(details.item.origin),
      nullable(details.item.strength),
      nullable(details.item.tastingNotes),
      JSON.stringify(metadata),
      details.actor.sub,
      details.requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Humidor enrichment update did not return item ${details.itemId}.`);
  }

  return row;
}

async function updateHumidorItemLocation(client, details) {
  const result = await client.query(
    `
      /* humidor_item_location_update */
      update public.humidor_items
      set humidor_location = coalesce($3, humidor_location),
          tray = case when $4::boolean then $5 else tray end,
          aging_start_date = coalesce($6::date, aging_start_date),
          actor_id = $7,
          request_id = $8,
          updated_at = now()
      where id = $1 and member_id = $2 and archived_at is null
      returning
        id,
        name,
        brand,
        line,
        vitola,
        wrapper,
        origin,
        strength,
        quantity,
        rating,
        purchase_date,
        aging_start_date,
        reorder_reminder,
        humidor_location,
        tray,
        tasting_notes,
        source,
        metadata,
        created_at
    `,
    [
      details.itemId,
      details.memberId,
      nullable(details.humidorLocation),
      Boolean(details.updateTray),
      details.tray ?? "",
      nullable(details.agingStartDate),
      details.actor.sub,
      details.requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Humidor item location update did not return item ${details.itemId}.`);
  }

  return row;
}

async function archiveHumidorItem(client, details) {
  const result = await client.query(
    `
      /* humidor_item_archive */
      update public.humidor_items
      set quantity = 0,
          archived_at = now(),
          actor_id = $3,
          request_id = $4,
          updated_at = now()
      where id = $1 and member_id = $2 and archived_at is null
      returning
        id,
        name,
        brand,
        line,
        vitola,
        wrapper,
        origin,
        strength,
        quantity,
        rating,
        purchase_date,
        aging_start_date,
        reorder_reminder,
        humidor_location,
        tray,
        tasting_notes,
        source,
        metadata,
        created_at
    `,
    [details.itemId, details.memberId, details.actor.sub, details.requestId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Humidor item archive did not return item ${details.itemId}.`);
  }

  return row;
}

async function updateHumidorItemSharedQuantity(client, details) {
  const result = await client.query(
    `
      /* humidor_item_shared_update */
      update public.humidor_items
      set quantity = greatest(quantity - $3, 0),
          archived_at = case when greatest(quantity - $3, 0) = 0 then now() else archived_at end,
          actor_id = $4,
          request_id = $5,
          updated_at = now()
      where id = $1 and member_id = $2 and archived_at is null
      returning
        id,
        name,
        brand,
        line,
        vitola,
        wrapper,
        origin,
        strength,
        quantity,
        rating,
        purchase_date,
        aging_start_date,
        reorder_reminder,
        humidor_location,
        tray,
        tasting_notes,
        source,
        metadata,
        created_at
    `,
    [details.itemId, details.memberId, details.quantity, details.actor.sub, details.requestId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Humidor item shared update did not return item ${details.itemId}.`);
  }

  return row;
}

function buildHumidorEnrichmentMetadata(details) {
  const metadata = buildHumidorItemMetadata(details.actor, details.item);
  metadata.humidorEnrichment = {
    agent: "YCCHumidorAgent",
    enrichedAt: new Date().toISOString(),
    requestId: details.requestId,
    updatedFields: details.updatedFields,
    confidence: details.enrichment.confidence,
    evidence: details.enrichment.evidence.slice(0, 6),
    needsReview: details.enrichment.needsReview.slice(0, 6),
  };

  return metadata;
}

async function persistHumidorItem(event, actor, requestId, item) {
  return withDatabaseTransaction("ycc-api-humidor-item", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    const result = await client.query(
      `
        insert into public.humidor_items (
          member_id,
          name,
          brand,
          line,
          vitola,
          wrapper,
          origin,
          strength,
          quantity,
          purchase_date,
          aging_start_date,
          reorder_reminder,
          tasting_notes,
          rating,
          humidor_location,
          tray,
          source,
          metadata,
          actor_id,
          request_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date, $11::date, $12::date, $13, $14, $15, $16, $17, $18::jsonb, $19, $20)
        returning id, created_at
      `,
      [
        member.id,
        item.name,
        nullable(item.brand),
        nullable(item.line),
        nullable(item.vitola),
        nullable(item.wrapper),
        nullable(item.origin),
        nullable(item.strength),
        item.quantity,
        item.purchaseDate,
        item.agingStartDate,
        item.reorderReminder,
        nullable(item.tastingNotes),
        item.rating,
        nullable(item.humidorLocation),
        nullable(item.tray),
        item.source,
        JSON.stringify(buildHumidorItemMetadata(actor, item)),
        actor.sub,
        requestId,
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Humidor item insert did not return a row.");
    }

    await insertAuditLog(client, event, {
      action: "humidor_item.created",
      actor,
      afterData: {
        name: item.name,
        quantity: item.quantity,
        purchaseDate: item.purchaseDate,
        agingStartDate: item.agingStartDate,
        productionDate: item.productionDate,
        reorderReminder: item.reorderReminder,
        estimatedValue: item.estimatedValue,
        estimatedValueCurrency: item.estimatedValueCurrency,
        cigarImage: item.cigarImage
          ? {
              fileName: item.cigarImage.fileName,
              mimeType: item.cigarImage.mimeType,
              bytes: item.cigarImage.bytes,
            }
          : null,
      },
      memberId: member.id,
      requestId,
      resourceId: row.id,
      resourceType: "humidor_item",
    });

    return {
      itemId: row.id,
      memberId: member.id,
      createdAt: toIsoString(row.created_at),
    };
  });
}

async function insertHumidorSmokeLog(client, details) {
  const metadata = {
    drinkPairing: details.log.drinkPairing,
    source: details.log.source,
  };
  const result = await client.query(
    `
      insert into public.smoke_logs (
        member_id,
        humidor_item_id,
        cigar_name,
        smoked_at,
        rating,
        pairing,
        notes,
        duration_minutes,
        metadata,
        actor_id,
        request_id
      )
      values ($1, $2::uuid, $3, coalesce($4::timestamptz, now()), $5, $6, $7, $8, $9::jsonb, $10, $11)
      returning
        id,
        humidor_item_id,
        cigar_name,
        smoked_at,
        rating,
        pairing,
        notes,
        duration_minutes,
        metadata,
        created_at
    `,
    [
      details.memberId,
      details.log.humidorItemId,
      details.log.cigarName,
      details.log.smokedAt,
      details.log.rating,
      nullable(details.log.drinkPairing),
      nullable(details.log.notes),
      details.log.durationMinutes,
      JSON.stringify(metadata),
      details.actor.sub,
      details.requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Humidor smoke log insert did not return a row.");
  }

  return row;
}

async function upsertHumidorAlertPreferences(client, actor, requestId, memberId, settings) {
  const existingResult = await client.query(
    `
      select preferences
      from public.member_profiles
      where member_id = $1
    `,
    [memberId]
  );

  const mergedPreferences = {
    ...normalizeHumidorAlertPreferences(existingResult.rows[0]?.preferences),
    ...settings,
  };

  if (!settings.pushEnabled) {
    mergedPreferences.pushSubscription = null;
  }

  const result = await client.query(
    `
      insert into public.member_profiles (
        member_id,
        preferences,
        actor_id,
        request_id
      )
      values ($1, $2::jsonb, $3, $4)
      on conflict (member_id) do update
      set preferences = $2::jsonb,
          actor_id = excluded.actor_id,
          request_id = excluded.request_id,
          updated_at = now()
      returning preferences
    `,
    [memberId, JSON.stringify(mergedPreferences), actor.sub, requestId]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Humidor alert preference upsert did not return a row.");
  }

  const persistedPreferences = normalizeHumidorAlertPreferences(row.preferences);
  const responsePreferences = {
    ...persistedPreferences,
    ...settings,
  };

  if (!settings.pushEnabled) {
    responsePreferences.pushSubscription = null;
  } else if (persistedPreferences.pushSubscription) {
    responsePreferences.pushSubscription = persistedPreferences.pushSubscription;
  } else if (settings.pushSubscription) {
    responsePreferences.pushSubscription = settings.pushSubscription;
  }

  return normalizeHumidorAlertPreferences(responsePreferences);
}

async function withDatabaseClient(applicationName, callback) {
  const secret = await getDatabaseSecret();
  const client = createPgClient(getDatabaseName(), secret, applicationName);

  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function withDatabaseTransaction(applicationName, callback) {
  return withDatabaseClient(applicationName, async (client) => {
    await client.query("begin");
    try {
      const result = await callback(client);
      await client.query("commit");
      return result;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch (rollbackError) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "rollback_failed",
            applicationName,
            message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          })
        );
      }

      throw error;
    }
  });
}

async function upsertMember(client, actor, requestId) {
  const normalized = normalizeActorForMember(actor);
  const metadata = JSON.stringify({
    cognitoGroups: actor.groups,
    cognitoUsername: actor.username,
    emailMissingInToken: !actor.email,
    source: "cognito-jwt",
  });
  const params = [
    actor.sub,
    normalized.email,
    actor.emailVerified,
    nullable(actor.name),
    normalized.role,
    normalized.membershipTier,
    normalized.memberStatus,
    normalized.stripeCustomerId,
    metadata,
    actor.sub,
    requestId,
  ];

  let result;
  try {
    result = await client.query(
      `
        insert into public.members (
          cognito_sub,
          email,
          email_verified,
          display_name,
          role,
          membership_tier,
          member_status,
          stripe_customer_id,
          last_seen_at,
          metadata,
          actor_id,
          request_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9::jsonb, $10, $11)
        on conflict (cognito_sub) do update
        set email = excluded.email,
            email_verified = excluded.email_verified,
            display_name = coalesce(public.members.display_name, excluded.display_name),
            role = excluded.role,
            membership_tier = coalesce(excluded.membership_tier, public.members.membership_tier),
            member_status = case
              when excluded.member_status = 'non_member'
                and public.members.member_status in ('active', 'paused')
                then public.members.member_status
              else excluded.member_status
            end,
            stripe_customer_id = coalesce(excluded.stripe_customer_id, public.members.stripe_customer_id),
            last_seen_at = now(),
            metadata = public.members.metadata || excluded.metadata,
            actor_id = excluded.actor_id,
            request_id = excluded.request_id,
            updated_at = now()
        returning id, cognito_sub, email, display_name, role, membership_tier, member_status, stripe_customer_id
      `,
      params
    );
  } catch (error) {
    if (!actor.email || !actor.emailVerified || !isMemberEmailUniqueConflict(error)) {
      throw error;
    }

    console.warn(
      JSON.stringify({
        level: "warn",
        event: "member_email_conflict_repair",
        requestId,
        actorHash: hashActor(actor.sub),
      })
    );

    result = await client.query(
      `
        update public.members
        set cognito_sub = $2,
            email_verified = $3,
            display_name = coalesce(public.members.display_name, $4),
            role = $5,
            membership_tier = coalesce($6, public.members.membership_tier),
            member_status = case
              when $7 = 'non_member'
                and public.members.member_status in ('active', 'paused')
                then public.members.member_status
              else $7
            end,
            stripe_customer_id = coalesce($8, public.members.stripe_customer_id),
            last_seen_at = now(),
            metadata = coalesce(public.members.metadata, '{}'::jsonb) || $9::jsonb,
            actor_id = $10,
            request_id = $11,
            updated_at = now()
        where lower(email) = lower($1)
        returning id, cognito_sub, email, display_name, role, membership_tier, member_status, stripe_customer_id
      `,
      [
        normalized.email,
        actor.sub,
        actor.emailVerified,
        nullable(actor.name),
        normalized.role,
        normalized.membershipTier,
        normalized.memberStatus,
        normalized.stripeCustomerId,
        metadata,
        actor.sub,
        requestId,
      ]
    );
  }

  const row = result.rows[0];
  if (!row) {
    throw new Error("Member upsert did not return a row.");
  }

  return {
    id: row.id,
    cognitoSub: row.cognito_sub,
    displayName: row.display_name,
    email: row.email,
    memberStatus: row.member_status,
    membershipTier: row.membership_tier,
    role: row.role,
    stripeCustomerId: row.stripe_customer_id || null,
  };
}

function isMemberEmailUniqueConflict(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error;
  return candidate.code === "23505" && String(candidate.constraint || "").includes("members_email_lower_uidx");
}

async function upsertConversation(client, memberId, actor, requestId, details) {
  const conversationId = getUuidOrNull(details.conversationId);
  const title = details.message.slice(0, 90);
  const result = await client.query(
    `
      insert into public.conversations (
        id,
        member_id,
        agent_name,
        channel,
        status,
        title,
        last_message_at,
        metadata,
        actor_id,
        request_id
      )
      values (coalesce($1::uuid, gen_random_uuid()), $2, $3, 'web', 'open', $4, now(), $5::jsonb, $6, $7)
      on conflict (id) do update
      set agent_name = excluded.agent_name,
          status = 'open',
          title = coalesce(public.conversations.title, excluded.title),
          last_message_at = now(),
          metadata = public.conversations.metadata || excluded.metadata,
          actor_id = excluded.actor_id,
          request_id = excluded.request_id,
          updated_at = now()
      where public.conversations.member_id = excluded.member_id
      returning id, status
    `,
    [
      conversationId,
      memberId,
      details.agent,
      title,
      JSON.stringify({
        requestedConversationId: details.conversationId,
        requestedBySub: actor.sub,
      }),
      actor.sub,
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Conversation insert did not return a row.");
  }

  return {
    id: row.id,
    status: row.status,
  };
}

async function insertConversationMessage(client, memberId, actor, requestId, details) {
  const result = await client.query(
    `
      insert into public.conversation_messages (
        conversation_id,
        member_id,
        role,
        content,
        model,
        metadata,
        actor_id,
        request_id
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      returning id
    `,
    [
      details.conversationId,
      memberId,
      details.role,
      details.content,
      details.model || null,
      JSON.stringify(details.metadata || {}),
      actor.sub,
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Conversation message insert did not return a row.");
  }

  return {
    id: row.id,
  };
}

async function insertSupportCase(client, memberId, actor, requestId, details) {
  const result = await client.query(
    `
      insert into public.support_cases (
        member_id,
        subject,
        status,
        priority,
        source,
        assigned_group,
        last_activity_at,
        metadata,
        actor_id,
        request_id
      )
      values ($1, $2, 'new', $3, 'web', 'concierge_operator', now(), $4::jsonb, $5, $6)
      returning id, case_number
    `,
    [
      memberId,
      details.subject,
      getSupportPriority(details.message),
      JSON.stringify({
        requestedCaseId: details.caseId,
        sourceMessagePreview: details.message.slice(0, 500),
      }),
      actor.sub,
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Support case insert did not return a row.");
  }

  return {
    caseNumber: row.case_number,
    id: row.id,
  };
}

async function insertSupportEmailMessage(client, supportCaseId, actor, requestId, details) {
  const result = await client.query(
    `
      insert into public.support_email_messages (
        support_case_id,
        direction,
        from_address,
        to_addresses,
        subject,
        body_text,
        draft_status,
        metadata,
        actor_id,
        request_id
      )
      values ($1, 'outbound', $2, $3, $4, $5, 'draft', $6::jsonb, $7, $8)
      returning id
    `,
    [
      supportCaseId,
      "support@yuzucigarclub.com",
      actor.email ? [actor.email] : [],
      details.subject,
      details.draftBody,
      JSON.stringify({
        source: "api",
        sourceMessagePreview: details.message.slice(0, 500),
      }),
      actor.sub,
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Support email message insert did not return a row.");
  }

  return {
    id: row.id,
  };
}

async function upsertNewsletterSubscriber(client, requestId, details) {
  const result = await client.query(
    `
      insert into public.newsletter_subscribers (
        email,
        first_name,
        last_name,
        full_name,
        phone,
        consent,
        source,
        page_path,
        wants_monthly_membership,
        preferred_tier,
        metadata,
        actor_id,
        request_id
      )
      values ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10::jsonb, 'newsletter-public', $11)
      on conflict (lower(email)) do update
      set first_name = coalesce(excluded.first_name, public.newsletter_subscribers.first_name),
          last_name = coalesce(excluded.last_name, public.newsletter_subscribers.last_name),
          full_name = coalesce(excluded.full_name, public.newsletter_subscribers.full_name),
          phone = coalesce(excluded.phone, public.newsletter_subscribers.phone),
          consent = true,
          consented_at = now(),
          source = excluded.source,
          page_path = coalesce(excluded.page_path, public.newsletter_subscribers.page_path),
          wants_monthly_membership = public.newsletter_subscribers.wants_monthly_membership or excluded.wants_monthly_membership,
          preferred_tier = coalesce(excluded.preferred_tier, public.newsletter_subscribers.preferred_tier),
          status = 'subscribed',
          metadata = public.newsletter_subscribers.metadata || excluded.metadata,
          actor_id = excluded.actor_id,
          request_id = excluded.request_id,
          updated_at = now()
      returning id, email, wants_monthly_membership, preferred_tier, updated_at
    `,
    [
      details.email,
      nullable(details.firstName),
      nullable(details.lastName),
      nullable(details.fullName),
      nullable(details.phone),
      details.source,
      nullable(details.pagePath),
      details.wantsMonthlyMembership,
      details.preferredTier,
      JSON.stringify({
        brandPreferences: details.brandPreferences,
        capturePath: details.pagePath || null,
        promotedCigars: details.promotedCigars,
        source: details.source,
      }),
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Newsletter subscriber upsert did not return a row.");
  }

  return {
    id: row.id,
    email: row.email,
    preferredTier: row.preferred_tier,
    updatedAt: toIsoString(row.updated_at),
    wantsMonthlyMembership: row.wants_monthly_membership,
  };
}

async function upsertSitePageContent(client, memberId, actor, requestId, details) {
  const result = await client.query(
    `
      insert into public.site_page_content (
        route,
        edits,
        updated_by_member_id,
        published_at,
        metadata,
        actor_id,
        request_id
      )
      values ($1, $2::jsonb, $3, now(), $4::jsonb, $5, $6)
      on conflict (route) do update
      set edits = excluded.edits,
          updated_by_member_id = excluded.updated_by_member_id,
          published_at = now(),
          metadata = public.site_page_content.metadata || excluded.metadata,
          actor_id = excluded.actor_id,
          request_id = excluded.request_id,
          updated_at = now()
      returning route, edits, published_at, updated_at
    `,
    [
      details.route,
      JSON.stringify(details.edits),
      memberId,
      JSON.stringify({
        source: "live-page-editor",
        updatedBySub: actor.sub,
      }),
      actor.sub,
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Site page content upsert did not return a row.");
  }

  return mapSitePageContentRow(row, details.route);
}

async function upsertNewsStory(client, memberId, actor, requestId, story) {
  const result = await client.query(
    `
      insert into public.news_stories (
        slug,
        title,
        dek,
        category,
        body_markdown,
        source_notes,
        official_sources,
        status,
        created_by_member_id,
        published_at,
        metadata,
        actor_id,
        request_id
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, case when $8 = 'published' then now() else null end, $10::jsonb, $11, $12)
      on conflict (slug) do update
      set title = excluded.title,
          dek = excluded.dek,
          category = excluded.category,
          body_markdown = excluded.body_markdown,
          source_notes = excluded.source_notes,
          official_sources = excluded.official_sources,
          status = excluded.status,
          created_by_member_id = excluded.created_by_member_id,
          published_at = case when excluded.status = 'published' then now() else null end,
          metadata = public.news_stories.metadata || excluded.metadata,
          actor_id = excluded.actor_id,
          request_id = excluded.request_id,
          updated_at = now()
      returning id, slug, title, dek, category, body_markdown, source_notes, official_sources, metadata, status, published_at, updated_at
    `,
    [
      story.slug,
      story.title,
      story.dek,
      story.category,
      story.bodyMarkdown,
      JSON.stringify(story.sourceNotes),
      JSON.stringify(story.officialSources),
      story.status,
      memberId,
      JSON.stringify(buildNewsStoryMetadata(story, actor)),
      actor.sub,
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("News story upsert did not return a row.");
  }

  return mapNewsStoryRow(row);
}

async function insertSentSupportEmailMessage(client, supportCaseId, actor, requestId, details) {
  const result = await client.query(
    `
      insert into public.support_email_messages (
        support_case_id,
        direction,
        from_address,
        to_addresses,
        subject,
        body_text,
        ses_message_id,
        draft_status,
        sent_at,
        metadata,
        actor_id,
        request_id
      )
      values ($1, 'outbound', $2, $3, $4, $5, $6, 'sent', now(), $7::jsonb, $8, $9)
      returning id
    `,
    [
      supportCaseId,
      details.fromAddress,
      details.toAddresses,
      details.subject,
      details.bodyText,
      details.sesMessageId,
      JSON.stringify({
        source: "api",
        sentBySub: actor.sub,
      }),
      actor.sub,
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Sent support email message insert did not return a row.");
  }

  return {
    id: row.id,
  };
}

async function insertInboundSupportCase(client, requestId, details) {
  const result = await client.query(
    `
      insert into public.support_cases (
        member_id,
        subject,
        status,
        priority,
        source,
        assigned_group,
        last_activity_at,
        metadata,
        actor_id,
        request_id
      )
      values (null, $1, 'new', $2, 'email', 'concierge_operator', now(), $3::jsonb, 'ses-inbound', $4)
      returning id, case_number
    `,
    [
      details.subject,
      getSupportPriority(details.bodyText),
      JSON.stringify({
        deliveryStatus: details.deliveryStatus || null,
        fromAddress: details.fromAddress,
        name: details.name || null,
        orderNumber: details.orderNumber || null,
        pagePath: details.pagePath || null,
        s3RawKey: details.rawKey,
        sesMessageId: details.sesMessageId,
        source: details.source || "ses",
        topic: details.topic || null,
        toAddresses: details.toAddresses,
      }),
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Inbound support case insert did not return a row.");
  }

  return {
    caseNumber: row.case_number,
    id: row.id,
  };
}

async function insertInboundSupportEmailMessage(client, supportCaseId, requestId, details) {
  const result = await client.query(
    `
      insert into public.support_email_messages (
        support_case_id,
        direction,
        from_address,
        to_addresses,
        subject,
        body_text,
        ses_message_id,
        s3_raw_key,
        draft_status,
        received_at,
        metadata,
        actor_id,
        request_id
      )
      values ($1, 'inbound', $2, $3, $4, $5, $6, $7, 'received', $8::timestamptz, $9::jsonb, 'ses-inbound', $10)
      returning id
    `,
    [
      supportCaseId,
      details.fromAddress,
      details.toAddresses,
      details.subject,
      details.bodyText,
      details.sesMessageId,
      details.rawKey || null,
      details.receivedAt || new Date().toISOString(),
      JSON.stringify({
        deliveryStatus: details.deliveryStatus || null,
        source: details.source || "ses",
      }),
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Inbound support email message insert did not return a row.");
  }

  return {
    id: row.id,
  };
}

async function insertInboundSupportAgentDraftMessage(client, supportCaseId, requestId, details) {
  const replySubject = buildSupportReplySubject(details.subject);
  const result = await client.query(
    `
      insert into public.support_email_messages (
        support_case_id,
        direction,
        from_address,
        to_addresses,
        subject,
        body_text,
        draft_status,
        metadata,
        actor_id,
        request_id
      )
      values ($1, 'outbound', $2, $3, $4, $5, 'draft', $6::jsonb, 'ses-inbound-agent', $7)
      returning id
    `,
    [
      supportCaseId,
      getSupportEmailFrom(),
      normalizeEmailAddresses(details.fromAddress, 1),
      replySubject,
      details.agentDraft.reply,
      JSON.stringify({
        source: "ses_inbound_agent",
        agent: details.agentDraft.agent,
        aiStatus: details.agentDraft.status,
        agentId: details.agentDraft.agentId,
        agentAliasId: details.agentDraft.agentAliasId,
        modelId: details.agentDraft.modelId,
        inboundSesMessageId: details.sesMessageId,
        s3RawKey: details.rawKey,
      }),
      requestId,
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Inbound support agent draft insert did not return a row.");
  }

  return {
    id: row.id,
  };
}

function buildSupportReplySubject(subject) {
  const cleaned = sanitizeText(subject, 180) || "Yuzu Cigar Club support email";
  return /^re:/i.test(cleaned) ? cleaned : `Re: ${cleaned}`;
}

async function insertAuditLog(client, event, details) {
  await client.query(
    `
      insert into public.audit_log (
        actor_id,
        request_id,
        member_id,
        action,
        resource_type,
        resource_id,
        after_data,
        ip_address,
        user_agent
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::inet, $9)
    `,
    [
      details.actor.sub,
      details.requestId,
      details.memberId,
      details.action,
      details.resourceType,
      details.resourceId,
      JSON.stringify(details.afterData || {}),
      getSourceIp(event),
      getUserAgent(event),
    ]
  );
}

async function insertCommerceAuditLog(client, details) {
  await client.query(
    `
      insert into public.commerce_audit_log (
        actor_sub,
        actor_email,
        action,
        target_type,
        target_id,
        request_id,
        stripe_event_id,
        order_id,
        compliance_hold_id,
        payload
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8::uuid, $9::uuid, $10::jsonb)
    `,
    [
      details.actor?.sub || "system",
      details.actor?.email || null,
      details.action,
      details.targetType,
      details.targetId,
      details.requestId,
      details.stripeEventId || null,
      details.orderId || null,
      details.complianceHoldId || null,
      JSON.stringify(details.payload || {}),
    ]
  );
}

function shouldPersistDatabaseWrites() {
  return process.env.FEATURE_DB_WRITES === "schema_ready";
}

function getDatabasePersistenceStatus() {
  if (process.env.FEATURE_DB_WRITES && process.env.FEATURE_DB_WRITES !== "schema_ready") {
    return process.env.FEATURE_DB_WRITES;
  }

  return "schema_ready_write_pending";
}

function normalizeCheckoutCustomer(value) {
  const customer = value && typeof value === "object" ? value : {};
  return {
    email: normalizeEmailAddresses(customer.email, 1)[0] || "",
    phone: sanitizeText(customer.phone, 40),
    fullName: sanitizeText(customer.fullName || customer.name, 160),
  };
}

function normalizeCheckoutShippingAddress(value) {
  const address = value && typeof value === "object" ? value : {};
  const country = String(address.country || "US")
    .trim()
    .toUpperCase();
  return {
    address1: sanitizeText(address.address1 || address.line1, 160),
    address2: sanitizeText(address.address2 || address.line2, 160),
    city: sanitizeText(address.city, 120),
    state: sanitizeText(address.state, 80).toUpperCase(),
    postalCode: sanitizeText(address.postalCode || address.zip, 40),
    country: /^[A-Z]{2}$/.test(country) ? country : "US",
  };
}

function normalizeCheckoutAgeVerificationIdentity(value) {
  const identitySource = value?.identity && typeof value.identity === "object" ? value.identity : value || {};
  const customer = normalizeCheckoutCustomer(identitySource.customer);
  const shippingAddress = normalizeCheckoutShippingAddress(identitySource.shippingAddress || identitySource.shipping);

  if (!customer.email || !shippingAddress.address1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.postalCode) {
    return {
      error: {
        error: "age_verification_identity_required",
        message: "Checkout identity details are required before signing age verification for checkout.",
      },
    };
  }

  const identity = buildCheckoutAgeIdentityBinding(customer, shippingAddress);
  return {
    value: {
      identity,
      identityHash: createCheckoutAgeIdentityHash(identity),
    },
  };
}

function buildCheckoutAgeIdentityBinding(customer, shippingAddress) {
  return {
    email: normalizeEmailAddresses(customer?.email, 1)[0] || "",
    phone: normalizeCheckoutAgeIdentityText(customer?.phone, 40),
    fullName: normalizeCheckoutAgeIdentityText(customer?.fullName || customer?.name, 160).toLowerCase(),
    address1: normalizeCheckoutAgeIdentityText(shippingAddress?.address1 || shippingAddress?.line1, 160).toLowerCase(),
    address2: normalizeCheckoutAgeIdentityText(shippingAddress?.address2 || shippingAddress?.line2, 160).toLowerCase(),
    city: normalizeCheckoutAgeIdentityText(shippingAddress?.city, 120).toLowerCase(),
    state: normalizeCheckoutAgeIdentityText(shippingAddress?.state, 80).toUpperCase(),
    postalCode: normalizeCheckoutAgeIdentityPostalCode(shippingAddress?.postalCode || shippingAddress?.zip),
    country: normalizeCheckoutAgeIdentityText(shippingAddress?.country || "US", 2).toUpperCase() || "US",
  };
}

function normalizeCheckoutAgeIdentityText(value, maxLength) {
  return sanitizeText(value, maxLength).replace(/\s+/g, " ").trim();
}

function normalizeCheckoutAgeIdentityPostalCode(value) {
  return normalizeCheckoutAgeIdentityText(value, 40).replace(/\s+/g, "").toUpperCase();
}

function createCheckoutAgeIdentityHash(identity) {
  return crypto.createHash("sha256").update(JSON.stringify(identity)).digest("base64url");
}

function resolveCheckoutAgeVerification(rawToken, env = process.env, checkoutIdentity = null) {
  const token = sanitizeText(rawToken, 600);
  if (!token || invalidAgeVerificationTokens.has(token)) {
    return {
      ok: false,
      error: "age_verification_required",
      message: "Complete verified 21+ identity review before checkout.",
    };
  }

  const signed = parseSignedCheckoutAgeToken(token, env);
  if (signed) {
    const expectedIdentityHash = checkoutIdentity ? createCheckoutAgeIdentityHash(checkoutIdentity) : "";
    if (!signed.identityHash || signed.identityHash !== expectedIdentityHash) {
      return {
        ok: false,
        error: "age_verification_identity_mismatch",
        message: "Verify again after changing checkout identity details.",
      };
    }

    return {
      ok: true,
      value: {
        status: "verified",
        verifiedAt: signed.verifiedAt,
        vendorTransactionId: signed.vendorTransactionId,
      },
    };
  }

  const allowLegacyToken = env.ALLOW_LEGACY_AGE_VERIFICATION_TOKEN === "1";
  if (allowLegacyToken && /^age_txn_[A-Za-z0-9_-]{8,160}$/.test(token)) {
    return {
      ok: true,
      value: {
        status: "verified",
        verifiedAt: new Date().toISOString(),
        vendorTransactionId: token,
      },
    };
  }

  return {
    ok: false,
    error: "age_verification_untrusted",
    message: "Age verification could not be trusted. Complete identity verification again before checkout.",
  };
}

async function validateAgeCheckerVerification(uuid, env = process.env) {
  const baseUrl = (sanitizeText(env.AGE_VERIFICATION_BASE_URL, 240) || AGECHECKER_DEFAULT_BASE_URL).replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/v1/status/${encodeURIComponent(uuid)}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-AgeChecker-Secret": getAgeCheckerAccountSecret(env),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ...(payload && typeof payload === "object" ? payload : {}),
      status: sanitizeText(payload?.status, 40) || "not_created",
      error: sanitizeText(payload?.error, 80) || `http_${response.status}`,
      httpStatus: response.status,
    };
  }

  return payload && typeof payload === "object" ? payload : {};
}

function normalizeAgeCheckerUuid(value) {
  const rawValue = sanitizeText(value, 220);
  const uuid = rawValue.replace(/^age_txn_/, "").replace(/^agechecker_/, "");

  return /^[A-Za-z0-9_-]{8,160}$/.test(uuid) ? uuid : "";
}

function createSignedCheckoutAgeToken({ vendorTransactionId, verifiedAt, identityHash }, env = process.env) {
  const signingSecret = getCheckoutAgeSigningSecret(env);
  if (!signingSecret) {
    throw new Error("AGE_VERIFICATION_SIGNING_SECRET is required to sign checkout age tokens.");
  }

  const normalizedIdentityHash = sanitizeText(identityHash, 120);
  if (!/^[A-Za-z0-9_-]{32,}$/.test(normalizedIdentityHash)) {
    throw new Error("A checkout identity hash is required to sign checkout age tokens.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    txn: vendorTransactionId,
    iat: nowSeconds,
    exp: nowSeconds + CHECKOUT_AGE_TOKEN_TTL_SECONDS,
    verifiedAt,
    identityHash: normalizedIdentityHash,
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signedMessage = `${CHECKOUT_AGE_TOKEN_VERSION}.${payloadSegment}`;
  const signatureSegment = crypto.createHmac("sha256", signingSecret).update(signedMessage).digest("base64url");

  return `${signedMessage}.${signatureSegment}`;
}

function resolveCheckoutMembershipEntitlement(rawToken, customer, env = process.env) {
  const signed = parseSignedMembershipEntitlementToken(rawToken, env);
  if (!signed) {
    return {
      trusted: false,
      status: "guest",
      tiers: [],
    };
  }

  const customerEmail = String(customer?.email || "").trim().toLowerCase();
  if (customerEmail && signed.email && customerEmail !== signed.email) {
    return {
      trusted: false,
      status: "guest",
      tiers: [],
    };
  }

  return {
    trusted: true,
    status: "member",
    subject: signed.subject,
    email: signed.email,
    tiers: signed.tiers,
  };
}

function parseSignedMembershipEntitlementToken(rawToken, env = process.env) {
  const signingSecret = String(env.MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET || "");
  const token = sanitizeText(rawToken, 1200);
  if (!signingSecret || !token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== MEMBERSHIP_ENTITLEMENT_TOKEN_VERSION) {
    return null;
  }

  const payloadSegment = parts[1];
  const signatureSegment = parts[2];
  const signedMessage = `${parts[0]}.${payloadSegment}`;
  const expectedSignature = crypto.createHmac("sha256", signingSecret).update(signedMessage).digest();
  const suppliedSignature = decodeBase64UrlToBuffer(signatureSegment);

  if (
    !suppliedSignature ||
    suppliedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  const payloadBytes = decodeBase64UrlToBuffer(payloadSegment);
  if (!payloadBytes) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const issuedAtSeconds = Number(payload.iat);
  const explicitExpirySeconds = Number(payload.exp);
  const expiresAtSeconds = Number.isFinite(explicitExpirySeconds)
    ? explicitExpirySeconds
    : Number.isFinite(issuedAtSeconds)
      ? issuedAtSeconds + MEMBERSHIP_ENTITLEMENT_TOKEN_TTL_SECONDS
      : null;
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= nowSeconds) {
    return null;
  }

  const status = sanitizeText(payload.status, 40).toLowerCase();
  if (status !== "member") {
    return null;
  }

  const subject = sanitizeText(payload.sub || payload.subject, 160);
  const email = normalizeEmailAddresses(payload.email, 1)[0] || "";
  const tiers = (Array.isArray(payload.tiers) ? payload.tiers : [payload.tier])
    .map((tier) => sanitizeText(tier, 40).toLowerCase())
    .filter(Boolean);

  return {
    subject,
    email,
    tiers,
  };
}

function parseSignedCheckoutAgeToken(token, env = process.env) {
  const signingSecret = getCheckoutAgeSigningSecret(env);
  if (!signingSecret) {
    return null;
  }

  const parts = String(token).split(".");
  if (parts.length !== 3 || parts[0] !== CHECKOUT_AGE_TOKEN_VERSION) {
    return null;
  }

  const payloadSegment = parts[1];
  const signatureSegment = parts[2];
  const signedMessage = `${parts[0]}.${payloadSegment}`;
  const expectedSignature = crypto.createHmac("sha256", signingSecret).update(signedMessage).digest();
  const suppliedSignature = decodeBase64UrlToBuffer(signatureSegment);

  if (
    !suppliedSignature ||
    suppliedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  const payloadBytes = decodeBase64UrlToBuffer(payloadSegment);
  if (!payloadBytes) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(payloadBytes.toString("utf8"));
  } catch {
    return null;
  }

  const vendorTransactionId = sanitizeText(payload.txn || payload.vendorTransactionId, 200);
  if (!/^age_txn_[A-Za-z0-9_-]{8,160}$/.test(vendorTransactionId)) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const issuedAtSeconds = Number(payload.iat);
  const explicitExpirySeconds = Number(payload.exp);
  const expiresAtSeconds = Number.isFinite(explicitExpirySeconds)
    ? explicitExpirySeconds
    : Number.isFinite(issuedAtSeconds)
      ? issuedAtSeconds + CHECKOUT_AGE_TOKEN_TTL_SECONDS
      : null;
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= nowSeconds) {
    return null;
  }

  const verifiedAt = toValidIsoTimestamp(payload.verifiedAt) || new Date(nowSeconds * 1000).toISOString();
  const identityHash = sanitizeText(payload.identityHash || payload.checkoutIdentityHash, 120);
  if (!/^[A-Za-z0-9_-]{32,}$/.test(identityHash)) {
    return null;
  }

  return {
    vendorTransactionId,
    verifiedAt,
    identityHash,
  };
}

function getCheckoutAgeSigningSecret(env = process.env) {
  return String(env.AGE_VERIFICATION_SIGNING_SECRET || env.AGE_VERIFICATION_API_SECRET || env.AGE_VERIFICATION_ACCOUNT_SECRET || "");
}

function getAgeCheckerAccountSecret(env = process.env) {
  return String(env.AGE_VERIFICATION_ACCOUNT_SECRET || env.AGE_VERIFICATION_API_SECRET || "");
}

function decodeBase64UrlToBuffer(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/\s+/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="))) {
    return null;
  }

  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
}

function toValidIsoTimestamp(value) {
  const timestamp = sanitizeText(value, 80);
  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function createMembershipEntitlementTokenForCheckout(actor, membership, env = process.env) {
  const signingSecret = String(env.MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET || "");
  const email = normalizeEmailAddresses(actor?.email, 1)[0] || "";
  const status = sanitizeText(membership?.status, 40).toLowerCase();
  if (!signingSecret || !email || !["active", "member"].includes(status)) {
    return null;
  }

  const tiers = [
    normalizeMembershipEntitlementTier(membership?.tier),
    ...(Array.isArray(membership?.groups) ? membership.groups.map(normalizeMembershipEntitlementTier) : []),
  ].filter(Boolean);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    sub: sanitizeText(actor?.sub, 160),
    email,
    status: "member",
    tiers: [...new Set(tiers)],
    iat: nowSeconds,
    exp: nowSeconds + MEMBERSHIP_ENTITLEMENT_TOKEN_TTL_SECONDS,
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signedMessage = `${MEMBERSHIP_ENTITLEMENT_TOKEN_VERSION}.${payloadSegment}`;
  const signatureSegment = crypto.createHmac("sha256", signingSecret).update(signedMessage).digest("base64url");

  return `${signedMessage}.${signatureSegment}`;
}

function normalizeMembershipEntitlementTier(value) {
  const normalized = sanitizeText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return ["box_access_pass", "kisha", "sensei", "daimyo", "member"].includes(normalized) ? normalized : "";
}

async function resolveMemberStripeCustomerId(actor, requestId) {
  const claimCustomerId = sanitizeText(actor.stripeCustomerId, 160);
  if (claimCustomerId) {
    return claimCustomerId;
  }

  if (!shouldPersistDatabaseWrites()) {
    return "";
  }

  return withDatabaseClient("ycc-api-customer-portal", async (client) => {
    const member = await upsertMember(client, actor, requestId);
    return findMemberStripeCustomerIdForMember(client, member.id, actor.email);
  });
}

async function findMemberStripeCustomerIdForMember(client, memberId, email) {
  const memberResult = await client.query(
    `
      select stripe_customer_id
      from public.members
      where id = $1
        and stripe_customer_id is not null
      limit 1
    `,
    [memberId]
  );
  const fromMember = sanitizeText(memberResult.rows[0]?.stripe_customer_id, 160);
  if (fromMember) {
    return fromMember;
  }

  const subscriptionResult = await client.query(
    `
      select stripe_customer_id
      from public.member_subscriptions
      where stripe_customer_id is not null
        and (
          member_id = $1
          or lower(email) = lower($2)
        )
      order by updated_at desc
      limit 1
    `,
    [memberId, email || ""]
  );
  const fromSubscription = sanitizeText(subscriptionResult.rows[0]?.stripe_customer_id, 160);
  if (fromSubscription) {
    return fromSubscription;
  }

  const orderResult = await client.query(
    `
      select stripe_customer_id
      from public.commerce_orders
      where stripe_customer_id is not null
        and (
          member_id = $1
          or lower(email) = lower($2)
        )
      order by updated_at desc
      limit 1
    `,
    [memberId, email || ""]
  );
  return sanitizeText(orderResult.rows[0]?.stripe_customer_id, 160);
}

async function processStripeWebhookEvent(event, requestId, stripeEvent, action, stripeClient) {
  return withDatabaseTransaction("ycc-api-stripe-webhook", async (client) => {
    const existing = await client.query("select id from public.stripe_events where id = $1 limit 1", [stripeEvent.id]);
    const processedEventIds = new Set(existing.rows.map((row) => String(row.id)));
    if (!shouldProcessStripeEvent(stripeEvent, processedEventIds)) {
      return {
        duplicate: true,
        eventStored: false,
        orderId: null,
        processingStatus: "duplicate",
      };
    }

    await client.query(
      `
        insert into public.stripe_events (id, type, payload, processing_status)
        values ($1, $2, $3::jsonb, 'received')
      `,
      [stripeEvent.id, stripeEvent.type, JSON.stringify(stripeEvent)]
    );

    const actionResult = await applyStripeCommerceWebhookAction(client, stripeEvent, action, stripeClient);
    const subscription = actionResult?.subscription || null;
    let order = actionResult?.order || (actionResult && actionResult.id ? actionResult : null);

    if (!order && (action === "record_checkout_completion" || action === "record_payment_failure")) {
      const checkoutSessionId = sanitizeText(stripeEvent?.data?.object?.id, 200);
      if (checkoutSessionId) {
        const persistedOrder = await findCommerceOrderByCheckoutSessionId(checkoutSessionId);
        if (persistedOrder) {
          order = persistedOrder;
        }
      }
    }

    const processingStatus = action === "ignore" ? "ignored" : "processed";

    await client.query(
      `
        update public.stripe_events
        set processed_at = now(),
            processing_status = $2
        where id = $1
      `,
      [stripeEvent.id, processingStatus]
    );

    await client.query(
      `
        insert into public.commerce_audit_log (
          actor_sub,
          actor_email,
          action,
          target_type,
          target_id,
          request_id,
          stripe_event_id,
          order_id,
          payload
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::uuid, $9::jsonb)
      `,
      [
        "stripe-webhook",
        null,
        `stripe.webhook.${stripeEvent.type}`,
        order ? "commerce_order" : "stripe_event",
        order ? order.id : stripeEvent.id,
        requestId,
        stripeEvent.id,
        order ? order.id : null,
        JSON.stringify({
          action,
          processingStatus,
        }),
      ]
    );

    return {
      duplicate: false,
      eventStored: true,
      orderId: order ? order.id : null,
      processingStatus,
      subscription,
    };
  });
}

function shouldSendStripeMemberWelcomeEmail(stripeEvent, action, processing) {
  return Boolean(
    stripeEvent?.type === "customer.subscription.created" &&
      action === "record_subscription_update" &&
      !processing?.duplicate &&
      processing?.subscription?.status === "active" &&
      processing.subscription.email
  );
}

function shouldSendStripeOrderConfirmationEmail(stripeEvent, action, processing) {
  const session = stripeEvent?.data?.object;
  const email =
    normalizeEmailAddresses(session?.customer_details?.email, 1)[0] ||
    normalizeEmailAddresses(session?.customer_email, 1)[0] ||
    normalizeEmailAddresses(session?.metadata?.customer_email, 1)[0] ||
    "";

  return Boolean(
    stripeEvent?.type === "checkout.session.completed" &&
      action === "record_checkout_completion" &&
      !processing?.duplicate &&
      processing?.orderId &&
      sanitizeText(session?.payment_status, 40).toLowerCase() === "paid" &&
      email
  );
}

async function maybeSendStripeOrderConfirmationEmail(stripeEvent, processing, requestId) {
  const details = normalizeStripeOrderConfirmationEmailDetails(stripeEvent, processing);
  if (!details.email) {
    return addOutboundEmailProviderFields({
      kind: "order_confirmation",
      status: "skipped",
      sesMessageId: null,
      orderId: processing?.orderId || null,
    });
  }

  if (!isOutboundEmailReady()) {
    console.info(
      JSON.stringify({
        level: "info",
        event: "order_confirmation_email_pending_sender",
        requestId,
        orderId: processing?.orderId || null,
        checkoutSessionId: details.checkoutSessionId,
        emailProvider: getOutboundEmailStatus(),
      })
    );
    return addOutboundEmailProviderFields({
      kind: "order_confirmation",
      status: getOutboundEmailPendingStatus(),
      sesMessageId: null,
      orderId: processing?.orderId || null,
      checkoutSessionId: details.checkoutSessionId,
    });
  }

  try {
    const emailContent = buildOrderConfirmationEmailContent(details, requestId);
    const sesMessageId = await sendSupportEmail({
      bodyHtml: emailContent.bodyHtml,
      bodyText: emailContent.bodyText,
      fromAddress: getSupportEmailFrom(),
      replyToAddresses: [getSupportInboundReplyToAddress()],
      subject: emailContent.subject,
      toAddresses: [details.email],
    });

    return addOutboundEmailProviderFields({
      kind: "order_confirmation",
      status: "sent",
      sesMessageId,
      orderId: processing?.orderId || null,
      checkoutSessionId: details.checkoutSessionId,
    }, sesMessageId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "order_confirmation_email_failed",
        requestId,
        orderId: processing?.orderId || null,
        checkoutSessionId: details.checkoutSessionId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return addOutboundEmailProviderFields({
      kind: "order_confirmation",
      status: "failed",
      sesMessageId: null,
      orderId: processing?.orderId || null,
      checkoutSessionId: details.checkoutSessionId,
    });
  }
}

function normalizeStripeOrderConfirmationEmailDetails(stripeEvent, processing) {
  const session = stripeEvent?.data?.object || {};
  const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
  const customerDetails = session.customer_details && typeof session.customer_details === "object" ? session.customer_details : {};
  const email =
    normalizeEmailAddresses(customerDetails.email, 1)[0] ||
    normalizeEmailAddresses(session.customer_email, 1)[0] ||
    normalizeEmailAddresses(metadata.customer_email, 1)[0] ||
    "";
  const checkoutSessionId = sanitizeText(session.id, 200);
  const shippingMethod = sanitizeText(metadata.shipping_method_id || metadata.shipping_method || "adult-signature fulfillment", 160)
    .replace(/[_-]+/g, " ");

  return {
    email,
    checkoutSessionId,
    orderId: sanitizeText(processing?.orderId, 120),
    customerName: sanitizeText(customerDetails.name || session.customer_name || "", 160),
    total: formatCurrencyCents(session.amount_total, session.currency),
    subtotal: formatCurrencyCents(session.amount_subtotal, session.currency),
    tax: formatCurrencyCents(session.total_details?.amount_tax, session.currency),
    shipping: formatCurrencyCents(session.total_details?.amount_shipping, session.currency),
    shippingMethod,
    accountUrl: resolveNewsletterEmailUrl("/account/"),
    contactUrl: resolveNewsletterEmailUrl("/contact/"),
  };
}

function buildOrderConfirmationEmailContent(details, requestId) {
  return {
    kind: "order_confirmation",
    subject: `Yuzu order confirmed: ${details.checkoutSessionId || details.orderId || "fulfillment review"}`,
    bodyText: buildOrderConfirmationEmailText(details, requestId),
    bodyHtml: buildOrderConfirmationEmailHtml(details, requestId),
  };
}

function buildOrderConfirmationEmailText(details, requestId) {
  return [
    `Yuzu order confirmed${details.customerName ? ` for ${details.customerName}` : ""}.`,
    "",
    `Order: ${details.checkoutSessionId || details.orderId || "pending"}`,
    `Total: ${details.total}`,
    `Subtotal: ${details.subtotal}`,
    `Tax: ${details.tax}`,
    `Shipping: ${details.shipping}`,
    `Fulfillment: adult-signature review is queued for ${details.shippingMethod || "the selected carrier service"}.`,
    "",
    "Stripe sends the payment receipt separately. This Yuzu note confirms the club has the paid order in fulfillment review.",
    `Account: ${details.accountUrl}`,
    `Need help? ${details.contactUrl}`,
    `Reference: ${requestId}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildOrderConfirmationEmailHtml(details, requestId) {
  const html = `
    <!doctype html>
    <html>
      <body style="margin:0;background:#030504;color:#f8edd7;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#030504;padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:660px;border:1px solid #6f5323;background:#101812;">
                <tr>
                  <td style="padding:28px;border-bottom:1px solid #6f5323;background:#07110d;">
                    <p style="margin:0 0 10px;color:#dca93a;font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">Yuzu Cigar Club</p>
                    <h1 style="margin:0;color:#f8edd7;font-size:28px;line-height:1.2;">Yuzu order confirmed</h1>
                    <p style="margin:14px 0 0;color:#cdbf9f;font-size:15px;line-height:1.6;">Your paid order is now in fulfillment review for adult-signature handling.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 28px;color:#f8edd7;font-size:15px;line-height:1.7;">
                    <p style="margin:0 0 14px;">${escapeHtml(details.customerName ? `Hi ${details.customerName},` : "Hi,")}</p>
                    <p style="margin:0 0 18px;">Stripe sends the payment receipt separately. This Yuzu confirmation means the club has your paid order and is preparing the compliance and fulfillment review.</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border:1px solid #6f5323;background:#030504;">
                      ${renderEmailSummaryRow("Order", details.checkoutSessionId || details.orderId || "pending")}
                      ${renderEmailSummaryRow("Total", details.total)}
                      ${renderEmailSummaryRow("Tax", details.tax)}
                      ${renderEmailSummaryRow("Shipping", details.shipping)}
                      ${renderEmailSummaryRow("Fulfillment", `Adult-signature review: ${details.shippingMethod}`)}
                    </table>
                    <p style="margin:0 0 18px;">Track your account or contact support if anything looks off.</p>
                    <p style="margin:0;"><a href="${escapeHtmlAttribute(details.accountUrl)}" style="color:#dca93a;">Open account</a> &nbsp; <a href="${escapeHtmlAttribute(details.contactUrl)}" style="color:#dca93a;">Contact support</a></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px;border-top:1px solid #6f5323;color:#8f826a;font-size:12px;line-height:1.5;">Reference: ${escapeHtml(requestId)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return sanitizeEmailHtml(html);
}

function renderEmailSummaryRow(label, value) {
  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #302817;color:#cdbf9f;font-size:13px;">${escapeHtml(label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #302817;color:#f8edd7;font-size:13px;font-weight:700;text-align:right;">${escapeHtml(value || "pending")}</td>
    </tr>
  `;
}

async function applyStripeCommerceWebhookAction(client, stripeEvent, action, stripeClient) {
  if (!stripeEvent || typeof stripeEvent !== "object") {
    return null;
  }

  if (action === "record_checkout_completion" || action === "record_payment_failure") {
    return upsertCommerceOrderFromStripeCheckoutEvent(client, stripeClient, stripeEvent);
  }

  if (action === "record_refund") {
    return upsertCommerceOrderFromStripeRefund(client, stripeEvent);
  }

  if (action === "record_subscription_payment" || action === "record_subscription_update" || action === "record_subscription_cancellation" || action === "record_subscription_payment_failure") {
    return {
      subscription: await upsertCommerceSubscriptionFromStripeEvent(client, stripeEvent, action),
    };
  }

  return null;
}

async function upsertCommerceOrderFromStripeCheckoutEvent(client, stripe, stripeEvent) {
  const session = stripeEvent?.data?.object;
  if (!session || typeof session !== "object") {
    return null;
  }

  const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
  const checkoutSessionId = sanitizeText(session.id, 200);
  if (!checkoutSessionId) {
    return null;
  }

  const email =
    normalizeEmailAddresses(session.customer_details?.email, 1)[0] ||
    normalizeEmailAddresses(session.customer_email, 1)[0] ||
    normalizeEmailAddresses(metadata.customer_email, 1)[0] ||
    "";
  if (!email) {
    return null;
  }

  const paymentStatus = sanitizeText(session.payment_status, 40).toLowerCase();
  const checkoutStatus = sanitizeText(session.status, 40).toLowerCase();
  const status =
    paymentStatus === "paid"
      ? "paid"
      : checkoutStatus === "expired"
        ? "expired"
        : paymentStatus === "unpaid"
          ? "pending_payment"
          : "pending_payment";
  const fulfillmentStatus = paymentStatus === "paid" ? "pending" : "awaiting_payment";
  const memberId = await findMemberIdByEmail(client, email);
  const stripeCustomerId = sanitizeText(session.customer, 160) || null;
  const subtotalCents = toNonNegativeInteger(session.amount_subtotal);
  const totalCents = toNonNegativeInteger(session.amount_total);
  const taxCents = toNonNegativeInteger(session.total_details?.amount_tax);
  const shippingCents = toNonNegativeInteger(session.total_details?.amount_shipping);
  const currency = sanitizeText(session.currency, 12).toLowerCase() || "usd";
  const shippingSnapshot = buildShippingSnapshotFromStripeSession(session, metadata);
  const taxSnapshot = {
    automaticTaxStatus: sanitizeText(session.automatic_tax?.status, 40),
    amountTaxCents: taxCents,
  };
  const result = await client.query(
    `
      insert into public.commerce_orders (
        member_id,
        email,
        status,
        stripe_customer_id,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        stripe_event_id,
        subtotal_cents,
        tax_cents,
        shipping_cents,
        total_cents,
        currency,
        compliance_status,
        fulfillment_status,
        shipping_snapshot,
        tax_snapshot
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)
      on conflict (stripe_checkout_session_id) do update
      set member_id = coalesce(excluded.member_id, public.commerce_orders.member_id),
          email = excluded.email,
          status = excluded.status,
          stripe_customer_id = coalesce(excluded.stripe_customer_id, public.commerce_orders.stripe_customer_id),
          stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, public.commerce_orders.stripe_payment_intent_id),
          stripe_event_id = excluded.stripe_event_id,
          subtotal_cents = excluded.subtotal_cents,
          tax_cents = excluded.tax_cents,
          shipping_cents = excluded.shipping_cents,
          total_cents = excluded.total_cents,
          currency = excluded.currency,
          compliance_status = excluded.compliance_status,
          fulfillment_status = excluded.fulfillment_status,
          shipping_snapshot = excluded.shipping_snapshot,
          tax_snapshot = excluded.tax_snapshot,
          updated_at = now()
      returning id, status, fulfillment_status
    `,
    [
      memberId,
      email,
      status,
      stripeCustomerId,
      checkoutSessionId,
      sanitizeText(session.payment_intent, 160) || null,
      stripeEvent.id,
      subtotalCents,
      taxCents,
      shippingCents,
      totalCents,
      currency,
      sanitizeText(metadata.age_verification_id, 200) ? "verified" : "pending",
      fulfillmentStatus,
      JSON.stringify(shippingSnapshot),
      JSON.stringify(taxSnapshot),
    ]
  );

  const row = result.rows[0];
  if (row?.id) {
    await upsertCommerceOrderItemsFromStripeSession(client, stripe, row.id, session);
  }

  if (memberId && stripeCustomerId) {
    await linkMemberStripeCustomer(client, memberId, stripeCustomerId);
  }

  return row
    ? {
        id: row.id,
        status: row.status,
        fulfillmentStatus: row.fulfillment_status,
      }
    : null;
}

async function upsertCommerceOrderFromStripeRefund(client, stripeEvent) {
  const charge = stripeEvent?.data?.object;
  const paymentIntentId = sanitizeText(charge?.payment_intent, 200);
  if (!paymentIntentId) {
    return null;
  }

  const status = "refunded";
  const result = await client.query(
    `
      update public.commerce_orders
      set status = coalesce($3, status),
          fulfillment_status = 'cancelled',
          stripe_event_id = $1,
          updated_at = now()
      where stripe_payment_intent_id = $2
      returning id, status, fulfillment_status
    `,
    [stripeEvent.id, paymentIntentId, status || null]
  );

  const row = result.rows[0];
  return row
    ? {
        id: row.id,
        status: row.status,
        fulfillmentStatus: row.fulfillment_status,
      }
    : null;
}

async function upsertCommerceSubscriptionFromStripeEvent(client, stripeEvent, action) {
  const subscriptionLike = stripeEvent?.data?.object;
  if (!subscriptionLike || typeof subscriptionLike !== "object") {
    return null;
  }

  const metadata = subscriptionLike.metadata && typeof subscriptionLike.metadata === "object" ? subscriptionLike.metadata : {};
  const subscriptionId = sanitizeText(
    subscriptionLike.id || subscriptionLike.subscription || subscriptionLike.subscription_id || subscriptionLike.stripe_subscription_id,
    200
  );
  if (!subscriptionId) {
    return null;
  }

  const subscriptionPriceId =
    sanitizeText(
      subscriptionLike.items?.data?.[0]?.price?.id || subscriptionLike.price?.id || subscriptionLike.plan?.id || metadata.stripe_price_id,
      160
    ) || null;
  const subscriptionCheckoutSessionId = sanitizeText(
    subscriptionLike.checkout_session || subscriptionLike.checkout?.session || subscriptionLike.checkout_session_id || metadata.checkout_session_id || null,
    200
  ) || null;
  const tierKey =
    sanitizeText(
      metadata.tier_key || subscriptionLike.plan?.metadata?.tier_key || subscriptionLike.items?.data?.[0]?.price?.metadata?.tier_key,
      120
    ) || null;
  const billingPeriod =
    sanitizeText(
      metadata.billing_period || subscriptionLike.items?.data?.[0]?.price?.recurring?.interval || subscriptionLike.billing_period,
      80
    ) || null;
  const email =
    normalizeEmailAddresses(subscriptionLike.customer_details?.email, 1)[0] ||
    normalizeEmailAddresses(subscriptionLike.customer_email, 1)[0] ||
    normalizeEmailAddresses(metadata.customer_email, 1)[0] ||
    "";
  const stripeCustomerId = sanitizeText(subscriptionLike.customer || subscriptionLike.customer_id, 160) || null;

  if (!email || !stripeCustomerId || !subscriptionPriceId || !tierKey || !billingPeriod) {
    return null;
  }

  const status =
    action === "record_subscription_payment_failure"
      ? "past_due"
      : action === "record_subscription_cancellation"
        ? "canceled"
        : "active";
  const currentPeriodEnd = Number(subscriptionLike.current_period_end);
  const currentPeriodEndIso = Number.isFinite(currentPeriodEnd) ? new Date(currentPeriodEnd * 1000).toISOString() : null;
  const memberId = await findMemberIdByEmail(client, email);

  const result = await client.query(
    `
      insert into public.member_subscriptions (
        member_id,
        email,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        stripe_checkout_session_id,
        tier_key,
        billing_period,
        status,
        current_period_end
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
      on conflict (stripe_subscription_id) do update
      set member_id = coalesce(excluded.member_id, public.member_subscriptions.member_id),
          email = excluded.email,
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_price_id = excluded.stripe_price_id,
          stripe_checkout_session_id = coalesce(excluded.stripe_checkout_session_id, public.member_subscriptions.stripe_checkout_session_id),
          tier_key = excluded.tier_key,
          billing_period = excluded.billing_period,
          status = excluded.status,
          current_period_end = coalesce(excluded.current_period_end, public.member_subscriptions.current_period_end),
          updated_at = now()
      returning id, status
    `,
    [
      memberId,
      email,
      stripeCustomerId,
      subscriptionId,
      subscriptionPriceId,
      subscriptionCheckoutSessionId,
      tierKey,
      billingPeriod,
      status,
      currentPeriodEndIso,
    ]
  );

  const row = result.rows[0];
  if (memberId && stripeCustomerId) {
    await linkMemberStripeCustomer(client, memberId, stripeCustomerId);
  }
  return row
    ? {
        id: row.id,
        status: row.status || status,
        email,
        tierKey,
        billingPeriod,
        currentPeriodEnd: currentPeriodEndIso,
        stripeCustomerId,
        stripeSubscriptionId: subscriptionId,
      }
    : null;
}

async function linkMemberStripeCustomer(client, memberId, stripeCustomerId) {
  const normalizedCustomerId = sanitizeText(stripeCustomerId, 160) || null;
  if (!memberId || !normalizedCustomerId) {
    return null;
  }

  const result = await client.query(
    `
      update public.members
      set stripe_customer_id = coalesce(public.members.stripe_customer_id, $2),
          updated_at = case when public.members.stripe_customer_id is null then now() else public.members.updated_at end
      where id = $1
        and (
          public.members.stripe_customer_id is not null
          or not exists (
            select 1
            from public.members other
            where other.stripe_customer_id = $2
              and other.id <> public.members.id
          )
        )
      returning id, stripe_customer_id
    `,
    [memberId, normalizedCustomerId]
  );

  return result.rows[0] || null;
}

async function upsertCommerceOrderItemsFromStripeSession(client, stripe, orderId, session) {
  const lineItems = await getCheckoutSessionLineItemsFromStripe(stripe, session);
  if (!lineItems.length) {
    return;
  }

  await client.query("delete from public.commerce_order_items where order_id = $1", [orderId]);

  for (let index = 0; index < lineItems.length; index += 1) {
    const normalized = normalizeCommerceOrderItemFromStripeLineItem(lineItems[index], index);
    if (!normalized) {
      continue;
    }

    await client.query(
      `
        insert into public.commerce_order_items (
          order_id,
          sku,
          product_slug,
          product_name,
          stripe_product_id,
          stripe_price_id,
          unit_amount_cents,
          quantity,
          line_total_cents
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        orderId,
        normalized.sku,
        normalized.productSlug,
        normalized.productName,
        normalized.stripeProductId,
        normalized.stripePriceId,
        normalized.unitAmountCents,
        normalized.quantity,
        normalized.lineTotalCents,
      ]
    );
  }
}

async function getCheckoutSessionLineItemsFromStripe(stripe, session) {
  const inline = session?.line_items;
  const inlineLineItems = Array.isArray(inline?.data) ? inline.data : Array.isArray(inline) ? inline : null;
  if (inlineLineItems && inlineLineItems.length) {
    return inlineLineItems;
  }

  if (!stripe?.checkout?.sessions?.listLineItems || !session?.id) {
    return [];
  }

  const allItems = [];
  let startingAfter;
  let hasMore = true;

  while (hasMore) {
    let response;

    try {
      response = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
        starting_after: startingAfter,
        expand: ["data.price.product"],
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "commerce_webhook_stripe_list_line_items_failed",
          sessionId: session.id,
          message: error instanceof Error ? error.message : String(error),
        })
      );
      return allItems;
    }

    const data = Array.isArray(response?.data) ? response.data : [];
    allItems.push(...data);

    hasMore = Boolean(response?.has_more);
    startingAfter = hasMore ? data.at(-1)?.id : undefined;
    if (data.length === 0 && hasMore) {
      hasMore = false;
    }
  }

  return allItems;
}

function normalizeCommerceOrderItemFromStripeLineItem(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const price = item.price && typeof item.price === "object" ? item.price : {};
  const product = price.product && typeof price.product === "object" ? price.product : {};
  const quantity = toNonNegativeInteger(item.quantity) || 1;
  const amountTotal = toNonNegativeInteger(item.amount_total);
  const amountSubtotal = toNonNegativeInteger(item.amount_subtotal);
  const amountUnit = toNonNegativeInteger(price.unit_amount);
  const unitAmountCents = amountUnit || (amountSubtotal > 0 && quantity ? Math.floor(amountSubtotal / quantity) : amountUnit || 0);
  const lineTotalCents =
    amountTotal || toNonNegativeInteger(price.unit_amount_decimal ? Number(price.unit_amount_decimal) * 100 : 0) * quantity || 0;
  const normalizedName = sanitizeText(
    item.description || product.name || price.nickname || `Item ${index + 1}`,
    160
  ) || `Item ${index + 1}`;
  const fallbackSku = sanitizeText(product.id || price.id || item.price?.product || item.id || `ITEM_${index + 1}`, 200) || `ITEM_${index + 1}`;
  const productSlug = slugify(product.slug || product.metadata?.slug || normalizedName || fallbackSku || `item-${index + 1}`);

  return {
    sku: fallbackSku.toUpperCase(),
    productSlug: productSlug || sanitizeText(`item_${index + 1}`, 120),
    productName: normalizedName,
    stripeProductId: sanitizeText(product.id, 160) || null,
    stripePriceId: sanitizeText(price.id, 160) || null,
    unitAmountCents,
    quantity,
    lineTotalCents: Math.max(lineTotalCents, 0),
  };
}

async function findMemberIdByEmail(client, email) {
  if (!email) {
    return null;
  }

  const result = await client.query(
    `
      select id
      from public.members
      where lower(email) = lower($1)
      limit 1
    `,
    [email]
  );
  return result.rows[0]?.id || null;
}

function buildShippingSnapshotFromStripeSession(session, metadata) {
  const customerDetails = session.customer_details && typeof session.customer_details === "object" ? session.customer_details : {};
  const address = customerDetails.address && typeof customerDetails.address === "object" ? customerDetails.address : {};
  return {
    name: sanitizeText(customerDetails.name || metadata.shipping_name, 160),
    phone: sanitizeText(customerDetails.phone || session.customer_phone, 60),
    address1: sanitizeText(address.line1 || metadata.shipping_address1, 180),
    address2: sanitizeText(address.line2 || metadata.shipping_address2, 180),
    city: sanitizeText(address.city || metadata.shipping_city, 120),
    state: sanitizeText(address.state || metadata.shipping_state, 80),
    postalCode: sanitizeText(address.postal_code || metadata.shipping_postal_code, 40),
    country: sanitizeText(address.country || metadata.shipping_country, 10).toUpperCase() || "US",
    shippingMethodId: sanitizeText(metadata.shipping_method_id, 120),
    carrier: sanitizeText(metadata.shipping_carrier, 40).toUpperCase() || "USPS",
    adultSignatureRequired: String(metadata.adult_signature_required || "true").toLowerCase() !== "false",
  };
}

function toNonNegativeInteger(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0;
  }

  return Math.floor(normalized);
}

async function findCommerceOrderByIdForActor(client, orderId, memberId, actorEmail) {
  if (!orderId || !/^[0-9a-fA-F-]{36}$/.test(orderId)) {
    return null;
  }

  const rowResult = await client.query(
    `
      select
        o.id,
        o.stripe_checkout_session_id,
        o.status,
        o.fulfillment_status,
        o.email,
        o.subtotal_cents,
        o.tax_cents,
        o.shipping_cents,
        o.total_cents,
        o.currency,
        o.compliance_status,
        o.created_at,
        o.updated_at,
        coalesce(sum(i.quantity), 0)::integer as item_count
      from public.commerce_orders o
      left join public.commerce_order_items i on i.order_id = o.id
      where o.id = $1
        and (
          o.member_id = $2
          or lower(o.email) = lower($3)
        )
      group by
        o.id,
        o.stripe_checkout_session_id,
        o.status,
        o.fulfillment_status,
        o.email,
        o.subtotal_cents,
        o.tax_cents,
        o.shipping_cents,
        o.total_cents,
        o.currency,
        o.compliance_status,
        o.created_at,
        o.updated_at
      limit 1
    `,
    [orderId, memberId, actorEmail || ""]
  );

  const row = rowResult.rows[0];
  if (!row) {
    return null;
  }

  const itemsResult = await client.query(
    `
      select id, sku, product_slug, product_name, stripe_product_id, stripe_price_id, unit_amount_cents, quantity, line_total_cents
      from public.commerce_order_items
      where order_id = $1
      order by product_name, sku
    `,
    [row.id]
  );

  return {
    id: row.id,
    orderNumber: row.stripe_checkout_session_id,
    status: row.status,
    fulfillmentStatus: row.fulfillment_status,
    email: row.email,
    subtotal: Number(row.subtotal_cents || 0) / 100,
    tax: Number(row.tax_cents || 0) / 100,
    shipping: Number(row.shipping_cents || 0) / 100,
    total: Number(row.total_cents || 0) / 100,
    currency: row.currency || "usd",
    complianceStatus: row.compliance_status,
    itemCount: Number(row.item_count || 0),
    placedAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    items: itemsResult.rows.map((item) => ({
      id: item.id,
      sku: item.sku,
      productSlug: item.product_slug,
      productName: item.product_name,
      stripeProductId: item.stripe_product_id,
      stripePriceId: item.stripe_price_id,
      unitAmountCents: Number(item.unit_amount_cents || 0),
      quantity: Number(item.quantity || 0),
      lineTotalCents: Number(item.line_total_cents || 0),
    })),
  };
}

async function findCommerceOrderByCheckoutSessionId(sessionId) {
  if (!sessionId) {
    return null;
  }

  return withDatabaseClient("ycc-api-checkout-session-status", async (client) => {
    const result = await client.query(
      `
        select id, status, fulfillment_status
        from public.commerce_orders
        where stripe_checkout_session_id = $1
        limit 1
      `,
      [sessionId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      status: row.status,
      fulfillmentStatus: row.fulfillment_status,
    };
  });
}

function applyPersistedOrderToCheckoutStatus(status, persistedOrder) {
  if (!persistedOrder) {
    return status;
  }

  return {
    ...status,
    orderRecorded: true,
    orderId: persistedOrder.id,
    fulfillmentStatus: persistedOrder.fulfillmentStatus || status.fulfillmentStatus,
    message:
      status.paymentStatus === "paid"
        ? "Stripe payment is confirmed and the Yuzu order record is in fulfillment review."
        : "Yuzu recorded the checkout order and is waiting for Stripe payment confirmation.",
  };
}

function getSupportEmailFrom() {
  return normalizeEmailAddresses(process.env.SUPPORT_EMAIL_FROM || DEFAULT_SUPPORT_EMAIL_FROM, 1)[0] || DEFAULT_SUPPORT_EMAIL_FROM;
}

function getSupportContactEmailTo() {
  return normalizeEmailAddresses(process.env.SUPPORT_CONTACT_EMAIL_TO || getSupportEmailFrom(), 1)[0] || getSupportEmailFrom();
}

function getSupportInboundReplyToAddress() {
  return normalizeEmailAddresses(process.env.SUPPORT_EMAIL_INBOUND_RECIPIENT || getSupportContactEmailTo(), 1)[0] || getSupportEmailFrom();
}

function getSupportEmailRawBucket() {
  return process.env.SUPPORT_EMAIL_RAW_BUCKET || process.env.S3_APP_BUCKET || "classroom2";
}

function getSupportEmailRawPrefix() {
  const prefix = process.env.SUPPORT_EMAIL_RAW_PREFIX || DEFAULT_SUPPORT_EMAIL_RAW_PREFIX;
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function getOutboundEmailProviderName() {
  const rawProvider = sanitizeText(process.env.EMAIL_PROVIDER || process.env.TRANSACTIONAL_EMAIL_PROVIDER || "", 40)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return rawProvider || "ses";
}

function isOutboundEmailReady() {
  const provider = getOutboundEmailProviderName();
  if (provider === "ses") {
    return process.env.FEATURE_SES === "ready";
  }

  return TRANSACTIONAL_EMAIL_PROVIDERS.has(provider) && process.env.FEATURE_EMAIL_PROVIDER === "ready";
}

function getOutboundEmailStatus() {
  const provider = getOutboundEmailProviderName();
  if (!TRANSACTIONAL_EMAIL_PROVIDERS.has(provider)) {
    return `invalid_provider:${provider || "unset"}`;
  }

  if (isOutboundEmailReady()) {
    return `${provider}_ready`;
  }

  if (provider === "ses") {
    return process.env.FEATURE_SES || "pending_production_access";
  }

  return process.env.FEATURE_EMAIL_PROVIDER || `${provider}_pending_approval`;
}

function getOutboundEmailPendingStatus() {
  return getOutboundEmailProviderName() === "ses" ? "pending_ses" : "pending_email_provider";
}

function addOutboundEmailProviderFields(result, providerMessageId = null) {
  return {
    ...result,
    ...getOutboundEmailProviderResponseFields(providerMessageId),
  };
}

function getOutboundEmailProviderResponseFields(providerMessageId = null) {
  const provider = getOutboundEmailProviderName();
  if (provider === "ses") {
    return {};
  }

  return {
    provider,
    providerMessageId: providerMessageId || null,
  };
}

function getMembershipSnapshot(actor, member) {
  const normalized = normalizeActorForMember(actor);

  return {
    tier: member?.membershipTier || normalized.membershipTier,
    status: member?.memberStatus || normalized.memberStatus,
    role: member?.role || normalized.role,
    groups: actor.groups,
  };
}

function normalizeActorForMember(actor) {
  return {
    email: actor.email || `member-${hashActor(actor.sub)}@cognito.local`,
    memberStatus: normalizeMemberStatus(actor.memberStatus, actor.groups),
    membershipTier: normalizeMembershipTier(actor.membershipTier, actor.groups),
    role: normalizeMemberRole(actor.groups),
    stripeCustomerId: sanitizeText(actor.stripeCustomerId, 160) || null,
  };
}

function normalizeMemberRole(groups) {
  const normalizedGroups = groups.map((group) => group.toLowerCase());
  if (normalizedGroups.includes("admin")) {
    return "admin";
  }

  if (normalizedGroups.includes("concierge_operator")) {
    return "operator";
  }

  return "customer";
}

function normalizeMembershipTier(value, groups) {
  const candidates = [value, ...groups];
  for (const candidate of candidates) {
    const normalized = String(candidate || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (["box_access_pass", "kisha", "sensei", "daimyo"].includes(normalized)) {
      return normalized;
    }
  }

  return null;
}

function normalizeMemberStatus(value, groups) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (["active", "paused", "cancelled", "banned", "non_member"].includes(normalized)) {
    return normalized;
  }

  if (["member", "verified", "current"].includes(normalized)) {
    return "active";
  }

  if (groups.some((group) => ["member", "kisha", "sensei", "daimyo"].includes(String(group).toLowerCase()))) {
    return "active";
  }

  return "non_member";
}

function getSupportPriority(message) {
  const normalized = message.toLowerCase();
  if (["urgent", "fraud", "chargeback"].some((term) => normalized.includes(term))) {
    return "urgent";
  }

  if (["damaged", "missing", "refund", "charge", "billing"].some((term) => normalized.includes(term))) {
    return "high";
  }

  return "normal";
}

function getUuidOrNull(value) {
  const normalized = String(value || "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return normalized;
  }

  return null;
}

function getSourceIp(event) {
  return optionalString(event.requestContext?.http?.sourceIp);
}

function getUserAgent(event) {
  return optionalString(event.headers?.["user-agent"]) || optionalString(event.headers?.["User-Agent"]);
}

function nullable(value) {
  return value === "" || value === undefined ? null : value;
}

function buildEmptyLivePageContent(route) {
  return {
    route,
    edits: {},
    updatedAt: null,
  };
}

function mapSitePageContentRow(row, route) {
  if (!row) {
    return buildEmptyLivePageContent(route);
  }

  return {
    route: row.route || route,
    edits: normalizeLivePageEdits(row.edits),
    updatedAt: row.updated_at || row.published_at ? toIsoString(row.updated_at || row.published_at) : null,
  };
}

function mapNewsStoryRow(row) {
  const metadata = normalizeMetadataObject(row.metadata);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dek: row.dek || "",
    category: row.category || "Industry News",
    bodyMarkdown: row.body_markdown || "",
    images: normalizeNewsStoryImages(metadata.images || metadata.storyImages),
    sourceNotes: normalizeNewsSourceNotes(row.source_notes),
    officialSources: normalizeStringArray(row.official_sources),
    status: row.status || "draft",
    publishedAt: row.published_at ? toIsoString(row.published_at) : null,
    updatedAt: row.updated_at ? toIsoString(row.updated_at) : null,
  };
}

function normalizeNewsDraftInput(value) {
  return {
    angle: sanitizeText(value.angle || value.topic || value.title, 160) || "weekly cigar industry news",
    timeframe: sanitizeText(value.timeframe || value.week, 80) || "this week",
    audience: sanitizeText(value.audience, 140) || "adult Yuzu Cigar Club members of legal tobacco age",
    sourceUrls: normalizeStringArray(value.sourceUrls || value.sources || value.urls).slice(0, 12),
    sourceNotes: normalizeStringArray(value.sourceNotes || value.notes).slice(0, 12),
    storyImages: normalizeNewsStoryImages(value.storyImages || value.images).slice(0, 6),
  };
}

function buildNewsAgentPrompt(input, options = {}) {
  const strictNoPlaceholder = options.strictNoPlaceholder === true;
  const vettedSources = input.sourceUrls.map(normalizeNewsSourceCandidate);
  const acceptedSources = vettedSources.filter((source) => source.status === "official" || source.status === "needs_review");
  const blockedSources = vettedSources.filter((source) => source.status === "blocked_secondary" || source.status === "invalid");
  const storyImages = normalizeNewsStoryImages(input.storyImages);
  const sourceLines = acceptedSources.length
    ? acceptedSources.map((source, index) => `${index + 1}. ${source.url} (${source.reviewNote})`).join("\n")
    : "No accepted primary sources were supplied.";
  const noteLines = input.sourceNotes.length
    ? input.sourceNotes.map((note, index) => `${index + 1}. ${note}`).join("\n")
    : "No operator notes supplied.";
  const blockedLines = blockedSources.length
    ? blockedSources.map((source) => `- ${source.input}: ${source.reviewNote}`).join("\n")
    : "None.";
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
    `Angle: ${input.angle}`,
    `Timeframe: ${input.timeframe}`,
    `Audience: ${input.audience}`,
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

function buildWeeklyNewsAgentPrompt(input) {
  const noteLines = input.sourceNotes.length
    ? input.sourceNotes.map((note, index) => `${index + 1}. ${note}`).join("\n")
    : "No operator notes supplied.";

  return [
    "You are YCCNewsAgent, an internal editorial agent for authorized Yuzu admins and concierge operators.",
    "Draft complete, operator-review-only cigar industry copy for adult readers of legal tobacco age.",
    "Write a publication-ready markdown story with clear structure and explicit operator verification points.",
    "Use only the context below and avoid health, cessation, medical, therapeutic, disease, safety, or underage tobacco claims.",
    "Return factual statements in a way that can be traced to source notes.",
    "Return JSON only with no prose before or after the object.",
    "bodyMarkdown must be a fully written story in publication-ready prose, not an outline, checklist, or operator note scaffold.",
    "",
    `Topic: ${input.angle}`,
    `Timeframe: ${input.timeframe}`,
    `Audience: ${input.audience}`,
    "",
    "Operator notes:",
    noteLines,
    "",
    "Return JSON with title, dek, category, bodyMarkdown, sections[{heading,body}], and sourceNotes[{label,url,note}].",
    "If a factual source is unavailable, write an explicit operator-verified placeholder note in the source notes and source body.",
  ].join("\n");
}

function normalizeNewsDraftFromAgentReply(reply, input) {
  const parsed = parseAgentJson(reply);
  const bodyMarkdown = sanitizeMultilineText(parsed?.bodyMarkdown, 12000);
  const parsedSections = normalizeNewsSections(parsed?.sections);
  const splitSections = splitNewsMarkdownToSections(bodyMarkdown);
  const sections =
    bodyMarkdown
      ? splitSections.length
        ? splitSections
        : parsedSections.length
          ? parsedSections
          : buildFallbackNewsSections(input)
      : parsedSections.length
        ? parsedSections
        : buildFallbackNewsSections(input);

  return {
    title: sanitizeText(parsed?.title, 120) || `${toTitleCase(input.angle)} brief`,
    dek:
      sanitizeText(parsed?.dek || parsed?.summary, 220) ||
      "A human-reviewed Yuzu Cigar Club news draft built from primary source notes.",
    category: sanitizeText(parsed?.category, 80) || "Industry News",
    bodyMarkdown: bodyMarkdown || draftNewsSectionsToMarkdown(sections),
    sections,
    images: mergeNewsStoryImages(input.storyImages, parsed?.images, parsed?.storyImages),
    sourceNotes: normalizeNewsSourceNotes(parsed?.sourceNotes, input),
    publishStatus: "draft",
    operatorReviewRequired: true,
    complianceReview: buildNewsComplianceReview(),
  };
}

function hasUsableNewsDraftReply(reply) {
  const parsed = parseAgentJson(reply);
  const bodyMarkdown = sanitizeMultilineText(parsed?.bodyMarkdown, 12000);
  const sections = normalizeNewsSections(parsed?.sections);
  const body = bodyMarkdown || draftNewsSectionsToMarkdown(sections);

  return Boolean(body) && !isPlaceholderNewsBodyMarkdown(body);
}

function mergeNewsStoryImages(...values) {
  const seen = new Set();

  return values
    .flatMap((value) => normalizeNewsStoryImages(value))
    .filter((image) => {
      const key = image.image.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function normalizeNewsStoryImages(value) {
  const rawImages = Array.isArray(value) ? value : [];

  return rawImages
    .map((item) => {
      const record = typeof item === "string" ? { image: item } : item && typeof item === "object" ? item : null;

      if (!record) {
        return null;
      }

      const image = sanitizeText(record.image || record.src || record.url, 1000);
      if (!isHttpUrl(image)) {
        return null;
      }

      const sourceUrl = sanitizeText(record.sourceUrl || record.storyUrl || record.href, 1000);
      const imagePosition = sanitizeText(record.imagePosition || record.objectPosition, 40);
      const alt = sanitizeText(record.alt, 180);
      const normalized = {
        label: sanitizeText(record.label || record.title, 90) || "Story image",
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
    .filter(Boolean);
}

function normalizeNewsStoryInput(value) {
  const title = sanitizeText(value.title, 160);
  const sourceNotes = normalizeNewsSourceNotes(value.sourceNotes);
  const sections = normalizeNewsSections(value.sections);
  const bodyMarkdown = sanitizeMultilineText(value.bodyMarkdown || draftNewsSectionsToMarkdown(sections), 12000);
  const status = value.publishStatus === "published" || value.status === "published" ? "published" : "draft";
  const images = mergeNewsStoryImages(value.images, value.storyImages);

  if (!title) {
    return {
      error: {
        error: "missing_news_title",
        message: "Add a title before publishing the news story.",
      },
    };
  }

  if (!bodyMarkdown) {
    return {
      error: {
        error: "missing_news_body",
        message: "Add story body copy before publishing.",
      },
    };
  }

  if (status === "published" && isPlaceholderNewsBodyMarkdown(bodyMarkdown)) {
    return {
      error: {
        error: "news_story_placeholder_body",
        message: "Replace the placeholder scaffold with a real story before publishing.",
      },
    };
  }

  if (!sourceNotes.some((source) => source.sourceType === "official" || source.sourceType === "needs_review")) {
    return {
      error: {
        error: "official_source_required",
        message: "At least one primary source note is required before publishing.",
      },
    };
  }

  return {
    value: {
      slug: sanitizeText(value.slug, 180) || slugify(title),
      title,
      dek: sanitizeText(value.dek || value.summary, 240),
      category: sanitizeText(value.category, 80) || "Industry News",
      bodyMarkdown,
      images,
      sourceNotes,
      officialSources: sourceNotes
        .filter((source) => source.sourceType === "official" || source.sourceType === "needs_review")
        .map((source) => source.url),
      status,
      publishedAt: null,
      updatedAt: null,
      complianceReview: buildNewsComplianceReview(),
    },
  };
}

function normalizeNewsSourceCandidate(value) {
  const input = sanitizeText(value, 500);
  if (!input) {
    return {
      input: String(value || ""),
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
      return buildInvalidNewsSource(input, "Use an HTTP or HTTPS source URL.");
    }

    const domain = normalizeNewsDomain(parsedUrl.hostname);
    if (isBlockedSecondaryNewsDomain(domain)) {
      return {
        input,
        url: parsedUrl.toString(),
        domain,
        status: "blocked_secondary",
        sourceType: "blocked_secondary",
        reviewNote: "This looks like a magazine or third-party story. Use it only as a lead; do not rewrite it.",
      };
    }

    if (OFFICIAL_CIGAR_NEWS_DOMAINS.has(domain)) {
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
      reviewNote: "Unknown source. Verify it is a brand, distributor, event organizer, regulator, or official wire before publishing.",
    };
  } catch {
    return buildInvalidNewsSource(input, "Enter a valid source URL.");
  }
}

function normalizeNewsSourceNotes(value, input = null) {
  const notes = Array.isArray(value) ? value : [];
  const normalizedNotes = notes
    .map((item) => {
      if (typeof item === "string") {
        const source = normalizeNewsSourceCandidate(item);
        return {
          label: source.domain || "Source",
          url: source.url || item,
          note: source.reviewNote,
          sourceType: source.sourceType,
          domain: source.domain,
          reviewNote: source.reviewNote,
        };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const source = normalizeNewsSourceCandidate(item.url || "");
      return {
        label: sanitizeText(item.label, 80) || source.domain || "Source",
        url: source.url || sanitizeText(item.url, 500),
        note: sanitizeText(item.note, 320) || source.reviewNote,
        sourceType: source.sourceType,
        domain: source.domain,
        reviewNote: source.reviewNote,
      };
    })
    .filter((source) => source && source.url);

  if (normalizedNotes.length || !input) {
    return normalizedNotes;
  }

  return input.sourceUrls
    .map((sourceUrl, index) => {
      const source = normalizeNewsSourceCandidate(sourceUrl);
      return {
        label: source.domain || `Source ${index + 1}`,
        url: source.url || sourceUrl,
        note: sanitizeText(input.sourceNotes[index], 320) || source.reviewNote,
        sourceType: source.sourceType,
        domain: source.domain,
        reviewNote: source.reviewNote,
      };
    })
    .filter((source) => source.url);
}

function normalizeNewsSections(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const heading = sanitizeText(section.heading, 100);
      const body = sanitizeMultilineText(section.body, 5000);
      return heading && body ? { heading, body } : null;
    })
    .filter(Boolean);
}

function splitNewsMarkdownToSections(markdown) {
  const normalized = sanitizeMultilineText(markdown, 12000);
  if (!normalized) {
    return [];
  }

  const headings = [...normalized.matchAll(/^##\s+(.+)$/gm)];
  if (!headings.length) {
    return [
      {
        heading: "Story",
        body: normalized,
      },
    ];
  }

  return headings
    .map((current, index) => {
      const heading = sanitizeText(current[1], 100);
      const start = current.index + current[0].length;
      const end = index + 1 < headings.length ? headings[index + 1].index : normalized.length;
      const body = sanitizeMultilineText(normalized.slice(start, end).trim(), 5000);

      return heading && body ? { heading, body } : null;
    })
    .filter(Boolean);
}

function buildFallbackNewsSections(input) {
  return [
    {
      heading: "What changed",
      body: `Yuzu is tracking ${input.angle} based on the official source notes supplied for ${input.timeframe}. Keep this section factual and concise until an operator verifies each detail against the source URLs.`,
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

function draftNewsSectionsToMarkdown(sections) {
  return sections
    .map((section) => ({
      heading: sanitizeText(section.heading, 90),
      body: sanitizeMultilineText(section.body, 5000),
    }))
    .filter((section) => Boolean(section.heading && section.body))
    .map((section) => `## ${section.heading}\n${section.body}`)
    .join("\n\n");
}

function isPlaceholderNewsBodyMarkdown(value) {
  const normalized = sanitizeMultilineText(value, 12000).toLowerCase();

  if (!normalized) {
    return true;
  }

  return (
    normalized.includes("## what changed") &&
    normalized.includes("## why adult members may care") &&
    normalized.includes("## operator review notes") &&
    FALLBACK_NEWS_BODY_PATTERNS.every((pattern) => normalized.includes(pattern))
  );
}

function buildNewsComplianceReview() {
  return {
    ageRestricted: true,
    humanApprovalRequired: true,
    sourceVerificationRequired: true,
    prohibitedClaims: ["health", "cessation", "medical", "therapeutic", "disease", "safe tobacco use"],
    prohibitedInputs: ["underage tobacco", "age-check bypass", "payment-card collection", "third-party article rewrite"],
  };
}

function parseAgentJson(reply) {
  const text = sanitizeMultilineText(reply, 20000);
  if (!text) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text.match(/\{[\s\S]*\}/)?.[0] || "";

  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildInvalidNewsSource(input, reviewNote) {
  return {
    input,
    url: "",
    domain: "",
    status: "invalid",
    sourceType: "invalid",
    reviewNote,
  };
}

function normalizeNewsDomain(value) {
  return String(value || "").toLowerCase().replace(/^www\./, "");
}

function isHttpUrl(value) {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:";
  } catch {
    return false;
  }
}

function isBlockedSecondaryNewsDomain(domain) {
  return BLOCKED_SECONDARY_NEWS_DOMAINS.has(domain) || [...BLOCKED_SECONDARY_NEWS_DOMAINS].some((blocked) => domain.endsWith(`.${blocked}`));
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeText(String(item || ""), 500)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\r?\n|,/)
      .map((item) => sanitizeText(item, 500))
      .filter(Boolean);
  }

  return [];
}

function toTitleCase(value) {
  return sanitizeText(value, 160).replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function mapHumidorItemRow(row) {
  const metadata = normalizeMetadataObject(row.metadata);
  const estimatedValue = normalizeHumidorMoneyValue(metadata.estimatedValue);
  const cigarImage = summarizeStoredHumidorCigarImage(metadata.cigarImage);

  return {
    id: row.id,
    name: row.name,
    brand: row.brand || "",
    line: row.line || "",
    vitola: row.vitola || "",
    wrapper: row.wrapper || "",
    origin: row.origin || "",
    strength: row.strength || "",
    quantity: Number(row.quantity || 0),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    purchaseDate: toDateOnly(row.purchase_date),
    agingStartDate: toDateOnly(row.aging_start_date),
    productionDate: toDateOnly(metadata.productionDate),
    reorderReminder: toDateOnly(row.reorder_reminder),
    humidorLocation: row.humidor_location || "",
    tray: row.tray || "",
    tastingNotes: row.tasting_notes || "",
    source: row.source || "api",
    estimatedValue,
    estimatedValueCurrency: estimatedValue === null ? "" : normalizeHumidorCurrency(metadata.estimatedValueCurrency) || "USD",
    estimatedValueSource: estimatedValue === null ? "" : sanitizeText(metadata.estimatedValueSource, 120),
    cigarImage,
    createdAt: toIsoString(row.created_at),
  };
}

async function mapHumidorItemRowForClient(client, row, memberId, actor, requestId) {
  const item = mapHumidorItemRow(row);
  const metadata = normalizeMetadataObject(row.metadata);

  return {
    ...item,
    cigarImage: await resolveHumidorCigarImageForClient(metadata.cigarImage, {
      actor,
      client,
      itemId: row.id,
      itemName: row.name,
      memberId,
      requestId,
    }),
  };
}

function mapHumidorSmokeLogRow(row) {
  const metadata = normalizeMetadataObject(row.metadata);
  const drinkPairing = sanitizeText(row.pairing || metadata.drinkPairing || metadata.drink || "", MAX_FIELD_LENGTH);

  return {
    id: row.id,
    humidorItemId: row.humidor_item_id || null,
    cigarName: row.cigar_name || "",
    smokedAt: toIsoString(row.smoked_at),
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    drinkPairing,
    pairing: drinkPairing,
    notes: row.notes || "",
    durationMinutes: row.duration_minutes === null || row.duration_minutes === undefined ? null : Number(row.duration_minutes),
    source: sanitizeText(metadata.source, 120) || "member_smoke_log",
    createdAt: toIsoString(row.created_at),
  };
}

function mapHumidorSmokeLogForResponse(log) {
  const drinkPairing = sanitizeText(log.drinkPairing || log.pairing, MAX_FIELD_LENGTH);

  return {
    humidorItemId: log.humidorItemId || null,
    cigarName: log.cigarName,
    smokedAt: log.smokedAt || new Date().toISOString(),
    rating: log.rating,
    drinkPairing,
    pairing: drinkPairing,
    notes: log.notes,
    durationMinutes: log.durationMinutes,
    source: log.source || "member_smoke_log",
    createdAt: log.createdAt || new Date().toISOString(),
  };
}

function normalizeHumidorAlertPreferences(value) {
  const raw = value && typeof value === "object" ? value : {};
  const normalized = {
    pushEnabled: Boolean(raw.pushEnabled),
    reorderRemindersEnabled: raw.reorderRemindersEnabled === undefined ? true : Boolean(raw.reorderRemindersEnabled),
    climateAlertsEnabled: Boolean(raw.climateAlertsEnabled),
    pushSubscription: normalizeHumidorPushSubscription(raw.pushSubscription),
    pairedDevices: normalizeHumidorPairedDevices(raw.pairedDevices),
    humidorProfile: normalizeHumidorLocationProfile(raw.humidorProfile),
  };

  return {
    ...DEFAULT_HUMIDOR_ALERT_PREFERENCES,
    ...normalized,
  };
}

function normalizeHumidorAlertPreferencesInput(value) {
  const raw = value && typeof value === "object" ? value : {};
  const pushEnabled = Boolean(raw.pushEnabled);
  const reorderRemindersEnabled = raw.reorderRemindersEnabled === undefined ? true : Boolean(raw.reorderRemindersEnabled);
  const climateAlertsEnabled = Boolean(raw.climateAlertsEnabled);

  return {
    ...DEFAULT_HUMIDOR_ALERT_PREFERENCES,
    pushEnabled,
    reorderRemindersEnabled,
    climateAlertsEnabled,
    pushSubscription: pushEnabled ? normalizeHumidorPushSubscription(raw.pushSubscription) : null,
    pairedDevices: normalizeHumidorPairedDevices(raw.pairedDevices),
    humidorProfile: normalizeHumidorLocationProfile(raw.humidorProfile),
  };
}

function normalizeHumidorLocationProfile(value) {
  const raw = value && typeof value === "object" ? value : {};

  return {
    humidorName: sanitizeText(raw.humidorName || raw.name, 120),
    defaultLocation: sanitizeText(raw.defaultLocation || raw.location || raw.defaultHumidorLocation, 120),
    locations: normalizeHumidorProfileLocations(raw.locations || raw.savedLocations || raw.locationOptions),
  };
}

function normalizeHumidorProfileLocationKind(value) {
  return sanitizeText(value, 40).toLowerCase() === "humidor" ? "humidor" : "other";
}

function normalizeHumidorProfileTextList(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/\r?\n|,/)
      : [];
  const values = [];
  const seen = new Set();

  for (const rawValue of rawValues) {
    const text = sanitizeText(String(rawValue || ""), 120);
    const key = text.toLowerCase();

    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    values.push(text);
  }

  return values;
}

function normalizeHumidorProfileLocation(value) {
  if (typeof value === "string") {
    const name = sanitizeText(value, 120);
    return name ? { name, kind: "other", trays: [] } : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const name = sanitizeText(value.name || value.location || value.label, 120);
  if (!name) {
    return null;
  }

  const kind = normalizeHumidorProfileLocationKind(value.kind || value.type || value.locationType);
  const trays = kind === "humidor" ? normalizeHumidorProfileTextList(value.trays || value.trayNames || value.trayOptions) : [];

  return { name, kind, trays };
}

function normalizeHumidorProfileLocations(value) {
  const rawLocations = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/\r?\n|,/)
      : [];
  const locations = [];
  const locationsByKey = new Map();

  for (const rawLocation of rawLocations) {
    const location = normalizeHumidorProfileLocation(rawLocation);

    if (!location) {
      continue;
    }

    const key = location.name.toLowerCase();
    const existing = locationsByKey.get(key);

    if (!existing) {
      locationsByKey.set(key, location);
      locations.push(location);
      continue;
    }

    if (location.kind === "humidor") {
      existing.kind = "humidor";
      existing.trays = normalizeHumidorProfileTextList([...existing.trays, ...location.trays]);
    }
  }

  return locations.map((location) => ({
    ...location,
    trays: location.kind === "humidor" ? normalizeHumidorProfileTextList(location.trays) : [],
  }));
}

function normalizeHumidorPushSubscription(value) {
  const raw = value && typeof value === "object" ? value : {};
  const endpoint = sanitizeText(raw.endpoint, 1024);

  if (!endpoint) {
    return null;
  }

  const keys = raw.keys && typeof raw.keys === "object" ? raw.keys : {};
  const p256dh = sanitizeText(keys.p256dh, 200);
  const auth = sanitizeText(keys.auth, 200);

  if (!p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  };
}

function normalizeHumidorPairedDevices(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const deviceType = normalizeHumidorDeviceType(item.deviceType);
    const connection = normalizeHumidorDeviceConnection(item.connection);
    const name = sanitizeText(item.name, 120);
    const location = sanitizeText(item.location, 120);
    const identifier = sanitizeText(item.identifier, 180);
    const humidity = Number(item.humidity);
    const temperature = Number(item.temperature);

    if (!deviceType || !connection || !name || !location || !identifier || !isValidHumidorDeviceClimate(humidity, temperature)) {
      return [];
    }

    const syncIntervalMinutes = Math.max(5, Math.min(120, Math.round(Number(item.syncIntervalMinutes) || 15)));
    const id = sanitizeText(item.id, 220) || buildHumidorPairedDeviceId(deviceType, connection, name, location, identifier);

    return [
      {
        id,
        name,
        location,
        deviceType,
        connection,
        identifier,
        humidity,
        temperature,
        syncIntervalMinutes,
        status: item.status === "Ready to sync" ? "Ready to sync" : "Connected",
        lastSyncedAt: sanitizeText(item.lastSyncedAt, 80) || "Just now",
      },
    ];
  });
}

function normalizeHumidorDeviceType(value) {
  if (value === "HUMIDIFIER" || value === "HYGROMETER_THERMOMETER") {
    return value;
  }

  const normalized = sanitizeText(value, 80)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "humidifier") {
    return "HUMIDIFIER";
  }

  if (normalized === "hygrometer" || normalized === "hygrometer_thermometer") {
    return "HYGROMETER_THERMOMETER";
  }

  return "";
}

function normalizeHumidorDeviceConnection(value) {
  return value === "Bluetooth" || value === "WiFi" ? value : "";
}

function isValidHumidorDeviceClimate(humidity, temperature) {
  return Number.isFinite(humidity) && humidity >= 1 && humidity <= 100 && Number.isFinite(temperature) && temperature >= 40 && temperature <= 95;
}

function buildHumidorPairedDeviceId(deviceType, connection, name, location, identifier) {
  return `device-${deviceType}-${connection}-${name}-${location}-${identifier}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeMetadataObject(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function buildNewsStoryMetadata(story, actor) {
  const metadata = {
    complianceReview: story.complianceReview || null,
    source: "newsroom-agent",
    updatedBySub: actor.sub,
  };
  const images = normalizeNewsStoryImages(story.images);

  if (images.length) {
    metadata.images = images;
  }

  return metadata;
}

function buildHumidorItemMetadata(actor, item) {
  const metadata = {
    ownerSub: actor.sub,
  };

  if (item.estimatedValue !== null) {
    metadata.estimatedValue = item.estimatedValue;
    metadata.estimatedValueCurrency = item.estimatedValueCurrency || "USD";
    metadata.estimatedValueSource = item.estimatedValueSource || "member_estimate";
  }

  if (item.productionDate) {
    metadata.productionDate = item.productionDate;
  }

  if (item.cigarImage) {
    metadata.cigarImage = item.cigarImage;
  }

  return metadata;
}

function toDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function toIsoString(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

async function maybeBuildBedrockReply(agent, actor, message, conversationId, options = {}) {
  const modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID;
  const guardrailsEnabled = process.env.BEDROCK_ENABLE_GUARDRAILS === "1";
  const guardrailId = guardrailsEnabled ? process.env.BEDROCK_GUARDRAIL_ID || null : null;
  const guardrailVersion = guardrailsEnabled ? process.env.BEDROCK_GUARDRAIL_VERSION || null : null;
  const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID || null;
  const prefetchedKnowledgeBaseRetrieval = options.knowledgeBaseRetrieval || null;
  const catalogRecommendations = await maybeSelectCatalogRecommendationsForMessage(message);
  const catalogRecommendationContext = buildCatalogRecommendationContext(catalogRecommendations);
  const memberHumidor = options.includeMemberHumidorContext
    ? await maybeBuildMemberHumidorContext(actor, message, options.requestId || conversationId)
    : { context: "", items: [] };
  const memberHumidorContext = memberHumidor.context;

  if (process.env.FEATURE_BEDROCK !== "runtime_ready") {
    return {
      status: process.env.FEATURE_BEDROCK || "pending_agent",
      modelId,
      knowledgeBaseId,
      guardrailId,
      guardrailVersion,
      reply: null,
    };
  }

  const agentTarget = options.forceDirectRuntime ? null : shouldUseBedrockAgentRuntime(agent) ? resolveBedrockAgentTarget(agent) : null;
  if (agentTarget) {
    try {
      const { BedrockAgentRuntimeClient, InvokeAgentCommand } = require("@aws-sdk/client-bedrock-agent-runtime");
      const client = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
      const agentSessionId = buildBedrockAgentSessionId(actor, conversationId);
      const command = new InvokeAgentCommand({
        agentId: agentTarget.agentId,
        agentAliasId: agentTarget.agentAliasId,
        sessionId: agentSessionId,
        inputText: buildBedrockAgentInputText(
          message,
          combineAgentContext(prefetchedKnowledgeBaseRetrieval?.context, catalogRecommendationContext, memberHumidorContext)
        ),
        enableTrace: process.env.BEDROCK_AGENT_ENABLE_TRACE === "1",
        sessionState: {
          sessionAttributes: buildAgentSessionAttributes(agent, actor, conversationId),
          promptSessionAttributes: {
            selectedAgent: agent,
            conversationId: String(conversationId || ""),
            responseStyle: "direct_concise",
            responseStyleInstruction: CONCIERGE_RESPONSE_STYLE_INSTRUCTION,
          },
        },
      });

      const result = await client.send(command);
      const reply = await extractAgentCompletionText(result);

      if (reply) {
        const finalReply = normalizeAgentReply(agent, message, reply, catalogRecommendations, memberHumidor);

        return {
          status: "bedrock_agent_runtime",
          modelId,
          agentId: agentTarget.agentId,
          agentAliasId: agentTarget.agentAliasId,
          agentSessionId,
          knowledgeBaseId,
          knowledgeBaseStatus: prefetchedKnowledgeBaseRetrieval?.status,
          retrievedContextCount: prefetchedKnowledgeBaseRetrieval?.count,
          guardrailId,
          guardrailVersion,
          reply: finalReply,
        };
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "warn",
          event: "bedrock_agent_runtime_fallback",
          agent,
          agentId: agentTarget.agentId,
          agentAliasId: agentTarget.agentAliasId,
          name: error instanceof Error ? error.name : null,
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  const knowledgeBaseRetrieval = prefetchedKnowledgeBaseRetrieval || (await maybeRetrieveKnowledgeBaseContext(knowledgeBaseId, message));
  const runtimeContext = combineAgentContext(knowledgeBaseRetrieval.context, catalogRecommendationContext, memberHumidorContext);

  try {
    const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: "user",
          content: [{ text: message }],
        },
      ],
      system: [{ text: buildAgentSystemPrompt(agent, actor, runtimeContext) }],
      inferenceConfig: {
        maxTokens: options.maxTokens || 700,
        temperature: options.temperature ?? 0.4,
        topP: options.topP ?? 0.9,
      },
      ...(guardrailId && guardrailVersion
        ? {
            guardrailConfig: {
              guardrailIdentifier: guardrailId,
              guardrailVersion,
              trace: "enabled",
            },
          }
        : {}),
    });
    const result = await client.send(command);
    let reply = extractConverseText(result);
    reply = normalizeAgentReply(agent, message, reply, catalogRecommendations, memberHumidor);

    return {
      status: reply ? "bedrock_runtime" : "fallback",
      modelId,
      knowledgeBaseId,
      knowledgeBaseStatus: knowledgeBaseRetrieval.status,
      retrievedContextCount: knowledgeBaseRetrieval.count,
      guardrailId,
      guardrailVersion,
      stopReason: result.stopReason || null,
      tokenUsage: result.usage || null,
      reply,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "bedrock_runtime_fallback",
        agent,
        modelId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    if (isCigarGuideQuestion(message)) {
      const reply = agent === "YCCCigarGuide" && isDisallowedTobaccoAccessQuestion(message)
        ? buildAdultCigarQuestionFallbackReply(message)
        : catalogRecommendations.length
        ? buildCatalogRecommendationReply(catalogRecommendations)
        : buildAdultCigarQuestionFallbackReply(message);

      return {
        status: "bedrock_runtime",
        modelId,
        knowledgeBaseId,
        knowledgeBaseStatus: knowledgeBaseRetrieval.status,
        retrievedContextCount: knowledgeBaseRetrieval.count,
        guardrailId,
        guardrailVersion,
        reply,
      };
    }

    if (shouldUseMemberHumidorFallbackReply(message, "", memberHumidor)) {
      return {
        status: "fallback",
        modelId,
        knowledgeBaseId,
        knowledgeBaseStatus: knowledgeBaseRetrieval.status,
        retrievedContextCount: knowledgeBaseRetrieval.count,
        guardrailId,
        guardrailVersion,
        reply: buildMemberHumidorFallbackReply(memberHumidor.items),
      };
    }

    if (agent === "YCCSupportAgent" && shouldUseSupportFallbackReply(message, "")) {
      return {
        status: "fallback",
        modelId,
        knowledgeBaseId,
        knowledgeBaseStatus: knowledgeBaseRetrieval.status,
        retrievedContextCount: knowledgeBaseRetrieval.count,
        guardrailId,
        guardrailVersion,
        reply: buildSupportFallbackReply(message),
      };
    }

    return {
      status: "fallback",
      modelId,
      knowledgeBaseId,
      knowledgeBaseStatus: knowledgeBaseRetrieval.status,
      retrievedContextCount: knowledgeBaseRetrieval.count,
      guardrailId,
      guardrailVersion,
      reply: null,
    };
  }
}

function normalizeAgentReply(agent, message, reply, catalogRecommendations, memberHumidor) {
  if (agent === "YCCCigarGuide" && isDisallowedTobaccoAccessQuestion(message)) {
    return buildAdultCigarQuestionFallbackReply(message);
  }

  if (shouldUseMemberHumidorFallbackReply(message, reply, memberHumidor)) {
    return buildMemberHumidorFallbackReply(memberHumidor.items);
  }

  if (shouldUseCatalogRecommendationFallbackReply(message, reply, catalogRecommendations)) {
    return buildCatalogRecommendationReply(catalogRecommendations);
  }

  if (agent === "YCCCigarGuide" && shouldUseAdultCigarQuestionFallbackReply(message, reply)) {
    return buildAdultCigarQuestionFallbackReply(message);
  }

  if (agent === "YCCSupportAgent" && shouldUseSupportFallbackReply(message, reply)) {
    return buildSupportFallbackReply(message);
  }

  return reply;
}

async function maybeSelectCatalogRecommendationsForMessage(message) {
  if (!shouldUseCatalogRecommendations(message)) {
    return [];
  }

  try {
    const commerceEnv = await getCommerceRuntimeEnv();
    const launchCatalog = loadStripeLaunchCatalog(commerceEnv);
    if (launchCatalog.error || !launchCatalog.catalog.length) {
      return [];
    }

    return selectCatalogRecommendationsForMessage(launchCatalog.catalog, message, 5);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "catalog_recommendation_context_unavailable",
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return [];
  }
}

function shouldUseCatalogRecommendations(message) {
  const normalized = String(message || "").toLowerCase();
  if (!isCigarGuideQuestion(normalized)) {
    return false;
  }

  if (isDisallowedTobaccoAccessQuestion(normalized)) {
    return false;
  }

  if (shouldUseMemberHumidorContext(normalized)) {
    return false;
  }

  return /\b(recommend|suggest|which|what should i buy|what cigar|catalog|shop|available|in stock|new arrival|latest cigar|box|sampler|pair|pairing|coffee|espresso|beginner|mild|medium|full|maduro|connecticut|habano|broadleaf|infused|sweet|budget)\b/.test(
    normalized
  );
}

function selectCatalogRecommendationsForMessage(catalog, message, limit = 5) {
  const maxPrice = extractCatalogRecommendationMaxPrice(message);
  const terms = buildCatalogRecommendationTerms(message);
  const scored = catalog
    .filter(isRecommendableCigarCatalogProduct)
    .filter((product) => maxPrice === null || product.price <= maxPrice)
    .map((product, index) => ({
      product,
      index,
      score: scoreCatalogRecommendation(product, terms),
    }))
    .filter((entry) => entry.score > 0 || terms.length === 0)
    .sort((left, right) => right.score - left.score || left.product.price - right.product.price || left.index - right.index);

  const recommendations = scored.length
    ? scored
    : catalog
        .filter(isRecommendableCigarCatalogProduct)
        .map((product, index) => ({ product, index, score: 0 }))
        .sort((left, right) => left.product.price - right.product.price || left.index - right.index);

  return recommendations.slice(0, limit).map((entry) => entry.product);
}

function isRecommendableCigarCatalogProduct(product) {
  if (!product || product.shippable === false) {
    return false;
  }

  if (sanitizeText(product.publishStatus, 40).toLowerCase() !== "published") {
    return false;
  }

  const text = `${product.name} ${product.category} ${product.description}`.toLowerCase();
  if (/\b(humidor|lighter|torch|butane|fluid|ashtray|cutter|punch cutter|display|book matches|membership|subscription)\b/.test(text)) {
    return false;
  }

  return /\b(cigar|cigars|robusto|toro|churchill|corona|gordo|lonsdale|belicoso|torpedo|maduro|connecticut|habano|sampler|box|bx|bundle|bdl)\b/.test(
    text
  );
}

function extractCatalogRecommendationMaxPrice(message) {
  const text = String(message || "").toLowerCase();
  const match = text.match(/\b(?:under|below|less than|max|maximum|budget)\s*\$?\s*(\d{2,4})(?:\.\d{1,2})?\b/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildCatalogRecommendationTerms(message) {
  const normalized = String(message || "")
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ");
  const stopWords = new Set([
    "adult",
    "adults",
    "cigar",
    "cigars",
    "from",
    "with",
    "that",
    "this",
    "what",
    "which",
    "would",
    "should",
    "recommend",
    "suggest",
    "catalog",
    "yuzu",
    "shop",
    "box",
    "boxes",
    "buy",
    "for",
    "and",
  ]);
  const terms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !stopWords.has(term));

  if (/\b(coffee|morning|breakfast|cream|creamy|mild|smooth|beginner)\b/.test(normalized)) {
    terms.push("connecticut", "shade", "claro", "mild");
  }

  if (/\b(espresso|dessert|chocolate|cocoa|sweet|maduro)\b/.test(normalized)) {
    terms.push("maduro", "java", "cocoa");
  }

  if (/\b(full|bold|strong|pepper|peppery)\b/.test(normalized)) {
    terms.push("full", "habano", "broadleaf", "nicaragua");
  }

  if (/\b(infused|aromatic|sweet)\b/.test(normalized)) {
    terms.push("acid", "java", "infused");
  }

  return Array.from(new Set(terms));
}

function scoreCatalogRecommendation(product, terms) {
  const searchable = `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (searchable.includes(term)) {
      score += product.name.toLowerCase().includes(term) ? 6 : 3;
    }
  }

  if (/\bconnecticut\b/i.test(product.name) && terms.includes("coffee")) {
    score += 4;
  }

  if (/\b(java|maduro)\b/i.test(product.name) && (terms.includes("espresso") || terms.includes("cocoa"))) {
    score += 4;
  }

  if (score === 0 && /\b(cigar|cigars|sampler)\b/i.test(product.category)) {
    score = 1;
  }

  return score;
}

function buildCatalogRecommendationContext(recommendations) {
  if (!recommendations.length) {
    return "";
  }

  return [
    "Yuzu live product catalog recommendations:",
    ...recommendations.map((product, index) => {
      const parts = [
        `${index + 1}. ${product.name}`,
        `SKU ${product.sku}`,
        `${formatMoney(product.price)} public price`,
        `shop /shop/${product.slug}/`,
      ];

      if (product.category) {
        parts.push(`category ${product.category}`);
      }

      return parts.join(" | ");
    }),
    "When the member asks for cigar suggestions from the Yuzu catalog, recommend only these listed products and include the shop path.",
  ].join("\n");
}

function combineAgentContext(...contexts) {
  return contexts
    .map((context) => sanitizeMultilineText(context, 4500))
    .filter(Boolean)
    .join("\n\n");
}

function shouldUseCatalogRecommendationFallbackReply(message, reply, recommendations) {
  if (!recommendations.length || !shouldUseCatalogRecommendations(message)) {
    return false;
  }

  if (isAgentGuardrailRefusalReply(reply)) {
    return true;
  }

  const normalizedReply = String(reply || "").toLowerCase();
  return !recommendations.some((product) => normalizedReply.includes(product.name.toLowerCase()) || normalizedReply.includes(`/shop/${product.slug}/`));
}

function buildCatalogRecommendationReply(recommendations) {
  const lines = recommendations.slice(0, 4).map((product, index) => {
    const category = product.category ? `, ${product.category}` : "";
    return `${index + 1}. ${product.name}${category}: ${formatMoney(product.price)} public price, SKU ${product.sku}, /shop/${product.slug}/`;
  });

  return [
    "For adults 21+, I would start with these live Yuzu catalog options:",
    ...lines,
    "I would still confirm current availability and adult-signature shipping at checkout before you place the order.",
  ].join("\n");
}

async function maybeBuildMemberHumidorContext(actor, message, requestId) {
  if (!shouldUseMemberHumidorContext(message) || !actor || !shouldPersistDatabaseWrites()) {
    return { context: "", items: [] };
  }

  if (buildHumidorMembershipDeniedPayload(actor)) {
    return { context: "", items: [] };
  }

  try {
    return await withDatabaseClient("ycc-api-agent-humidor-context", async (client) => {
      const member = await upsertMember(client, actor, sanitizeText(requestId, 120) || `agent_humidor_${crypto.randomUUID()}`);
      const result = await client.query(
        `
          select
            id,
            name,
            brand,
            line,
            vitola,
            wrapper,
            origin,
            strength,
            quantity,
            rating,
            purchase_date,
            aging_start_date,
            reorder_reminder,
            humidor_location,
            tray,
            tasting_notes,
            source,
            metadata,
            created_at
          from public.humidor_items
          where member_id = $1 and archived_at is null
          order by created_at desc
          limit 20
        `,
        [member.id]
      );
      const items = result.rows.map(mapHumidorItemRow);
      return {
        context: buildMemberHumidorContext(items),
        items,
      };
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "member_humidor_context_unavailable",
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return { context: "", items: [] };
  }
}

function shouldUseMemberHumidorContext(message) {
  const normalized = String(message || "").toLowerCase();
  const ownsHumidorContext = /\b(digital humidor|my humidor|member humidor|saved cigars|my collection|my inventory)\b/.test(normalized);
  const inventoryIntent =
    /\b(humidor inventory|inventory|saved cigars|my collection|my inventory|which cigar|what cigar|what should i smoke|smoke tonight|smoke next|reorder soon|reorder reminder|aging window|ready to smoke|locker|tray|quantity|qty)\b/.test(
      normalized
    ) || /\bwhat(?:'s| is)? in my humidor\b/.test(normalized);

  return ownsHumidorContext && inventoryIntent;
}

function buildMemberHumidorContext(items) {
  if (!items.length) {
    return "Member digital humidor inventory: no saved cigars found for this member.";
  }

  return [
    "Member digital humidor inventory:",
    ...items.slice(0, 12).map((item, index) => {
      const parts = [
        `${index + 1}. ${item.name}`,
        `qty ${item.quantity || 0}`,
        item.humidorLocation ? `location ${item.humidorLocation}${item.tray ? ` / ${item.tray}` : ""}` : "location not set",
      ];

      const blend = [item.brand, item.line, item.vitola, item.wrapper, item.strength].filter(Boolean).join(", ");
      if (blend) {
        parts.push(`details ${blend}`);
      }

      if (typeof item.rating === "number") {
        parts.push(`member rating ${item.rating}`);
      }

      if (item.agingStartDate) {
        parts.push(`aging start ${item.agingStartDate}`);
      }

      if (item.reorderReminder) {
        parts.push(`reorder ${item.reorderReminder}`);
      }

      if (item.tastingNotes) {
        parts.push(`notes ${sanitizeText(item.tastingNotes, 140)}`);
      }

      return parts.join(" | ");
    }),
    "Use this member-owned inventory when answering questions about what to smoke, age, move, rate, reorder, or compare. Do not claim changes were saved unless an authenticated action confirms it.",
  ].join("\n");
}

function shouldUseMemberHumidorFallbackReply(message, reply, memberHumidor) {
  if (!shouldUseMemberHumidorContext(message) || !memberHumidor?.context) {
    return false;
  }

  if (isAgentGuardrailRefusalReply(reply)) {
    return true;
  }

  const items = Array.isArray(memberHumidor.items) ? memberHumidor.items : [];
  const normalizedReply = String(reply || "").toLowerCase();

  if (!items.length) {
    return !/\b(no saved cigars|no cigars saved|empty humidor|add cigars)\b/.test(normalizedReply);
  }

  return !items.some((item) => item.name && normalizedReply.includes(item.name.toLowerCase()));
}

function buildMemberHumidorFallbackReply(items) {
  if (!items.length) {
    return "I do not see any saved cigars in your digital humidor yet. Add a cigar first, then I can help choose what to smoke, track aging, or flag reorder reminders.";
  }

  const smokePick =
    items
      .filter((item) => item.name)
      .sort((left, right) => (Number(right.rating) || 0) - (Number(left.rating) || 0))[0] || items[0];
  const reorderPick =
    items.find((item) => item.reorderReminder) ||
    items.find((item) => Number(item.quantity || 0) > 0 && Number(item.quantity || 0) <= 2) ||
    null;
  const agingPick = items.find((item) => item.agingStartDate && item.name !== smokePick.name) || null;

  const lines = [
    "Looking only at your saved digital humidor:",
    `Smoke tonight: ${formatHumidorFallbackItem(smokePick)}.`,
  ];

  if (reorderPick) {
    lines.push(
      `Reorder watch: ${reorderPick.name}${
        reorderPick.reorderReminder ? ` has a reorder reminder for ${reorderPick.reorderReminder}` : ` is down to qty ${reorderPick.quantity || 0}`
      }.`
    );
  } else {
    lines.push("Reorder watch: I do not see an urgent reorder reminder in the saved items.");
  }

  if (agingPick) {
    lines.push(`Keep aging: ${formatHumidorFallbackItem(agingPick)}.`);
  }

  lines.push("I have not saved any changes from this chat; use the humidor action controls to update inventory.");

  return lines.join("\n");
}

function formatHumidorFallbackItem(item) {
  const details = [item.brand, item.line, item.vitola, item.wrapper, item.strength].filter(Boolean).join(", ");
  const location = item.humidorLocation ? ` in ${item.humidorLocation}${item.tray ? ` / ${item.tray}` : ""}` : "";
  const rating = typeof item.rating === "number" ? `, member rating ${item.rating}` : "";
  const notes = item.tastingNotes ? `, notes: ${sanitizeText(item.tastingNotes, 120)}` : "";
  return `${item.name}${details ? ` (${details})` : ""}${location}${rating}${notes}`;
}

function shouldUseSupportFallbackReply(message, reply) {
  if (!isSupportShippingQuestion(message)) {
    return false;
  }

  if (isAgentGuardrailRefusalReply(reply)) {
    return true;
  }

  const normalizedReply = String(reply || "").toLowerCase();
  return !/\b(adult[- ]signature|age verification|signature delivery|shipping)\b/.test(normalizedReply);
}

function isSupportShippingQuestion(message) {
  const normalized = String(message || "").toLowerCase();
  return /\b(ship|shipping|delivery|deliver|order|checkout)\b/.test(normalized) &&
    /\b(adult|signature|21|age verification|age check|tobacco|cigar)\b/.test(normalized);
}

function buildSupportFallbackReply() {
  return [
    "For adult cigar orders, expect age verification before checkout and adult-signature delivery where the selected service or destination requires it.",
    "Use the checkout address and shipping service shown in Yuzu so the compliance token, carrier, and signature option stay matched to the order.",
    "If a shipment is delayed, damaged, or missing, share the order number with support so a concierge operator can review the case without collecting payment details in chat.",
  ].join("\n");
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "price pending";
  }

  return `$${amount.toFixed(2)}`;
}

async function maybeBuildNewsDraftRuntimeReply(actor, prompt) {
  const modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID;
  const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID || null;

  if (process.env.FEATURE_BEDROCK !== "runtime_ready") {
    return {
      status: process.env.FEATURE_BEDROCK || "pending_agent",
      modelId,
      knowledgeBaseId,
      reply: null,
    };
  }

  try {
    const { BedrockRuntimeClient, ConverseCommand } = require("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
    const command = new ConverseCommand({
      modelId,
      messages: [
        {
          role: "user",
          content: [{ text: prompt }],
        },
      ],
      system: [
        {
          text:
            "You are YCCNewsAgent in a newsroom drafting workflow. Return JSON only. " +
            "The JSON must include title, dek, category, bodyMarkdown, sections, and sourceNotes. " +
            "Do not return operator scaffolding, checklists, or placeholder copy.",
        },
      ],
      inferenceConfig: {
        maxTokens: 1600,
        temperature: 0.25,
        topP: 0.9,
      },
    });
    const result = await client.send(command);
    const reply = extractConverseText(result);

    return {
      status: reply ? "bedrock_runtime_news_draft" : "fallback",
      modelId,
      knowledgeBaseId,
      stopReason: result.stopReason || null,
      tokenUsage: result.usage || null,
      reply,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "bedrock_news_draft_runtime_fallback",
        modelId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return {
      status: "fallback",
      modelId,
      knowledgeBaseId,
      reply: null,
    };
  }
}

async function sendSupportEmail(details) {
  const provider = getOutboundEmailProviderName();
  if (provider !== "ses") {
    return sendTransactionalProviderEmail(provider, details);
  }

  const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
  const client = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });
  const body = {
    Text: {
      Data: details.bodyText,
      Charset: "UTF-8",
    },
  };

  if (details.bodyHtml) {
    body.Html = {
      Data: details.bodyHtml,
      Charset: "UTF-8",
    };
  }

  const response = await client.send(
    new SendEmailCommand({
      FromEmailAddress: details.fromAddress,
      Destination: {
        ToAddresses: details.toAddresses,
      },
      ReplyToAddresses: normalizeEmailAddresses(details.replyToAddresses || details.fromAddress, 10),
      Content: {
        Simple: {
          Subject: {
            Data: details.subject,
            Charset: "UTF-8",
          },
          Body: body,
        },
      },
    })
  );

  return response.MessageId || `ses_${crypto.randomUUID()}`;
}

async function sendTransactionalProviderEmail(provider, details) {
  const config = await getTransactionalEmailProviderConfig(provider);
  if (!config.ready) {
    throw new EmailProviderConfigurationError(config.message || `Transactional email provider ${provider} is not configured.`);
  }

  if (provider === "sendgrid") {
    return sendSendGridEmail(config, details);
  }

  if (provider === "brevo") {
    return sendBrevoEmail(config, details);
  }

  if (provider === "mailgun") {
    return sendMailgunEmail(config, details);
  }

  if (provider === "postmark") {
    return sendPostmarkEmail(config, details);
  }

  if (MICROSOFT_365_SMTP_PROVIDERS.has(provider)) {
    return sendMicrosoft365SmtpEmail(config, details);
  }

  throw new Error(`Unsupported transactional email provider: ${provider}`);
}

async function getTransactionalEmailProviderConfig(provider) {
  const secretId = sanitizeText(process.env.EMAIL_PROVIDER_SECRET_ARN || process.env.EMAIL_PROVIDER_SECRET_ID || "", 240);
  let secret = {};
  if (secretId) {
    secret = await readJsonSecretFromSecretsManager(secretId, "Email provider");
  }

  const providerSecret = secret?.[provider] && typeof secret[provider] === "object" ? secret[provider] : {};
  const rootSecret = secret && typeof secret === "object" ? secret : {};
  const smtpPort = toPositiveInteger(providerSecret.port || rootSecret.port || process.env.M365_SMTP_PORT || process.env.SMTP_PORT, 587);
  const config = {
    apiKey: sanitizeText(
      providerSecret.apiKey ||
        rootSecret.apiKey ||
        process.env[`${provider.toUpperCase()}_API_KEY`] ||
        process.env.EMAIL_PROVIDER_API_KEY ||
        "",
      500
    ),
    domain: sanitizeText(providerSecret.domain || rootSecret.domain || process.env.MAILGUN_DOMAIN || process.env.EMAIL_PROVIDER_DOMAIN || "", 200),
    serverToken: sanitizeText(
      providerSecret.serverToken || rootSecret.serverToken || process.env.POSTMARK_SERVER_TOKEN || process.env.EMAIL_PROVIDER_API_KEY || "",
      500
    ),
    host: sanitizeText(providerSecret.host || rootSecret.host || process.env.M365_SMTP_HOST || process.env.SMTP_HOST || "smtp.office365.com", 200),
    password: sanitizeSecretText(
      providerSecret.password ||
        rootSecret.password ||
        process.env.M365_SMTP_PASSWORD ||
        process.env.GODADDY_M365_SMTP_PASSWORD ||
        process.env.SMTP_PASSWORD ||
        process.env.EMAIL_PROVIDER_API_KEY ||
        "",
      1000
    ),
    port: smtpPort,
    username: sanitizeText(
      providerSecret.username ||
        rootSecret.username ||
        process.env.M365_SMTP_USERNAME ||
        process.env.GODADDY_M365_SMTP_USERNAME ||
        process.env.SMTP_USERNAME ||
        "",
      240
    ),
  };

  if (MICROSOFT_365_SMTP_PROVIDERS.has(provider)) {
    return {
      ...config,
      ready: Boolean(config.host && config.port && config.username && config.password),
      message: "M365_SMTP_USERNAME and M365_SMTP_PASSWORD, or matching email provider secret values, are required.",
    };
  }

  if (provider === "postmark") {
    return {
      ...config,
      ready: Boolean(config.serverToken),
      message: "POSTMARK_SERVER_TOKEN or email provider secret serverToken is required.",
    };
  }

  if (provider === "mailgun") {
    return {
      ...config,
      ready: Boolean(config.apiKey && config.domain),
      message: "MAILGUN_API_KEY and MAILGUN_DOMAIN, or matching email provider secret values, are required.",
    };
  }

  return {
    ...config,
    ready: Boolean(config.apiKey),
    message: `${provider.toUpperCase()}_API_KEY or an email provider secret apiKey is required.`,
  };
}

async function sendSendGridEmail(config, details) {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: { email: details.fromAddress },
      personalizations: [
        {
          to: normalizeEmailAddresses(details.toAddresses, 50).map((email) => ({ email })),
        },
      ],
      reply_to: { email: normalizeEmailAddresses(details.replyToAddresses || details.fromAddress, 1)[0] || details.fromAddress },
      subject: details.subject,
      content: buildProviderEmailContent(details),
    }),
  });
  await assertProviderEmailAccepted(response, "SendGrid");
  return response.headers?.get?.("x-message-id") || `sendgrid_${crypto.randomUUID()}`;
}

async function sendBrevoEmail(config, details) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: details.fromAddress },
      to: normalizeEmailAddresses(details.toAddresses, 50).map((email) => ({ email })),
      replyTo: { email: normalizeEmailAddresses(details.replyToAddresses || details.fromAddress, 1)[0] || details.fromAddress },
      subject: details.subject,
      textContent: details.bodyText,
      ...(details.bodyHtml ? { htmlContent: details.bodyHtml } : {}),
    }),
  });
  const payload = await readProviderJsonResponse(response, "Brevo");
  return sanitizeText(payload.messageId || payload.message_id, 240) || `brevo_${crypto.randomUUID()}`;
}

async function sendMailgunEmail(config, details) {
  const form = new URLSearchParams();
  form.set("from", details.fromAddress);
  for (const address of normalizeEmailAddresses(details.toAddresses, 50)) {
    form.append("to", address);
  }
  form.set("subject", details.subject);
  form.set("text", details.bodyText || "");
  if (details.bodyHtml) {
    form.set("html", details.bodyHtml);
  }
  const replyTo = normalizeEmailAddresses(details.replyToAddresses || details.fromAddress, 1)[0] || details.fromAddress;
  form.set("h:Reply-To", replyTo);

  const response = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(config.domain)}/messages`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`api:${config.apiKey}`, "utf8").toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const payload = await readProviderJsonResponse(response, "Mailgun");
  return sanitizeText(payload.id || payload.messageId, 240) || `mailgun_${crypto.randomUUID()}`;
}

async function sendPostmarkEmail(config, details) {
  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "x-postmark-server-token": config.serverToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      From: details.fromAddress,
      To: normalizeEmailAddresses(details.toAddresses, 50).join(","),
      ReplyTo: normalizeEmailAddresses(details.replyToAddresses || details.fromAddress, 1)[0] || details.fromAddress,
      Subject: details.subject,
      TextBody: details.bodyText,
      ...(details.bodyHtml ? { HtmlBody: details.bodyHtml } : {}),
    }),
  });
  const payload = await readProviderJsonResponse(response, "Postmark");
  return sanitizeText(payload.MessageID || payload.MessageId || payload.messageId, 240) || `postmark_${crypto.randomUUID()}`;
}

async function sendMicrosoft365SmtpEmail(config, details) {
  if (typeof globalThis.__YCC_TEST_SMTP_SEND__ === "function") {
    return globalThis.__YCC_TEST_SMTP_SEND__(config, details);
  }

  const message = buildSmtpMimeMessage(details);
  const toAddresses = normalizeEmailAddresses(details.toAddresses, 50);
  await sendSmtpMessage({
    fromAddress: details.fromAddress,
    host: config.host,
    password: config.password,
    port: config.port,
    toAddresses,
    username: config.username,
    message,
  });
  return `m365_smtp_${crypto.randomUUID()}`;
}

async function sendSmtpMessage(options) {
  let socket = await connectSmtpSocket(options.host, options.port);
  let session = createSmtpSession(socket);
  await session.expect([220]);
  await session.command(`EHLO ${getSmtpHeloName()}`, [250]);
  await session.command("STARTTLS", [220]);

  socket = await upgradeSmtpSocketToTls(socket, options.host);
  session = createSmtpSession(socket);
  await session.command(`EHLO ${getSmtpHeloName()}`, [250]);
  await session.command("AUTH LOGIN", [334]);
  await session.command(Buffer.from(options.username, "utf8").toString("base64"), [334]);
  await session.command(Buffer.from(options.password, "utf8").toString("base64"), [235]);
  await session.command(`MAIL FROM:<${options.fromAddress}>`, [250]);
  for (const address of options.toAddresses) {
    await session.command(`RCPT TO:<${address}>`, [250, 251]);
  }
  await session.command("DATA", [354]);
  await session.command(`${dotStuffSmtpMessage(options.message)}\r\n.`, [250]);
  await session.command("QUIT", [221]);
  socket.end();
}

function connectSmtpSocket(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.setEncoding("utf8");
    socket.setTimeout(15000);
    socket.once("connect", () => resolve(socket));
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`SMTP connection timed out for ${host}:${port}`));
    });
    socket.once("error", reject);
  });
}

function upgradeSmtpSocketToTls(socket, host) {
  return new Promise((resolve, reject) => {
    socket.removeAllListeners("data");
    socket.removeAllListeners("error");
    socket.removeAllListeners("timeout");
    const secureSocket = tls.connect({ socket, servername: host });
    secureSocket.setEncoding("utf8");
    secureSocket.setTimeout(15000);
    secureSocket.once("secureConnect", () => resolve(secureSocket));
    secureSocket.once("timeout", () => {
      secureSocket.destroy();
      reject(new Error(`SMTP TLS handshake timed out for ${host}`));
    });
    secureSocket.once("error", reject);
  });
}

function createSmtpSession(socket) {
  let buffer = "";
  const pending = [];
  let closed = false;

  socket.on("data", (chunk) => {
    buffer += String(chunk);
    flushSmtpResponses();
  });
  socket.once("close", () => {
    closed = true;
    while (pending.length) {
      pending.shift().reject(new Error("SMTP connection closed before a complete response was received."));
    }
  });

  function flushSmtpResponses() {
    while (pending.length) {
      const response = readCompleteSmtpResponse();
      if (!response) {
        return;
      }
      pending.shift().resolve(response);
    }
  }

  function readCompleteSmtpResponse() {
    const lineEnd = buffer.indexOf("\n");
    if (lineEnd === -1) {
      return null;
    }

    const lines = [];
    let consumed = 0;
    while (true) {
      const nextLineEnd = buffer.indexOf("\n", consumed);
      if (nextLineEnd === -1) {
        return null;
      }
      const rawLine = buffer.slice(consumed, nextLineEnd + 1);
      const line = rawLine.replace(/\r?\n$/, "");
      lines.push(line);
      consumed = nextLineEnd + 1;
      if (/^\d{3} /.test(line)) {
        buffer = buffer.slice(consumed);
        return {
          code: Number(line.slice(0, 3)),
          lines,
        };
      }
    }
  }

  function readResponse() {
    const response = readCompleteSmtpResponse();
    if (response) {
      return Promise.resolve(response);
    }
    if (closed) {
      return Promise.reject(new Error("SMTP connection closed."));
    }
    return new Promise((resolve, reject) => {
      pending.push({ resolve, reject });
    });
  }

  async function expect(expectedCodes) {
    const response = await readResponse();
    if (!expectedCodes.includes(response.code)) {
      throw new Error(`SMTP expected ${expectedCodes.join("/")} but received ${response.code}: ${response.lines.join(" | ")}`);
    }
    return response;
  }

  async function command(commandText, expectedCodes) {
    socket.write(`${commandText}\r\n`);
    return expect(expectedCodes);
  }

  return { command, expect };
}

function buildSmtpMimeMessage(details) {
  const toAddresses = normalizeEmailAddresses(details.toAddresses, 50);
  const replyTo = normalizeEmailAddresses(details.replyToAddresses || details.fromAddress, 1)[0] || details.fromAddress;
  const headers = [
    `From: ${details.fromAddress}`,
    `To: ${toAddresses.join(", ")}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeMimeHeader(details.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@yuzucigarclub.com>`,
    "MIME-Version: 1.0",
  ];

  if (details.bodyHtml) {
    const boundary = `ycc-${crypto.randomUUID()}`;
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      details.bodyText || "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      details.bodyHtml,
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  return [
    ...headers,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    details.bodyText || "",
    "",
  ].join("\r\n");
}

function dotStuffSmtpMessage(message) {
  return String(message || "")
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function encodeMimeHeader(value) {
  const text = sanitizeText(value, 240).replace(/[\r\n]+/g, " ");
  return /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function getSmtpHeloName() {
  return sanitizeText(process.env.M365_SMTP_HELO || process.env.SMTP_HELO || "api.yuzucigarclub.com", 120) || "api.yuzucigarclub.com";
}

function buildProviderEmailContent(details) {
  const content = [
    {
      type: "text/plain",
      value: details.bodyText || "",
    },
  ];

  if (details.bodyHtml) {
    content.push({
      type: "text/html",
      value: details.bodyHtml,
    });
  }

  return content;
}

async function assertProviderEmailAccepted(response, providerLabel) {
  if (response.ok) {
    return;
  }

  const body = await safeProviderResponseText(response);
  throw new Error(`${providerLabel} email send failed with HTTP ${response.status}${body ? `: ${body}` : ""}`);
}

async function readProviderJsonResponse(response, providerLabel) {
  const text = await safeProviderResponseText(response);
  if (!response.ok) {
    throw new Error(`${providerLabel} email send failed with HTTP ${response.status}${text ? `: ${text}` : ""}`);
  }

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function safeProviderResponseText(response) {
  try {
    return sanitizeMultilineText(await response.text(), 1000);
  } catch {
    return "";
  }
}

async function getRawEmailFromS3(bucket, key) {
  const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
  const client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  return readAwsSdkBodyAsString(response.Body);
}

async function maybeTranscribeConciergeVoice(audio, requestId) {
  try {
    const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
    const { DeleteTranscriptionJobCommand, GetTranscriptionJobCommand, StartTranscriptionJobCommand, TranscribeClient } = require("@aws-sdk/client-transcribe");
    const region = process.env.AWS_REGION || "us-east-1";
    const bucket = getConciergeVoiceBucket();
    const prefix = normalizeS3Prefix(process.env.CONCIERGE_VOICE_PREFIX || DEFAULT_CONCIERGE_VOICE_PREFIX);
    const token = `${Date.now()}-${crypto.randomUUID()}`.replace(/[^a-zA-Z0-9-]/g, "-");
    const audioKey = `${prefix}${token}/input.${audio.mediaFormat}`;
    const transcriptKey = `${prefix}${token}/transcript.json`;
    const jobName = `ycc-concierge-${token}`.slice(0, 200);
    const s3 = new S3Client({ region });
    const transcribe = new TranscribeClient({ region });

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: audioKey,
        Body: audio.bytes,
        ContentType: audio.mimeType,
        Metadata: {
          requestId: String(requestId || ""),
          source: "ycc-concierge-voice",
        },
      })
    );

    await transcribe.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        LanguageCode: process.env.CONCIERGE_TRANSCRIBE_LANGUAGE_CODE || "en-US",
        MediaFormat: audio.mediaFormat,
        Media: {
          MediaFileUri: `s3://${bucket}/${audioKey}`,
        },
        OutputBucketName: bucket,
        OutputKey: transcriptKey,
        Settings: {
          ShowAlternatives: false,
          ShowSpeakerLabels: false,
        },
      })
    );

    const deadline = Date.now() + getConciergeVoiceTranscribeMaxWaitMs();
    let status = "IN_PROGRESS";
    while (Date.now() <= deadline) {
      const job = await transcribe.send(
        new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName,
        })
      );
      status = job.TranscriptionJob?.TranscriptionJobStatus || status;

      if (status === "COMPLETED") {
        const transcriptObject = await s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: transcriptKey,
          })
        );
        const transcript = extractTranscribeTranscript(await readAwsSdkBodyAsString(transcriptObject.Body));
        await deleteTranscriptionJobQuietly(transcribe, DeleteTranscriptionJobCommand, jobName);

        return {
          service: "amazon_transcribe",
          status: "completed",
          transcript,
        };
      }

      if (status === "FAILED") {
        await deleteTranscriptionJobQuietly(transcribe, DeleteTranscriptionJobCommand, jobName);
        break;
      }

      await sleep(700);
    }

    await deleteTranscriptionJobQuietly(transcribe, DeleteTranscriptionJobCommand, jobName);
    return {
      service: "amazon_transcribe",
      status: "failed",
      transcript: "",
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "concierge_voice_transcribe_failed",
        requestId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return {
      service: "amazon_transcribe",
      status: "failed",
      transcript: "",
    };
  }
}

async function synthesizeConciergeSpeech(text) {
  if (process.env.FEATURE_CONCIERGE_VOICE !== "ready") {
    return buildDisabledSpeechOutput();
  }

  const voiceId = sanitizeText(process.env.CONCIERGE_POLLY_VOICE_ID, 80) || DEFAULT_CONCIERGE_POLLY_VOICE_ID;
  const engine = sanitizeText(process.env.CONCIERGE_POLLY_ENGINE, 40) || "neural";

  try {
    const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
    const client = new PollyClient({ region: process.env.AWS_REGION || "us-east-1" });
    const response = await client.send(
      new SynthesizeSpeechCommand({
        Engine: engine,
        OutputFormat: "mp3",
        Text: sanitizeText(text, 2800),
        TextType: "text",
        VoiceId: voiceId,
      })
    );
    const audio = await readAwsSdkBodyAsBuffer(response.AudioStream);

    if (!audio.length) {
      return {
        service: "amazon_polly",
        status: "failed",
        mimeType: null,
        audioBase64: null,
        voiceId,
      };
    }

    return {
      service: "amazon_polly",
      status: "synthesized",
      mimeType: response.ContentType || "audio/mpeg",
      audioBase64: audio.toString("base64"),
      voiceId,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "concierge_speech_synthesis_failed",
        voiceId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return {
      service: "amazon_polly",
      status: "failed",
      mimeType: null,
      audioBase64: null,
      voiceId,
    };
  }
}

function buildDisabledSpeechOutput() {
  return {
    service: "unavailable",
    status: "disabled",
    mimeType: null,
    audioBase64: null,
    voiceId: null,
  };
}

async function readAwsSdkBodyAsString(body) {
  if (!body) {
    return "";
  }

  if (typeof body.transformToString === "function") {
    return body.transformToString("utf8");
  }

  if (typeof body === "string") {
    return body;
  }

  if (Buffer.isBuffer(body)) {
    return body.toString("utf8");
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readAwsSdkBodyAsBuffer(body) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }

  if (typeof body.transformToString === "function") {
    return Buffer.from(await body.transformToString("utf8"), "utf8");
  }

  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "string") {
    return Buffer.from(body, "utf8");
  }

  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function deleteTranscriptionJobQuietly(client, Command, jobName) {
  try {
    await client.send(new Command({ TranscriptionJobName: jobName }));
  } catch {
    // Cleanup is best-effort; failed deletes should not block the member reply.
  }
}

function extractTranscribeTranscript(value) {
  try {
    const parsed = JSON.parse(value);
    return sanitizeText(parsed?.results?.transcripts?.[0]?.transcript, MAX_MESSAGE_LENGTH);
  } catch {
    return "";
  }
}

function getConciergeVoiceBucket() {
  return process.env.CONCIERGE_VOICE_BUCKET || process.env.S3_APP_BUCKET || process.env.SUPPORT_EMAIL_RAW_BUCKET || "classroom2";
}

function getConciergeVoiceTranscribeMaxWaitMs() {
  const value = Number(process.env.CONCIERGE_VOICE_TRANSCRIBE_MAX_WAIT_MS || "22000");
  if (!Number.isFinite(value)) {
    return 22000;
  }

  return Math.min(Math.max(Math.trunc(value), 1000), 26000);
}

function normalizeS3Prefix(value) {
  const normalized = sanitizeText(value, 180).replace(/^\/+/, "").replace(/\/?$/, "/");
  return normalized === "/" ? DEFAULT_CONCIERGE_VOICE_PREFIX : normalized;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function maybeRetrieveKnowledgeBaseContext(knowledgeBaseId, message) {
  if (!knowledgeBaseId) {
    return { status: "not_configured", context: "", count: 0 };
  }

  try {
    const { BedrockAgentRuntimeClient, RetrieveCommand } = require("@aws-sdk/client-bedrock-agent-runtime");
    if (typeof RetrieveCommand !== "function") {
      return { status: "sdk_unavailable", context: "", count: 0 };
    }

    const client = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
    const result = await client.send(
      new RetrieveCommand({
        knowledgeBaseId,
        retrievalQuery: {
          text: message,
        },
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 5,
          },
        },
      })
    );
    const snippets = extractKnowledgeBaseSnippets(result).slice(0, 5);

    return {
      status: snippets.length ? "retrieved" : "empty",
      context: snippets.map((snippet, index) => `[${index + 1}] ${snippet}`).join("\n\n"),
      count: snippets.length,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "bedrock_knowledge_base_retrieve_failed",
        knowledgeBaseId,
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return { status: "retrieve_failed", context: "", count: 0 };
  }
}

function extractKnowledgeBaseSnippets(result) {
  const retrievalResults = Array.isArray(result?.retrievalResults) ? result.retrievalResults : [];

  return retrievalResults
    .map((item) => sanitizeMultilineText(item?.content?.text, 900))
    .filter(Boolean)
    .slice(0, 5);
}

function extractConverseText(result) {
  const content = result?.output?.message?.content;
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((block) => (typeof block?.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function extractAgentCompletionText(result) {
  if (!result?.completion) {
    return "";
  }

  let completion = "";
  for await (const event of result.completion) {
    const bytes = event?.chunk?.bytes;
    if (bytes) {
      completion += Buffer.from(bytes).toString("utf8");
    }
  }

  return completion.trim();
}

function resolveBedrockAgentTarget(agent) {
  if (!BEDROCK_AGENT_NAMES.has(agent)) {
    return null;
  }

  const envKey = String(agent || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const agentId = process.env[`BEDROCK_AGENT_${envKey}_ID`];
  const agentAliasId = process.env[`BEDROCK_AGENT_${envKey}_ALIAS_ID`];

  if (!agentId || !agentAliasId) {
    return null;
  }

  return { agentId, agentAliasId };
}

function shouldUseBedrockAgentRuntime(agent) {
  return !DIRECT_BEDROCK_RUNTIME_AGENTS.has(agent);
}

function buildBedrockAgentSessionId(actor, conversationId) {
  const sessionSeed = `${actor.sub || actor.email || "anonymous"}:${conversationId || "default"}`;
  return `ycc-${crypto.createHash("sha256").update(sessionSeed).digest("hex").slice(0, 32)}`;
}

function buildAgentSessionAttributes(agent, actor, conversationId) {
  return compactStringMap({
    selectedAgent: agent,
    conversationId,
    memberSub: actor.sub,
    memberEmail: actor.email,
    memberName: actor.name,
    cognitoGroups: actor.groups.join(","),
    membershipTier: actor.membershipTier,
    memberStatus: actor.memberStatus,
  });
}

function compactStringMap(values) {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value !== undefined && value !== null && String(value) !== "")
      .map(([key, value]) => [key, String(value)])
  );
}

function buildBedrockAgentInputText(message, retrievedContext = "") {
  const knowledgeContext = sanitizeMultilineText(retrievedContext, 4500);
  const contextBlock = knowledgeContext
    ? `\n\nRetrieved YCC knowledge base context:\n${knowledgeContext}\n\nUse this context when it is relevant. If the retrieved context is insufficient, say what needs operator review instead of inventing facts.`
    : "";

  return `Response style: ${CONCIERGE_RESPONSE_STYLE_INSTRUCTION}\nAdult cigar context: ${ADULT_CIGAR_21_PLUS_CONTEXT_INSTRUCTION}${contextBlock}\n\nMember message: ${message}`;
}

function buildAgentSystemPrompt(agent, actor, retrievedContext = "") {
  const base =
    "You are part of Yuzu Cigar Club. Only answer for adults in an age-restricted tobacco context. " +
    "Do not make health, cessation, medical, or safety claims. Minimize PII, avoid collecting payment data, and hand off sensitive account issues to a human operator. " +
    `${ADULT_CIGAR_21_PLUS_CONTEXT_INSTRUCTION} ${CONCIERGE_RESPONSE_STYLE_INSTRUCTION}`;

  const personas = {
    YCCConcierge:
      "You are YCCConcierge, the warm front-door concierge for membership, account, education, events, support triage, and humidor routing.",
    YCCCigarGuide:
      "You are YCCCigarGuide, a 21+ adult cigar education specialist. Discuss vitola, wrapper, binder, filler, origin, strength, tasting notes, cutting, lighting, draw, storage, aging, buying, and pairings without health claims.",
    YCCSupportAgent:
      "You are YCCSupportAgent, a support drafting specialist. Summarize the issue, ask for only necessary details, and prepare handoff-ready next steps.",
    YCCHumidorAgent:
      "You are YCCHumidorAgent, a humidor inventory and care specialist. Help with storage conditions, aging plans, inventory organization, reorder reminders, and tasting logs.",
    YCCAdminAgent:
      "You are YCCAdminAgent, an internal operations assistant for authorized admins and concierge operators. Discuss workflows, audits, support queues, catalog operations, and safe administrative next steps.",
    YCCNewsAgent:
      "You are YCCNewsAgent, an internal editorial agent for authorized Yuzu admins and concierge operators. Treat phrases such as adult members, adult-only, and legal tobacco age as tobacco-compliance language, not sexual content. Draft operator-review-only cigar education and industry-news copy, provide source-note placeholders when live source retrieval is unavailable, avoid health, cessation, medical, or safety claims, refuse underage tobacco or age-check bypass requests, refuse explicit off-domain sexual content, and never publish without human approval.",
  };

  const knowledgeContext = sanitizeMultilineText(retrievedContext, 4500);

  return `${base}\n\n${personas[agent] || personas.YCCConcierge}\n\nMember context: tier=${actor.membershipTier || "unknown"}; status=${
    actor.memberStatus || "unknown"
  }; groups=${actor.groups.join(",") || "none"}.${
    knowledgeContext
      ? `\n\nRetrieved YCC knowledge base context:\n${knowledgeContext}\n\nUse this context when it is relevant. If the retrieved context is insufficient, say what needs operator review instead of inventing facts.`
      : ""
  }`;
}

function buildConciergeReply(agent, actor) {
  const name = actor.name || "there";

  if (agent === "YCCCigarGuide") {
    return (
      `Hi ${name}. The cigar guide contract is live. I can help compare wrapper, vitola, strength, flavor notes, pairings, and humidor conditions. ` +
      "The Bedrock agent runtime is available, and this fallback response is used only when the live agent call cannot complete."
    );
  }

  if (agent === "YCCSupportAgent") {
    return (
      `Hi ${name}. I can collect the support context and prepare a handoff-ready draft. ` +
      "The support case and draft are stored for operator review while SES sending waits on the verified email identity."
    );
  }

  if (agent === "YCCHumidorAgent") {
    return (
      `Hi ${name}. The humidor agent can help organize inventory, storage conditions, aging plans, tasting logs, and reorder reminders. ` +
      "The Bedrock agent runtime is available, and the humidor write path is stored behind authenticated actions."
    );
  }

  if (agent === "YCCAdminAgent") {
    return (
      `Hi ${name}. The admin agent can help authorized operators reason through support queues, audit trails, catalog tasks, and member operations. ` +
      "Administrative actions stay behind Cognito group checks and durable audit logging."
    );
  }

  if (agent === "YCCNewsAgent") {
    return (
      `Hi ${name}. The weekly cigar news agent is ready for authorized operators. ` +
      "It can research the full week's cigar and adjacent industry news, draft the education-page article, and prepare the newsletter version for review."
    );
  }

  return (
    `Hi ${name}. The YCC concierge contract is live. I can route membership, account, humidor, cigar education, and support requests through the authenticated API. ` +
    "The Bedrock agent runtime is available, with conversation persistence ready underneath it."
  );
}

function isCigarGuideQuestion(message) {
  const normalizedMessage = String(message || "").toLowerCase();
  return CIGAR_GUIDE_TERMS.some((term) => normalizedMessage.includes(term));
}

function shouldUseAdultCigarQuestionFallbackReply(message, reply) {
  if (!isCigarGuideQuestion(message)) {
    return false;
  }

  return isAdultCigarHealthQuestion(message) || isAgentGuardrailRefusalReply(reply) || isAdultWrapperReplyMissingRequestedTerms(message, reply);
}

function isAdultWrapperReplyMissingRequestedTerms(message, reply) {
  const normalizedMessage = String(message || "").toLowerCase();
  const normalizedReply = String(reply || "").toLowerCase();
  const requestedWrapperTerms = CIGAR_WRAPPER_TERMS.filter((term) => normalizedMessage.includes(term));

  if (requestedWrapperTerms.length === 0) {
    return false;
  }

  return requestedWrapperTerms.some((term) => !normalizedReply.includes(term));
}

function isAdultCigarHealthQuestion(message) {
  return /\b(safe|safer|safest|safety|healthy|health|risk|risks|cancer|medical|doctor|pregnant|addiction|cessation|quit)\b/.test(
    String(message || "").toLowerCase()
  );
}

function isDisallowedTobaccoAccessQuestion(message) {
  const normalizedMessage = String(message || "").toLowerCase();
  const mentionsTobacco = isCigarGuideQuestion(normalizedMessage);
  const underagePattern =
    /\b(underage|minor|teen|teenager|kid|child|children|school|fake id|without id|bypass|evade|avoid age|age check bypass|age verification bypass)\b/;
  const under21AgePattern = /\b(1[0-9]|20)\b.*\b(buy|purchase|order|ship|smoke|use|access|get)\b/;

  return mentionsTobacco && (underagePattern.test(normalizedMessage) || under21AgePattern.test(normalizedMessage));
}

function buildAdultCigarQuestionFallbackReply(message) {
  const normalizedMessage = String(message || "").toLowerCase();

  if (isDisallowedTobaccoAccessQuestion(message)) {
    return "I can help adults 21+ with cigar education, storage, pairings, and product selection, but I cannot help anyone under 21 access tobacco or bypass age verification.";
  }

  if (isAdultCigarHealthQuestion(normalizedMessage)) {
    return "For adults 21+, I can discuss cigar flavor, storage, pairings, construction, and etiquette, but I cannot describe cigar use as safe or give medical advice. For health questions, rely on a qualified clinician or public-health source.";
  }

  if (/\b(pair|pairs|pairing|coffee|espresso|whiskey|bourbon|rum|wine|drink)\b/.test(normalizedMessage)) {
    return "For adults 21+, pair by matching intensity: Connecticut shade works well with coffee or lighter pours, Cameroon and Habano suit medium-bodied drinks, and Maduro or Broadleaf usually fits espresso, bourbon, rum, or dessert notes.";
  }

  if (/\b(humidor|humidity|storage|store|age|aging|hygrometer|temperature)\b/.test(normalizedMessage)) {
    return "For adults 21+, keep cigars stable rather than chasing perfect numbers: roughly 65-72% RH and 64-74 F, with a calibrated hygrometer, steady airflow, and slow adjustments if wrappers feel too dry or too soft.";
  }

  if (/\b(wrapper|maduro|connecticut|habano|cameroon|sumatra|broadleaf|corojo|candela|rosado)\b/.test(normalizedMessage)) {
    return "For adults 21+, wrapper is a strong flavor signal: Connecticut tends creamy and mellow, Cameroon often adds cedar and baking spice, Habano can bring pepper and earth, and Maduro or Broadleaf leans cocoa, espresso, and sweetness.";
  }

  if (/\b(cut|light|draw|ash|retrohale|smoke|smoking)\b/.test(normalizedMessage)) {
    return "For adults 21+, focus on construction and pace: make a clean shallow cut, toast the foot evenly, take slow draws, let the cigar rest between puffs, and use retrohale sparingly because it intensifies pepper and aroma.";
  }

  return "For adults 21+, I can answer cigar questions about wrappers, vitolas, blends, strength, flavor notes, storage, aging, cutting, lighting, draw, pairings, and box selection. Share the cigar name or the flavor profile you want and I will narrow it down.";
}

function shouldUseLexRouterForRequest(requestedAgent) {
  const normalizedAgent = normalizeAgentKey(requestedAgent);
  return ["", "auto", "lex", "router", "concierge", "yccconcierge", "yccconciergeagent"].includes(normalizedAgent);
}

async function maybeRecognizeLexRoute(actor, message, conversationId) {
  const featureStatus = process.env.FEATURE_LEX_ROUTER || "pending_bot";
  const config = getLexRouterConfig();

  if (featureStatus !== "ready" || !config) {
    return null;
  }

  try {
    const { LexRuntimeV2Client, RecognizeTextCommand } = require("@aws-sdk/client-lex-runtime-v2");
    const client = new LexRuntimeV2Client({ region: process.env.AWS_REGION || "us-east-1" });
    const sessionId = buildLexSessionId(actor, conversationId);
    const command = new RecognizeTextCommand({
      botId: config.botId,
      botAliasId: config.botAliasId,
      localeId: config.localeId,
      sessionId,
      text: message.slice(0, 1024),
      requestAttributes: compactStringMap({
        "ycc-source": "concierge",
        "ycc-conversation-id": conversationId,
      }),
      sessionState: {
        sessionAttributes: compactStringMap({
          conversationId,
          memberSub: actor.sub,
          memberEmail: actor.email,
          memberName: actor.name,
          membershipTier: actor.membershipTier,
          memberStatus: actor.memberStatus,
          cognitoGroups: actor.groups.join(","),
        }),
      },
    });

    return normalizeLexRoute(await client.send(command), sessionId);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "lex_router_fallback",
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return {
      status: "unavailable",
      sessionId: buildLexSessionId(actor, conversationId),
      intentName: null,
      confidence: null,
      dialogActionType: null,
      slotToElicit: null,
      slots: {},
      messages: [],
    };
  }
}

function getLexRouterConfig() {
  const botId = sanitizeText(process.env.LEX_ROUTER_BOT_ID, 40);
  const botAliasId = sanitizeText(process.env.LEX_ROUTER_BOT_ALIAS_ID, 40);
  const localeId = sanitizeText(process.env.LEX_ROUTER_LOCALE_ID, 24) || DEFAULT_LEX_ROUTER_LOCALE_ID;

  if (!botId || !botAliasId) {
    return null;
  }

  return { botId, botAliasId, localeId };
}

function buildLexSessionId(actor, conversationId) {
  const rawId = sanitizeText(conversationId, 80);
  const readableId = rawId.replace(/[^0-9a-zA-Z._:-]+/g, "-").replace(/^-+|-+$/g, "");
  if (readableId) {
    return `ycc-lex-${readableId}`.slice(0, 100);
  }

  const seed = `${actor.sub || actor.email || "anonymous"}:${conversationId || "default"}`;
  return `ycc-lex-${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;
}

function normalizeLexRoute(result, fallbackSessionId) {
  const interpretation = Array.isArray(result?.interpretations) ? result.interpretations[0] : null;
  const intent = result?.sessionState?.intent || interpretation?.intent || null;
  const dialogAction = result?.sessionState?.dialogAction || {};
  const dialogActionType = sanitizeText(dialogAction.type, 80) || null;
  const slotToElicit = sanitizeText(dialogAction.slotToElicit, 120) || null;
  const messages = Array.isArray(result?.messages)
    ? result.messages
        .map((message) => sanitizeText(message?.content, 1000))
        .filter(Boolean)
    : [];
  const confidence = Number(interpretation?.nluConfidence?.score);

  return {
    status: dialogActionType && LEX_DIALOG_ACTION_TYPES.has(dialogActionType) ? "slot_elicitation" : "recognized",
    sessionId: sanitizeText(result?.sessionId, 100) || fallbackSessionId,
    intentName: sanitizeText(intent?.name, 120) || null,
    confidence: Number.isFinite(confidence) ? confidence : null,
    dialogActionType,
    slotToElicit,
    slots: extractLexSlots(intent?.slots),
    messages,
  };
}

function extractLexSlots(slots) {
  if (!slots || typeof slots !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(slots)
      .map(([key, slot]) => [key, extractLexSlotValue(slot)])
      .filter(([, value]) => Boolean(value))
  );
}

function extractLexSlotValue(slot) {
  if (!slot || typeof slot !== "object") {
    return "";
  }

  const value = slot.value || {};
  const interpretedValue = sanitizeText(value.interpretedValue || value.originalValue, MAX_FIELD_LENGTH);
  if (interpretedValue) {
    return interpretedValue;
  }

  if (Array.isArray(slot.values)) {
    return slot.values.map(extractLexSlotValue).filter(Boolean).join(", ");
  }

  return "";
}

function shouldReturnLexDialogTurn(lexRouting) {
  return Boolean(lexRouting && lexRouting.status === "slot_elicitation" && buildLexDialogReply(lexRouting));
}

function shouldHonorLexDialogTurn(agent, message, lexRouting) {
  if (!shouldReturnLexDialogTurn(lexRouting)) {
    return false;
  }

  if (isCigarGuideQuestion(message) && agent !== "YCCSupportAgent") {
    return false;
  }

  const lexAgent = mapLexIntentToAgent(lexRouting?.intentName);
  return Boolean(lexAgent && lexAgent === agent);
}

function buildLexDialogReply(lexRouting) {
  const messageReply = Array.isArray(lexRouting?.messages) ? lexRouting.messages.join("\n").trim() : "";
  if (messageReply) {
    return messageReply;
  }

  if (lexRouting?.slotToElicit) {
    return `What ${formatLexSlotLabel(lexRouting.slotToElicit)} should I use?`;
  }

  return "";
}

function buildLexResponsePayload(lexRouting) {
  return {
    status: lexRouting.status,
    intentName: lexRouting.intentName,
    confidence: lexRouting.confidence,
    dialogActionType: lexRouting.dialogActionType,
    slotToElicit: lexRouting.slotToElicit,
    slots: lexRouting.slots,
    sessionId: lexRouting.sessionId,
  };
}

function getLexDialogNextActions(agent, lexRouting) {
  const slotAction = lexRouting?.slotToElicit ? `collect_${lexRouting.slotToElicit}` : "collect_requested_detail";
  return ["continue_lex_guided_flow", slotAction, agent === "YCCSupportAgent" ? "review_operator_handoffs" : "route_after_slots_ready"];
}

function formatLexSlotLabel(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}

function mapLexIntentToAgent(intentName) {
  const normalizedIntent = normalizeAgentKey(intentName).replace(/_?intent$/, "");
  if (!normalizedIntent) {
    return null;
  }

  if (normalizedIntent.includes("fallback") || normalizedIntent.includes("unknown")) {
    return null;
  }

  if (normalizedIntent.includes("humidor")) {
    return "YCCHumidorAgent";
  }

  if (normalizedIntent.includes("support") || normalizedIntent.includes("case") || normalizedIntent.includes("order_help")) {
    return "YCCSupportAgent";
  }

  if (normalizedIntent.includes("cigar") || normalizedIntent.includes("wrapper") || normalizedIntent.includes("pairing")) {
    return "YCCCigarGuide";
  }

  if (
    normalizedIntent.includes("concierge") ||
    normalizedIntent.includes("membership") ||
    normalizedIntent.includes("account") ||
    normalizedIntent.includes("event") ||
    normalizedIntent.includes("education")
  ) {
    return "YCCConcierge";
  }

  return null;
}

function chooseAgent(message, requestedAgent, lexRouting = null) {
  const normalizedAgent = normalizeAgentKey(requestedAgent);
  if (["admin", "admin_agent", "yccadminagent"].includes(normalizedAgent)) {
    return "YCCAdminAgent";
  }

  if (
    [
      "news",
      "news_agent",
      "weekly_news",
      "weekly_cigar_news",
      "cigar_news",
      "newsletter",
      "weekly_newsletter",
      "yccnewsagent",
    ].includes(normalizedAgent)
  ) {
    return "YCCNewsAgent";
  }

  if (["humidor", "humidor_agent", "ycchumidoragent"].includes(normalizedAgent)) {
    return "YCCHumidorAgent";
  }

  if (["cigar_guide", "ycccigarguide", "cigar_guide_agent"].includes(normalizedAgent)) {
    return "YCCCigarGuide";
  }

  if (["support", "support_agent", "yccsupportagent"].includes(normalizedAgent) || messageNeedsHumanSupport(message)) {
    return "YCCSupportAgent";
  }

  const normalizedMessage = String(message || "").toLowerCase();
  if (HUMIDOR_AGENT_TERMS.some((term) => normalizedMessage.includes(term))) {
    return "YCCHumidorAgent";
  }

  if (isCigarGuideQuestion(normalizedMessage)) {
    return "YCCCigarGuide";
  }

  const lexAgent = mapLexIntentToAgent(lexRouting?.intentName);
  if (lexAgent) {
    return lexAgent;
  }

  return "YCCConcierge";
}

function getAgentNextActions(agent, bedrockStatus) {
  if (agent === "YCCNewsAgent") {
    return bedrockStatus === "bedrock_agent_runtime"
      ? ["review_source_notes", "approve_education_article", "queue_weekly_newsletter"]
      : ["configure_news_agent_alias", "review_fallback_draft", "verify_source_research_workflow"];
  }

  return bedrockStatus === "bedrock_agent_runtime"
    ? ["review_operator_handoffs", "expand_knowledge_base_source", "add_conversation_history_read_model"]
    : ["verify_bedrock_agent_runtime", "review_fallback_logs", "add_conversation_history_read_model"];
}

function normalizeAgentKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canUseAdminAgent(actor) {
  return actor.groups.some((group) => ["admin", "concierge_operator"].includes(String(group).toLowerCase()));
}

function canAdministerMemberAccess(actor) {
  return actor.groups.some((group) => String(group).toLowerCase() === "admin");
}

function canSendSupportEmail(actor) {
  return actor.groups.some((group) => ["admin", "concierge_operator"].includes(String(group).toLowerCase()));
}

function getHumidorMembershipAccess(actor) {
  if (!actor) {
    return {
      allowed: false,
      role: null,
      status: null,
    };
  }

  const normalized = normalizeActorForMember(actor);
  const allowed =
    ["admin", "operator"].includes(normalized.role) ||
    ["active", "paused"].includes(normalized.memberStatus);

  return {
    allowed,
    role: normalized.role,
    status: normalized.memberStatus,
  };
}

function buildHumidorMembershipDeniedPayload(actor) {
  const membership = getHumidorMembershipAccess(actor);
  if (membership.allowed) {
    return null;
  }

  return {
    error: "humidor_membership_forbidden",
    message: "Humidor access is limited to active or paused members.",
    membership: {
      role: membership.role,
      status: membership.status,
    },
  };
}

function normalizeLivePageRoute(value) {
  const rawRoute = sanitizeText(value, 180);
  if (!rawRoute) {
    return null;
  }

  const withoutQuery = rawRoute.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
  const normalized =
    withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")
      ? withLeadingSlash.slice(0, -1)
      : withLeadingSlash;

  return LIVE_PAGE_ROUTES.has(normalized) ? normalized : null;
}

function normalizeLivePageEdits(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const edits = {};
  for (const [fieldId, fieldValue] of Object.entries(value).slice(0, MAX_LIVE_PAGE_EDIT_FIELDS)) {
    const normalizedFieldId = sanitizeText(fieldId, 120);
    if (!/^[a-z0-9]+(?:\.[a-z0-9]+){1,8}$/.test(normalizedFieldId)) {
      continue;
    }

    edits[normalizedFieldId] = sanitizeMultilineText(fieldValue, MAX_LIVE_PAGE_EDIT_FIELD_LENGTH);
  }

  return edits;
}

function messageNeedsHumanSupport(message) {
  const normalized = message.toLowerCase();
  return ["refund", "charge", "billing", "cancel", "damaged", "missing", "complaint"].some((term) =>
    normalized.includes(term)
  );
}

function normalizeHumidorEnrichmentFields(value) {
  if (value === undefined || value === null || value === "") {
    return { value: [], error: "" };
  }

  const rawFields = Array.isArray(value) ? value : String(value).split(",");
  const fields = [];

  for (const field of rawFields) {
    const normalized = sanitizeText(String(field || ""), 40)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!normalized) {
      continue;
    }

    if (!HUMIDOR_ENRICHMENT_FIELDS.has(normalized)) {
      return {
        value: [],
        error: `Allowed values are: ${Array.from(HUMIDOR_ENRICHMENT_FIELDS).sort().join(", ")}.`,
      };
    }

    if (!fields.includes(normalized)) {
      fields.push(normalized);
    }
  }

  return { value: fields, error: "" };
}

function getMissingHumidorEnrichmentFields(item) {
  const fields = [];
  const missingInfo = ["brand", "line", "vitola", "wrapper", "origin", "strength"].some((field) => !sanitizeText(item[field], MAX_FIELD_LENGTH));

  if (missingInfo) {
    fields.push("info");
  }

  if (!hasHumidorRenderableImageMetadata(item)) {
    fields.push("image");
  }

  if (item.estimatedValue === null || item.estimatedValue === undefined) {
    fields.push("msrp");
  }

  return fields;
}

function hasHumidorRenderableImageMetadata(item) {
  const image = item?.cigarImage;
  if (!image || typeof image !== "object" || Array.isArray(image)) {
    return false;
  }

  if (normalizeHumidorReferenceImage(image, { requireRenderableHost: true })?.imageUrl) {
    return true;
  }

  if (normalizeHumidorS3Image(image)) {
    return true;
  }

  return Boolean(normalizeHumidorCigarImageAttachment(image).value?.dataUrl);
}

function parseHumidorEnrichmentReply(reply, item, requestedFields) {
  const parsed = parseFirstJsonObject(reply);
  if (!parsed) {
    return buildFallbackHumidorEnrichmentSuggestion(item, requestedFields);
  }

  const normalized = normalizeHumidorItem({
    ...parsed,
    name: item.name,
    quantity: item.quantity || 1,
    source: "ai_humidor_enrichment",
  });
  const details = normalizeCigarDetails(parsed, normalized);
  const referenceImage = normalizeHumidorReferenceImage(
    parsed.cigarImage ||
      parsed.image ||
      parsed.referenceImage ||
      {
        imageUrl: parsed.imageUrl || parsed.referenceImageUrl || parsed.productImageUrl,
        mimeType: parsed.mimeType,
        fileName: parsed.fileName,
        source: parsed.imageSource || parsed.imageSourceUrl,
      },
    { allowFirstPartyAssets: false, requireRenderableHost: true }
  );
  const estimatedValue = normalized.estimatedValue ?? normalizeHumidorMoneyValue(parsed.msrp ?? details.msrp);
  const estimatedValueSource = sanitizeText(parsed.estimatedValueSource || parsed.valueSource, 120);

  return {
    brand: normalized.brand || sanitizeText(parsed.manufacturer || details.manufacturer, MAX_FIELD_LENGTH),
    line: normalized.line,
    vitola: normalized.vitola || details.shape || details.size,
    wrapper: normalized.wrapper || details.wrapper,
    origin: normalized.origin || details.country,
    strength: normalized.strength || details.body,
    tastingNotes: normalized.tastingNotes,
    estimatedValue,
    estimatedValueCurrency: estimatedValue === null ? "" : normalized.estimatedValueCurrency || "USD",
    estimatedValueSource: estimatedValue === null ? "" : estimatedValueSource || "ai_humidor_enrichment_msrp",
    cigarImage: referenceImage,
    confidence: normalizeCigarConfidence(parsed.confidence),
    evidence: normalizeTextList(parsed.evidence, [`YCCHumidorAgent reviewed ${item.name} for ${requestedFields.join(", ")} gaps.`]),
    needsReview: normalizeTextList(parsed.needsReview || parsed.review, []),
    details,
  };
}

function buildFallbackHumidorEnrichmentSuggestion(item, requestedFields) {
  return {
    brand: "",
    line: "",
    vitola: "",
    wrapper: "",
    origin: "",
    strength: "",
    tastingNotes: "",
    estimatedValue: null,
    estimatedValueCurrency: "",
    estimatedValueSource: "",
    cigarImage: null,
    confidence: "low",
    evidence: [],
    needsReview: [`YCCHumidorAgent could not locate enough reference data for ${item.name} (${requestedFields.join(", ")}).`],
    details: normalizeCigarDetails({}, item),
  };
}

async function maybeBuildHumidorWebEnrichmentSuggestion(item, requestedFields, browserSearch) {
  if (!isHumidorWebSearchEnabled()) {
    return {
      status: "disabled",
      query: browserSearch?.query || "",
      references: [],
      suggestion: null,
    };
  }

  if (typeof fetch !== "function") {
    return {
      status: "unavailable",
      query: browserSearch?.query || "",
      references: [],
      suggestion: null,
    };
  }

  const query = sanitizeText(browserSearch?.query || buildHumidorEnrichmentBrowserSearchPlan(item, requestedFields).query, 700);
  if (!query) {
    return {
      status: "missing_query",
      query: "",
      references: [],
      suggestion: null,
    };
  }

  try {
    const references = await searchHumidorWebReferences(query, item);
    if (!references.length) {
      return {
        status: "no_results",
        query,
        references: [],
        suggestion: null,
      };
    }

    return {
      status: "retrieved",
      query,
      references,
      suggestion: buildHumidorWebEnrichmentSuggestion(item, requestedFields, references),
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "humidor_web_enrichment_unavailable",
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return {
      status: "error",
      query,
      references: [],
      suggestion: null,
    };
  }
}

function isHumidorWebSearchEnabled() {
  return HUMIDOR_WEB_SEARCH_READY_VALUES.has(sanitizeText(process.env.HUMIDOR_ENRICHMENT_WEB_SEARCH, 40).toLowerCase());
}

function summarizeHumidorWebSearchResult(result, browserSearch) {
  const references = Array.isArray(result?.references) ? result.references : [];
  return {
    status: result?.status || "not_run",
    query: result?.query || browserSearch?.query || "",
    resultCount: references.length,
    sources: references.slice(0, 4).map((reference) => ({
      title: reference.title,
      url: reference.url,
      fields: reference.fields,
    })),
  };
}

async function searchHumidorWebReferences(query, item) {
  const searchHtml = await fetchHumidorWebText(buildHumidorSearchUrl(query), "text/html");
  const searchResults = parseHumidorSearchResults(searchHtml)
    .filter((result) => isAllowedHumidorWebReferenceUrl(result.url))
    .slice(0, getHumidorWebSearchMaxResults());
  const references = [];

  for (const result of searchResults) {
    try {
      const html = await fetchHumidorWebText(result.url, "text/html,application/xhtml+xml");
      const reference = extractHumidorWebReference(result.url, result.title, html, item);
      if (reference) {
        references.push(reference);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "warn",
          event: "humidor_web_reference_fetch_skipped",
          url: result.url,
          name: error instanceof Error ? error.name : null,
          message: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  return references;
}

function buildHumidorSearchUrl(query) {
  const configuredTemplate = sanitizeText(process.env.HUMIDOR_ENRICHMENT_WEB_SEARCH_URL, 1200);
  if (configuredTemplate.includes("{query}")) {
    return configuredTemplate.replace("{query}", encodeURIComponent(query));
  }

  return `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
}

function getHumidorWebSearchMaxResults() {
  const configured = Number(process.env.HUMIDOR_ENRICHMENT_WEB_SEARCH_MAX_RESULTS || 4);
  return Number.isFinite(configured) ? Math.max(1, Math.min(8, Math.round(configured))) : 4;
}

function getHumidorWebSearchTimeoutMs() {
  const configured = Number(process.env.HUMIDOR_ENRICHMENT_WEB_SEARCH_TIMEOUT_MS || 4500);
  return Number.isFinite(configured) ? Math.max(500, Math.min(12000, Math.round(configured))) : 4500;
}

async function fetchHumidorWebText(url, accept) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), getHumidorWebSearchTimeoutMs()) : null;

  try {
    const response = await fetch(url, {
      headers: {
        accept,
        "user-agent": "YuzuCigarClubHumidorAgent/1.0 (+https://www.yuzucigarclub.com)",
      },
      signal: controller?.signal,
    });

    if (!response?.ok) {
      throw new Error(`web_fetch_failed_${response?.status || "unknown"}`);
    }

    const text = await response.text();
    return String(text || "").slice(0, 300000);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function parseHumidorSearchResults(html) {
  const results = [];
  const anchorPattern = /<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(String(html || "")))) {
    const attributes = parseHtmlAttributes(match[1]);
    const rawHref = attributes.href;
    const url = normalizeHumidorSearchResultUrl(rawHref);
    const title = sanitizeText(htmlToPlainText(match[2]), 220);
    if (!url || !title) {
      continue;
    }

    if (!results.some((result) => result.url === url)) {
      results.push({ title, url });
    }
  }

  return results;
}

function normalizeHumidorSearchResultUrl(rawHref) {
  let href = decodeHtmlEntities(sanitizeText(rawHref, 1200));
  if (!href) {
    return "";
  }

  if (href.startsWith("//")) {
    href = `https:${href}`;
  }

  try {
    const parsed = new URL(href, "https://duckduckgo.com");
    const redirected = parsed.searchParams.get("uddg") || parsed.searchParams.get("u");
    const finalUrl = redirected ? new URL(redirected) : parsed;
    if (finalUrl.protocol !== "https:" && finalUrl.protocol !== "http:") {
      return "";
    }

    finalUrl.hash = "";
    return finalUrl.toString();
  } catch {
    return "";
  }
}

function isAllowedHumidorWebReferenceUrl(value) {
  try {
    const parsed = new URL(value);
    const domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (HUMIDOR_WEB_SEARCH_BLOCKED_DOMAINS.has(domain)) {
      return false;
    }

    if ([...HUMIDOR_WEB_SEARCH_BLOCKED_DOMAINS].some((blocked) => domain.endsWith(`.${blocked}`))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function extractHumidorWebReference(url, searchTitle, html, item) {
  const title = sanitizeText(extractHtmlTitle(html) || searchTitle, 220);
  const heading = sanitizeText(extractFirstHtmlHeading(html), 220);
  const text = htmlToPlainText(html);
  const searchable = `${title} ${heading} ${text}`.toLowerCase();
  const identityTerms = buildHumidorCatalogEnrichmentTerms(item);
  const matchedTerms = identityTerms.filter((term) => searchable.includes(term));
  const cigarCue = /\b(cigar|cigars|wrapper|origin|strength|body|toro|robusto|churchill|corona|vitola|msrp)\b/i.test(searchable);

  if (!hasEnoughHumidorReferenceTermCoverage(item, matchedTerms, identityTerms) || !cigarCue) {
    return null;
  }

  const identity = inferHumidorWebReferenceIdentity(`${title} ${heading}`, text);
  const wrapper = extractHumidorWebFact(text, ["Wrapper Type", "Wrapper", "Wrapper Leaf"]);
  const origin = extractHumidorWebFact(text, ["Country of Origin", "Origin", "Country", "Made In"]);
  const strength = extractHumidorWebFact(text, ["Strength", "Body"]);
  const extractedEstimatedValue = extractHumidorWebMoneyValue(text);
  const estimatedValue = isPlausibleHumidorEnrichmentUnitValue(extractedEstimatedValue) ? extractedEstimatedValue : null;
  const rejectedEstimatedValue = extractedEstimatedValue !== null && estimatedValue === null ? extractedEstimatedValue : null;
  const imageUrl = sanitizeHumidorImageUrl(
    resolveHumidorReferenceUrl(url, extractHtmlMetaContent(html, ["og:image", "twitter:image", "image"])),
    { requireRenderableHost: true }
  );
  const fields = [];

  for (const [field, value] of Object.entries({
    brand: identity.brand,
    line: identity.line,
    vitola: identity.vitola,
    wrapper,
    origin,
    strength,
    estimatedValue,
    image: imageUrl,
  })) {
    if (value !== null && value !== undefined && value !== "") {
      fields.push(field);
    }
  }

  if (fields.length < 2) {
    return null;
  }

  return {
    url,
    title,
    brand: identity.brand,
    line: identity.line,
    vitola: identity.vitola,
    wrapper,
    origin,
    strength,
    estimatedValue,
    rejectedEstimatedValue,
    imageUrl,
    fields,
    matchedTerms,
  };
}

function hasEnoughHumidorReferenceTermCoverage(item, matchedTerms, identityTerms) {
  if (!identityTerms.length || !matchedTerms.length) {
    return false;
  }

  if (sanitizeText(item.brand, MAX_FIELD_LENGTH)) {
    return matchedTerms.length >= 1;
  }

  return identityTerms.length >= 2 && matchedTerms.length >= 2;
}

function inferHumidorWebReferenceIdentity(titleText, bodyText) {
  const text = `${titleText} ${bodyText}`.replace(/\s+/g, " ");
  if (/\bcamacho\s+ecuador\b/i.test(text)) {
    return {
      brand: "Camacho",
      line: "Ecuador",
      vitola: inferHumidorReferenceVitola(text),
    };
  }

  const title = sanitizeText(titleText, 220);
  const vitola = inferHumidorReferenceVitola(title);
  const firstWords = title
    .replace(/\|.*$/, "")
    .replace(/[-:]\s*(?:cigar|cigars).*$/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    brand: firstWords.length ? titleCaseCatalogText(firstWords[0]) : "",
    line: firstWords.length > 1 ? titleCaseCatalogText(firstWords.slice(1, Math.min(firstWords.length, 4)).join(" ")) : "",
    vitola,
  };
}

function inferHumidorReferenceVitola(text) {
  for (const vitola of HUMIDOR_VITOLA_TERMS) {
    if (new RegExp(`\\b${escapeRegex(vitola)}\\b`, "i").test(text)) {
      return titleCaseCatalogText(vitola);
    }
  }

  return "";
}

function extractHumidorWebFact(text, labels) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => sanitizeText(line, 220))
    .filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const label of labels) {
      const labelPattern = new RegExp(`^${escapeRegex(label)}\\s*(?:[:|\\-])?\\s*(.*)$`, "i");
      const match = line.match(labelPattern);
      if (!match) {
        continue;
      }

      const inlineValue = cleanHumidorWebFactValue(match[1]);
      if (inlineValue) {
        return inlineValue;
      }

      const nextValue = cleanHumidorWebFactValue(lines[index + 1] || "");
      if (nextValue && !isHumidorWebFactLabel(nextValue)) {
        return nextValue;
      }
    }
  }

  return "";
}

function isHumidorWebFactLabel(value) {
  return /^(wrapper(?: type| leaf)?|country(?: of origin)?|origin|made in|strength|body|price|msrp)$/i.test(sanitizeText(value, 120));
}

function cleanHumidorWebFactValue(value) {
  return sanitizeText(String(value || "").replace(/^[\s:|\-]+/, "").replace(/\s+/g, " "), 120)
    .replace(/\b(?:learn more|shop now|add to cart)\b.*$/i, "")
    .trim();
}

function extractHumidorWebMoneyValue(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => sanitizeText(line, 500))
    .filter(Boolean);
  const packageCount = inferHumidorWebPackageCount(lines.join(" "));
  const labeledMsrp = findHumidorWebPriceCandidate(lines, packageCount, [
    /\$\s*(\d{1,5}(?:\.\d{1,2})?)\s*(?:msrp|m\.s\.r\.p\.|list\s+price)\b/i,
    /\b(?:single\s+)?(?:msrp|m\.s\.r\.p\.|list\s+price)\b\s*:?\s*\$?\s*(\d{1,5}(?:\.\d{1,2})?)\b/i,
  ]);

  if (labeledMsrp !== null) {
    return labeledMsrp;
  }

  const singlePrice = findHumidorWebPriceCandidate(lines, packageCount, [
    /\bsingle\b[^\n$]{0,60}\$\s*(\d{1,5}(?:\.\d{1,2})?)\b/i,
    /\$\s*(\d{1,5}(?:\.\d{1,2})?)\s*(?:each|per\s+cigar)\b/i,
  ]);

  if (singlePrice !== null) {
    return singlePrice;
  }

  const tablePrice = findHumidorWebTablePriceCandidate(lines, packageCount);
  if (tablePrice !== null) {
    return tablePrice;
  }

  return findHumidorWebPriceCandidate(lines, packageCount, [
    /\b(?:retail|price|special\s+price|sale\s+price|our\s+price|each|per\s+cigar)\b\s*:?\s*\$\s*(\d{1,5}(?:\.\d{1,2})?)\b/i,
    /\$\s*(\d{1,5}(?:\.\d{1,2})?)\s*(?:retail|price)\b/i,
  ]);
}

function findHumidorWebPriceCandidate(lines, packageCount, patterns) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/,/g, "");
    const context = getHumidorWebPriceContext(lines, index);
    if (isHumidorWebMarketingMoneyContext(line)) {
      continue;
    }

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) {
        continue;
      }

      const value = normalizeHumidorWebPriceCandidate(match[1], packageCount, context);
      if (value !== null) {
        return value;
      }
    }

    if (/^(?:msrp|m\.s\.r\.p\.|retail|price|special\s+price|sale\s+price|our\s+price)\s*:?\s*$/i.test(line)) {
      const nextMoneyLine = lines
        .slice(index + 1, index + 4)
        .find((candidate) => /^\$\s*\d{1,5}(?:\.\d{1,2})?\b/.test(candidate.replace(/,/g, "")));
      if (nextMoneyLine && !isHumidorWebMarketingMoneyContext(nextMoneyLine)) {
        const match = nextMoneyLine.replace(/,/g, "").match(/^\$\s*(\d{1,5}(?:\.\d{1,2})?)\b/);
        const value = normalizeHumidorWebPriceCandidate(match?.[1], packageCount, `${context} ${nextMoneyLine}`);
        if (value !== null) {
          return value;
        }
      }
    }
  }

  return null;
}

function findHumidorWebTablePriceCandidate(lines, packageCount) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/,/g, "");
    const context = getHumidorWebPriceContext(lines, index);
    if (isHumidorWebMarketingMoneyContext(line)) {
      continue;
    }

    const tableMatch = line.match(/\bbox\s+of\s+\d{1,3}\b[^\n$]{0,100}\b(\d{2,5}(?:\.\d{1,2})?)\s*\$/i);
    if (!tableMatch) {
      continue;
    }

    const value = normalizeHumidorWebPriceCandidate(tableMatch[1], inferHumidorWebPackageCount(context) || packageCount, context);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getHumidorWebPriceContext(lines, index) {
  return lines.slice(Math.max(0, index - 4), Math.min(lines.length, index + 3)).join(" ");
}

function inferHumidorWebPackageCount(value) {
  const text = sanitizeText(value, 1200);
  const patterns = [
    /\bbox\s*[-:]?\s*(\d{1,3})\s*(?:total\s+)?cigars\b/i,
    /\bbox\s+of\s+(\d{1,3})\b/i,
    /\b(\d{1,3})\s*(?:total\s+)?cigars\b/i,
    /\b(\d{1,3})\s*\/\s*(?:bx|bdl|pk|tin|ct)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const count = match ? Number(match[1]) : 0;
    if (Number.isFinite(count) && count > 1 && count <= 100) {
      return Math.round(count);
    }
  }

  return null;
}

function normalizeHumidorWebPriceCandidate(value, packageCount, context) {
  const amount = normalizeHumidorMoneyValue(value);
  if (amount === null || amount <= 0) {
    return null;
  }

  const count = inferHumidorWebPackageCount(context) || packageCount;
  const hasSingleContext = /\b(?:single|each|per\s+cigar)\b/i.test(context);
  const hasPackageContext = /\b(?:box|bundle|pack|tin|total\s+cigars)\b|\/\s*(?:bx|bdl|pk|tin|ct)\b/i.test(context);

  if (!hasSingleContext && hasPackageContext && count && amount >= count * 1.5) {
    return Math.round((amount / count) * 100) / 100;
  }

  return amount;
}

function isPlausibleHumidorEnrichmentUnitValue(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= HUMIDOR_ENRICHMENT_MAX_AUTO_UNIT_VALUE;
}

function isHumidorWebMarketingMoneyContext(value) {
  return /\b(?:advertised\s+price|best\s+price\s+guarantee|beat\s+any|bonus\s+item|discount|free\s+shipping|gift\s+certificate|guarantee|off|points|quantity|return\s+policy|returns|reward\s+points|save|shipping\s+over|you\s+save)\b/i.test(
    sanitizeText(value, 700)
  );
}

function buildHumidorWebEnrichmentSuggestion(item, requestedFields, references) {
  const suggestion = {
    brand: "",
    line: "",
    vitola: "",
    wrapper: "",
    origin: "",
    strength: "",
    tastingNotes: "",
    estimatedValue: null,
    estimatedValueCurrency: "",
    estimatedValueSource: "",
    cigarImage: null,
    confidence: "low",
    evidence: [],
    needsReview: [],
    details: normalizeCigarDetails({}, item),
  };

  for (const reference of references) {
    if (requestedFields.includes("info")) {
      suggestion.brand ||= reference.brand;
      suggestion.line ||= reference.line;
      suggestion.vitola ||= reference.vitola;
      suggestion.wrapper ||= reference.wrapper;
      suggestion.origin ||= reference.origin;
      suggestion.strength ||= reference.strength;
    }

    if (requestedFields.includes("msrp") && suggestion.estimatedValue === null && reference.estimatedValue !== null) {
      suggestion.estimatedValue = reference.estimatedValue;
      suggestion.estimatedValueCurrency = "USD";
      suggestion.estimatedValueSource = "public_web_reference";
    }

    if (requestedFields.includes("msrp") && reference.rejectedEstimatedValue !== null && reference.rejectedEstimatedValue !== undefined) {
      suggestion.needsReview.push(
        `${reference.title || "Public cigar reference"} (${reference.url}) reported ${formatMoney(reference.rejectedEstimatedValue)}, which is an implausible per-cigar price for automatic MSRP enrichment.`
      );
    }

    if (requestedFields.includes("image") && !suggestion.cigarImage && reference.imageUrl) {
      suggestion.cigarImage = normalizeHumidorReferenceImage({
        imageUrl: reference.imageUrl,
        source: reference.url,
      }, { allowFirstPartyAssets: false, requireRenderableHost: true });
    }

    suggestion.evidence.push(`${reference.title || "Public cigar reference"} (${reference.url}) provided ${reference.fields.join(", ")}.`);
  }

  const coverage = [
    suggestion.brand,
    suggestion.vitola,
    suggestion.wrapper,
    suggestion.origin,
    suggestion.strength,
    suggestion.estimatedValue,
    suggestion.cigarImage?.imageUrl,
  ].filter(Boolean).length;

  if (coverage >= 4) {
    suggestion.confidence = "medium";
  }

  if (requestedFields.includes("image") && !suggestion.cigarImage) {
    suggestion.needsReview.push("No stable product image URL was found during public web search.");
  }

  if (suggestion.estimatedValue !== null) {
    suggestion.details = normalizeCigarDetails(
      {
        manufacturer: suggestion.brand,
        size: suggestion.vitola,
        shape: suggestion.vitola,
        wrapper: suggestion.wrapper,
        country: suggestion.origin,
        body: suggestion.strength,
        msrp: formatMoney(suggestion.estimatedValue),
        sourceSummary: references.slice(0, 2).map((reference) => reference.url).join("; "),
      },
      item
    );
  } else {
    suggestion.details = normalizeCigarDetails(
      {
        manufacturer: suggestion.brand,
        size: suggestion.vitola,
        shape: suggestion.vitola,
        wrapper: suggestion.wrapper,
        country: suggestion.origin,
        body: suggestion.strength,
        sourceSummary: references.slice(0, 2).map((reference) => reference.url).join("; "),
      },
      item
    );
  }

  return suggestion;
}

function extractHtmlTitle(html) {
  const match = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToPlainText(match[1]) : "";
}

function extractFirstHtmlHeading(html) {
  const match = String(html || "").match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? htmlToPlainText(match[1]) : "";
}

function extractHtmlMetaContent(html, names) {
  const metaPattern = /<meta\b([^>]*?)>/gi;
  let match;

  while ((match = metaPattern.exec(String(html || "")))) {
    const attributes = parseHtmlAttributes(match[1]);
    const key = sanitizeText(attributes.property || attributes.name || attributes.itemprop, 120).toLowerCase();
    if (names.map((name) => name.toLowerCase()).includes(key)) {
      return decodeHtmlEntities(attributes.content || "");
    }
  }

  return "";
}

function parseHtmlAttributes(value) {
  const attributes = {};
  const attrPattern = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;

  while ((match = attrPattern.exec(String(value || "")))) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[2] || match[3] || match[4] || "");
  }

  return attributes;
}

function htmlToPlainText(value) {
  return decodeHtmlEntities(
    String(value || "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/?(?:br|p|div|section|article|li|ul|ol|table|thead|tbody|tr|td|th|dt|dd|dl|h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    });
}

function resolveHumidorReferenceUrl(pageUrl, candidate) {
  const text = sanitizeText(candidate, 1200);
  if (!text) {
    return "";
  }

  try {
    return new URL(text, pageUrl).toString();
  } catch {
    return text;
  }
}

async function maybeBuildHumidorCatalogEnrichmentSuggestion(item, requestedFields) {
  let catalog = [];
  try {
    const commerceEnv = await getCommerceRuntimeEnv();
    const launchCatalog = loadStripeLaunchCatalog(commerceEnv);
    catalog = Array.isArray(launchCatalog.catalog) ? launchCatalog.catalog : [];
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "humidor_catalog_enrichment_unavailable",
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return null;
  }

  const candidates = selectHumidorCatalogEnrichmentCandidates(catalog, item);
  if (!candidates.length) {
    return null;
  }

  return {
    status: "catalog_candidates_matched",
    count: candidates.length,
    suggestion: buildHumidorCatalogEnrichmentSuggestion(item, requestedFields, candidates),
  };
}

function selectHumidorCatalogEnrichmentCandidates(catalog, item) {
  const terms = buildHumidorCatalogEnrichmentTerms(item);
  if (!terms.length) {
    return [];
  }

  return catalog
    .filter(isRecommendableCigarCatalogProduct)
    .map((product, index) => ({
      product,
      index,
      score: scoreHumidorCatalogEnrichmentCandidate(product, terms),
    }))
    .filter((entry) => entry.score >= 8)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 8)
    .map((entry) => entry.product);
}

function buildHumidorCatalogEnrichmentTerms(item) {
  const raw = [item.brand, item.line, item.name, item.vitola, item.wrapper]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  const stopWords = new Set(["cigar", "cigars", "hand", "made", "box", "bx", "bundle", "bdl", "pack", "ct", "the"]);

  return Array.from(
    new Set(
      raw
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 3 && !stopWords.has(term) && !/^\d+$/.test(term))
    )
  );
}

function scoreHumidorCatalogEnrichmentCandidate(product, terms) {
  const searchable = `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (searchable.includes(term)) {
      score += product.name.toLowerCase().includes(term) ? 4 : 2;
    }
  }

  return score;
}

function buildHumidorCatalogEnrichmentSuggestion(item, requestedFields, candidates) {
  const best = candidates[0];
  const parsed = parseHumidorCatalogProductName(best.name);
  const estimatedValue = requestedFields.includes("msrp") ? getHumidorCatalogUnitPrice(best) : null;
  const evidence = candidates.slice(0, 4).map((product) => {
    const unitPrice = getHumidorCatalogUnitPrice(product);
    const price = unitPrice === null ? formatMoney(product.price) : `${formatMoney(unitPrice)} estimated per cigar from ${formatMoney(product.price)} box/bundle price`;
    return `${product.name} | SKU ${product.sku} | ${price} | /shop/${product.slug}/`;
  });
  const needsReview = [
    "Confirm the exact cigar, vitola, wrapper, and box count before approving catalog-derived enrichment.",
  ];

  if (requestedFields.includes("image")) {
    needsReview.push("No verified product image was available from the launch catalog; keep product image empty until a stable source is confirmed.");
  }

  return {
    brand: parsed.brand,
    line: parsed.line,
    vitola: parsed.vitola,
    wrapper: parsed.wrapper,
    origin: "",
    strength: "",
    tastingNotes: "",
    estimatedValue,
    estimatedValueCurrency: estimatedValue === null ? "" : "USD",
    estimatedValueSource: estimatedValue === null ? "" : "yuzu_catalog_public_price",
    cigarImage: null,
    confidence: "low",
    evidence,
    needsReview,
    details: normalizeCigarDetails(
      {
        manufacturer: parsed.brand,
        size: parsed.vitola,
        shape: parsed.vitola,
        wrapper: parsed.wrapper,
        msrp: estimatedValue === null ? "" : formatMoney(estimatedValue),
        sourceSummary: `Matched ${item.name} against Yuzu launch catalog candidates.`,
      },
      item
    ),
  };
}

function parseHumidorCatalogProductName(name) {
  const normalized = sanitizeText(name, 220)
    .replace(/\b\d+\s*(?:ct|\/\s*(?:bx|bdl|pk|tin|ct))\b/gi, " ")
    .replace(/\b(?:by oliva)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const upper = normalized.toUpperCase();
  const brand = inferHumidorCatalogBrand(upper);
  const withoutBrand = brand ? normalized.replace(new RegExp(`^${escapeRegex(brand)}\\s+`, "i"), "").trim() : normalized;
  const vitola = inferHumidorCatalogVitola(withoutBrand);
  const wrapper = inferHumidorCatalogWrapper(withoutBrand);
  let line = withoutBrand;

  if (vitola) {
    line = line.replace(new RegExp(`\\b${escapeRegex(vitola)}\\b`, "i"), " ");
  }

  line = titleCaseCatalogText(line.replace(/\s+/g, " ").trim());

  return {
    brand,
    line,
    vitola,
    wrapper,
  };
}

function inferHumidorCatalogBrand(upperName) {
  const knownBrands = [
    "DREW ESTATE",
    "ARTURO FUENTE",
    "MY FATHER",
    "ROCKY PATEL",
    "LA AROMA DE CUBA",
    "SAN CRISTOBAL",
    "ASHTON",
    "PLASENCIA",
    "CAMACHO",
    "OLIVA",
    "NUB",
    "PADRON",
    "MONTECRISTO",
    "ROMEO Y JULIETA",
    "PARTAGAS",
    "PUNCH",
    "ACID",
    "CAO",
    "JAVA",
    "QUORUM",
  ];
  const match = knownBrands.find((brand) => upperName.startsWith(`${brand} `) || upperName === brand);
  if (match) {
    return titleCaseCatalogText(match);
  }

  return titleCaseCatalogText(upperName.split(/\s+/, 1)[0] || "");
}

function inferHumidorCatalogVitola(name) {
  const match = name.match(
    /\b(robusto|toro|churchill|corona(?:\s+gorda)?|torpedo|gordo|double\s+gordo|lonsdale|belicoso|perfecto|panatela|short\s+robusto|the\s+58)\b/i
  );
  return match ? titleCaseCatalogText(match[1]) : "";
}

function inferHumidorCatalogWrapper(name) {
  const match = name.match(/\b(maduro|connecticut|habano|cameroon|corojo|sumatra|natural|broadleaf|oscuro|claro|ecuador)\b/i);
  return match ? titleCaseCatalogText(match[1]) : "";
}

function getHumidorCatalogUnitPrice(product) {
  const price = Number(product.price);
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  const count = inferHumidorCatalogPackageCount(product.name);
  const unitPrice = count > 1 ? price / count : price;

  return Math.round(unitPrice * 100) / 100;
}

function inferHumidorCatalogPackageCount(name) {
  const text = String(name || "").toLowerCase();
  const slashMatch = text.match(/\b(\d{1,3})\s*\/\s*(?:bx|bdl|pk|tin|ct)\b/);
  if (slashMatch) {
    return Math.max(1, Number(slashMatch[1]) || 1);
  }

  const countMatch = text.match(/\b(\d{1,3})\s*ct\b/);
  if (countMatch) {
    return Math.max(1, Number(countMatch[1]) || 1);
  }

  return 1;
}

function titleCaseCatalogText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mergeHumidorEnrichment(currentItem, enrichment, requestedFields) {
  const item = { ...currentItem };
  const updatedFields = [];

  if (requestedFields.includes("info")) {
    fillMissingHumidorText(item, updatedFields, "brand", enrichment.brand);
    fillMissingHumidorText(item, updatedFields, "line", enrichment.line);
    fillMissingHumidorText(item, updatedFields, "vitola", enrichment.vitola);
    fillMissingHumidorText(item, updatedFields, "wrapper", enrichment.wrapper);
    fillMissingHumidorText(item, updatedFields, "origin", enrichment.origin);
    fillMissingHumidorText(item, updatedFields, "strength", enrichment.strength);
    fillMissingHumidorText(item, updatedFields, "tastingNotes", enrichment.tastingNotes);
  }

  if (requestedFields.includes("msrp") && item.estimatedValue === null && isPlausibleHumidorEnrichmentUnitValue(enrichment.estimatedValue)) {
    item.estimatedValue = enrichment.estimatedValue;
    item.estimatedValueCurrency = enrichment.estimatedValueCurrency || "USD";
    item.estimatedValueSource = enrichment.estimatedValueSource || "ai_humidor_enrichment_msrp";
    updatedFields.push("estimatedValue");
  }

  if (requestedFields.includes("image") && !hasHumidorRenderableImageMetadata(item) && enrichment.cigarImage?.imageUrl) {
    item.cigarImage = enrichment.cigarImage;
    updatedFields.push("cigarImage");
  }

  return { item, updatedFields };
}

function fillMissingHumidorText(item, updatedFields, field, value) {
  const text = sanitizeText(value, field === "tastingNotes" ? 2000 : MAX_FIELD_LENGTH);

  if (!text || sanitizeText(item[field], field === "tastingNotes" ? 2000 : MAX_FIELD_LENGTH)) {
    return;
  }

  item[field] = text;
  updatedFields.push(field);
}

function buildHumidorEnrichmentAiSummary(ai) {
  return {
    status: ai.status,
    modelId: ai.modelId,
    agentId: ai.agentId,
    agentAliasId: ai.agentAliasId,
    knowledgeBaseStatus: ai.knowledgeBaseStatus,
    retrievedContextCount: ai.retrievedContextCount,
    webSearchStatus: ai.webSearchStatus,
    webSearchQuery: ai.webSearchQuery,
    webSearchResultCount: ai.webSearchResultCount,
    webSearchSources: ai.webSearchSources,
    catalogReferenceStatus: ai.catalogReferenceStatus,
    catalogReferenceCount: ai.catalogReferenceCount,
    browserSearch: ai.browserSearch,
    rekognition: ai.rekognition ? summarizeRekognitionForClient(ai.rekognition) : undefined,
    stopReason: ai.stopReason || null,
  };
}

function normalizeHumidorReferenceImage(value, options = {}) {
  const raw =
    typeof value === "string"
      ? { imageUrl: value }
      : value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
  const imageUrl = sanitizeHumidorImageUrl(raw.imageUrl || raw.url || raw.src || raw.href, options);

  if (!imageUrl) {
    return null;
  }

  const mimeType = sanitizeText(raw.mimeType || raw.contentType, 80).toLowerCase().split(";", 1)[0] || inferHumidorImageMimeType(imageUrl);

  if (!CIGAR_IMAGE_MIME_FORMATS.has(mimeType)) {
    return null;
  }

  return {
    dataUrl: "",
    imageUrl,
    mimeType,
    fileName: sanitizeText(raw.fileName || raw.name, 180) || buildHumidorImageFileName(imageUrl),
    bytes: 0,
    source: sanitizeText(raw.source || raw.sourceUrl || raw.attribution, 200) || "agent_reference",
  };
}

function sanitizeHumidorImageUrl(value, options = {}) {
  const text = sanitizeText(value, 1000);
  const allowFirstPartyAssets = options.allowFirstPartyAssets !== false;

  if (/^https:\/\/[^\s"<>]+$/i.test(text)) {
    return options.requireRenderableHost && !isHumidorRenderableReferenceImageUrl(text) ? "" : text;
  }

  if (allowFirstPartyAssets && isHumidorRenderableFirstPartyAssetPath(text)) {
    return text;
  }

  return "";
}

function isHumidorRenderableFirstPartyAssetPath(value) {
  return /^\/assets\/(?:product-[a-z-]+\.png|inventory\/[A-Za-z0-9._~/%-]+\.(?:png|jpe?g|gif|webp))$/i.test(
    String(value || "").trim()
  );
}

function hasHumidorReferenceImageUrlMetadata(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Boolean(sanitizeText(raw.imageUrl || raw.url || raw.src || raw.href, 1000));
}

function isHumidorRenderableReferenceImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return HUMIDOR_RENDERABLE_REFERENCE_IMAGE_PATHS.some(
      ([allowedHost, allowedPathPrefix]) => hostname === allowedHost && url.pathname.startsWith(allowedPathPrefix)
    );
  } catch {
    return false;
  }
}

function inferHumidorImageMimeType(imageUrl) {
  const path = imageUrl.split("?", 1)[0].toLowerCase();

  if (path.endsWith(".png")) {
    return "image/png";
  }

  if (path.endsWith(".gif")) {
    return "image/gif";
  }

  if (path.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

function buildHumidorImageFileName(imageUrl) {
  const lastPathPart = imageUrl.split("?", 1)[0].split("/").filter(Boolean).pop() || "humidor-reference-image.jpg";
  return sanitizeText(lastPathPart, 180) || "humidor-reference-image.jpg";
}

function normalizeHumidorS3Image(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const s3Key = sanitizeHumidorS3Key(raw.s3Key || raw.key || raw.objectKey);
  if (!s3Key) {
    return null;
  }

  const s3Bucket = sanitizeS3BucketName(raw.s3Bucket || raw.bucket || getHumidorImageBucket());
  if (!s3Bucket) {
    return null;
  }

  const mimeType = sanitizeText(raw.mimeType || raw.contentType, 80).toLowerCase().split(";", 1)[0] || inferHumidorImageMimeType(s3Key);
  if (!CIGAR_IMAGE_MIME_FORMATS.has(mimeType)) {
    return null;
  }

  const bytes = Number(raw.bytes ?? raw.size ?? raw.byteLength ?? 0);

  return {
    dataUrl: "",
    imageUrl: "",
    s3Bucket,
    s3Key,
    mimeType,
    fileName: sanitizeText(raw.fileName || raw.name, 180) || buildHumidorImageFileName(s3Key),
    bytes: Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0,
    source: sanitizeText(raw.source, 120) || "member_upload",
  };
}

async function prepareHumidorCigarImageForStorage(cigarImage, actor, requestId, itemName) {
  if (!cigarImage) {
    return null;
  }

  const referenceImage = normalizeHumidorReferenceImage(cigarImage, { requireRenderableHost: true });
  if (referenceImage?.imageUrl) {
    return referenceImage;
  }

  const s3Image = normalizeHumidorS3Image(cigarImage);
  if (s3Image) {
    return s3Image;
  }

  const attachment = normalizeHumidorCigarImageAttachment(cigarImage);
  if (!attachment.value) {
    return summarizeStoredHumidorCigarImage(cigarImage);
  }

  const storedImage = await maybeStoreHumidorCigarImageInS3(attachment.value, actor, requestId, itemName);
  return storedImage || summarizeStoredHumidorCigarImage(attachment.value);
}

async function resolveHumidorCigarImageForClient(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const referenceImage = normalizeHumidorReferenceImage(value, { requireRenderableHost: true });
  if (referenceImage?.imageUrl) {
    return referenceImage;
  }

  let s3Image = normalizeHumidorS3Image(value);
  const attachment = !s3Image ? normalizeHumidorCigarImageAttachment(value).value : null;

  if (!s3Image && attachment) {
    s3Image = await maybeStoreHumidorCigarImageInS3(attachment, options.actor, options.requestId, options.itemName);
    if (s3Image && options.client && options.itemId && options.memberId) {
      await updateHumidorItemCigarImageMetadata(options.client, options.itemId, options.memberId, s3Image);
    }
  }

  if (s3Image) {
    return {
      ...s3Image,
      imageUrl: await maybeBuildHumidorCigarImageSignedUrl(s3Image),
    };
  }

  if (hasHumidorReferenceImageUrlMetadata(value)) {
    return null;
  }

  return summarizeStoredHumidorCigarImage(value);
}

async function maybeStoreHumidorCigarImageInS3(cigarImage, actor, requestId, itemName) {
  const attachment = normalizeHumidorCigarImageAttachment(cigarImage);
  if (!attachment.value?.dataUrl) {
    return normalizeHumidorS3Image(cigarImage);
  }

  const parsed = parseImageDataUrl(attachment.value.dataUrl);
  if (!parsed.base64) {
    return summarizeStoredHumidorCigarImage(attachment.value);
  }

  try {
    const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
    const bucket = getHumidorImageBucket();
    const key = buildHumidorImageS3Key(actor, attachment.value, itemName);
    const body = Buffer.from(parsed.base64, "base64");
    const client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: attachment.value.mimeType,
        Metadata: {
          requestId: sanitizeText(requestId, 120),
          source: "ycc-humidor-image",
        },
      })
    );

    return {
      dataUrl: "",
      imageUrl: "",
      s3Bucket: bucket,
      s3Key: key,
      mimeType: attachment.value.mimeType,
      fileName: attachment.value.fileName,
      bytes: body.length,
      source: attachment.value.source || "member_upload",
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "humidor_cigar_image_s3_store_failed",
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return summarizeStoredHumidorCigarImage(attachment.value);
  }
}

async function maybeBuildHumidorCigarImageSignedUrl(cigarImage) {
  const s3Image = normalizeHumidorS3Image(cigarImage);
  if (!s3Image) {
    return "";
  }

  try {
    const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
    const client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: s3Image.s3Bucket,
        Key: s3Image.s3Key,
      }),
      { expiresIn: HUMIDOR_IMAGE_SIGNED_URL_EXPIRES_SECONDS }
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "humidor_cigar_image_signed_url_failed",
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return "";
  }
}

async function updateHumidorItemCigarImageMetadata(client, itemId, memberId, cigarImage) {
  const s3Image = normalizeHumidorS3Image(cigarImage);
  if (!s3Image) {
    return;
  }

  await client.query(
    `
      update public.humidor_items
      set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{cigarImage}', $1::jsonb, true),
          updated_at = now()
      where id = $2 and member_id = $3
    `,
    [JSON.stringify(s3Image), itemId, memberId]
  );
}

function getHumidorImageBucket() {
  return sanitizeS3BucketName(process.env.HUMIDOR_IMAGE_BUCKET || process.env.S3_APP_BUCKET || process.env.CONCIERGE_VOICE_BUCKET || process.env.SUPPORT_EMAIL_RAW_BUCKET || "classroom2");
}

function getHumidorImagePrefix() {
  const prefix = String(process.env.HUMIDOR_IMAGE_PREFIX || DEFAULT_HUMIDOR_IMAGE_PREFIX)
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;

  if (!normalized.startsWith("ycc/") || normalized.includes("..")) {
    return DEFAULT_HUMIDOR_IMAGE_PREFIX;
  }

  return normalized;
}

function buildHumidorImageS3Key(actor, cigarImage, itemName) {
  const prefix = getHumidorImagePrefix();
  const owner = crypto
    .createHash("sha256")
    .update(String(actor?.sub || actor?.email || "anonymous"))
    .digest("hex")
    .slice(0, 16);
  const nameHint = slugify(itemName || cigarImage.fileName || "cigar-image").slice(0, 48) || "cigar-image";
  const extension = CIGAR_IMAGE_MIME_FORMATS.get(cigarImage.mimeType) || "jpg";

  return `${prefix}${owner}/${Date.now()}-${crypto.randomUUID()}-${nameHint}.${extension}`;
}

function sanitizeHumidorS3Key(value) {
  const text = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (!text || text.length > 1024 || text.includes("..") || !text.startsWith("ycc/")) {
    return "";
  }

  return text;
}

function sanitizeS3BucketName(value) {
  const text = String(value || "").trim();
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(text) ? text : "";
}

function normalizeHumidorItem(value) {
  const brand = sanitizeText(value.brand, MAX_FIELD_LENGTH);
  const line = sanitizeText(value.line, MAX_FIELD_LENGTH);
  const name = sanitizeText(value.name || value.cigarName || [brand, line].filter(Boolean).join(" "), MAX_FIELD_LENGTH);
  const quantity = Number(value.quantity ?? 1);
  const rating = value.rating === undefined || value.rating === null || value.rating === "" ? null : Number(value.rating);
  const estimatedValue = normalizeHumidorMoneyValue(
    value.estimatedValue ??
      value.unitValue ??
      value.value ??
      value.price ??
      value.msrp ??
      value.details?.msrp
  );
  const estimatedValueCurrency = estimatedValue === null ? "" : normalizeHumidorCurrency(value.estimatedValueCurrency || value.currency) || "USD";
  const estimatedValueSource =
    estimatedValue === null ? "" : sanitizeText(value.estimatedValueSource || value.valueSource, 120) || "member_estimate";
  const cigarImage = normalizeStoredHumidorCigarImage(value.cigarImage);

  return {
    name,
    brand,
    line,
    vitola: sanitizeText(value.vitola, MAX_FIELD_LENGTH),
    wrapper: sanitizeText(value.wrapper, MAX_FIELD_LENGTH),
    origin: sanitizeText(value.origin, MAX_FIELD_LENGTH),
    strength: sanitizeText(value.strength, MAX_FIELD_LENGTH),
    quantity: Number.isFinite(quantity) && quantity > 0 ? Math.min(Math.round(quantity), 10000) : 1,
    rating: Number.isFinite(rating) ? Math.max(0, Math.min(100, Math.round(rating))) : null,
    purchaseDate: normalizeDateOnly(value.purchaseDate),
    agingStartDate: normalizeDateOnly(value.agingStartDate),
    productionDate: normalizeDateOnly(value.productionDate || value.producedDate || value.boxDate),
    reorderReminder: normalizeDateOnly(value.reorderReminder),
    humidorLocation: sanitizeText(value.humidorLocation || value.location, MAX_FIELD_LENGTH),
    tray: sanitizeText(value.tray, MAX_FIELD_LENGTH),
    tastingNotes: sanitizeText(value.tastingNotes || value.notes, 2000),
    source: sanitizeText(value.source, 120) || "api",
    estimatedValue,
    estimatedValueCurrency,
    estimatedValueSource,
    cigarImage,
  };
}

function normalizeHumidorSmokeLog(value) {
  const rawRating = value.rating;
  const rawDuration = value.durationMinutes ?? value.duration_minutes;
  const rawSmokedAt = value.smokedAt ?? value.smoked_at;
  const rating = rawRating === undefined || rawRating === null || rawRating === "" ? null : Number(rawRating);
  const durationMinutes = rawDuration === undefined || rawDuration === null || rawDuration === "" ? null : Number(rawDuration);
  const smokedAt = normalizeHumidorSmokeTimestamp(rawSmokedAt);
  const drinkPairing = sanitizeText(value.drinkPairing || value.drink || value.pairing, MAX_FIELD_LENGTH);

  return {
    humidorItemId: getUuidOrNull(value.humidorItemId || value.humidor_item_id),
    cigarName: sanitizeText(value.cigarName || value.cigar || value.name, MAX_FIELD_LENGTH),
    smokedAt,
    rating: Number.isFinite(rating) ? Math.max(0, Math.min(100, Math.round(rating))) : null,
    drinkPairing,
    pairing: drinkPairing,
    notes: sanitizeText(value.notes || value.tastingNotes, 2000),
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.min(Math.round(durationMinutes), 24 * 60) : null,
    source: sanitizeText(value.source, 120) || "member_smoke_log",
    invalidRating: rawRating !== undefined && rawRating !== null && rawRating !== "" && (!Number.isFinite(rating) || rating < 0 || rating > 100),
    invalidDuration:
      rawDuration !== undefined &&
      rawDuration !== null &&
      rawDuration !== "" &&
      (!Number.isFinite(durationMinutes) || durationMinutes <= 0),
    invalidSmokedAt: rawSmokedAt !== undefined && rawSmokedAt !== null && rawSmokedAt !== "" && !smokedAt,
  };
}

function normalizeHumidorSharedQuantity(value) {
  if (value === undefined || value === null || value === "") {
    return 1;
  }

  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  return Math.min(Math.round(quantity), 10000);
}

function buildHumidorSharedInventoryLog(item, details) {
  const sharedWith = sanitizeText(details.sharedWith, MAX_FIELD_LENGTH);
  const sharedNotes = sanitizeText(details.sharedNotes, 1000);
  const sharedSummary = `Shared ${details.quantity}${sharedWith ? ` with ${sharedWith}` : ""}.`;

  return {
    humidorItemId: item.id,
    cigarName: item.name,
    smokedAt: null,
    rating: null,
    drinkPairing: "",
    pairing: "",
    notes: [sharedSummary, sharedNotes].filter(Boolean).join(" "),
    durationMinutes: null,
    source: "member_shared_gift",
  };
}

function normalizeHumidorSmokeTimestamp(value) {
  const text = sanitizeText(value, 80);
  if (!text) {
    return null;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeHumidorMoneyValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(Math.min(value, 1000000) * 100) / 100 : null;
  }

  const text = sanitizeText(value, 120).replace(/,/g, "");
  const match = text.match(/\d+(?:\.\d{1,2})?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(Math.min(parsed, 1000000) * 100) / 100 : null;
}

function normalizeHumidorCurrency(value) {
  const normalized = sanitizeText(value, 12).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "";
}

function normalizeHumidorCigarImageAttachment(value) {
  const root = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const dataUrlImage = parseImageDataUrl(root.imageDataUrl || root.dataUrl || root.image);
  const mimeType = sanitizeText(root.mimeType || root.contentType || dataUrlImage.mimeType, 80).toLowerCase();
  const imageBase64 = String(root.imageBase64 || root.base64 || dataUrlImage.base64 || "")
    .replace(/\s+/g, "")
    .trim();

  if (!mimeType && !imageBase64) {
    return { value: null };
  }

  const format = CIGAR_IMAGE_MIME_FORMATS.get(mimeType);
  if (!format) {
    return {
      error: {
        error: mimeType ? "unsupported_cigar_image_type" : "missing_cigar_image",
        message: "Upload a PNG, JPEG, GIF, or WebP cigar image before saving it with a humidor item.",
      },
    };
  }

  if (!imageBase64) {
    return {
      error: {
        error: "missing_cigar_image",
        message: "Upload a cigar image before saving it with a humidor item.",
      },
    };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64) || imageBase64.length % 4 !== 0) {
    return {
      error: {
        error: "invalid_cigar_image",
        message: "The uploaded cigar image could not be decoded.",
      },
    };
  }

  const bytes = Buffer.from(imageBase64, "base64");
  if (!bytes.length) {
    return {
      error: {
        error: "invalid_cigar_image",
        message: "The uploaded cigar image could not be decoded.",
      },
    };
  }

  if (bytes.length > MAX_CIGAR_IMAGE_BYTES) {
    return {
      error: {
        error: "cigar_image_too_large",
        message: "Upload a cigar image under 5 MB.",
      },
    };
  }

  return {
    value: {
      dataUrl: `data:${mimeType};base64,${imageBase64}`,
      mimeType,
      fileName: sanitizeText(root.fileName || root.name, 180),
      bytes: bytes.length,
      source: sanitizeText(root.source, 120) || "member_upload",
    },
  };
}

function normalizeStoredHumidorCigarImage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const referenceImage = normalizeHumidorReferenceImage(value, { requireRenderableHost: true });
  if (referenceImage) {
    return referenceImage;
  }

  const s3Image = normalizeHumidorS3Image(value);
  if (s3Image) {
    return s3Image;
  }

  const attachment = normalizeHumidorCigarImageAttachment(value);
  return attachment.value ? summarizeHumidorImageAttachment(attachment.value) : null;
}

function summarizeStoredHumidorCigarImage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const referenceImage = normalizeHumidorReferenceImage(value, { requireRenderableHost: true });
  if (referenceImage) {
    return referenceImage;
  }

  const s3Image = normalizeHumidorS3Image(value);
  if (s3Image) {
    return s3Image;
  }

  const attachment = normalizeHumidorCigarImageAttachment(value);
  if (attachment.value) {
    return summarizeHumidorImageAttachment(attachment.value);
  }

  if (hasHumidorReferenceImageUrlMetadata(value)) {
    return null;
  }

  const dataUrlMimeType = parseImageDataUrlMimeType(value.imageDataUrl || value.dataUrl || value.image);
  const mimeType = sanitizeText(value.mimeType || value.contentType || dataUrlMimeType, 80)
    .toLowerCase()
    .split(";", 1)[0];
  if (!CIGAR_IMAGE_MIME_FORMATS.has(mimeType)) {
    return null;
  }

  const bytes = Number(value.bytes ?? value.size ?? value.byteLength ?? 0);

  return {
    dataUrl: "",
    imageUrl: "",
    mimeType,
    fileName: sanitizeText(value.fileName || value.name, 180),
    bytes: Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : 0,
    source: sanitizeText(value.source, 120) || "member_upload",
  };
}

function summarizeHumidorImageAttachment(value) {
  const attachment = normalizeHumidorCigarImageAttachment(value);
  if (!attachment.value) {
    return null;
  }

  return {
    dataUrl: "",
    imageUrl: "",
    mimeType: attachment.value.mimeType,
    fileName: attachment.value.fileName,
    bytes: attachment.value.bytes,
    source: attachment.value.source || "member_upload",
  };
}

function parseImageDataUrlMimeType(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const match = text.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  return match ? match[1].toLowerCase() : "";
}

function parseConciergeVoiceAudio(value) {
  const dataUrlAudio = parseAudioDataUrl(value.audioDataUrl || value.dataUrl || value.audio);
  const mimeType = sanitizeText(value.mimeType || value.contentType || dataUrlAudio.mimeType, 120)
    .toLowerCase()
    .split(";", 1)[0];
  const mediaFormat = VOICE_AUDIO_MIME_FORMATS.get(mimeType);

  if (!mediaFormat) {
    return {
      error: {
        error: mimeType ? "unsupported_voice_audio_type" : "missing_voice_audio",
        message: "Record a WebM, Ogg, MP4, MPEG, WAV, or M4A voice message before sending it to the concierge.",
      },
    };
  }

  const audioBase64 = String(value.audioBase64 || value.base64 || dataUrlAudio.base64 || "")
    .replace(/\s+/g, "")
    .trim();

  if (!audioBase64) {
    return {
      error: {
        error: "missing_voice_audio",
        message: "Record a voice message before sending it to the concierge.",
      },
    };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(audioBase64) || audioBase64.length % 4 !== 0) {
    return {
      error: {
        error: "invalid_voice_audio",
        message: "The recorded voice message could not be decoded.",
      },
    };
  }

  const bytes = Buffer.from(audioBase64, "base64");
  if (!bytes.length) {
    return {
      error: {
        error: "invalid_voice_audio",
        message: "The recorded voice message could not be decoded.",
      },
    };
  }

  if (bytes.length > MAX_VOICE_AUDIO_BYTES) {
    return {
      error: {
        error: "voice_audio_too_large",
        message: "Record a voice message under 6 MB.",
      },
    };
  }

  const duration = Number(value.durationMs);
  return {
    audioBase64,
    bytes,
    durationMs: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null,
    mediaFormat,
    mimeType,
  };
}

function normalizeCigarImageInput(value) {
  const dataUrlImage = parseImageDataUrl(value.imageDataUrl || value.dataUrl || value.image);
  const mimeType = sanitizeText(value.mimeType || value.contentType || dataUrlImage.mimeType, 80).toLowerCase();
  const format = CIGAR_IMAGE_MIME_FORMATS.get(mimeType);

  if (!format) {
    return {
      error: {
        error: mimeType ? "unsupported_cigar_image_type" : "missing_cigar_image",
        message: "Upload a PNG, JPEG, GIF, or WebP cigar image before asking the humidor agent to identify it.",
      },
    };
  }

  const imageBase64 = String(value.imageBase64 || value.base64 || dataUrlImage.base64 || "")
    .replace(/\s+/g, "")
    .trim();

  if (!imageBase64) {
    return {
      error: {
        error: "missing_cigar_image",
        message: "Upload a cigar image before asking the humidor agent to identify it.",
      },
    };
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64) || imageBase64.length % 4 !== 0) {
    return {
      error: {
        error: "invalid_cigar_image",
        message: "The uploaded cigar image could not be decoded.",
      },
    };
  }

  const bytes = Buffer.from(imageBase64, "base64");
  if (!bytes.length) {
    return {
      error: {
        error: "invalid_cigar_image",
        message: "The uploaded cigar image could not be decoded.",
      },
    };
  }

  if (bytes.length > MAX_CIGAR_IMAGE_BYTES) {
    return {
      error: {
        error: "cigar_image_too_large",
        message: "Upload a cigar image under 5 MB.",
      },
    };
  }

  return {
    bytes,
    format,
    mimeType,
    fileName: sanitizeText(value.fileName || value.name, 180),
  };
}

function parseImageDataUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const match = text.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);

  return {
    mimeType: match ? match[1].toLowerCase() : "",
    base64: match ? match[2] : "",
  };
}

function parseAudioDataUrl(value) {
  const text = typeof value === "string" ? value.trim() : "";
  const match = text.match(/^data:(audio\/[a-z0-9.+-]+(?:;codecs=[a-z0-9.+-]+)?);base64,([A-Za-z0-9+/=\s]+)$/i);

  return {
    mimeType: match ? match[1].toLowerCase().split(";", 1)[0] : "",
    base64: match ? match[2] : "",
  };
}

function buildCigarVisionSystemPrompt(actor) {
  return [
    "You are YCCHumidorAgent, an adult-only humidor inventory specialist for Yuzu Cigar Club.",
    "Identify cigar bands, boxes, labels, or receipts from images and extract inventory fields for a member's digital humidor.",
    "Do not make health, cessation, medical, or safety claims. Minimize PII and mark uncertain fields for member review.",
    `Member context: tier=${actor.membershipTier || "unknown"}; status=${actor.memberStatus || "unknown"}.`,
  ].join(" ");
}

async function maybeDetectCigarImageText(image) {
  const minConfidence = normalizeRekognitionMinTextConfidence(process.env.REKOGNITION_MIN_TEXT_CONFIDENCE);
  const minLabelConfidence = normalizeRekognitionMinLabelConfidence(process.env.REKOGNITION_MIN_LABEL_CONFIDENCE);
  const featureStatus = sanitizeText(process.env.FEATURE_REKOGNITION || "pending_service", 80);
  const textReady = REKOGNITION_TEXT_READY_VALUES.has(featureStatus);
  const labelsReady = REKOGNITION_LABEL_READY_VALUES.has(featureStatus);
  const analysis = {
    status: textReady ? "not_run" : labelsReady ? "not_enabled" : featureStatus,
    minConfidence,
    textLines: [],
    labelStatus: labelsReady ? "not_run" : textReady ? "not_enabled" : featureStatus,
    minLabelConfidence,
    labels: [],
  };

  if (!textReady && !labelsReady) {
    return analysis;
  }

  if (!REKOGNITION_TEXT_IMAGE_MIME_TYPES.has(image.mimeType)) {
    return {
      ...analysis,
      status: textReady ? "unsupported_image_type" : analysis.status,
      labelStatus: labelsReady ? "unsupported_image_type" : analysis.labelStatus,
    };
  }

  let rekognitionSdk;
  try {
    rekognitionSdk = require("@aws-sdk/client-rekognition");
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "warn",
        event: "rekognition_cigar_image_sdk_load_failed",
        name: error instanceof Error ? error.name : null,
        message: error instanceof Error ? error.message : String(error),
      })
    );

    return {
      ...analysis,
      status: textReady ? "detect_text_failed" : analysis.status,
      labelStatus: labelsReady ? "detect_labels_failed" : analysis.labelStatus,
    };
  }

  const { DetectLabelsCommand, DetectTextCommand, RekognitionClient } = rekognitionSdk;
  const client = new RekognitionClient({ region: process.env.AWS_REGION || "us-east-1" });

  if (textReady) {
    try {
      const result = await client.send(
        new DetectTextCommand({
          Image: {
            Bytes: image.bytes,
          },
        })
      );

      const textLines = normalizeRekognitionTextLines(result.TextDetections, minConfidence);
      analysis.status = textLines.length ? "detected_text" : "no_text";
      analysis.textLines = textLines;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "warn",
          event: "rekognition_cigar_text_detection_failed",
          name: error instanceof Error ? error.name : null,
          message: error instanceof Error ? error.message : String(error),
        })
      );

      analysis.status = "detect_text_failed";
      analysis.textLines = [];
    }
  }

  if (labelsReady) {
    try {
      const result = await client.send(
        new DetectLabelsCommand({
          Image: {
            Bytes: image.bytes,
          },
          MaxLabels: MAX_REKOGNITION_LABELS,
          MinConfidence: minLabelConfidence,
          Features: ["GENERAL_LABELS"],
        })
      );

      const labels = normalizeRekognitionLabels(result.Labels, minLabelConfidence);
      analysis.labelStatus = labels.length ? "detected_labels" : "no_labels";
      analysis.labels = labels;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "warn",
          event: "rekognition_cigar_label_detection_failed",
          name: error instanceof Error ? error.name : null,
          message: error instanceof Error ? error.message : String(error),
        })
      );

      analysis.labelStatus = "detect_labels_failed";
      analysis.labels = [];
    }
  }

  return analysis;
}

function normalizeRekognitionMinTextConfidence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REKOGNITION_MIN_TEXT_CONFIDENCE;
  }

  return Math.min(99, Math.max(1, Math.round(parsed * 10) / 10));
}

function normalizeRekognitionMinLabelConfidence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_REKOGNITION_MIN_LABEL_CONFIDENCE;
  }

  return Math.min(99, Math.max(1, Math.round(parsed * 10) / 10));
}

function normalizeRekognitionTextLines(detections, minConfidence) {
  const lines = [];
  const seen = new Set();

  for (const detection of Array.isArray(detections) ? detections : []) {
    const type = sanitizeText(detection?.Type, 20).toUpperCase();
    if (type !== "LINE") {
      continue;
    }

    const text = sanitizeText(detection?.DetectedText, 180);
    const confidence = Number(detection?.Confidence);
    const key = text.toLowerCase();
    if (!text || seen.has(key) || !Number.isFinite(confidence) || confidence < minConfidence) {
      continue;
    }

    seen.add(key);
    lines.push({
      text,
      confidence: Math.round(confidence * 10) / 10,
    });

    if (lines.length >= MAX_REKOGNITION_TEXT_LINES) {
      break;
    }
  }

  return lines;
}

function normalizeRekognitionLabels(detections, minConfidence) {
  const labels = [];
  const seen = new Set();

  for (const detection of Array.isArray(detections) ? detections : []) {
    const name = sanitizeText(detection?.Name, 100);
    const confidence = Number(detection?.Confidence);
    const key = name.toLowerCase();
    if (!name || seen.has(key) || !Number.isFinite(confidence) || confidence < minConfidence) {
      continue;
    }

    seen.add(key);
    labels.push({
      name,
      confidence: Math.round(confidence * 10) / 10,
      parents: normalizeRekognitionLabelNames(detection?.Parents, 4),
      categories: normalizeRekognitionLabelNames(detection?.Categories, 4),
      aliases: normalizeRekognitionLabelNames(detection?.Aliases, 4),
    });

    if (labels.length >= MAX_REKOGNITION_LABELS) {
      break;
    }
  }

  return labels;
}

function normalizeRekognitionLabelNames(values, maxCount) {
  const names = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const name = sanitizeText(typeof value === "string" ? value : value?.Name, 100);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) {
      continue;
    }

    seen.add(key);
    names.push(name);

    if (names.length >= maxCount) {
      break;
    }
  }

  return names;
}

function summarizeRekognitionForClient(rekognition) {
  const textLines = Array.isArray(rekognition?.textLines)
    ? rekognition.textLines.map((line) => ({
        text: sanitizeText(line.text, 180),
        confidence: normalizeRekognitionMinTextConfidence(line.confidence),
      }))
    : [];
  const labels = Array.isArray(rekognition?.labels)
    ? rekognition.labels.map((label) => ({
        name: sanitizeText(label.name, 100),
        confidence: normalizeRekognitionMinLabelConfidence(label.confidence),
        parents: normalizeRekognitionLabelNames(label.parents, 4),
        categories: normalizeRekognitionLabelNames(label.categories, 4),
        aliases: normalizeRekognitionLabelNames(label.aliases, 4),
      }))
    : [];

  return {
    status: sanitizeText(rekognition?.status || "not_run", 80),
    minConfidence: normalizeRekognitionMinTextConfidence(rekognition?.minConfidence),
    textCount: textLines.length,
    textLines,
    labelStatus: sanitizeText(rekognition?.labelStatus || "not_run", 80),
    minLabelConfidence: normalizeRekognitionMinLabelConfidence(rekognition?.minLabelConfidence),
    labelCount: labels.length,
    labels,
  };
}

function buildCigarImageIdentificationPrompt(notes, rekognition) {
  return [
    "Identify the cigar in this image and return only strict JSON. If the exact cigar is visually identifiable, include generally known reference details; if it is not, leave uncertain fields empty and add review notes.",
    "Use this top-level schema exactly: name, brand, line, vitola, wrapper, origin, strength, quantity, purchaseDate, agingStartDate, productionDate, reorderReminder, humidorLocation, tray, rating, estimatedValue, estimatedValueCurrency, tastingNotes, confidence, evidence, needsReview, details.",
    "details must be an object with this schema exactly: manufacturer, country, region, factory, size, length, ringGauge, shape, wrapper, binder, filler, blend, flavorProfile, body, finish, msrp, releaseStatus, packaging, sourceSummary, imageObservations.",
    "Set estimatedValue to the best per-cigar retail/MSRP number when visible or generally known, otherwise null. Set estimatedValueCurrency to USD unless another currency is explicit.",
    "Set confidence to high, medium, or low. Use null for unknown dates, rating, and estimatedValue. Use empty strings for unknown text fields. Use empty arrays for unknown array fields. Use quantity 1 unless a count is visible.",
    "Evidence, needsReview, details.flavorProfile, and details.imageObservations must be arrays of short strings.",
    "Separate visual evidence from reference knowledge: evidence and imageObservations should describe what is visible; sourceSummary should say which details are inferred from known cigar references.",
    "Explain useful humidor-ready details in tastingNotes, including blend, size, likely flavor profile, aging/storage notes, and any fields the member should confirm. Do not claim certainty when the band or label is unclear.",
    buildRekognitionPromptEvidence(rekognition),
    notes ? `Member notes: ${notes}` : "No member notes were provided.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRekognitionPromptEvidence(rekognition) {
  return [buildRekognitionTextPromptEvidence(rekognition), buildRekognitionLabelPromptEvidence(rekognition)]
    .filter(Boolean)
    .join("\n");
}

function buildRekognitionTextPromptEvidence(rekognition) {
  const lines = Array.isArray(rekognition?.textLines) ? rekognition.textLines : [];
  if (!lines.length) {
    return "";
  }

  const formattedLines = lines
    .map((line) => {
      const text = sanitizeText(line.text, 180);
      const confidence = normalizeRekognitionMinTextConfidence(line.confidence);
      return text ? `- ${text} (${confidence}% confidence)` : "";
    })
    .filter(Boolean);

  if (!formattedLines.length) {
    return "";
  }

  return [
    `Amazon Rekognition OCR candidates from cigar band or box text, minimum confidence ${normalizeRekognitionMinTextConfidence(rekognition.minConfidence)}%:`,
    ...formattedLines,
    "Use these OCR candidates only as visual evidence. If the OCR conflicts with the image, member notes, or known cigar references, mark the affected fields for review instead of guessing.",
  ].join("\n");
}

function buildRekognitionLabelPromptEvidence(rekognition) {
  const labels = Array.isArray(rekognition?.labels) ? rekognition.labels : [];
  if (!labels.length) {
    return "";
  }

  const formattedLabels = labels
    .map((label) => {
      const name = sanitizeText(label.name, 100);
      const confidence = normalizeRekognitionMinLabelConfidence(label.confidence);
      const parents = normalizeRekognitionLabelNames(label.parents, 4);
      const categories = normalizeRekognitionLabelNames(label.categories, 4);
      const aliases = normalizeRekognitionLabelNames(label.aliases, 4);
      const context = [
        parents.length ? `parents: ${parents.join(", ")}` : "",
        categories.length ? `categories: ${categories.join(", ")}` : "",
        aliases.length ? `aliases: ${aliases.join(", ")}` : "",
      ].filter(Boolean);

      return name ? `- ${name} (${confidence}% confidence${context.length ? `; ${context.join("; ")}` : ""})` : "";
    })
    .filter(Boolean);

  if (!formattedLabels.length) {
    return "";
  }

  return [
    `Amazon Rekognition visual labels from the uploaded image, minimum confidence ${normalizeRekognitionMinLabelConfidence(rekognition.minLabelConfidence)}%:`,
    ...formattedLabels,
    "Use these labels only as supplemental visual context for cigar, box, band, receipt, or humidor cues. Do not infer brand, line, vitola, or value from labels alone.",
  ].join("\n");
}

function parseCigarIdentificationReply(reply, notes) {
  const parsed = parseFirstJsonObject(reply);
  if (!parsed) {
    return buildFallbackCigarSuggestion(notes, "low");
  }

  const item = normalizeHumidorItem({
    ...parsed,
    source: "ai_cigar_image",
    quantity: parsed.quantity ?? 1,
  });
  const details = normalizeCigarDetails(parsed, item);
  const estimatedValue = item.estimatedValue ?? normalizeHumidorMoneyValue(details.msrp);
  const estimatedValueSource = sanitizeText(parsed.estimatedValueSource || parsed.valueSource, 120);

  if (!item.name) {
    item.name = [item.brand, item.line, item.vitola].filter(Boolean).join(" ") || "Unidentified cigar";
  }

  return {
    ...item,
    source: "ai_cigar_image",
    estimatedValue,
    estimatedValueCurrency: estimatedValue === null ? "" : item.estimatedValueCurrency || "USD",
    estimatedValueSource: estimatedValue === null ? "" : estimatedValueSource || "ai_identification_msrp",
    confidence: normalizeCigarConfidence(parsed.confidence),
    evidence: normalizeTextList(parsed.evidence, ["Review the uploaded image before saving."]),
    needsReview: normalizeTextList(parsed.needsReview || parsed.review, item.name === "Unidentified cigar" ? ["Confirm cigar name before saving."] : []),
    details,
  };
}

function buildFallbackCigarSuggestion(notes, confidence) {
  const item = normalizeHumidorItem({
    name: "Unidentified cigar",
    quantity: 1,
    tastingNotes: notes ? `Image needs member review. Notes: ${notes}` : "Image needs member review before saving.",
    source: "ai_cigar_image",
  });

  return {
    ...item,
    source: "ai_cigar_image",
    confidence: normalizeCigarConfidence(confidence),
    evidence: notes ? ["Member notes were captured for review."] : ["No confident visual identification was returned."],
    needsReview: ["Confirm cigar name, brand, and vitola before saving."],
    details: normalizeCigarDetails({}, item),
  };
}

function normalizeCigarDetails(parsed, item) {
  const root = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const nested = root.details && typeof root.details === "object" && !Array.isArray(root.details) ? root.details : {};
  const read = (...keys) => readFirstDetailValue(root, nested, keys);

  return {
    manufacturer: sanitizeDetailText(read("manufacturer", "maker", "producer"), MAX_FIELD_LENGTH),
    country: sanitizeDetailText(read("country", "countryOfOrigin", "originCountry") || item.origin, MAX_FIELD_LENGTH),
    region: sanitizeDetailText(read("region", "growingRegion"), MAX_FIELD_LENGTH),
    factory: sanitizeDetailText(read("factory", "factoryName"), MAX_FIELD_LENGTH),
    size: sanitizeDetailText(read("size", "dimensions"), MAX_FIELD_LENGTH),
    length: sanitizeDetailText(read("length", "lengthInches"), MAX_FIELD_LENGTH),
    ringGauge: sanitizeDetailText(read("ringGauge", "ring", "gauge"), MAX_FIELD_LENGTH),
    shape: sanitizeDetailText(read("shape", "format") || item.vitola, MAX_FIELD_LENGTH),
    wrapper: sanitizeDetailText(read("wrapper") || item.wrapper, MAX_FIELD_LENGTH),
    binder: sanitizeDetailText(read("binder"), MAX_FIELD_LENGTH),
    filler: sanitizeDetailText(read("filler"), MAX_FIELD_LENGTH),
    blend: sanitizeDetailText(read("blend", "blendSummary"), 700),
    flavorProfile: normalizeTextList(read("flavorProfile", "flavors", "tastingProfile"), []),
    body: sanitizeDetailText(read("body") || item.strength, MAX_FIELD_LENGTH),
    finish: sanitizeDetailText(read("finish"), MAX_FIELD_LENGTH),
    msrp: sanitizeDetailText(read("msrp", "price", "estimatedPrice"), MAX_FIELD_LENGTH),
    releaseStatus: sanitizeDetailText(read("releaseStatus", "availability", "productionStatus"), MAX_FIELD_LENGTH),
    packaging: sanitizeDetailText(read("packaging", "box", "pack"), MAX_FIELD_LENGTH),
    sourceSummary: sanitizeDetailText(read("sourceSummary", "referenceSummary", "knownDetails"), 700),
    imageObservations: normalizeTextList(read("imageObservations", "visualObservations", "observations"), []),
  };
}

function readFirstDetailValue(root, nested, keys) {
  for (const source of [nested, root]) {
    for (const key of keys) {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        return source[key];
      }
    }
  }

  return "";
}

function sanitizeDetailText(value, maxLength) {
  if (Array.isArray(value)) {
    return sanitizeText(value.filter(Boolean).join(", "), maxLength);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return sanitizeText(String(value), maxLength);
  }

  return sanitizeText(value, maxLength);
}

function logCigarIdentificationSummary(event, requestId, actor, ai, image, notes) {
  const suggestion = ai.suggestion || {};

  console.log(
    JSON.stringify({
      level: "info",
      event: "cigar_image_identification_completed",
      requestId,
      status: ai.status,
      modelId: ai.modelId,
      stopReason: ai.stopReason || null,
      confidence: suggestion.confidence || "low",
      suggestedName: suggestion.name || "",
      brand: suggestion.brand || "",
      line: suggestion.line || "",
      vitola: suggestion.vitola || "",
      fieldCoverage: getCigarSuggestionCoverage(suggestion),
      detailsCoverage: getCigarDetailsCoverage(suggestion.details),
      evidenceCount: Array.isArray(suggestion.evidence) ? suggestion.evidence.length : 0,
      needsReviewCount: Array.isArray(suggestion.needsReview) ? suggestion.needsReview.length : 0,
      rekognition: {
        status: ai.rekognition?.status || "not_run",
        textCount: Array.isArray(ai.rekognition?.textLines) ? ai.rekognition.textLines.length : 0,
        minConfidence: ai.rekognition?.minConfidence || null,
        labelStatus: ai.rekognition?.labelStatus || "not_run",
        labelCount: Array.isArray(ai.rekognition?.labels) ? ai.rekognition.labels.length : 0,
        minLabelConfidence: ai.rekognition?.minLabelConfidence || null,
      },
      input: {
        imageType: image.mimeType,
        imageBytes: image.bytes.length,
        notesLength: notes.length,
      },
      actorHash: actor ? hashActor(actor.sub || actor.email) : null,
      sourceIp: event.requestContext?.http?.sourceIp || null,
    })
  );
}

function getCigarSuggestionCoverage(suggestion) {
  return [
    "name",
    "brand",
    "line",
    "vitola",
    "wrapper",
    "origin",
    "strength",
    "quantity",
    "purchaseDate",
    "agingStartDate",
    "productionDate",
    "reorderReminder",
    "humidorLocation",
    "tray",
    "rating",
    "estimatedValue",
    "tastingNotes",
  ].filter((field) => hasMeaningfulCigarValue(suggestion?.[field]));
}

function getCigarDetailsCoverage(details) {
  return [
    "manufacturer",
    "country",
    "region",
    "factory",
    "size",
    "length",
    "ringGauge",
    "shape",
    "wrapper",
    "binder",
    "filler",
    "blend",
    "flavorProfile",
    "body",
    "finish",
    "msrp",
    "releaseStatus",
    "packaging",
    "sourceSummary",
    "imageObservations",
  ].filter((field) => hasMeaningfulCigarValue(details?.[field]));
}

function hasMeaningfulCigarValue(value) {
  if (Array.isArray(value)) {
    return value.some((item) => sanitizeText(item, 80));
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return Boolean(sanitizeText(value, 80));
}

function parseFirstJsonObject(value) {
  const text = sanitizeMultilineText(value, 5000);
  if (!text) {
    return null;
  }

  const candidates = [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    candidates.push(fenced[1]);
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  candidates.push(text);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function normalizeCigarConfidence(value) {
  const normalized = sanitizeText(value, 30).toLowerCase();
  if (["high", "medium", "low"].includes(normalized)) {
    return normalized;
  }

  return "medium";
}

function normalizeTextList(value, fallback = []) {
  const values = Array.isArray(value) ? value : value ? [value] : fallback;

  return values
    .map((item) => sanitizeText(item, 180))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeDateOnly(value) {
  const text = sanitizeText(value, 80);
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function parseJsonBody(event, options = {}) {
  if (!event.body) {
    return { value: {} };
  }

  try {
    const maxBytes = Number.isFinite(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : MAX_DEFAULT_JSON_BODY_BYTES;
    const rawBuffer = event.isBase64Encoded ? Buffer.from(String(event.body), "base64") : Buffer.from(String(event.body), "utf8");
    if (rawBuffer.length > maxBytes) {
      return {
        error: json(413, getRequestId(event, {}), {
          error: "request_body_too_large",
          message: "The request body is too large.",
          maxBytes,
        }),
      };
    }

    const raw = rawBuffer.toString("utf8");
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        error: json(400, getRequestId(event, {}), {
          error: "invalid_json_body",
          message: "The request body must be a JSON object.",
        }),
      };
    }

    return { value: parsed };
  } catch {
    return {
      error: json(400, getRequestId(event, {}), {
        error: "invalid_json_body",
        message: "The request body could not be parsed as JSON.",
      }),
    };
  }
}

function parseRawEmail(rawEmail) {
  const normalized = String(rawEmail || "").replace(/\r\n/g, "\n");
  const separatorIndex = normalized.search(/\n\n/);
  const headerText = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : normalized;
  const bodyText = separatorIndex >= 0 ? normalized.slice(separatorIndex + 2) : "";
  const headers = {};
  let currentHeader = "";

  for (const line of headerText.split("\n")) {
    if (/^\s/.test(line) && currentHeader) {
      headers[currentHeader] = `${headers[currentHeader]} ${line.trim()}`;
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex <= 0) {
      continue;
    }

    currentHeader = line.slice(0, colonIndex).trim().toLowerCase();
    headers[currentHeader] = line.slice(colonIndex + 1).trim();
  }

  return {
    bodyText,
    from: headers.from || "",
    subject: headers.subject || "",
    to: headers.to || "",
  };
}

function normalizeEmailAddresses(value, maxItems) {
  const candidates = Array.isArray(value) ? value : String(value || "").split(/[;,]/);
  const addresses = [];

  for (const candidate of candidates) {
    const match = String(candidate || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match) {
      addresses.push(match[0].toLowerCase());
    }

    if (addresses.length >= maxItems) {
      break;
    }
  }

  return [...new Set(addresses)];
}

function sanitizeMultilineText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxLength);
}

function isSesReceiptEvent(event) {
  return Array.isArray(event.Records) && event.Records.some((record) => record?.eventSource === "aws:ses");
}

function isCognitoPostConfirmationSignUpEvent(event) {
  return event.triggerSource === "PostConfirmation_ConfirmSignUp" && Boolean(event.request?.userAttributes);
}

function isBedrockActionGroupEvent(event) {
  return event.messageVersion === "1.0" && typeof event.actionGroup === "string" && (typeof event.function === "string" || typeof event.apiPath === "string");
}

function getActionParameters(event) {
  const params = {};
  for (const item of Array.isArray(event.parameters) ? event.parameters : []) {
    if (item && typeof item.name === "string") {
      params[item.name] = String(item.value ?? "");
    }
  }

  const properties = event.requestBody?.content?.["application/json"]?.properties;
  for (const item of Array.isArray(properties) ? properties : []) {
    if (item && typeof item.name === "string") {
      params[item.name] = String(item.value ?? "");
    }
  }

  return params;
}

function getActionActor(event) {
  const attrs = event.sessionAttributes || {};
  const sub = optionalString(attrs.memberSub || attrs.sub || attrs.cognitoSub);
  if (!sub) {
    return null;
  }

  return {
    sub,
    email: optionalString(attrs.memberEmail || attrs.email),
    emailVerified: true,
    name: optionalString(attrs.memberName || attrs.name),
    username: optionalString(attrs.username || attrs.cognitoUsername),
    groups: parseGroups(attrs.cognitoGroups || attrs.groups),
    membershipTier: optionalString(attrs.membershipTier || attrs["custom:membership_tier"]),
    memberStatus: optionalString(attrs.memberStatus || attrs["custom:member_status"]),
    stripeCustomerId: optionalString(attrs.stripeCustomerId || attrs["custom:stripe_customer_id"]),
  };
}

function bedrockFunctionResponse(event, body, responseState) {
  const functionResponse = {
    responseBody: {
      TEXT: {
        body: JSON.stringify(body),
      },
    },
  };

  if (responseState) {
    functionResponse.responseState = responseState;
  }

  return {
    messageVersion: "1.0",
    response: {
      actionGroup: event.actionGroup,
      function: event.function,
      functionResponse,
    },
    sessionAttributes: event.sessionAttributes || {},
    promptSessionAttributes: event.promptSessionAttributes || {},
  };
}

function getActionResponseStatus(response) {
  const state = response?.response?.functionResponse?.responseState;
  return state === "FAILURE" ? 500 : state === "REPROMPT" ? 400 : 200;
}

function getActor(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (!claims || !claims.sub) {
    return null;
  }

  return {
    sub: String(claims.sub),
    email: optionalString(claims.email),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: optionalString(claims.name) || optionalString(claims.given_name),
    username: optionalString(claims.username) || optionalString(claims["cognito:username"]),
    groups: parseGroups(claims["cognito:groups"]),
    membershipTier: optionalString(claims["custom:membership_tier"]),
    memberStatus: optionalString(claims["custom:member_status"]),
    stripeCustomerId: optionalString(claims["custom:stripe_customer_id"] || claims.stripe_customer_id),
  };
}

function parseGroups(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" && value.trim() ? [value] : [];

  return values
    .flatMap((item) =>
      String(item)
        .trim()
        .replace(/^\[+|\]+$/g, "")
        .split(/[\s,]+/g)
    )
    .map((item) =>
      String(item)
        .replace(/^["']+|["']+$/g, "")
        .trim()
    )
    .filter(Boolean);
}

function isCheckoutSessionStatusRoute(routeKey) {
  return routeKey === "GET /commerce/checkout-session/{id}" || /^GET \/commerce\/checkout-session\/[^/]+$/.test(routeKey);
}

function isCommerceOrderRoute(routeKey) {
  return routeKey === "GET /commerce/orders/{id}" || /^GET \/commerce\/orders\/[^/]+$/.test(routeKey);
}

function isAdminCommerceOrderMutationRoute(routeKey) {
  return routeKey === "PATCH /admin/commerce/orders/{id}" || /^PATCH \/admin\/commerce\/orders\/[^/]+$/.test(routeKey);
}

function isAdminMemberAccessMutationRoute(routeKey) {
  return routeKey === "PATCH /admin/members/{id}/access" || /^PATCH \/admin\/members\/[^/]+\/access$/.test(routeKey);
}

function isAdminRoute(routeKey) {
  return ADMIN_ROUTES.has(routeKey) || isAdminCommerceOrderMutationRoute(routeKey) || isAdminMemberAccessMutationRoute(routeKey);
}

function isHumidorRoute(routeKey) {
  return HUMIDOR_ROUTES.has(routeKey);
}

function getRouteKey(event) {
  if (event.routeKey) {
    return event.routeKey;
  }

  return `${getMethod(event)} ${event.rawPath || event.path || "/"}`;
}

function getMethod(event) {
  return event.requestContext?.http?.method || event.httpMethod || "GET";
}

function getRequestId(event, context) {
  return (
    event.headers?.["x-request-id"] ||
    event.headers?.["X-Request-Id"] ||
    event.requestContext?.requestId ||
    context.awsRequestId ||
    crypto.randomUUID()
  );
}

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeSecretText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function toPositiveInteger(value, fallback) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getHeader(event, name) {
  const headers = event.headers || {};
  const target = name.toLowerCase();

  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  return "";
}

function getQueryParam(event, name) {
  const target = String(name || "").toLowerCase();
  const params = event.queryStringParameters || {};
  for (const [key, value] of Object.entries(params)) {
    if (String(key).toLowerCase() === target) {
      return Array.isArray(value) ? value[0] : value;
    }
  }

  const rawQueryString = String(event.rawQueryString || "");
  if (rawQueryString) {
    const searchParams = new URLSearchParams(rawQueryString);
    return searchParams.get(name) || "";
  }

  return "";
}

function extractLastPathSegment(event) {
  const pathValue = event.rawPath || event.path || "";
  const lastSegment = String(pathValue).split("/").filter(Boolean).pop();
  let decodedSegment = lastSegment || "";
  try {
    decodedSegment = decodeURIComponent(decodedSegment);
  } catch {
    decodedSegment = String(lastSegment || "");
  }

  return sanitizeText(decodedSegment, 180);
}

function getPathId(event, name) {
  const params = event.pathParameters || {};
  for (const [key, value] of Object.entries(params)) {
    if (String(key).toLowerCase() === String(name).toLowerCase()) {
      return sanitizeText(String(value || ""), 180);
    }
  }

  const parts = String(event.rawPath || event.path || "")
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });

  if (parts[0] === "admin" && parts[1] === "commerce" && parts[2] === "orders") {
    return sanitizeText(parts[3] || "", 180);
  }

  if (parts[0] === "admin" && parts[1] === "members") {
    return sanitizeText(parts[2] || "", 180);
  }

  if (parts[0] === "humidor" && parts[1] === "items") {
    return sanitizeText(parts[2] || "", 180);
  }

  return "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function normalizeOptionalStatus(value, allowedValues) {
  if (value === undefined) {
    return {
      supplied: false,
      value: null,
      error: "",
    };
  }

  const normalized = sanitizeText(String(value || ""), 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized || !allowedValues.has(normalized)) {
    return {
      supplied: true,
      value: null,
      error: `Allowed values are: ${Array.from(allowedValues).sort().join(", ")}.`,
    };
  }

  return {
    supplied: true,
    value: normalized,
    error: "",
  };
}

function normalizeOptionalNullableStatus(value, allowedValues) {
  if (value === undefined) {
    return {
      supplied: false,
      value: undefined,
      error: "",
    };
  }

  if (value === null || sanitizeText(String(value), 80) === "") {
    return {
      supplied: true,
      value: null,
      error: "",
    };
  }

  return normalizeOptionalStatus(value, allowedValues);
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function json(statusCode, requestId, payload) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
    body: JSON.stringify({ requestId, ...payload }),
  };
}

function empty(statusCode, requestId) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
    body: "",
  };
}

function corsHeaders() {
  return {
    "access-control-allow-origin": getCorsAllowOrigin(),
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "accept,authorization,content-type,stripe-signature,x-request-id,x-humidor-alert-dispatch-secret",
    vary: "origin",
  };
}

function getCorsAllowOrigin() {
  const allowedOrigins = getConfiguredCorsOrigins();
  if (allowedOrigins.includes("*")) {
    return activeRequestOrigin || "*";
  }

  if (activeRequestOrigin && allowedOrigins.includes(activeRequestOrigin)) {
    return activeRequestOrigin;
  }

  return allowedOrigins[0] || DEFAULT_CORS_ALLOW_ORIGINS[0];
}

function getConfiguredCorsOrigins() {
  const origins = [];
  const singleOrigin = sanitizeText(process.env.CORS_ALLOW_ORIGIN, 240);
  if (singleOrigin) {
    origins.push(singleOrigin);
  }

  origins.push(
    ...String(process.env.CORS_ALLOW_ORIGINS || "")
      .split(",")
      .map((origin) => sanitizeText(origin, 240))
      .filter(Boolean)
  );

  if (origins.length === 0) {
    origins.push(...DEFAULT_CORS_ALLOW_ORIGINS);
  }

  const uniqueOrigins = [...new Set(origins)];
  if (!isProductionCorsRuntime()) {
    return uniqueOrigins;
  }

  const productionOrigins = uniqueOrigins.filter((origin) => origin !== "*");
  return productionOrigins.length > 0 ? productionOrigins : DEFAULT_CORS_ALLOW_ORIGINS;
}

function isProductionCorsRuntime() {
  const nodeEnv = sanitizeText(process.env.NODE_ENV, 80).toLowerCase();
  const publicSiteUrl = sanitizeText(process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL, 240)
    .toLowerCase()
    .replace(/\/+$/g, "");

  return nodeEnv === "production" || publicSiteUrl === "https://yuzucigarclub.com" || publicSiteUrl === "https://www.yuzucigarclub.com";
}

function canOpenTcpConnection(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;

    const finish = (value) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function logCompleted(event, routeKey, statusCode, startedAt, requestId, actor) {
  console.log(
    JSON.stringify({
      level: "info",
      event: "request_completed",
      requestId,
      routeKey,
      statusCode,
      durationMs: Date.now() - startedAt,
      actorHash: actor ? hashActor(actor.sub || actor.email) : null,
      sourceIp: event.requestContext?.http?.sourceIp || null,
    })
  );
}

function hashActor(value) {
  if (!value) {
    return null;
  }

  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}
