import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const stripeCommercePath = new URL("../infra/lambda/ycc-api/stripe-commerce.js", import.meta.url);

function loadStripeCommerce() {
  assert.equal(existsSync(stripeCommercePath), true, "stripe commerce module should exist");
  return require("../infra/lambda/ycc-api/stripe-commerce.js") as {
    buildCheckoutSessionParams: (input: Record<string, unknown>, env?: Record<string, string>) => Record<string, unknown>;
    buildMembershipSessionParams: (input: Record<string, unknown>, env?: Record<string, string>) => Record<string, unknown>;
    buildCustomerPortalSessionParams: (input: Record<string, unknown>, env?: Record<string, string>) => Record<string, unknown>;
    mapCheckoutSessionStatus: (session: Record<string, unknown>) => Record<string, unknown>;
    verifyStripeWebhook: (input: Record<string, unknown>) => unknown;
    shouldProcessStripeEvent: (event: { id: string }, processedEventIds: Set<string>) => boolean;
    getHandledStripeEventAction: (eventType: string) => string;
  };
}

const env = {
  PUBLIC_SITE_URL: "https://www.yuzucigarclub.com",
  YCC_API_BASE_URL: "https://api.yuzucigarclub.com",
  STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID: "bpc_test_123",
};
const fakeWebhookSecret = ["whsec", "test"].join("_");

test("Stripe product checkout sessions use hosted Checkout with server-computed line items", () => {
  const { buildCheckoutSessionParams } = loadStripeCommerce();
  const params = buildCheckoutSessionParams(
    {
      cartId: "cart_123",
      customer: { email: "member@example.com" },
      items: [
        {
          sku: "APPROVED-BOX",
          productSlug: "approved-box",
          name: "Approved Box",
          quantity: 2,
          unitAmountCents: 12000,
          stripePriceId: "price_approved",
        },
      ],
      shipping: {
        methodId: "usps-adult-signature-ground",
        title: "USPS Adult Signature Ground",
        carrier: "USPS",
        adultSignatureRequired: true,
        deliveryAmountCents: 1800,
        handlingFeeCents: 1000,
        amountCents: 2800,
        address: {
          address1: "123 Yuzu Way",
          address2: "Suite 5",
          city: "Chandler",
          state: "AZ",
          postalCode: "85225",
          country: "US",
        },
      },
      compliance: { ageVerificationId: "age_txn_123", policyVersion: "2026-05-07" },
      statusToken: "chkst_unit_test_123456789012345678901234567890",
    },
    env
  );

  assert.equal(params.mode, "payment");
  assert.equal(params.customer_email, "member@example.com");
  assert.equal(params.customer_creation, "always");
  assert.deepEqual(params.phone_number_collection, { enabled: true });
  assert.deepEqual(params.shipping_address_collection, { allowed_countries: ["US"] });
  assert.deepEqual(params.line_items, [{ price: "price_approved", quantity: 2 }]);
  assert.deepEqual(params.shipping_options, [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        display_name: "USPS Adult Signature Ground + non-member handling",
        fixed_amount: {
          amount: 2800,
          currency: "usd",
        },
      },
    },
  ]);
  assert.deepEqual(params.automatic_tax, { enabled: true });
  assert.match(String(params.success_url), /\/checkout\/success\?session_id=\{CHECKOUT_SESSION_ID\}&status_token=chkst_unit_test_/);
  assert.match(String(params.cancel_url), /\/checkout\/cancel/);
  assert.deepEqual(params.metadata, {
    order_kind: "product",
    cart_id: "cart_123",
    age_verification_id: "age_txn_123",
    compliance_policy_version: "2026-05-07",
    shipping_method_id: "usps-adult-signature-ground",
    shipping_carrier: "USPS",
    shipping_amount_cents: "2800",
    shipping_delivery_amount_cents: "1800",
    shipping_handling_fee_cents: "1000",
    adult_signature_required: "true",
    order_id: "",
    shipping_name: "",
    shipping_address1: "123 Yuzu Way",
    shipping_address2: "Suite 5",
    shipping_city: "Chandler",
    shipping_state: "AZ",
    shipping_postal_code: "85225",
    shipping_country: "US",
    checkout_status_token: "chkst_unit_test_123456789012345678901234567890",
  });
});

