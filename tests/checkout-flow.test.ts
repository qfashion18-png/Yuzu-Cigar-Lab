import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  adultSignatureRequiredStates,
  addCartItem,
  checkoutPaymentMethods,
  createEmptyShoppingCart,
  defaultDeliveryMethods,
} from "../src/lib/shopping-cart";

const checkoutClientPath = new URL("../src/lib/stripe-checkout.ts", import.meta.url);
const checkoutExperiencePath = new URL("../src/components/checkout-experience.tsx", import.meta.url);
const successPagePath = new URL("../src/app/checkout/success/page.tsx", import.meta.url);
const cancelPagePath = new URL("../src/app/checkout/cancel/page.tsx", import.meta.url);

async function loadCheckoutClient() {
  assert.equal(existsSync(checkoutClientPath), true, "frontend Stripe checkout client should exist");
  return import("../src/lib/stripe-checkout");
}

const cart = addCartItem(
  createEmptyShoppingCart(1000),
  {
    productId: "sku-approved",
    variantId: "sku-approved-catalog-item",
    slug: "approved-box",
    name: "Approved Box",
    sku: "APPROVED-BOX",
    image: "/assets/product.png",
    imagePosition: "center",
    packageLabel: "Box of 20",
    category: "Premium Cigars ($150-$300)",
    unitPrice: 120,
    maxQuantity: 5,
  },
  2,
  1001
);

test("checkout session request sends cart identifiers, price snapshots, customer contact, shipping, and compliance reference", async () => {
  const { buildCheckoutSessionRequest } = await loadCheckoutClient();
  const request = buildCheckoutSessionRequest({
    cart,
    customer: { email: "member@example.com", phone: "4805551212", fullName: "Member One" },
    shippingAddress: {
      address1: "111 W Boston St",
      address2: "",
      city: "Chandler",
      state: "AZ",
      postalCode: "85225",
      country: "US",
    },
    shippingMethodId: "usps-adult-signature-ground",
    complianceToken: "age_txn_123",
    deliveryPrice: 18,
    taxRate: 0.066,
  });

  assert.deepEqual(request.items, [{ sku: "APPROVED-BOX", quantity: 2, unitPrice: 120 }]);
  assert.equal(request.customer.email, "member@example.com");
  assert.equal(request.shippingAddress.country, "US");
  assert.equal(request.shippingMethodId, "usps-adult-signature-ground");
  assert.equal(request.compliance.ageVerificationToken, "age_txn_123");
  assert.equal(request.quote.subtotal, 240);
  assert.equal((request.quote as { shipping?: number }).shipping, 18);
  assert.equal((request.quote as { handling?: number }).handling, 10);
  assert.equal((request.quote as { tax?: number }).tax, 15.84);
  assert.equal((request.quote as { total?: number }).total, 283.84);
  assert.equal(request.quote.currency, "USD");
  assert.equal(JSON.stringify(request).includes("paymentMethodId"), false);
  assert.equal(JSON.stringify(request).includes("card"), false);
});

test("member checkout request carries the membership entitlement and waives the handling fee", async () => {
  const { buildCheckoutSessionRequest } = await loadCheckoutClient();
  const request = buildCheckoutSessionRequest({
    cart,
    customer: { email: "member@example.com", phone: "4805551212", fullName: "Member One" },
    isMember: true,
    membershipEntitlementToken: "yccmem1.payload.signature",
    shippingAddress: {
      address1: "111 W Boston St",
      address2: "",
      city: "Chandler",
      state: "AZ",
      postalCode: "85225",
      country: "US",
    },
    shippingMethodId: "usps-adult-signature-ground",
    complianceToken: "age_txn_123",
    deliveryPrice: 18,
    taxRate: 0.066,
  });

  assert.equal(request.membership?.entitlementToken, "yccmem1.payload.signature");
  assert.equal((request.quote as { shipping?: number }).shipping, 18);
  assert.equal((request.quote as { handling?: number }).handling, 0);
  assert.equal((request.quote as { tax?: number }).tax, 15.84);
  assert.equal((request.quote as { total?: number }).total, 273.84);
});

