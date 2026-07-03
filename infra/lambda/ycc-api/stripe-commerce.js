"use strict";

const DEFAULT_STRIPE_API_VERSION = "2026-02-25.clover";

const handledStripeEventActions = {
  "checkout.session.completed": "record_checkout_completion",
  "checkout.session.async_payment_succeeded": "record_checkout_completion",
  "checkout.session.async_payment_failed": "record_payment_failure",
  "invoice.paid": "record_subscription_payment",
  "invoice.payment_failed": "record_subscription_payment_failure",
  "customer.subscription.created": "record_subscription_update",
  "customer.subscription.updated": "record_subscription_update",
  "customer.subscription.deleted": "record_subscription_cancellation",
  "charge.refunded": "record_refund",
};

function createStripeClient(env = process.env) {
  if (!env.STRIPE_SECRET_KEY) {
    const error = new Error("STRIPE_SECRET_KEY is not configured.");
    error.code = "stripe_not_configured";
    throw error;
  }

  const Stripe = require("stripe");
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: env.STRIPE_API_VERSION || DEFAULT_STRIPE_API_VERSION,
  });
}

function buildCheckoutSessionParams(input = {}, env = process.env) {
  const siteUrl = getSiteUrl(env);
  const items = Array.isArray(input.items) ? input.items : [];
  const compliance = input.compliance || {};
  const shipping = input.shipping || {};
  const shippingAddress = shipping.address && typeof shipping.address === "object" ? shipping.address : {};
  const shippingCountry = normalizeCountryCode(shippingAddress.country || "US");
  const statusToken = toMetadataString(input.statusToken, 120);
  const shippingOptions = buildCheckoutShippingOptions(shipping, input.currency || "usd");

  return {
    mode: "payment",
    customer_email: input.customer?.email,
    customer_creation: "always",
    phone_number_collection: { enabled: true },
    shipping_address_collection: {
      allowed_countries: [shippingCountry],
    },
    line_items: items.map((item) => ({
      price: item.stripePriceId,
      quantity: item.quantity,
    })),
    ...(shippingOptions.length > 0 ? { shipping_options: shippingOptions } : {}),
    automatic_tax: { enabled: true },
    allow_promotion_codes: true,
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&status_token=${encodeURIComponent(statusToken)}`,
    cancel_url: `${siteUrl}/checkout/cancel`,
    metadata: {
      order_kind: "product",
      cart_id: input.cartId || "",
      age_verification_id: compliance.ageVerificationId || "",
      compliance_policy_version: compliance.policyVersion || "",
      shipping_method_id: shipping.methodId || "",
      shipping_carrier: toMetadataString(shipping.carrier || "USPS", 20),
      shipping_amount_cents: String(toNonNegativeInteger(shipping.amountCents)),
      shipping_delivery_amount_cents: String(toNonNegativeInteger(shipping.deliveryAmountCents)),
      shipping_handling_fee_cents: String(toNonNegativeInteger(shipping.handlingFeeCents)),
      adult_signature_required: shipping.adultSignatureRequired === false ? "false" : "true",
      order_id: input.orderId || "",
      shipping_name: toMetadataString(input.customer?.fullName, 120),
      shipping_address1: toMetadataString(shippingAddress.address1, 120),
      shipping_address2: toMetadataString(shippingAddress.address2, 120),
      shipping_city: toMetadataString(shippingAddress.city, 120),
      shipping_state: toMetadataString(shippingAddress.state, 40),
      shipping_postal_code: toMetadataString(shippingAddress.postalCode, 40),
      shipping_country: shippingCountry,
      checkout_status_token: statusToken,
    },
  };
}

function buildCheckoutShippingOptions(shipping = {}, currency = "usd") {
  const amount = toNonNegativeInteger(shipping.amountCents);
  if (amount <= 0) {
    return [];
  }

  const deliveryTitle = toMetadataString(shipping.title || shipping.methodTitle || shipping.methodId || "Shipping", 80) || "Shipping";
  const handlingFeeCents = toNonNegativeInteger(shipping.handlingFeeCents);
  const displayName = handlingFeeCents > 0 ? `${deliveryTitle} + non-member handling` : deliveryTitle;

  return [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: toMetadataString(displayName, 100),
        fixed_amount: {
          amount,
          currency: normalizeCurrencyCode(currency),
        },
      },
    },
  ];
}

function buildMembershipSessionParams(input = {}, env = process.env) {
  const siteUrl = getSiteUrl(env);
  const tierKey = input.tierKey || "";
  const billingPeriod = input.billingPeriod || "monthly";
  const statusToken = toMetadataString(input.statusToken, 120);
  const customerEmail = toMetadataString(input.customer?.email, 160);
  const membershipOffer = normalizeMembershipOffer(input.membershipOffer);
  const metadata = {
    order_kind: "membership",
    tier_key: tierKey,
    billing_period: billingPeriod,
    customer_email: customerEmail,
    checkout_status_token: statusToken,
    ...buildMembershipOfferMetadata(membershipOffer),
  };
  const subscriptionData = {
    metadata,
  };

  if (membershipOffer?.trialPeriodDays) {
    subscriptionData.trial_period_days = membershipOffer.trialPeriodDays;
  }

  return {
    mode: "subscription",
    customer_email: customerEmail,
    line_items: [{ price: input.stripePriceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&status_token=${encodeURIComponent(statusToken)}`,
    cancel_url: `${siteUrl}/checkout/cancel`,
    metadata,
    subscription_data: subscriptionData,
  };
}

