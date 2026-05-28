import assert from "node:assert/strict";
import test from "node:test";

import { getStorefrontProductBySlug } from "../src/lib/catalog";
import { resolveVisibleProductPrice } from "../src/lib/catalog-pricing";
import { repriceCartForAccount } from "../src/lib/cart-price-reconciliation";
import {
  addCartItem,
  applyPromotionCode,
  calculateCartTotals,
  checkoutPaymentMethods,
  createEmptyShoppingCart,
  defaultDeliveryCarrier,
  defaultDeliveryMethods,
  adultSignatureRequiredStates,
  removeCartItem,
  updateCartItemQuantity,
} from "../src/lib/shopping-cart";

const acidItem = {
  productId: "sku-39919-acid-20-twenty-year-24-bx",
  variantId: "sku-39919-acid-20-twenty-year-24-bx-catalog-item",
  slug: "acid-20-twenty-year-24-bx",
  name: "ACID 20 TWENTY YEAR 24/BX",
  sku: "39919",
  image: "https://swwest.com/Images/SunsetItems/39919/0.jpg",
  imagePosition: "center",
  packageLabel: "Box of 24",
  category: "Cigars",
  unitPrice: 220,
  maxQuantity: 8,
};

const lighterItem = {
  productId: "sku-777-special-blue",
  variantId: "sku-777-special-blue-catalog-item",
  slug: "special-blue",
  name: "SPECIAL BLUE TORCH",
  sku: "777",
  image: "/assets/gift-box.png",
  imagePosition: "center",
  packageLabel: "Catalog item",
  category: "Accessories",
  unitPrice: 24,
  maxQuantity: 20,
};

test("adds catalog items to cart and merges repeat variants", () => {
  const emptyCart = createEmptyShoppingCart();
  const firstCart = addCartItem(emptyCart, acidItem, 1);
  const mergedCart = addCartItem(firstCart, acidItem, 2);

  assert.equal(mergedCart.items.length, 1);
  assert.equal(mergedCart.items[0].quantity, 3);
  assert.equal(mergedCart.items[0].lineId, "line-sku-39919-acid-20-twenty-year-24-bx-catalog-item");
  assert.equal(mergedCart.updatedAt > emptyCart.updatedAt, true);
});

test("updates and removes cart line items without mutating the previous cart", () => {
  const cart = addCartItem(createEmptyShoppingCart(), acidItem, 1);
  const updated = updateCartItemQuantity(cart, cart.items[0].lineId, 4);
  const removed = removeCartItem(updated, updated.items[0].lineId);

  assert.equal(cart.items[0].quantity, 1);
  assert.equal(updated.items[0].quantity, 4);
  assert.equal(removed.items.length, 0);
});

test("calculates checkout totals with delivery, tax, and member promotion on eligible non-box products", () => {
  const cart = applyPromotionCode(
    addCartItem(addCartItem(createEmptyShoppingCart(), acidItem, 2), lighterItem, 1),
    "SENSEI5"
  );
  const totals = calculateCartTotals(cart, {
    deliveryPrice: 18,
    taxRate: 0.066,
  });

  assert.equal(totals.itemCount, 3);
  assert.equal(totals.subtotal, 464);
  assert.equal(totals.discount, 1.2);
  assert.equal(totals.shipping, 18);
  assert.equal(totals.tax, 30.54);
  assert.equal(totals.total, 511.34);
});

test("adds a shipping and handling fee to non-member checkout totals", () => {
  const cart = addCartItem(createEmptyShoppingCart(), lighterItem, 1);
  const nonMemberTotals = calculateCartTotals(cart, {
    deliveryPrice: 9,
    isMember: false,
    taxRate: 0.066,
  });
  const memberTotals = calculateCartTotals(cart, {
    deliveryPrice: 9,
    isMember: true,
    taxRate: 0.066,
  });

  assert.equal((nonMemberTotals as { handling?: number }).handling, 10);
  assert.equal(nonMemberTotals.shipping, 9);
  assert.equal(nonMemberTotals.total, 44.58);
  assert.equal((memberTotals as { handling?: number }).handling, 0);
  assert.equal(memberTotals.shipping, 9);
  assert.equal(memberTotals.total, 34.58);
});

test("checkout exposes only payment methods backed by Stripe Checkout", () => {
  assert.deepEqual(
    checkoutPaymentMethods.map((method) => method.id),
    ["stripe-checkout"]
  );
  assert.ok(checkoutPaymentMethods.every((method) => method.stripeMode === "checkout"));
});

test("default delivery methods include USPS non-signature and adult-signature service", () => {
  assert.equal(defaultDeliveryCarrier, "USPS");
  assert.deepEqual(
    defaultDeliveryMethods.map((method) => [method.id, method.carrier, method.adultSignatureRequired]),
    [
      ["usps-ground-advantage", "USPS", false],
      ["usps-priority-mail", "USPS", false],
      ["usps-adult-signature-ground", "USPS", true],
      ["usps-adult-signature-priority", "USPS", true],
    ],
  );
  assert.deepEqual([...adultSignatureRequiredStates], ["AR", "CA", "DE", "FL", "GA", "MA", "MN", "ND", "RI", "SC", "WY"]);
});

test("reprices stored cart lines when member authentication changes", () => {
  const product = getStorefrontProductBySlug("acid-20-twenty-year-24-bx");

  assert.ok(product);

  const publicPrice = resolveVisibleProductPrice(product, false);
  const memberPrice = resolveVisibleProductPrice(product, true);

  assert.notEqual(publicPrice, memberPrice);

  const cart = addCartItem(
    createEmptyShoppingCart(4000),
    {
      productId: product.id,
      variantId: `${product.id}-catalog-item`,
      slug: product.slug,
      name: product.name,
      sku: product.sku ?? product.id,
      image: product.image,
      imagePosition: product.imagePosition,
      packageLabel: product.packageLabel,
      category: product.category ?? product.tags[0] ?? "Catalog",
      unitPrice: publicPrice,
      maxQuantity: 12,
      memberOnly: product.memberOnly,
    },
    2,
    4001
  );

  const repricedForMember = repriceCartForAccount(cart, true, 4002);

  assert.equal(cart.items[0].unitPrice, publicPrice);
  assert.equal(repricedForMember.items[0].unitPrice, memberPrice);
  assert.equal(repricedForMember.updatedAt, 4002);
  assert.strictEqual(repriceCartForAccount(repricedForMember, true, 4003), repricedForMember);

  const repricedForPublic = repriceCartForAccount(repricedForMember, false, 4004);

  assert.equal(repricedForPublic.items[0].unitPrice, publicPrice);
  assert.equal(repricedForPublic.updatedAt, 4004);
});