test("Stripe membership checkout sessions use subscription mode and recurring price IDs", () => {
  const { buildMembershipSessionParams } = loadStripeCommerce();
  const params = buildMembershipSessionParams(
    {
      tierKey: "sensei",
      billingPeriod: "monthly",
      stripePriceId: "price_sensei_monthly",
      statusToken: "chkst_member_test_123456789012345678901234567890",
      customer: { email: "member@example.com" },
    },
    env
  );

  assert.equal(params.mode, "subscription");
  assert.equal(params.customer_email, "member@example.com");
  assert.deepEqual(params.line_items, [{ price: "price_sensei_monthly", quantity: 1 }]);
  assert.equal((params.metadata as Record<string, string>).order_kind, "membership");
  assert.equal((params.metadata as Record<string, string>).customer_email, "member@example.com");
  assert.equal((params.metadata as Record<string, string>).checkout_status_token, "chkst_member_test_123456789012345678901234567890");
  assert.match(String(params.success_url), /status_token=chkst_member_test_/);
  assert.equal((params.subscription_data as { metadata: Record<string, string> }).metadata.tier_key, "sensei");
  assert.equal((params.subscription_data as { metadata: Record<string, string> }).metadata.customer_email, "member@example.com");
});

test("Stripe membership checkout sessions preserve friends and family yearly pass metadata", () => {
  const { buildMembershipSessionParams } = loadStripeCommerce();
  const params = buildMembershipSessionParams(
    {
      tierKey: "box-access-pass",
      billingPeriod: "yearly",
      stripePriceId: "price_box_access_yearly",
      statusToken: "chkst_member_test_123456789012345678901234567890",
      customer: { email: "friend@example.com" },
      membershipOffer: {
        code: "friends-family-box-pass",
        source: "friends-family-page",
        campaign: "friends-family-1-year-box-pass",
        landingPath: "/friends-family",
        access: "box_access_pass_1_year",
        trialPeriodDays: 365,
      },
    },
    env
  ) as {
    metadata: Record<string, string>;
    subscription_data: { metadata: Record<string, string>; trial_period_days?: number };
  };

  assert.equal(params.subscription_data.trial_period_days, 365);
  assert.equal(params.metadata.membership_offer_code, "friends-family-box-pass");
  assert.equal(params.metadata.membership_offer_source, "friends-family-page");
  assert.equal(params.metadata.membership_offer_access, "box_access_pass_1_year");
  assert.equal(params.metadata.membership_offer_trial_days, "365");
  assert.equal(params.subscription_data.metadata.membership_offer_campaign, "friends-family-1-year-box-pass");
});

test("Stripe customer portal sessions keep subscription management inside Stripe", () => {
  const { buildCustomerPortalSessionParams } = loadStripeCommerce();
  const params = buildCustomerPortalSessionParams({ stripeCustomerId: "cus_123" }, env);

  assert.equal(params.customer, "cus_123");
  assert.equal(params.configuration, "bpc_test_123");
  assert.match(String(params.return_url), /\/account/);
});

test("Stripe checkout session status maps paid sessions to recorded orders", () => {
  const { mapCheckoutSessionStatus } = loadStripeCommerce();
  const status = mapCheckoutSessionStatus({
    id: "cs_test_paid",
    payment_status: "paid",
    status: "complete",
    metadata: {
      order_id: "order_123",
    },
  });

  assert.equal(status.id, "cs_test_paid");
  assert.equal(status.paymentStatus, "paid");
  assert.equal(status.fulfillmentStatus, "pending");
  assert.equal(status.orderRecorded, true);
  assert.equal(status.orderId, "order_123");
});

test("Stripe checkout session status waits for backend order recording when payment is paid without an order id", () => {
  const { mapCheckoutSessionStatus } = loadStripeCommerce();
  const status = mapCheckoutSessionStatus({
    id: "cs_test_paid_pending_order",
    payment_status: "paid",
    status: "complete",
    metadata: {},
  });

  assert.equal(status.id, "cs_test_paid_pending_order");
  assert.equal(status.paymentStatus, "paid");
  assert.equal(status.fulfillmentStatus, "awaiting_order_record");
  assert.equal(status.orderRecorded, false);
  assert.equal(status.orderId, null);
});

test("Stripe webhook verification delegates to Stripe SDK and event ledger blocks duplicates", () => {
  const { shouldProcessStripeEvent, verifyStripeWebhook, getHandledStripeEventAction } = loadStripeCommerce();
  const fakeStripe = {
    webhooks: {
      constructEvent(rawBody: string, signature: string, secret: string) {
        assert.equal(rawBody, "{\"id\":\"evt_123\"}");
        assert.equal(signature, "t=123,v1=sig");
        assert.equal(secret, fakeWebhookSecret);
        return { id: "evt_123", type: "checkout.session.completed" };
      },
    },
  };

  assert.deepEqual(
    verifyStripeWebhook({
      stripe: fakeStripe,
      rawBody: "{\"id\":\"evt_123\"}",
      signature: "t=123,v1=sig",
      webhookSecret: fakeWebhookSecret,
    }),
    { id: "evt_123", type: "checkout.session.completed" }
  );
  assert.equal(shouldProcessStripeEvent({ id: "evt_123" }, new Set(["evt_123"])), false);
  assert.equal(shouldProcessStripeEvent({ id: "evt_124" }, new Set(["evt_123"])), true);
  assert.equal(getHandledStripeEventAction("charge.refunded"), "record_refund");
});
