import assert from "node:assert/strict";
import test from "node:test";

import { catalogProducts } from "../src/lib/catalog";
import { calculateCatalogPricing, isCatalogPricingPublishable, resolveVisibleProductPrice } from "../src/lib/catalog-pricing";

test("non-member catalog pricing follows public market price while member pricing stays at member cost", () => {
  assert.deepEqual(
    calculateCatalogPricing({
      currentPrice: 186,
      marketPrice: 197.23,
    }),
    {
      marketPrice: 197.23,
      nonMemberPrice: 197.23,
      memberPrice: 186,
    }
  );

  assert.deepEqual(
    calculateCatalogPricing({
      currentPrice: 28,
      marketPrice: 34.43,
    }),
    {
      marketPrice: 34.43,
      nonMemberPrice: 34.43,
      memberPrice: 28,
    }
  );
});

test("catalog pricing rejects boxes when outside public pricing would undercut member cost", () => {
  assert.equal(isCatalogPricingPublishable({ currentPrice: 100, marketPrice: 95 }), false);
  assert.equal(isCatalogPricingPublishable({ currentPrice: 100, marketPrice: 100 }), true);
  assert.equal(isCatalogPricingPublishable({ currentPrice: 100, marketPrice: 125 }), true);
});

test("visible product price switches between non-member and member pricing", () => {
  const product = {
    price: 186,
    nonMemberPrice: 197.23,
    memberPrice: 186,
  };

  assert.equal(resolveVisibleProductPrice(product, false), 197.23);
  assert.equal(resolveVisibleProductPrice(product, true), 186);
});

test("catalog products expose market, non-member, and lower member prices", () => {
  const acidTwenty = catalogProducts.find((product) => product.sku === "39919");
  const jcNewmanSampler = catalogProducts.find((product) => product.sku === "11279");

  assert.ok(acidTwenty);
  assert.equal(acidTwenty.marketPrice, 197.23);
  assert.equal(acidTwenty.nonMemberPrice, 197.23);
  assert.equal(acidTwenty.memberPrice, 186);

  assert.ok(jcNewmanSampler);
  assert.equal(jcNewmanSampler.marketPrice, 34.43);
  assert.equal(jcNewmanSampler.nonMemberPrice, 34.43);
  assert.equal(jcNewmanSampler.memberPrice, 28);
});

test("published catalog never shows non-member pricing below member cost", () => {
  const invertedProducts = catalogProducts
    .filter((product) => product.nonMemberPrice < product.memberPrice)
    .map((product) => product.sku);

  assert.deepEqual(invertedProducts, []);
});
