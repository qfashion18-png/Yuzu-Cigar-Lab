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
  buildCustomerPortalSessionParams,
  createCommerceCheckoutSession,
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
const MAX_LIVE_PAGE_EDIT_FIELDS = 80;
const MAX_LIVE_PAGE_EDIT_FIELD_LENGTH = 2000;
const MAX_CIGAR_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VOICE_AUDIO_BYTES = 6 * 1024 * 1024;
const DEFAULT_SUPPORT_EMAIL_FROM = "support@yuzucigarclub.com";
const DEFAULT_SUPPORT_EMAIL_RAW_PREFIX = "ycc/support-email/raw/";
const DEFAULT_BEDROCK_MODEL_ID = "amazon.nova-lite-v1:0";
const DEFAULT_CONCIERGE_POLLY_VOICE_ID = "Joanna";
const DEFAULT_CONCIERGE_VOICE_PREFIX = "ycc/concierge-voice/";
const CONCIERGE_RESPONSE_STYLE_INSTRUCTION =
  "Answer the member's question directly first. Keep replies concise: one short paragraph or up to three bullets. Do not include broad background, internal implementation details, or extra next steps unless the member asks or a safety, compliance, or account handoff requires it.";
const CIGAR_IMAGE_MIME_FORMATS = new Map([
  ["image/jpeg", "jpeg"],
  ["image/jpg", "jpeg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
]);
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
  "GET /humidor/alerts",
  "POST /humidor/identify-cigar",
  "POST /humidor/alerts",
  "POST /humidor/items",
]);
const HUMIDOR_ALERT_DISPATCH_ROUTE = "POST /humidor/alerts/dispatch";
const HUMIDOR_ALERT_DISPATCH_SECRET_HEADER = "x-humidor-alert-dispatch-secret";
const HUMIDOR_REORDER_REMINDER_DISPATCH_MARKER = "humidorReorderReminderDispatchedOn";
const HUMIDOR_ALERT_DISPATCH_NOTIFICATION_TAG = "digital-humidor-alert";
const HUMIDOR_DISPATCH_ACTOR_SUB = "system.humidor-dispatch";
const ADMIN_ROUTES = new Set([
  "POST /admin/commerce/stripe-sync-products",
  "GET /admin/commerce/webhook-events",
  "GET /admin/commerce/compliance-holds",
  "POST /content/pages",
  "POST /news/story-drafts",
  "POST /news/stories",
  "POST /support/email-send",
]);
const COMMERCE_MIGRATION_CONFIRM = "APPLY_YCC_COMMERCE_SCHEMA";
const SITE_CONTENT_MIGRATION_CONFIRM = "APPLY_YCC_SITE_CONTENT_SCHEMA";
const NEWSROOM_MIGRATION_CONFIRM = "APPLY_YCC_NEWSROOM_SCHEMA";
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
const BEDROCK_AGENT_NAMES = new Set([
  "YCCConcierge",
  "YCCCigarGuide",
  "YCCSupportAgent",
  "YCCHumidorAgent",
  "YCCAdminAgent",
  "YCCNewsAgent",
]);
const DIRECT_BEDROCK_RUNTIME_AGENTS = new Set(["YCCCigarGuide"]);
const CIGAR_GUIDE_TERMS = [
  "cigar",
  "vitola",
  "wrapper",
  "binder",
  "filler",
  "humidor",
  "humidity",
  "pairing",
  "strength",
  "draw",
  "smoke",
];
const HUMIDOR_AGENT_TERMS = ["humidor", "humidity", "hygrometer", "temperature", "aging", "reorder", "inventory"];
const DEFAULT_HUMIDOR_ALERT_PREFERENCES = Object.freeze({
  pushEnabled: false,
  reorderRemindersEnabled: true,
  climateAlertsEnabled: false,
  pushSubscription: null,
});
const CHECKOUT_AGE_TOKEN_VERSION = "yccav1";
const CHECKOUT_AGE_TOKEN_TTL_SECONDS = 30 * 60;
const DEFAULT_CORS_ALLOW_ORIGINS = ["https://yuzucigarclub.com", "https://www.yuzucigarclub.com"];
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

    if (isSesReceiptEvent(event)) {
      const response = await handleSesReceipt(event, requestId);
      logCompleted(event, "SES_RECEIPT support-email", response.statusCode, startedAt, requestId);
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

    if (routeKey === "POST /commerce/checkout-session") {
      const response = await handleCommerceCheckoutSession(event, requestId);
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
    } else if (routeKey === "POST /commerce/customer-portal-session") {
      response = await handleCustomerPortalSession(event, actor, requestId);
    } else if (routeKey === "GET /commerce/membership") {
      response = await handleCommerceMembership(event, actor, requestId);
    } else if (routeKey === "GET /commerce/orders") {
      response = await handleCommerceOrders(event, actor, requestId);
    } else if (isCommerceOrderRoute(routeKey)) {
      response = await handleCommerceOrderStatus(event, actor, requestId);
    } else if (isAdminRoute(routeKey)) {
      if (routeKey === "POST /admin/commerce/stripe-sync-products") {
        response = await handleAdminStripeSyncProducts(event, actor, requestId);
      } else if (routeKey === "GET /admin/commerce/webhook-events") {
        response = await handleAdminWebhookEvents(event, actor, requestId);
      } else if (routeKey === "GET /admin/commerce/compliance-holds") {
        response = await handleAdminComplianceHolds(event, actor, requestId);
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
      } else if (routeKey === "GET /humidor/alerts") {
        response = await handleHumidorAlertPreferences(event, actor, requestId);
      } else if (routeKey === "POST /humidor/identify-cigar") {
        response = await handleHumidorCigarIdentification(event, actor, requestId);
      } else if (routeKey === "POST /humidor/alerts") {
        response = await handleHumidorAlertPreferencesUpdate(event, actor, requestId);
      } else if (routeKey === "POST /humidor/items") {
        response = await handleHumidorItem(event, actor, requestId);
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
      newsletterSubscribe: true,
    },
  });
}

