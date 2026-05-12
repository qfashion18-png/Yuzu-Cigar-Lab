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
      normalizedItems: Array<{ sku: string; quantity: number; unitAmountCents: number }>;
    };
    adultSignatureShippingMethodIds: Set<string>;
    restrictedDestinationStates: Set<string>;
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
];

const readyCheckout = {
  items: [{ sku: "APPROVED-BOX", quantity: 2, unitPrice: 120 }],
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
  shippingMethodId: "adult-signature-ground",
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
});

test("checkout compliance rejects unknown, draft, stale-price, and over-quantity cart lines", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    items: [
      { sku: "UNKNOWN", quantity: 1, unitPrice: 25 },
      { sku: "DRAFT-BOX", quantity: 1, unitPrice: 99 },
      { sku: "APPROVED-BOX", quantity: 1, unitPrice: 119 },
      { sku: "APPROVED-BOX", quantity: 8, unitPrice: 120 },
    ],
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["unknown_sku", "unpublished_sku", "stale_price", "insufficient_inventory"]
  );
});

test("checkout compliance blocks unverified age, restricted destinations, missing adult signature, and unavailable tax", () => {
  const { validateCheckoutReadiness } = loadRules();
  const result = validateCheckoutReadiness({
    ...readyCheckout,
    ageVerification: { status: "pending" },
    destination: { country: "US", state: "UT", postalCode: "84101" },
    shippingMethodId: "standard-ground",
    tax: { status: "unavailable" },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["age_verification_required", "restricted_destination", "adult_signature_required", "tax_provider_unavailable"]
  );
  assert.deepEqual(result.holdReasons, [
    "age_verification_required",
    "restricted_destination",
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