function normalizeMembershipOffer(offer = {}) {
  if (!offer || typeof offer !== "object") {
    return null;
  }

  const trialPeriodDays = Math.min(toNonNegativeInteger(offer.trialPeriodDays), 365);
  const normalized = {
    code: toMetadataString(offer.code || offer.offerCode, 80),
    source: toMetadataString(offer.source, 80),
    campaign: toMetadataString(offer.campaign, 80),
    landingPath: toMetadataString(offer.landingPath || offer.landing_path, 120),
    access: toMetadataString(offer.access, 80),
    trialPeriodDays,
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function buildMembershipOfferMetadata(offer) {
  if (!offer) {
    return {};
  }

  return {
    membership_offer_code: offer.code,
    membership_offer_source: offer.source,
    membership_offer_campaign: offer.campaign,
    membership_offer_landing_path: offer.landingPath,
    membership_offer_access: offer.access,
    membership_offer_trial_days: offer.trialPeriodDays ? String(offer.trialPeriodDays) : "",
  };
}

function buildFriendsFamilyCustomerParams(input = {}) {
  const customerEmail = toMetadataString(input.customer?.email, 160).toLowerCase();
  const customerName = toMetadataString(input.customer?.fullName || input.customer?.name, 160);
  const membershipOffer = normalizeMembershipOffer(input.membershipOffer);
  const expiresAt = toMetadataString(input.expiresAt, 120);

  return {
    email: customerEmail,
    ...(customerName ? { name: customerName } : {}),
    metadata: {
      order_kind: "membership",
      membership_path: "friends_family_box_pass",
      tier_key: "box_access_pass",
      member_status: "active",
      customer_email: customerEmail,
      friends_family_expires_at: expiresAt,
      ...buildMembershipOfferMetadata(membershipOffer),
    },
  };
}

function buildCognitoSignupCustomerParams(input = {}) {
  const customerEmail = toMetadataString(input.customer?.email, 160).toLowerCase();
  const customerName = toMetadataString(input.customer?.fullName || input.customer?.name, 160);
  const cognitoSub = toMetadataString(input.cognitoSub, 160);
  const tierKey = toMetadataString(input.membershipTier || input.tierKey, 80);
  const memberStatus = toMetadataString(input.memberStatus, 80) || "non_member";

  return {
    email: customerEmail,
    ...(customerName ? { name: customerName } : {}),
    metadata: {
      customer_source: "cognito_post_confirmation",
      cognito_sub: cognitoSub,
      customer_email: customerEmail,
      tier_key: tierKey,
      member_status: memberStatus,
    },
  };
}

function buildCustomerPortalSessionParams(input = {}, env = process.env) {
  const siteUrl = getSiteUrl(env);
  const params = {
    customer: input.stripeCustomerId,
    return_url: `${siteUrl}/account`,
  };

  if (env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID) {
    params.configuration = env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID;
  }

  return params;
}

function verifyStripeWebhook(input = {}) {
  const { stripe, rawBody, signature, webhookSecret } = input;

  if (!signature) {
    const error = new Error("Missing Stripe-Signature header.");
    error.code = "missing_stripe_signature";
    throw error;
  }

  if (!webhookSecret) {
    const error = new Error("STRIPE_WEBHOOK_SECRET is not configured.");
    error.code = "stripe_webhook_not_configured";
    throw error;
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

function shouldProcessStripeEvent(event, processedEventIds) {
  return Boolean(event?.id) && !processedEventIds.has(event.id);
}

function getHandledStripeEventAction(eventType) {
  return handledStripeEventActions[eventType] || "ignore";
}

async function createCommerceCheckoutSession(stripe, input, env = process.env) {
  return stripe.checkout.sessions.create(buildCheckoutSessionParams(input, env));
}

async function createMembershipCheckoutSession(stripe, input, env = process.env) {
  return stripe.checkout.sessions.create(buildMembershipSessionParams(input, env));
}

async function createFriendsFamilyCustomer(stripe, input, requestOptions = {}) {
  return stripe.customers.create(buildFriendsFamilyCustomerParams(input), requestOptions);
}

async function createCognitoSignupCustomer(stripe, input, requestOptions = {}) {
  return stripe.customers.create(buildCognitoSignupCustomerParams(input), requestOptions);
}

async function createCustomerPortalSession(stripe, input, env = process.env) {
  return stripe.billingPortal.sessions.create(buildCustomerPortalSessionParams(input, env));
}

function mapCheckoutSessionStatus(session = {}) {
  const metadata = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
  const paymentStatus = String(session.payment_status || "processing");
  const checkoutStatus = String(session.status || "");
  const orderId = metadata.order_id || metadata.orderId || null;
  const orderRecorded = Boolean(orderId);

  return {
    id: session.id || null,
    paymentStatus,
    fulfillmentStatus:
      metadata.fulfillment_status ||
      metadata.fulfillmentStatus ||
      (orderRecorded ? "pending" : paymentStatus === "paid" ? "awaiting_order_record" : "awaiting_payment"),
    orderRecorded,
    orderId,
    message:
      orderRecorded
        ? "Stripe payment is confirmed. Fulfillment will continue through the webhook-backed order pipeline."
        : paymentStatus === "paid"
          ? "Stripe payment is confirmed. Yuzu is recording the order and fulfillment details now."
        : checkoutStatus === "expired"
          ? "Checkout expired before payment was completed."
          : "Checkout is still processing. Stripe payment confirmation or webhook-backed fulfillment has not completed yet.",
  };
}

function getSiteUrl(env) {
  return (env.PUBLIC_SITE_URL || env.NEXT_PUBLIC_BASE_URL || env.BASE_URL || "https://www.yuzucigarclub.com").replace(/\/$/, "");
}

function toMetadataString(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeCountryCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "US";
}

function normalizeCurrencyCode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z]{3}$/.test(normalized) ? normalized : "usd";
}

function toNonNegativeInteger(value) {
  const integer = Math.round(Number(value));
  return Number.isFinite(integer) && integer > 0 ? integer : 0;
}

module.exports = {
  DEFAULT_STRIPE_API_VERSION,
  buildCognitoSignupCustomerParams,
  buildCheckoutSessionParams,
  buildCustomerPortalSessionParams,
  buildFriendsFamilyCustomerParams,
  buildMembershipSessionParams,
  createCognitoSignupCustomer,
  createCommerceCheckoutSession,
  createCustomerPortalSession,
  createFriendsFamilyCustomer,
  createMembershipCheckoutSession,
  createStripeClient,
  getHandledStripeEventAction,
  mapCheckoutSessionStatus,
  shouldProcessStripeEvent,
  verifyStripeWebhook,
};