test("checkout client posts to the configured commerce API and returns the hosted Stripe URL", async () => {
  const { createCheckoutSession } = await loadCheckoutClient();
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const session = await createCheckoutSession({
      cart,
      customer: { email: "member@example.com", fullName: "Member One" },
      shippingAddress: {
        address1: "111 W Boston St",
        city: "Chandler",
        state: "AZ",
        postalCode: "85225",
        country: "US",
      },
      shippingMethodId: "usps-adult-signature-ground",
      complianceToken: "age_txn_123",
    });

    assert.equal(session.url, "https://checkout.stripe.com/c/pay/cs_test_123");
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/commerce/checkout-session");
    assert.equal(calls[0].init?.method, "POST");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("member-only checkout sends a server-minted membership entitlement", async () => {
  const { buildCheckoutSessionRequest, getCommerceMembership } = await loadCheckoutClient();
  const memberOnlyCart = addCartItem(
    createEmptyShoppingCart(2000),
    {
      productId: "sku-member",
      variantId: "sku-member-catalog-item",
      slug: "member-box",
      name: "Member Box",
      sku: "MEMBER-BOX",
      image: "/assets/product.png",
      imagePosition: "center",
      packageLabel: "Box of 20",
      category: "Premium Cigars ($150-$300)",
      unitPrice: 140,
      maxQuantity: 5,
      memberOnly: true,
    },
    1,
    2001
  );
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ membershipEntitlementToken: "yccmem1.payload.signature" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const membership = await getCommerceMembership({ Authorization: "Bearer id-token" });
    const entitlementToken = membership.membershipEntitlementToken;
    assert.equal(entitlementToken, "yccmem1.payload.signature");
    const request = buildCheckoutSessionRequest({
      cart: memberOnlyCart,
      customer: { email: "member@example.com", fullName: "Member One" },
      shippingAddress: {
        address1: "111 W Boston St",
        city: "Chandler",
        state: "AZ",
        postalCode: "85225",
        country: "US",
      },
      shippingMethodId: "usps-adult-signature-ground",
      complianceToken: "age_txn_123",
      isMember: true,
      membershipEntitlementToken: entitlementToken,
    });

    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/commerce/membership");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer id-token");
    assert.equal(request.membership?.entitlementToken, "yccmem1.payload.signature");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("member-only checkout fails closed when no server membership entitlement is present", async () => {
  const { buildCheckoutSessionRequest } = await loadCheckoutClient();
  const memberOnlyCart = addCartItem(
    createEmptyShoppingCart(3000),
    {
      productId: "sku-member",
      variantId: "sku-member-catalog-item",
      slug: "member-box",
      name: "Member Box",
      sku: "MEMBER-BOX",
      image: "/assets/product.png",
      imagePosition: "center",
      packageLabel: "Box of 20",
      category: "Premium Cigars ($150-$300)",
      unitPrice: 140,
      maxQuantity: 5,
      memberOnly: true,
    },
    1,
    3001
  );

  assert.throws(
    () =>
      buildCheckoutSessionRequest({
        cart: memberOnlyCart,
        customer: { email: "member@example.com", fullName: "Member One" },
        shippingAddress: {
          address1: "111 W Boston St",
          city: "Chandler",
          state: "AZ",
          postalCode: "85225",
          country: "US",
        },
        shippingMethodId: "usps-adult-signature-ground",
        complianceToken: "age_txn_123",
        isMember: true,
      }),
    /server membership entitlement/i
  );
});

test("checkout client exchanges an AgeChecker verification UUID for a signed checkout token", async () => {
  const { createCheckoutAgeVerificationToken } = await import("../src/lib/age-verification");
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ageVerificationToken: "yccav1.payload123.signature1234567" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await createCheckoutAgeVerificationToken({
      vendorTransactionId: "12345678901234567890123456789012",
      customer: {
        email: "member@example.com",
        phone: "4805551212",
        fullName: "Member One",
      },
      shippingAddress: {
        address1: "123 Yuzu Way",
        city: "Chandler",
        state: "AZ",
        postalCode: "85225",
        country: "US",
      },
    });

    assert.equal(result.ageVerificationToken, "yccav1.payload123.signature1234567");
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/commerce/age-verification-token");
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      vendorTransactionId: "12345678901234567890123456789012",
      customer: {
        email: "member@example.com",
        phone: "4805551212",
        fullName: "Member One",
      },
      shippingAddress: {
        address1: "123 Yuzu Way",
        address2: "",
        city: "Chandler",
        state: "AZ",
        postalCode: "85225",
        country: "US",
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});

test("checkout UI routes to Stripe-hosted checkout and success clears only after backend confirmation", () => {
  assert.equal(existsSync(successPagePath), true, "checkout success page should exist");
  assert.equal(existsSync(cancelPagePath), true, "checkout cancel page should exist");
  const checkoutSource = readFileSync(checkoutExperiencePath, "utf8");
  const successSource = readFileSync(successPagePath, "utf8");
  const cancelSource = readFileSync(cancelPagePath, "utf8");

  assert.ok(checkoutSource.includes("createCheckoutSession"), "checkout form should call the commerce API client");
  assert.ok(checkoutSource.includes("AgeCheckerVerification"), "checkout form should render the AgeChecker.Net checkout verifier");
  assert.ok(checkoutSource.includes("useBackupAuth"), "checkout form should read the signed-in account session");
  assert.ok(checkoutSource.includes("shippingAddress"), "checkout form should prefill from the saved account shipping address");
  assert.ok(checkoutSource.includes("checkoutPaymentMethods"), "checkout form should render only payment methods it can submit");
  assert.ok(checkoutSource.includes("defaultDeliveryMethods"), "checkout form should render configured delivery methods");
  assert.ok(checkoutSource.includes("getDeliveryMethodsForState"), "checkout form should filter delivery methods by destination state");
  assert.ok(checkoutSource.includes("Non-member shipping/handling"), "checkout should disclose the non-member handling fee in the order summary");
  assert.deepEqual(
    defaultDeliveryMethods.map((method) => [method.id, method.carrier, method.adultSignatureRequired]),
    [
      ["usps-ground-advantage", "USPS", false],
      ["usps-priority-mail", "USPS", false],
      ["usps-adult-signature-ground", "USPS", true],
      ["usps-adult-signature-priority", "USPS", true],
    ]
  );
  assert.deepEqual([...adultSignatureRequiredStates], ["AR", "CA", "DE", "FL", "GA", "MA", "MN", "ND", "RI", "SC", "WY"]);
  assert.equal(checkoutSource.includes("defaultPaymentMethods.map"), false, "checkout form should not offer invoice methods without a backend branch");
  assert.equal(checkoutPaymentMethods.some((method) => method.id === "concierge-invoice"), false);
  assert.ok(checkoutSource.includes("Continue to secure checkout"), "CTA should make Stripe redirect clear");
  assert.equal(checkoutSource.includes("checkout_identity_verification_required"), false, "checkout must not submit a fake age verification token");
  assert.ok(checkoutSource.includes("readCheckoutAgeVerificationToken"), "checkout should submit only a stored provider age verification token");
  assert.match(
    readFileSync(new URL("../src/components/agechecker-verification.tsx", import.meta.url), "utf8"),
    /cdn\.agechecker\.net\/static\/popup\/v1\/popup\.js/,
    "checkout verifier should load the AgeChecker.Net popup on the checkout route only"
  );
  assert.ok(successSource.includes("getCheckoutSessionStatus(sessionId, statusToken)"), "success polling must include the backend status token");
  assert.equal(checkoutSource.includes("createOrder({"), false, "production checkout must not create local orders");
  assert.ok(successSource.includes("getCheckoutSessionStatus"), "success page should ask backend for session/order state");
  assert.ok(successSource.includes("status_token"), "success page should read the backend status token from the Stripe redirect URL");
  assert.ok(successSource.includes("clearCart"), "success page should clear cart after backend confirmation");
  assert.ok(successSource.includes("shouldClearCartAfterCheckoutStatus"), "cart clearing should also prevent duplicate paid checkouts while order recording syncs");
  assert.ok(cancelSource.includes("/checkout"), "cancel page should return shoppers to checkout");
});

test("paid checkout status clears the local cart even while order recording syncs", async () => {
  const { shouldClearCartAfterCheckoutStatus } = await loadCheckoutClient();

  assert.equal(
    shouldClearCartAfterCheckoutStatus({
      id: "cs_test_paid_pending",
      paymentStatus: "paid",
      fulfillmentStatus: "awaiting_order_record",
      orderRecorded: false,
      orderId: null,
    }),
    true
  );
  assert.equal(
    shouldClearCartAfterCheckoutStatus({
      id: "cs_test_unpaid",
      paymentStatus: "unpaid",
      fulfillmentStatus: "not_started",
      orderRecorded: false,
      orderId: null,
    }),
    false
  );
});

test("commerce errors are mapped to shopper-friendly checkout messages", async () => {
  const { getCheckoutErrorMessage } = await loadCheckoutClient();

  assert.match(getCheckoutErrorMessage({ error: "age_verification_required" }), /verify your age/i);
  assert.match(getCheckoutErrorMessage({ error: "restricted_destination" }), /cannot ship/i);
  assert.match(getCheckoutErrorMessage({ error: "insufficient_inventory" }), /stock/i);
  assert.match(getCheckoutErrorMessage({ error: "price_snapshot_required" }), /refresh/i);
  assert.match(getCheckoutErrorMessage({ error: "stale_price" }), /price/i);
  assert.match(getCheckoutErrorMessage({ error: "checkout_status_forbidden" }), /session/i);
  assert.match(getCheckoutErrorMessage({ error: "payment_failed" }), /payment/i);
});

test("age gate stores only provider-issued checkout age verification tokens", async () => {
  const { normalizeCheckoutAgeVerificationToken } = await import("../src/lib/age-verification");
  const ageGateSource = readFileSync(new URL("../src/components/age-gate.tsx", import.meta.url), "utf8");

  assert.equal(normalizeCheckoutAgeVerificationToken(JSON.stringify({ type: "checkout_age_verification" })), "");
  assert.equal(normalizeCheckoutAgeVerificationToken("age_txn_12345678"), "age_txn_12345678");
  assert.equal(
    normalizeCheckoutAgeVerificationToken("yccav1.payload123.signature1234567"),
    "yccav1.payload123.signature1234567"
  );
  assert.equal(ageGateSource.includes("createCheckoutAgeVerificationToken"), false);
  assert.ok(ageGateSource.includes("clearCheckoutAgeVerificationToken"), "age gate should clear stale checkout tokens after browser-only confirmation");
});
