import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const rulesPath = new URL("../infra/lambda/ycc-api/commerce-rules.js", import.meta.url);

function loadRules() {
  assert.equal(existsSync(rulesPath), true, "commerce rules module should exist");
  return require("../infra/lambda/ycc-api/commerce-rules.js") as {
    validateCheckoutReadiness: (input: unknown) => {
      ok: boolean;
      errors: Array<{ code: string; message: string }>;
      holdReasons: string[];
      normalizedItems: Array<{ sku: string; quantity: number; unitAmountCents: number; stripePriceId: string | null }>;
      shipping: {
        methodId: string;
        submittedMethodId: string;
        carrier: string;
        adultSignatureRequired: boolean;
        adultSignatureRequiredState: boolean;
      };
    };
    adultSignatureRequiredStates: Set<string>;
    adultSignatureShippingMethodIds: Set<string>;
    requiredShippingCarrier: string;
    restrictedDestinationStates: Set<string>;
    requiresAdultSignatureDelivery: (items: Array<{ adultSignatureRequired?: boolean }>, destination: { state?: string }) => boolean;
  };
}

const launchCatalog = [
  {
    sku: "APPROVED-BOX",
    slug: "approved-box",
    name: "Approved Box",
    price: 120,
    publishStatus: "published",
    inventoryPolicy: "track",
    sourceQuantity: 5,
    shippable: true,
    adultSignatureRequired: true,
    stripeProductId: "prod_approved",
    stripePriceId: "price_approved",
  },
  {
    sku: "DUAL-PRICE",
    slug: "dual-price",
    name: "Dual Price Box",
    price: 150,
    publicPrice: 150,
    memberPrice: 120,
    publishStatus: "published",
    inventoryPolicy: "track",
    sourceQuantity: 5,
    shippable: true,
    adultSignatureRequired: true,
    stripeProductId: "prod_dual_price",
    stripePriceId: " price_dual_public ",
    memberStripePriceId: " price_dual_member ",
  },
  {
    sku: "DRAFT-BOX",
    slug: "draft-box",
    name: "Draft Box",
    price: 99,
    publishStatus: "draft",
    inventoryPolicy: "track",
    sourceQuantity: 5,
    shippable: true,
    adultSignatureRequired: true,
    stripeProductId: "prod_draft",
    stripePriceId: "price_draft",
  },
  {
    sku: "MEMBER-BOX",
    slug: "member-box",
    name: "Member Box",
    price: 140,
    publishStatus: "published",
    inventoryPolicy: "track",
    sourceQuantity: 5,
    shippable: true,
    memberOnly: true,
    adultSignatureRequired: true,
    stripeProductId: "prod_member",
    stripePriceId: "price_member",
  },
];

const readyCheckout = {
  items: [{ sku: "APPROVED-BOX", quantity: 2, unitPrice: 120 }],
  quote: {
    subtotal: 240,
    currency: "USD",
  },
  catalog: launchCatalog,
  ageVerification: {
    status: "verified",
    verifiedAt: "2026-05-07T12:00:00.000Z",
    vendorTransactionId: "age_txn_123",
  },
  destination: {
    country: "US",
    state: "AZ",
    postalCode: "85225",
  },
  shippingMethodId: "usps-adult-signature-ground",
  tax: {
    status: "ready",
    provider: "stripe_tax",
  },
};

test("checkout compliance accepts verified adults with publishable stock and adult signature shipping", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness(readyCheckout);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.holdReasons, []);
  assert.equal(result.normalizedItems[0].sku, "APPROVED-BOX");
  assert.equal(result.normalizedItems[0].quantity, 2);
  assert.equal(result.normalizedItems[0].unitAmountCents, 12000);
  assert.deepEqual(result.shipping, {
    methodId: "usps-adult-signature-ground",
    submittedMethodId: "usps-adult-signature-ground",
    title: "USPS Adult Signature Ground",
    carrier: "USPS",
    adultSignatureRequired: true,
    adultSignatureRequiredState: false,
    deliveryAmountCents: 1800,
    handlingFeeCents: 1000,
    amountCents: 2800,
  });
});

