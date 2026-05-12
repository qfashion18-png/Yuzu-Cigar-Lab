import assert from "node:assert/strict";
import test from "node:test";

import {
  addCartItem,
  applyPromotionCode,
  calculateCartTotals,
  checkoutPaymentMethods,
  createEmptyShoppingCart,
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

test("checkout exposes only payment methods backed by Stripe Checkout", () => {
  assert.deepEqual(
    checkoutPaymentMethods.map((method) => method.id),
    ["stripe-checkout"]
  );
  assert.ok(checkoutPaymentMethods.every((method) => method.stripeMode === "checkout"));
});
