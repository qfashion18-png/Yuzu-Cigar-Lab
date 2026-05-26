import assert from "node:assert/strict";
import test from "node:test";

import { catalogProducts } from "../src/lib/catalog";
import { calculateCatalogPricing, isCatalogPricingPublishable, resolveVisibleProductPrice } from "../src/lib/catalog-pricing";
import { importedMarketPricesBySku } from "../src/lib/imported-market-prices";

const researchedButanePriceTargets = new Map(
  Object.entries({
    "910": { marketPrice: 74.99, memberPrice: 67.49 },
    "1225": { marketPrice: 10.05, memberPrice: 9.05 },
    "1242": { marketPrice: 43.9, memberPrice: 39.51 },
    "1778": { marketPrice: 8, memberPrice: 7.2 },
    "2832": { marketPrice: 33.52, memberPrice: 30.17 },
    "3583": { marketPrice: 71.7, memberPrice: 64.53 },
    "5366": { marketPrice: 7.99, memberPrice: 7.19 },
    "5396": { marketPrice: 6.99, memberPrice: 6.29 },
    "6800": { marketPrice: 10.99, memberPrice: 9.89 },
    "6801": { marketPrice: 8.99, memberPrice: 8.09 },
    "9001": { marketPrice: 6.95, memberPrice: 6.26 },
    "9248": { marketPrice: 84.9, memberPrice: 76.41 },
    "10027": { marketPrice: 71.99, memberPrice: 64.79 },
    "10411": { marketPrice: 6.29, memberPrice: 5.66 },
    "10413": { marketPrice: 8.39, memberPrice: 7.55 },
    "10832": { marketPrice: 6.99, memberPrice: 6.29 },
    "11738": { marketPrice: 3.39, memberPrice: 3.05 },
    "18094": { marketPrice: 12.99, memberPrice: 11.69 },
    "59093": { marketPrice: 7.99, memberPrice: 7.19 },
    "64078": { marketPrice: 27.49, memberPrice: 24.74 },
    "69673": { marketPrice: 53.88, memberPrice: 48.49 },
    "73438": { marketPrice: 8.17, memberPrice: 7.35 },
    "88201": { marketPrice: 22.59, memberPrice: 20.33 },
    "89163": { marketPrice: 29.99, memberPrice: 26.99 },
  })
);

const researchedLighterPriceTargets = new Map(
  Object.entries({
    "31119": { retailerPrice: 19.95, marketPrice: 10.49, memberPrice: 7.75 },
    "31120": { retailerPrice: 19.95, marketPrice: 13.96, memberPrice: 9.45 },
    "46853": { retailerPrice: 83.99, marketPrice: 58.79, memberPrice: 15.23 },
    "69493": { retailerPrice: 19.95, marketPrice: 13.96, memberPrice: 8.75 },
    "69494": { retailerPrice: 19.95, marketPrice: 11.89, memberPrice: 8 },
    "69496": { retailerPrice: 19.95, marketPrice: 10.5, memberPrice: 9.5 },
    "76078": { retailerPrice: 19.95, marketPrice: 13.96, memberPrice: 11.03 },
    "77086": { retailerPrice: 19.95, marketPrice: 13.96, memberPrice: 9.5 },
    "81274": { retailerPrice: 16.49, marketPrice: 11.54, memberPrice: 8.95 },
    "85318": { retailerPrice: 22.95, marketPrice: 10.49, memberPrice: 8.95 },
    "85319": { retailerPrice: 16.99, marketPrice: 11.89, memberPrice: 7 },
    "85321": { retailerPrice: 21.99, marketPrice: 15.39, memberPrice: 9.97 },
  })
);

function thirtyPercentBelowRetail(retailerPrice: number) {
  return Math.floor(retailerPrice * 70) / 100;
}

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

test("published catalog requires explicit public market pricing instead of member-cost fallback", () => {
  const fallbackPricedProducts = catalogProducts
    .filter((product) => !(product.sku in importedMarketPricesBySku))
    .map((product) => product.sku);

  assert.deepEqual(fallbackPricedProducts, []);
});

test("butane and lighter-fluid member prices are ten percent below researched online retailer prices", () => {
  const publishedFuelProducts = catalogProducts.filter(
    (product) => product.category === "Butane / Fluid" && !/^BOOK MATCHES\b/i.test(product.name)
  );

  assert.equal(
    publishedFuelProducts.length,
    researchedButanePriceTargets.size,
    "every published fuel product should have a researched price target"
  );

  for (const [sku, expectedPricing] of researchedButanePriceTargets) {
    const product = catalogProducts.find((product) => product.sku === sku);
    const expectedMemberPrice = Math.round((expectedPricing.marketPrice * 0.9 + Number.EPSILON) * 100) / 100;

    assert.ok(product, `Expected SKU ${sku} to be published`);
    assert.equal(product.category, "Butane / Fluid", `${sku} category`);
    assert.equal(product.marketPrice, expectedPricing.marketPrice, `${sku} market price`);
    assert.equal(product.nonMemberPrice, expectedPricing.marketPrice, `${sku} public price`);
    assert.equal(expectedPricing.memberPrice, expectedMemberPrice, `${sku} expected member target`);
    assert.equal(product.memberPrice, expectedPricing.memberPrice, `${sku} member price`);
  }
});

test("torch hardware is not listed under butane and lighter-fluid filters", () => {
  const zZeusTorch = catalogProducts.find((product) => product.sku === "41205");
  const hardwareInFuelCategory = catalogProducts.filter(
    (product) => product.category === "Butane / Fluid" && /\bTORCH\b/i.test(product.name)
  );

  assert.ok(zZeusTorch);
  assert.equal(zZeusTorch.category, "Lighters / Torch");
  assert.deepEqual(hardwareInFuelCategory.map((product) => product.sku), []);
});

test("requested lighter public prices beat researched retailer prices by at least thirty percent", () => {
  for (const [sku, expectedPricing] of researchedLighterPriceTargets) {
    const product = catalogProducts.find((candidate) => candidate.sku === sku);
    const maxThirtyPercentDiscountPrice = thirtyPercentBelowRetail(expectedPricing.retailerPrice);

    assert.ok(product, `Expected SKU ${sku} to be published`);
    assert.equal(product.category, "Lighters / Torch", `${sku} category`);
    assert.equal(product.marketPrice, expectedPricing.marketPrice, `${sku} market price`);
    assert.equal(product.nonMemberPrice, expectedPricing.marketPrice, `${sku} public price`);
    assert.equal(product.memberPrice, expectedPricing.memberPrice, `${sku} member price`);
    assert.ok(
      product.nonMemberPrice <= maxThirtyPercentDiscountPrice,
      `${sku} public price should be no higher than ${maxThirtyPercentDiscountPrice}`
    );
  }
});