async function handleNewsletterSubscribe(event, requestId) {
  const body = parseJsonBody(event);
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
  };

  let persistedSubscriber = null;
  if (shouldPersistDatabaseWrites()) {
    persistedSubscriber = await persistNewsletterSubscriber(event, requestId, signup);
  }

  return json(200, requestId, {
    subscriber: {
      id: persistedSubscriber?.id || null,
      email,
      persisted: Boolean(persistedSubscriber),
      persistence: persistedSubscriber ? "stored" : getDatabasePersistenceStatus(),
      wantsMonthlyMembership,
      preferredTier: signup.preferredTier,
      updatedAt: persistedSubscriber?.updatedAt || null,
    },
    nextActions: wantsMonthlyMembership
      ? ["send_newsletter", "send_monthly_membership_info", "invite_to_choose_plan"]
      : ["send_newsletter", "offer_membership_education"],
  });
}

async function handleCommerceCheckoutSession(event, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

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

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(409, requestId, {
      error: "stripe_not_ready",
      message: "Stripe checkout is not configured for this environment.",
    });
  }

  if (!process.env.STRIPE_LAUNCH_CATALOG_READY) {
    return json(409, requestId, {
      error: "commerce_not_configured",
      message: "The approved Stripe launch catalog has not been synced for checkout.",
    });
  }

  const launchCatalog = loadStripeLaunchCatalog(process.env);
  if (launchCatalog.error || launchCatalog.catalog.length === 0) {
    return json(409, requestId, {
      error: launchCatalog.error || "commerce_not_configured",
      message: launchCatalog.message || "The approved Stripe launch catalog has no checkout-ready products configured.",
      catalogSource: launchCatalog.source,
    });
  }

  const ageVerification = resolveCheckoutAgeVerification(body.value.compliance?.ageVerificationToken, process.env);
  if (!ageVerification.ok) {
    return json(400, requestId, {
      error: ageVerification.error || "age_verification_required",
      message: ageVerification.message || "Complete verified 21+ identity review before checkout.",
    });
  }

  const compliance = validateCheckoutReadiness({
    items,
    catalog: launchCatalog.catalog,
    ageVerification: ageVerification.value,
    destination: shippingAddress,
    shippingMethodId: body.value.shippingMethodId,
    tax: {
      status: process.env.FEATURE_STRIPE_TAX === "ready" ? "ready" : "unavailable",
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

  const stripe = createStripeClient();
  const session = await createCommerceCheckoutSession(stripe, {
    cartId: body.value.cartId,
    customer,
    items: compliance.normalizedItems,
    shipping: {
      methodId: body.value.shippingMethodId,
      address: shippingAddress,
    },
    compliance: {
      ageVerificationId: ageVerification.value.vendorTransactionId,
      verifiedAt: ageVerification.value.verifiedAt,
      policyVersion: "2026-05-07",
    },
  });

  return json(200, requestId, {
    id: session.id,
    url: session.url,
  });
}

async function handleCommerceMembershipSession(event, requestId) {
  const body = parseJsonBody(event);
  if (body.error) {
    return body.error;
  }

  const tierKey = slugify(body.value.tierName || body.value.tierKey);
  const billingPeriod = sanitizeText(body.value.billingPeriod, 40) || "monthly";
  const priceEnvKey = `STRIPE_PRICE_${tierKey.replace(/-/g, "_").toUpperCase()}_${billingPeriod.toUpperCase()}`;
  const stripePriceId = process.env[priceEnvKey];

  if (!process.env.STRIPE_SECRET_KEY || !stripePriceId) {
    return json(409, requestId, {
      error: "stripe_not_ready",
      message: "Stripe membership checkout is not configured for this environment.",
      priceEnvKey,
    });
  }

  const stripe = createStripeClient();
  const session = await createMembershipCheckoutSession(stripe, {
    tierKey,
    billingPeriod,
    stripePriceId,
    customer: body.value.customer,
  });

  return json(200, requestId, {
    id: session.id,
    url: session.url,
  });
}

async function handleStripeWebhook(event, requestId) {
  const signature = getHeader(event, "stripe-signature");
  if (!signature) {
    return json(400, requestId, {
      error: "missing_stripe_signature",
      message: "Stripe webhook events require a Stripe-Signature header.",
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return json(409, requestId, {
      error: "stripe_webhook_not_configured",
      message: "Stripe webhook verification is not configured for this environment.",
    });
  }

  try {
    const stripe = createStripeClient();
    const rawBody = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
    const stripeEvent = verifyStripeWebhook({
      stripe,
      rawBody,
      signature,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
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

    return json(200, requestId, {
      received: true,
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
      action,
      persistence: shouldPersistDatabaseWrites() ? "stored" : getDatabasePersistenceStatus(),
      processing,
    });
  } catch (error) {
    return json(400, requestId, {
      error: error.code || "invalid_stripe_signature",
      message: "Stripe webhook signature verification failed.",
    });
  }
}

async function handleCheckoutSessionStatus(event, requestId) {
  const sessionId = extractLastPathSegment(event);

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(409, requestId, {
      error: "stripe_not_ready",
      message: "Stripe checkout status is not configured for this environment.",
    });
  }

  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const status = mapCheckoutSessionStatus(session);
  const persistedOrder = shouldPersistDatabaseWrites() ? await findCommerceOrderByCheckoutSessionId(sessionId) : null;
  const effectiveStatus = applyPersistedOrderToCheckoutStatus(status, persistedOrder);

  return json(200, requestId, {
    ...effectiveStatus,
    id: effectiveStatus.id || sessionId,
  });
}

function loadStripeLaunchCatalog(env = process.env) {
  const source = readStripeLaunchCatalogSource(env);
  if (!source.content) {
    return { catalog: [], source: source.name };
  }

  let parsed;
  try {
    parsed = JSON.parse(source.content);
  } catch (error) {
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
    } catch (error) {
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
    price,
    publishStatus: sanitizeText(product.publishStatus || product.status || "published", 40),
    inventoryPolicy: sanitizeText(product.inventoryPolicy || (product.managedStock === false ? "manual" : "track"), 40),
    sourceQuantity: product.sourceQuantity ?? product.quantity ?? product.inventory ?? null,
    shippable: product.shippable !== false,
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
  if (!process.env.STRIPE_SECRET_KEY || !stripeCustomerId) {
    return json(409, requestId, {
      error: "stripe_not_ready",
      message: "Stripe Customer Portal is not configured for this member yet.",
    });
  }

  const stripe = createStripeClient();
  const session = await stripe.billingPortal.sessions.create(
    buildCustomerPortalSessionParams({ stripeCustomerId })
  );

  return json(200, requestId, {
    url: session.url,
  });
}

async function handleCommerceMembership(event, actor, requestId) {
  return json(200, requestId, {
    membership: getMembershipSnapshot(actor, null),
    source: "cognito-jwt",
    subscription: {
      status: "pending_backend_sync",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    },
  });
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

async function handleAdminStripeSyncProducts(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Stripe catalog sync requires an admin or concierge operator group.",
    });
  }

  return json(202, requestId, {
    sync: {
      status: "queued",
      seedScope: "featured_products_and_memberships",
      liveApprovalRequired: true,
    },
  });
}

async function handleAdminWebhookEvents(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Webhook event history requires an admin or concierge operator group.",
    });
  }

  return json(200, requestId, {
    events: [],
    persistence: getDatabasePersistenceStatus(),
  });
}

async function handleAdminComplianceHolds(event, actor, requestId) {
  if (!canUseAdminAgent(actor)) {
    return json(403, requestId, {
      error: "admin_forbidden",
      message: "Compliance hold review requires an admin or concierge operator group.",
    });
  }

  return json(200, requestId, {
    holds: [],
    persistence: getDatabasePersistenceStatus(),
  });
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

  const prompt = buildNewsAgentPrompt(input);
  const conversationId = `news_${crypto.randomUUID()}`;
  const bedrock = await maybeBuildBedrockReply("YCCNewsAgent", actor, prompt, conversationId);
  const draft = normalizeNewsDraftFromAgentReply(bedrock.reply || "", input);

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
  const member = await maybePersistMember(event, actor, requestId);
  const membership = getMembershipSnapshot(actor, member);

  return json(200, requestId, {
    account: actor,
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
  const agent = chooseAgent(message, requestedAgent);
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

  const conversationId = sanitizeText(details.conversationId, 120) || `conv_${crypto.randomUUID()}`;
  const bedrock = await maybeBuildBedrockReply(agent, actor, message, conversationId);
  const reply = bedrock.reply || buildConciergeReply(agent, actor);

  let persistedConversation = null;
  if (shouldPersistDatabaseWrites()) {
    persistedConversation = await persistConciergeChat(event, actor, requestId, {
      agent,
      bedrock,
      conversationId,
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
      nextActions: getAgentNextActions(agent, bedrock.status),
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

  if (process.env.FEATURE_SES !== "ready") {
    return json(409, requestId, {
      error: "ses_not_ready",
      message: "SES sending is disabled until YCC sender identities are verified and production access is ready.",
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
  const sesMessageId = await sendSupportEmail({
    bodyText,
    fromAddress,
    subject,
    toAddresses,
  });

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

    let persisted = null;
    if (shouldPersistDatabaseWrites()) {
      persisted = await persistInboundSupportEmail(event, requestId, {
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

    return bedrockFunctionResponse(event, {
      action: "admin_queue_summary",
      queue: sanitizeText(params.queue, 80) || "support",
      summary: [
        "Review high-priority billing, damaged, missing, refund, cancellation, and compliance-sensitive cases first.",
        "Keep payment data out of notes and route destructive account changes to a human operator.",
        "Use the audit trail and support case context before changing status or drafting outbound email.",
      ],
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

  const item = normalizeHumidorItem({
    ...body.value,
    cigarImage: cigarImage.value,
  });
  if (!item.name) {
    return json(400, requestId, {
      error: "missing_humidor_item_name",
      message: "Send at least a cigar name, or brand and line, to create a humidor item.",
    });
  }

  let persistedItem = null;
  if (shouldPersistDatabaseWrites()) {
    persistedItem = await persistHumidorItem(event, actor, requestId, item);
  }

  return json(persistedItem ? 201 : 202, requestId, {
    item: {
      id: persistedItem?.itemId || `humidor_${crypto.randomUUID()}`,
      ownerSub: actor.sub,
      ...item,
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
          and coalesce(hi.metadata#>>'{${HUMIDOR_REORDER_REMINDER_DISPATCH_MARKER}}', '') <> $1
          and hi.archived_at is null
        order by m.id, hi.reorder_reminder asc
      `,
      [dispatchDate]
    );

    if (dueResult.rows.length === 0) {
      return json(200, requestId, {
        status: "no_due_items",
        summary: {
          notificationDate: dispatchDate,
          dueItems: 0,
          sentNotifications: 0,
          failedNotifications: 0,
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

    return json(200, requestId, {
      status: "dispatched",
      summary: {
        notificationDate: dispatchDate,
        dueItems: dueResult.rows.length,
        attemptedMembers: memberGroups.size,
        sentNotifications,
        failedNotifications,
        sentItems,
        invalidSubscriptionItems,
      },
      failed: failedMembers,
    });
  });
}

async function maybeIdentifyCigarFromImage(actor, image, notes) {
  const modelId = process.env.BEDROCK_VISION_MODEL_ID || process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID;

  if (process.env.FEATURE_BEDROCK !== "runtime_ready") {
    return {
      status: process.env.FEATURE_BEDROCK || "pending_agent",
      modelId,
      stopReason: null,
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
            { text: buildCigarImageIdentificationPrompt(notes) },
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
      suggestion: buildFallbackCigarSuggestion(notes, "low"),
    };
  }
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

    return json(200, requestId, {
      items: result.rows.map(mapHumidorItemRow),
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

  if (event.action !== "apply_phase3_schema") {
    return json(400, requestId, {
      error: "invalid_migration_action",
      message: "Use apply_phase3_schema, verify_phase3_schema, apply_commerce_schema, verify_commerce_schema, apply_site_content_schema, verify_site_content_schema, apply_newsroom_schema, or verify_newsroom_schema.",
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

  const { GetSecretValueCommand, SecretsManagerClient } = require("@aws-sdk/client-secrets-manager");
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const parsed = JSON.parse(result.SecretString || "{}");

  if (!parsed.username || !parsed.password) {
    throw new Error("Database secret must include username and password.");
  }

  return {
    username: String(parsed.username),
    password: String(parsed.password),
  };
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

async function maybePersistMember(event, actor, requestId) {
  if (!shouldPersistDatabaseWrites()) {
    return null;
  }

  return withDatabaseClient("ycc-api-account", async (client) => {
    return upsertMember(client, actor, requestId);
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

    await insertAuditLog(client, event, {
      action: "support.email.received",
      actor,
      afterData: {
        caseNumber: supportCase.caseNumber,
        emailMessageId: emailMessage.id,
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
        select id, slug, title, dek, category, body_markdown, source_notes, official_sources, status, published_at, updated_at
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
  const result = await client.query(
    `
      insert into public.members (
        cognito_sub,
        email,
        email_verified,
        display_name,
        role,
        membership_tier,
        member_status,
        last_seen_at,
        metadata,
        actor_id,
        request_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, now(), $8::jsonb, $9, $10)
      on conflict (cognito_sub) do update
      set email = excluded.email,
          email_verified = excluded.email_verified,
          display_name = coalesce(excluded.display_name, public.members.display_name),
          role = excluded.role,
          membership_tier = excluded.membership_tier,
          member_status = excluded.member_status,
          last_seen_at = now(),
          metadata = public.members.metadata || excluded.metadata,
          actor_id = excluded.actor_id,
          request_id = excluded.request_id,
          updated_at = now()
      returning id, cognito_sub, email, display_name, role, membership_tier, member_status
    `,
    [
      actor.sub,
      normalized.email,
      actor.emailVerified,
      nullable(actor.name),
      normalized.role,
      normalized.membershipTier,
      normalized.memberStatus,
      JSON.stringify({
        cognitoGroups: actor.groups,
        cognitoUsername: actor.username,
        emailMissingInToken: !actor.email,
        source: "cognito-jwt",
      }),
      actor.sub,
      requestId,
    ]
  );

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
  };
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
        capturePath: details.pagePath || null,
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
          published_at = case when excluded.status = 'published' then coalesce(public.news_stories.published_at, now()) else null end,
          metadata = public.news_stories.metadata || excluded.metadata,
          actor_id = excluded.actor_id,
          request_id = excluded.request_id,
          updated_at = now()
      returning id, slug, title, dek, category, body_markdown, source_notes, official_sources, status, published_at, updated_at
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
      JSON.stringify({
        complianceReview: story.complianceReview || null,
        source: "newsroom-agent",
        updatedBySub: actor.sub,
      }),
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
        fromAddress: details.fromAddress,
        s3RawKey: details.rawKey,
        sesMessageId: details.sesMessageId,
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
      details.rawKey,
      details.receivedAt,
      JSON.stringify({
        source: "ses",
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

function resolveCheckoutAgeVerification(rawToken, env = process.env) {
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

function parseSignedCheckoutAgeToken(token, env = process.env) {
  const signingSecret = String(env.AGE_VERIFICATION_SIGNING_SECRET || "");
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
  return {
    vendorTransactionId,
    verifiedAt,
  };
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
    };
  });
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
      sanitizeText(session.customer, 160) || null,
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

  const subscriptionId = sanitizeText(
    subscriptionLike.id || subscriptionLike.subscription || subscriptionLike.subscription_id || subscriptionLike.stripe_subscription_id,
    200
  );
  if (!subscriptionId) {
    return null;
  }

  const subscriptionPriceId =
    sanitizeText(
      subscriptionLike.items?.data?.[0]?.price?.id || subscriptionLike.price?.id || subscriptionLike.plan?.id,
      160
    ) || null;
  const subscriptionCheckoutSessionId = sanitizeText(
    subscriptionLike.checkout_session || subscriptionLike.checkout?.session || subscriptionLike.checkout_session_id || null,
    200
  ) || null;
  const tierKey =
    sanitizeText(
      subscriptionLike.metadata?.tier_key || subscriptionLike.plan?.metadata?.tier_key || subscriptionLike.items?.data?.[0]?.price?.metadata?.tier_key,
      120
    ) || null;
  const billingPeriod =
    sanitizeText(
      subscriptionLike.metadata?.billing_period || subscriptionLike.items?.data?.[0]?.price?.recurring?.interval || subscriptionLike.billing_period,
      80
    ) || null;

  const status =
    action === "record_subscription_payment_failure"
      ? "past_due"
      : action === "record_subscription_cancellation"
        ? "canceled"
        : "active";
  const currentPeriodEnd = Number(subscriptionLike.current_period_end);
  const currentPeriodEndIso = Number.isFinite(currentPeriodEnd) ? new Date(currentPeriodEnd * 1000).toISOString() : null;

  const result = await client.query(
    `
      update public.member_subscriptions
      set status = $1,
          stripe_price_id = coalesce($2, public.member_subscriptions.stripe_price_id),
          stripe_checkout_session_id = coalesce($3, public.member_subscriptions.stripe_checkout_session_id),
          tier_key = coalesce($4, public.member_subscriptions.tier_key),
          billing_period = coalesce($5, public.member_subscriptions.billing_period),
          current_period_end = coalesce($6::timestamptz, public.member_subscriptions.current_period_end),
          updated_at = now()
      where stripe_subscription_id = $7
      returning id
    `,
    [status, subscriptionPriceId, subscriptionCheckoutSessionId, tierKey, billingPeriod, currentPeriodEndIso, subscriptionId]
  );

  const row = result.rows[0];
  return row ? { id: row.id, status } : null;
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

function getSupportEmailRawBucket() {
  return process.env.SUPPORT_EMAIL_RAW_BUCKET || process.env.S3_APP_BUCKET || "classroom2";
}

function getSupportEmailRawPrefix() {
  const prefix = process.env.SUPPORT_EMAIL_RAW_PREFIX || DEFAULT_SUPPORT_EMAIL_RAW_PREFIX;
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
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
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dek: row.dek || "",
    category: row.category || "Industry News",
    bodyMarkdown: row.body_markdown || "",
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
  };
}

function buildNewsAgentPrompt(input) {
  const vettedSources = input.sourceUrls.map(normalizeNewsSourceCandidate);
  const acceptedSources = vettedSources.filter((source) => source.status === "official" || source.status === "needs_review");
  const blockedSources = vettedSources.filter((source) => source.status === "blocked_secondary" || source.status === "invalid");
  const sourceLines = acceptedSources.length
    ? acceptedSources.map((source, index) => `${index + 1}. ${source.url} (${source.reviewNote})`).join("\n")
    : "No accepted primary sources were supplied.";
  const noteLines = input.sourceNotes.length
    ? input.sourceNotes.map((note, index) => `${index + 1}. ${note}`).join("\n")
    : "No operator notes supplied.";
  const blockedLines = blockedSources.length
    ? blockedSources.map((source) => `- ${source.input}: ${source.reviewNote}`).join("\n")
    : "None.";

  return [
    "You are YCCNewsAgent, an internal editorial agent for authorized Yuzu operators.",
    "Draft original cigar-industry news copy for adult readers of legal tobacco age.",
    "Use facts only from official brand, company, distributor, event, regulator, or wire sources supplied below.",
    "Do not rewrite magazine articles, reviews, or third-party stories. If a third-party story appears, treat it only as a lead and ask for primary verification.",
    "Do not copy source wording beyond short attributed names or product titles. Use a new structure and Yuzu's own editorial voice.",
    "Avoid health, cessation, medical, therapeutic, disease, safety, or underage tobacco claims.",
    "Every factual claim must be tied to a source note. Publication requires human approval.",
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
    "Blocked or invalid sources:",
    blockedLines,
    "",
    "Return JSON with title, dek, category, bodyMarkdown (a complete publication-ready story in markdown), sections[{heading,body}], and sourceNotes[{label,url,note}].",
    "BodyMarkdown should be a full draft article for operator approval; sections should be a readable breakdown of that article.",
  ].join("\n");
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
    parsedSections.length ? parsedSections : splitSections.length ? splitSections : buildFallbackNewsSections(input);

  return {
    title: sanitizeText(parsed?.title, 120) || `${toTitleCase(input.angle)} brief`,
    dek:
      sanitizeText(parsed?.dek || parsed?.summary, 220) ||
      "A human-reviewed Yuzu Cigar Club news draft built from primary source notes.",
    category: sanitizeText(parsed?.category, 80) || "Industry News",
    bodyMarkdown: bodyMarkdown || draftNewsSectionsToMarkdown(sections),
    sections,
    sourceNotes: normalizeNewsSourceNotes(parsed?.sourceNotes, input),
    publishStatus: "draft",
    operatorReviewRequired: true,
    complianceReview: buildNewsComplianceReview(),
  };
}

function normalizeNewsStoryInput(value) {
  const title = sanitizeText(value.title, 160);
  const sourceNotes = normalizeNewsSourceNotes(value.sourceNotes);
  const sections = normalizeNewsSections(value.sections);
  const bodyMarkdown = sanitizeMultilineText(value.bodyMarkdown || draftNewsSectionsToMarkdown(sections), 12000);
  const status = value.publishStatus === "published" || value.status === "published" ? "published" : "draft";

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
  return sections.map((section) => `## ${section.heading}\n${section.body}`).join("\n\n");
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
  const cigarImage = normalizeStoredHumidorCigarImage(metadata.cigarImage);

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

function normalizeHumidorAlertPreferences(value) {
  const raw = value && typeof value === "object" ? value : {};
  const normalized = {
    pushEnabled: Boolean(raw.pushEnabled),
    reorderRemindersEnabled: raw.reorderRemindersEnabled === undefined ? true : Boolean(raw.reorderRemindersEnabled),
    climateAlertsEnabled: Boolean(raw.climateAlertsEnabled),
    pushSubscription: normalizeHumidorPushSubscription(raw.pushSubscription),
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
  };
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

function buildHumidorItemMetadata(actor, item) {
  const metadata = {
    ownerSub: actor.sub,
  };

  if (item.estimatedValue !== null) {
    metadata.estimatedValue = item.estimatedValue;
    metadata.estimatedValueCurrency = item.estimatedValueCurrency || "USD";
    metadata.estimatedValueSource = item.estimatedValueSource || "member_estimate";
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

async function maybeBuildBedrockReply(agent, actor, message, conversationId) {
  const modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL_ID;
  const guardrailsEnabled = process.env.BEDROCK_ENABLE_GUARDRAILS === "1";
  const guardrailId = guardrailsEnabled ? process.env.BEDROCK_GUARDRAIL_ID || null : null;
  const guardrailVersion = guardrailsEnabled ? process.env.BEDROCK_GUARDRAIL_VERSION || null : null;
  const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID || null;

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

  const agentTarget = shouldUseBedrockAgentRuntime(agent) ? resolveBedrockAgentTarget(agent) : null;
  if (agentTarget) {
    try {
      const { BedrockAgentRuntimeClient, InvokeAgentCommand } = require("@aws-sdk/client-bedrock-agent-runtime");
      const client = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
      const agentSessionId = buildBedrockAgentSessionId(actor, conversationId);
      const command = new InvokeAgentCommand({
        agentId: agentTarget.agentId,
        agentAliasId: agentTarget.agentAliasId,
        sessionId: agentSessionId,
        inputText: buildBedrockAgentInputText(message),
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
        return {
          status: "bedrock_agent_runtime",
          modelId,
          agentId: agentTarget.agentId,
          agentAliasId: agentTarget.agentAliasId,
          agentSessionId,
          knowledgeBaseId,
          guardrailId,
          guardrailVersion,
          reply,
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

  const knowledgeBaseRetrieval = await maybeRetrieveKnowledgeBaseContext(knowledgeBaseId, message);

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
      system: [{ text: buildAgentSystemPrompt(agent, actor, knowledgeBaseRetrieval.context) }],
      inferenceConfig: {
        maxTokens: 700,
        temperature: 0.4,
        topP: 0.9,
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
    const reply = extractConverseText(result);

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

async function sendSupportEmail(details) {
  const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");
  const client = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });
  const response = await client.send(
    new SendEmailCommand({
      FromEmailAddress: details.fromAddress,
      Destination: {
        ToAddresses: details.toAddresses,
      },
      ReplyToAddresses: [details.fromAddress],
      Content: {
        Simple: {
          Subject: {
            Data: details.subject,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: details.bodyText,
              Charset: "UTF-8",
            },
          },
        },
      },
    })
  );

  return response.MessageId || `ses_${crypto.randomUUID()}`;
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

function buildBedrockAgentInputText(message) {
  return `Response style: ${CONCIERGE_RESPONSE_STYLE_INSTRUCTION}\n\nMember message: ${message}`;
}

function buildAgentSystemPrompt(agent, actor, retrievedContext = "") {
  const base =
    "You are part of Yuzu Cigar Club. Only answer for adults in an age-restricted tobacco context. " +
    "Do not make health, cessation, medical, or safety claims. Minimize PII, avoid collecting payment data, and hand off sensitive account issues to a human operator. " +
    CONCIERGE_RESPONSE_STYLE_INSTRUCTION;

  const personas = {
    YCCConcierge:
      "You are YCCConcierge, the warm front-door concierge for membership, account, education, events, support triage, and humidor routing.",
    YCCCigarGuide:
      "You are YCCCigarGuide, a cigar education specialist. Discuss vitola, wrapper, binder, filler, origin, strength, tasting notes, storage, and pairings without health claims.",
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

function chooseAgent(message, requestedAgent) {
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

  const normalizedMessage = message.toLowerCase();
  if (HUMIDOR_AGENT_TERMS.some((term) => normalizedMessage.includes(term))) {
    return "YCCHumidorAgent";
  }

  if (CIGAR_GUIDE_TERMS.some((term) => normalizedMessage.includes(term))) {
    return "YCCCigarGuide";
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

  const attachment = normalizeHumidorCigarImageAttachment(value);
  return attachment.value || null;
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

function buildCigarImageIdentificationPrompt(notes) {
  return [
    "Identify the cigar in this image and return only strict JSON. If the exact cigar is visually identifiable, include generally known reference details; if it is not, leave uncertain fields empty and add review notes.",
    "Use this top-level schema exactly: name, brand, line, vitola, wrapper, origin, strength, quantity, purchaseDate, agingStartDate, reorderReminder, humidorLocation, tray, rating, estimatedValue, estimatedValueCurrency, tastingNotes, confidence, evidence, needsReview, details.",
    "details must be an object with this schema exactly: manufacturer, country, region, factory, size, length, ringGauge, shape, wrapper, binder, filler, blend, flavorProfile, body, finish, msrp, releaseStatus, packaging, sourceSummary, imageObservations.",
    "Set estimatedValue to the best per-cigar retail/MSRP number when visible or generally known, otherwise null. Set estimatedValueCurrency to USD unless another currency is explicit.",
    "Set confidence to high, medium, or low. Use null for unknown dates, rating, and estimatedValue. Use empty strings for unknown text fields. Use empty arrays for unknown array fields. Use quantity 1 unless a count is visible.",
    "Evidence, needsReview, details.flavorProfile, and details.imageObservations must be arrays of short strings.",
    "Separate visual evidence from reference knowledge: evidence and imageObservations should describe what is visible; sourceSummary should say which details are inferred from known cigar references.",
    "Explain useful humidor-ready details in tastingNotes, including blend, size, likely flavor profile, aging/storage notes, and any fields the member should confirm. Do not claim certainty when the band or label is unclear.",
    notes ? `Member notes: ${notes}` : "No member notes were provided.",
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

function parseJsonBody(event) {
  if (!event.body) {
    return { value: {} };
  }

  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
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
  const values = Array.isArray(value) ? value : typeof value === "string" && value.trim() ? value.split(",") : [];

  return values
    .map((item) =>
      String(item)
        .trim()
        .replace(/^\[+|\]+$/g, "")
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

function isAdminRoute(routeKey) {
  return ADMIN_ROUTES.has(routeKey);
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

function extractLastPathSegment(event) {
  const pathValue = event.rawPath || event.path || "";
  const lastSegment = String(pathValue).split("/").filter(Boolean).pop();
  return sanitizeText(decodeURIComponent(lastSegment || ""), 180);
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
    "access-control-allow-methods": "GET,POST,OPTIONS",
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

  return [...new Set(origins)];
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