test("checkout compliance accepts AgeChecker-verified non-required states with USPS non-signature methods", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    catalog: launchCatalog.map((product) =>
      product.sku === "APPROVED-BOX" ? { ...product, adultSignatureRequired: false } : product
    ),
    destination: {
      country: "US",
      state: "AZ",
      postalCode: "85225",
    },
    shippingMethodId: "usps-ground-advantage",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    {
      methodId: result.shipping.methodId,
      submittedMethodId: result.shipping.submittedMethodId,
      carrier: result.shipping.carrier,
      adultSignatureRequired: result.shipping.adultSignatureRequired,
      adultSignatureRequiredState: result.shipping.adultSignatureRequiredState,
    },
    {
      methodId: "usps-ground-advantage",
      submittedMethodId: "usps-ground-advantage",
      carrier: "USPS",
      adultSignatureRequired: false,
      adultSignatureRequiredState: false,
    }
  );
  assert.deepEqual(
    result.shipping as typeof result.shipping & {
      title?: string;
      deliveryAmountCents?: number;
      handlingFeeCents?: number;
      amountCents?: number;
    },
    {
      methodId: "usps-ground-advantage",
      submittedMethodId: "usps-ground-advantage",
      title: "USPS Ground Advantage",
      carrier: "USPS",
      adultSignatureRequired: false,
      adultSignatureRequiredState: false,
      deliveryAmountCents: 900,
      handlingFeeCents: 1000,
      amountCents: 1900,
    }
  );
});

test("checkout compliance waives the shipping and handling fee for trusted members", () => {
  const { validateCheckoutReadiness } = loadRules();
  const guestResult = validateCheckoutReadiness({
    ...readyCheckout,
    catalog: launchCatalog.map((product) =>
      product.sku === "APPROVED-BOX" ? { ...product, adultSignatureRequired: false } : product
    ),
    shippingMethodId: "usps-ground-advantage",
    quote: {
      subtotal: 240,
      handling: 10,
      currency: "USD",
    },
  });
  const memberResult = validateCheckoutReadiness({
    ...readyCheckout,
    catalog: launchCatalog.map((product) =>
      product.sku === "APPROVED-BOX" ? { ...product, adultSignatureRequired: false } : product
    ),
    shippingMethodId: "usps-ground-advantage",
    quote: {
      subtotal: 240,
      handling: 0,
      currency: "USD",
    },
    membership: {
      status: "member",
      trusted: true,
      tiers: ["sensei"],
    },
  });

  assert.equal(guestResult.ok, true);
  assert.equal((guestResult.shipping as typeof guestResult.shipping & { handlingFeeCents?: number }).handlingFeeCents, 1000);
  assert.equal(memberResult.ok, true);
  assert.equal((memberResult.shipping as typeof memberResult.shipping & { handlingFeeCents?: number }).handlingFeeCents, 0);
});

test("checkout compliance uses the public catalog price and normalized public Stripe price id for guests", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    items: [{ sku: "DUAL-PRICE", quantity: 2, unitPrice: 150 }],
    quote: {
      subtotal: 300,
      handling: 10,
      currency: "USD",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.normalizedItems[0].unitAmountCents, 15000);
  assert.equal(result.normalizedItems[0].stripePriceId, "price_dual_public");

  const memberPriceAttempt = validateCheckoutReadiness({
    ...readyCheckout,
    items: [{ sku: "DUAL-PRICE", quantity: 1, unitPrice: 120 }],
    quote: undefined,
  });
  assert.equal(memberPriceAttempt.errors.some((error) => error.code === "stale_price"), true);
});

test("checkout compliance uses the member catalog price and normalized member Stripe price id for trusted members", () => {
  const { validateCheckoutReadiness } = loadRules();
  const membership = {
    status: "member",
    trusted: true,
    tiers: ["sensei"],
  };
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    items: [{ sku: "DUAL-PRICE", quantity: 2, unitPrice: 120 }],
    quote: {
      subtotal: 240,
      handling: 0,
      currency: "USD",
    },
    membership,
  });

  assert.equal(result.ok, true);
  assert.equal(result.normalizedItems[0].unitAmountCents, 12000);
  assert.equal(result.normalizedItems[0].stripePriceId, "price_dual_member");

  const publicPriceAttempt = validateCheckoutReadiness({
    ...readyCheckout,
    items: [{ sku: "DUAL-PRICE", quantity: 1, unitPrice: 150 }],
    quote: undefined,
    membership,
  });
  assert.equal(publicPriceAttempt.errors.some((error) => error.code === "stale_price"), true);
});

test("checkout compliance rejects a non-member quote that omits the handling fee", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    shippingMethodId: "usps-ground-advantage",
    quote: {
      subtotal: 240,
      handling: 0,
      currency: "USD",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "quote_mismatch"), true);
});

