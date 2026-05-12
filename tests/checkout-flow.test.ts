import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createEmptyShoppingCart, addCartItem, checkoutPaymentMethods } from "../src/lib/shopping-cart";

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

test("checkout session request sends only cart identifiers, customer contact, shipping, and compliance reference", async () => {
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
    shippingMethodId: "adult-signature-ground",
    complianceToken: "age_txn_123",
  });

  assert.deepEqual(request.items, [{ sku: "APPROVED-BOX", quantity: 2 }]);
  assert.equal(request.customer.email, "member@example.com");
  assert.equal(request.shippingAddress.country, "US");
  assert.equal(request.compliance.ageVerificationToken, "age_txn_123");
  assert.equal(JSON.stringify(request).includes("unitPrice"), false);
  assert.equal(JSON.stringify(request).includes("paymentMethodId"), false);
  assert.equal(JSON.stringify(request).includes("card"), false);
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
      shippingMethodId: "adult-signature-ground",
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

test("checkout UI routes to Stripe-hosted checkout and success clears only after backend confirmation", () => {
  assert.equal(existsSync(successPagePath), true, "checkout success page should exist");
  assert.equal(existsSync(cancelPagePath), true, "checkout cancel page should exist");
  const checkoutSource = readFileSync(checkoutExperiencePath, "utf8");
  const successSource = readFileSync(successPagePath, "utf8");
  const cancelSource = readFileSync(cancelPagePath, "utf8");

  assert.ok(checkoutSource.includes("createCheckoutSession"), "checkout form should call the commerce API client");
  assert.ok(checkoutSource.includes("useBackupAuth"), "checkout form should read the signed-in account session");
  assert.ok(checkoutSource.includes("shippingAddress"), "checkout form should prefill from the saved account shipping address");
  assert.ok(checkoutSource.includes("checkoutPaymentMethods"), "checkout form should render only payment methods it can submit");
  assert.equal(checkoutSource.includes("defaultPaymentMethods.map"), false, "checkout form should not offer invoice methods without a backend branch");
  assert.equal(checkoutPaymentMethods.some((method) => method.id === "concierge-invoice"), false);
  assert.ok(checkoutSource.includes("Continue to secure checkout"), "CTA should make Stripe redirect clear");
  assert.equal(checkoutSource.includes("checkout_identity_verification_required"), false, "checkout must not submit a fake age verification token");
  assert.ok(checkoutSource.includes("readCheckoutAgeVerificationToken"), "checkout should submit only a stored provider age verification token");
  assert.equal(checkoutSource.includes("createOrder({"), false, "production checkout must not create local orders");
  assert.ok(successSource.includes("getCheckoutSessionStatus"), "success page should ask backend for session/order state");
  assert.ok(successSource.includes("clearCart"), "success page should clear cart after backend confirmation");
  assert.ok(successSource.includes("orderRecorded"), "cart clearing should wait for backend order recording");
  assert.ok(cancelSource.includes("/checkout"), "cancel page should return shoppers to checkout");
});

test("commerce errors are mapped to shopper-friendly checkout messages", async () => {
  const { getCheckoutErrorMessage } = await loadCheckoutClient();

  assert.match(getCheckoutErrorMessage({ error: "age_verification_required" }), /verify your age/i);
  assert.match(getCheckoutErrorMessage({ error: "restricted_destination" }), /cannot ship/i);
  assert.match(getCheckoutErrorMessage({ error: "insufficient_inventory" }), /stock/i);
  assert.match(getCheckoutErrorMessage({ error: "stale_price" }), /price/i);
  assert.match(getCheckoutErrorMessage({ error: "payment_failed" }), /payment/i);
});