test("checkout compliance uses USPS adult-signature states and rejects UPS methods", () => {
  const {
    adultSignatureRequiredStates,
    adultSignatureShippingMethodIds,
    requiredShippingCarrier,
    requiresAdultSignatureDelivery,
    validateCheckoutReadiness,
  } = loadRules();

  assert.equal(requiredShippingCarrier, "USPS");
  assert.deepEqual([...adultSignatureRequiredStates], ["AR", "CA", "DE", "FL", "GA", "MA", "MN", "ND", "RI", "SC", "WY"]);
  assert.equal(adultSignatureShippingMethodIds.has("usps-adult-signature-ground"), true);
  assert.equal(adultSignatureShippingMethodIds.has("ups-adult-signature-ground"), false);
  assert.equal(requiresAdultSignatureDelivery([{ adultSignatureRequired: false }], { state: "CA" }), true);
  assert.equal(requiresAdultSignatureDelivery([{ adultSignatureRequired: false }], { state: "AZ" }), false);
  assert.equal(requiresAdultSignatureDelivery([{ adultSignatureRequired: true }], { state: "AZ" }), true);

  const result = validateCheckoutReadiness({
    ...readyCheckout,
    shippingMethodId: "ups-adult-signature-ground",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "shipping_method_unavailable"), true);
  assert.equal(result.holdReasons.includes("shipping_method_unavailable"), true);
});

test("checkout compliance still requires adult-signature USPS methods in required states", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    destination: {
      country: "US",
      state: "CA",
      postalCode: "90210",
    },
    shippingMethodId: "usps-ground-advantage",
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "adult_signature_required"), true);
  assert.equal(result.errors.some((error) => error.code === "shipping_method_unavailable"), false);
  assert.equal(result.holdReasons.includes("adult_signature_required"), true);
});

test("checkout compliance rejects unknown, draft, stale-price, and over-quantity cart lines", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    quote: undefined,
    items: [
      { sku: "UNKNOWN", quantity: 1, unitPrice: 25 },
      { sku: "DRAFT-BOX", quantity: 1, unitPrice: 99 },
      { sku: "APPROVED-BOX", quantity: 1 },
      { sku: "APPROVED-BOX", quantity: 1, unitPrice: 119 },
      { sku: "APPROVED-BOX", quantity: 8, unitPrice: 120 },
    ],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["unknown_sku", "unpublished_sku", "price_snapshot_required", "stale_price", "insufficient_inventory"]
  );
});

test("checkout compliance blocks member-only catalog lines without trusted entitlement", () => {
  const { validateCheckoutReadiness } = loadRules();
  const blocked = validateCheckoutReadiness({
    ...readyCheckout,
    quote: { subtotal: 140, currency: "USD" },
    items: [{ sku: "MEMBER-BOX", quantity: 1, unitPrice: 140 }],
  });
  const allowed = validateCheckoutReadiness({
    ...readyCheckout,
    quote: { subtotal: 140, currency: "USD" },
    items: [{ sku: "MEMBER-BOX", quantity: 1, unitPrice: 140 }],
    membership: {
      status: "member",
      trusted: true,
      tiers: ["sensei"],
    },
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.errors.some((error) => error.code === "membership_required"), true);
  assert.equal(allowed.ok, true);
});

test("checkout compliance rejects quote subtotal drift", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    quote: {
      subtotal: 239,
      currency: "USD",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "quote_mismatch"), true);
});

test("checkout compliance blocks unverified age, restricted destinations, missing adult signature, and unavailable tax", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    ageVerification: { status: "pending" },
    destination: { country: "US", state: "AR", postalCode: "72201" },
    shippingMethodId: "standard-ground",
    tax: { status: "unavailable" },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    [
      "age_verification_required",
      "restricted_destination",
      "shipping_method_unavailable",
      "adult_signature_required",
      "tax_provider_unavailable",
    ]
  );
  assert.deepEqual(result.holdReasons, [
    "age_verification_required",
    "restricted_destination",
    "shipping_method_unavailable",
    "adult_signature_required",
    "tax_provider_unavailable",
  ]);
});

test("checkout compliance rejects static placeholder age verification tokens", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    ageVerification: {
      status: "verified",
      vendorTransactionId: "checkout_identity_verification_required",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.code === "age_verification_required"), true);
  assert.equal(result.holdReasons.includes("age_verification_required"), true);
});
