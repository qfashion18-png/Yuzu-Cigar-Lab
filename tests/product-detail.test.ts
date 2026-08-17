import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  catalogProducts,
  featuredLuxuryProducts,
  getCatalogImageUrl,
  getCatalogProductDetails,
  isCigarCatalogProduct,
  getStorefrontProductBySlug,
  luxuryCatalogProducts,
  publishedImportedInventory,
  storefrontProducts,
} from "../src/lib/catalog";
import { toMedusaProduct } from "../src/lib/commerce/medusa";
import { importedMarketPricesBySku } from "../src/lib/imported-market-prices";
import { importedProductDescriptions } from "../src/lib/imported-product-descriptions";
import { buildProductPageCopy } from "../src/lib/product-page-content";

const requestedSwwestLighterSkus = [
  "85318",
  "85321",
  "76078",
  "46853",
  "81274",
  "69496",
  "85319",
  "69493",
  "69494",
  "77086",
  "31120",
  "31119",
];

const requestedCigarRestockSkus = [
  "777146",
  "777147",
  "777148",
  "777149",
  "572590",
  "113887",
  "113886",
  "572685",
  "572686",
  "572409",
  "572410",
  "572356",
  "MISSING-SKU-NICA-RUSTICA-GORDO",
  "777199",
  "MISSING-SKU-UNDERCROWN-SHADE-GORDITO",
  "572493",
  "572429",
  "MISSING-SKU-UNDERCROWN-MADURO-TORO",
  "572749",
  "572753",
  "777229",
  "572305",
  "777230",
  "777242",
  "777243",
  "777141",
  "572744",
  "572745",
];

const pricedRequestedCigarRestockSkus = [
  "777146",
  "777147",
  "777148",
  "777149",
  "572590",
  "113887",
  "113886",
  "572685",
  "572686",
  "572409",
  "572410",
  "572356",
  "777199",
  "572493",
  "572429",
  "572749",
  "572753",
  "777229",
  "572305",
  "777230",
  "777242",
  "777243",
  "777141",
  "572744",
  "572745",
];

const pricePendingRequestedCigarRestockSkus = requestedCigarRestockSkus.filter(
  (sku) => !pricedRequestedCigarRestockSkus.includes(sku)
);

const pricePendingSwwestCigarSkus = [
  "29177",
  "67529",
  "67530",
  "67531",
  "777275",
  "777276",
  "777277",
  "777278",
  "777279",
  "777280",
  "777281",
];

const requestedNewCigarCatalogItems = [
  {
    sku: "777293",
    slug: "my-father-don-pepin-clasicos-20th-20-bx",
    memberPrice: 300,
    nonMemberPrice: 396,
    image: "/assets/inventory/cigars/my-father-don-pepin-clasicos-20th-20-bx.jpg",
    vitola: "Toro Extra",
    length: '6.5"',
    gauge: "52",
  },
  {
    sku: "777292",
    slug: "oliva-serie-v-melanio-soccer-edition-24-bx",
    memberPrice: 450,
    nonMemberPrice: 612,
    image: "/assets/inventory/cigars/oliva-serie-v-melanio-soccer-edition-24-bx.jpg",
    vitola: "Double Toro",
    length: '6"',
    gauge: "60",
  },
  {
    sku: "777297",
    slug: "olmec-maduro-toro-12-bx",
    memberPrice: 133,
    nonMemberPrice: 174.99,
    image: "/assets/inventory/cigars/olmec-maduro-toro-12-bx.jpg",
    vitola: "Toro",
    length: '6"',
    gauge: "52",
  },
  {
    sku: "777296",
    slug: "montecristo-1935-winners-club-sampler-6-pk",
    memberPrice: 90,
    nonMemberPrice: 121.5,
    image: "/assets/inventory/cigars/montecristo-1935-winners-club-sampler-6-pk.jpg",
    vitola: "Sampler",
    length: "Assorted",
    gauge: "Assorted",
  },
  {
    sku: "777303",
    slug: "plasencia-alma-fuerte-salomon-10-bx",
    memberPrice: 160,
    nonMemberPrice: 247.99,
    image: "/assets/inventory/cigars/plasencia-alma-fuerte-salomon-10-bx.jpg",
    vitola: "Salomon",
    length: '7"',
    gauge: "58",
  },
  {
    sku: "777287",
    slug: "plasencia-explorer-sampler-6-bx",
    memberPrice: 75,
    nonMemberPrice: 107.95,
    image: "/assets/inventory/cigars/plasencia-explorer-sampler-6-bx.jpg",
    vitola: "Sampler",
    length: "Assorted",
    gauge: "Assorted",
  },
  {
    sku: "777295",
    slug: "plasencia-triunfal-2026-10-bx",
    memberPrice: 400,
    nonMemberPrice: 539.91,
    image: "/assets/inventory/cigars/plasencia-triunfal-2026-10-bx.jpg",
    vitola: "Toro",
    length: '6.25"',
    gauge: "54",
  },
];

const requestedTabernacleCigarItems = [
  {
    sku: "777298",
    slug: "the-tabernacle-broadleaf-robusto-24-bx",
    memberPrice: 240,
    nonMemberPrice: 300.95,
    image: "/assets/inventory/cigars/the-tabernacle-broadleaf-robusto-24-bx.png",
    vitola: "Robusto",
    length: '5"',
    gauge: "50",
    wrapper: "CT Broadleaf",
    strength: "Full",
  },
  {
    sku: "777299",
    slug: "the-tabernacle-broadleaf-toro-24-bx",
    memberPrice: 250,
    nonMemberPrice: 324.95,
    image: "/assets/inventory/cigars/the-tabernacle-broadleaf-toro-24-bx.png",
    vitola: "Toro",
    length: '6"',
    gauge: "52",
    wrapper: "CT Broadleaf",
    strength: "Full",
  },
  {
    sku: "777300",
    slug: "the-tabernacle-ct-142-robusto-24-bx",
    memberPrice: 240,
    nonMemberPrice: 300.95,
    image: "/assets/inventory/cigars/the-tabernacle-ct-142-robusto-24-bx.png",
    vitola: "Robusto",
    length: '5"',
    gauge: "50",
    wrapper: "Havana Seed CT No. 142",
    strength: "Medium",
  },
  {
    sku: "777301",
    slug: "the-tabernacle-ct-142-toro-24-bx",
    memberPrice: 250,
    nonMemberPrice: 324.95,
    image: "/assets/inventory/cigars/the-tabernacle-ct-142-toro-24-bx.png",
    vitola: "Toro",
    length: '6"',
    gauge: "52",
    wrapper: "Havana Seed CT No. 142",
    strength: "Medium",
  },
];

const removedInventorySlug = "cohiba-riviera-box-press-toro-20-bx";
const removedInventorySku = "572603";

function readJpegSize(assetPath: string) {
  const buffer = readFileSync(new URL(`../public${assetPath}`, import.meta.url));

  assert.equal(buffer[0], 0xff, `${assetPath} should be a JPEG`);
  assert.equal(buffer[1], 0xd8, `${assetPath} should be a JPEG`);

  let offset = 2;
  const startOfFrameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset);

    if (startOfFrameMarkers.has(marker)) {
      return {
        bytes: buffer.length,
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += segmentLength;
  }

  throw new Error(`${assetPath} is missing JPEG dimensions`);
}

function readPngSize(assetPath: string) {
  const buffer = readFileSync(new URL(`../public${assetPath}`, import.meta.url));

  assert.deepEqual(
    [...buffer.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${assetPath} should be a PNG`
  );

  return {
    bytes: buffer.length,
    colorType: buffer[25],
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

test("featured luxury products expose unique static detail slugs", () => {
  const slugs = featuredLuxuryProducts.map((product) => product.slug);

  assert.equal(luxuryCatalogProducts.length, 21);
  assert.equal(slugs.length, 4);
  assert.equal(new Set(slugs).size, featuredLuxuryProducts.length);
  assert.equal(featuredLuxuryProducts.every((product) => product.category === "Luxury Cigars ($300+)"), true);
  assert.equal(featuredLuxuryProducts[0].slug, "ashton-churchill-25-bx");

  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
});

test("static storefront detail registry covers featured luxury product cards", () => {
  const storefrontSlugs = storefrontProducts.map((product) => product.slug);

  assert.equal(new Set(storefrontSlugs).size, storefrontSlugs.length);

  for (const product of featuredLuxuryProducts) {
    const routeProduct = getStorefrontProductBySlug(product.slug);

    assert.ok(routeProduct, `${product.slug} should resolve to a static storefront route`);
    assert.equal(routeProduct.storeHref, `/shop/${product.slug}/`);
  }
});

test("featured luxury products include detail-page merchandising content", () => {
  const ashton = featuredLuxuryProducts[0];
  const details = getCatalogProductDetails(ashton);

  assert.match(details.summary, /Ashton Churchill/i);
  assert.ok(details.signals.includes("Luxury Cigars ($300+)"));
  assert.ok(details.signals.includes("Box of 25"));
  assert.ok(details.signals.includes("$314.84 public catalog price"));
});

test("featured luxury detail metadata includes sourced cigar size and blend fields", () => {
  const ashton = featuredLuxuryProducts[0];

  assert.equal(ashton.length, '7.5"');
  assert.equal(ashton.gauge, "52");
  assert.equal(ashton.strength, "Mild");
  assert.equal(ashton.filler, "Dominican Republic");
  assert.equal(ashton.binder, "Dominican Republic");
});

test("featured luxury products include complete size, strength, and blend details", () => {
  const bySlug = new Map(featuredLuxuryProducts.map((product) => [product.slug, product]));

  assert.deepEqual(
    [
      bySlug.get("ashton-churchill-25-bx"),
      bySlug.get("montecristo-churchill-25-bx"),
      bySlug.get("oliva-serie-v-melanio-soccer-edition-24-bx"),
      bySlug.get("my-father-don-pepin-clasicos-20th-20-bx"),
    ].map((product) => [product?.length, product?.gauge, product?.strength, product?.wrapper, product?.filler, product?.binder]),
    [
      ['7.5"', "52", "Mild", "Connecticut Shade", "Dominican Republic", "Dominican Republic"],
      ['7"', "54", "Mild", "Connecticut Shade", "Dominican Republic", "Dominican Republic"],
      ['6"', "60", "Medium-Full", "Ecuadorian Sumatra, Mexican San Andres Maduro", "Nicaragua", "Nicaragua"],
      ['6.5"', "52", "Full", "Nicaraguan Habano", "Nicaragua", "Nicaragua"],
    ]
  );
});

test("shop catalog is generated from imported inventory and curated SKU image URLs", () => {
  const acidTwenty = catalogProducts.find((product) => product.sku === "39919");
  const vectorLighter = catalogProducts.find((product) => product.sku === "31683");

  assert.equal(catalogProducts.length, 956);
  assert.ok(acidTwenty);
  assert.equal(acidTwenty.name, "ACID 20 TWENTY YEAR 24/BX");
  assert.equal(acidTwenty.storeHref, "/shop/acid-20-twenty-year-24-bx/");
  assert.equal(acidTwenty.image, "/assets/inventory/acid-20-twenty-year-open-box.jpg");
  assert.equal(getCatalogImageUrl("39919"), "/assets/inventory/acid-20-twenty-year-open-box.jpg");
  assert.ok(vectorLighter);
  assert.equal(vectorLighter.image, "/assets/inventory/lighters/31683-single-lighter.jpg");
  assert.equal(getCatalogImageUrl("31683", "Lighters / Torch"), "/assets/inventory/lighters/31683-single-lighter.jpg");
  assert.equal(getCatalogImageUrl("999999"), "https://swwest.com/Images/SunsetItems/999999/0.jpg");
});

test("removed Cohiba Riviera inventory item is not published", () => {
  assert.equal(publishedImportedInventory.some((product) => product.slug === removedInventorySlug), false);
  assert.equal(catalogProducts.some((product) => product.slug === removedInventorySlug), false);
  assert.equal(storefrontProducts.some((product) => product.slug === removedInventorySlug), false);
  assert.equal(catalogProducts.some((product) => product.sku === removedInventorySku), false);
  assert.equal(removedInventorySlug in importedProductDescriptions, false);
  assert.equal(removedInventorySku in importedMarketPricesBySku, false);
});

test("catalog SKUs with missing source images use local fallback assets", () => {
  const missingSourceImageSkus = ["48443", "572576"];
  const productsBySku = new Map(catalogProducts.map((product) => [product.sku, product]));

  for (const sku of missingSourceImageSkus) {
    const product = productsBySku.get(sku);

    assert.ok(product, `${sku} should remain publishable with a local fallback image`);
    assert.equal(product.image, "/assets/gift-box.png");
    assert.equal(getCatalogImageUrl(sku), "/assets/gift-box.png");
  }
});

test("shop catalog includes requested Tabernacle 24-count box additions", () => {
  const productsBySku = new Map(catalogProducts.map((product) => [product.sku, product]));

  for (const expected of requestedTabernacleCigarItems) {
    const product = productsBySku.get(expected.sku);

    assert.ok(product, `expected SKU ${expected.sku} to be published`);
    assert.equal(product.name.startsWith("THE TABERNACLE"), true);
    assert.equal(product.slug, expected.slug);
    assert.equal(product.brand, "The Tabernacle");
    assert.equal(product.category, "Premium Cigars ($150-$300)");
    assert.equal(product.price, expected.memberPrice);
    assert.equal(product.memberPrice, expected.memberPrice);
    assert.equal(product.marketPrice, expected.nonMemberPrice);
    assert.equal(product.nonMemberPrice, expected.nonMemberPrice);
    assert.equal(importedMarketPricesBySku[expected.sku], expected.nonMemberPrice);
    assert.equal(product.packageLabel, "Box of 24");
    assert.equal(product.packageCount, 24);
    assert.equal(product.availability, "In stock");
    assert.equal(product.image, expected.image);
    assert.equal(product.wrapper, expected.wrapper);
    assert.equal(product.vitola, expected.vitola);
    assert.equal(product.length, expected.length);
    assert.equal(product.gauge, expected.gauge);
    assert.equal(product.strength, expected.strength);
    assert.equal(product.origin, "Nicaragua");
    assert.equal(product.binder, "San Andres Mexican");
    assert.equal(product.filler, "Esteli / Jalapa / Jamastran");
    assert.match(product.reviewProfile?.summary ?? "", /The Tabernacle/i);
    assert.ok(importedProductDescriptions[expected.slug].length > 120, `${expected.slug} should expose a shopper description`);
    assert.equal(getStorefrontProductBySlug(expected.slug)?.sku, expected.sku);
  }
});

test("requested Tabernacle cigar images are clean local PNG product renders", () => {
  for (const expected of requestedTabernacleCigarItems) {
    const image = readPngSize(expected.image);

    assert.equal(getCatalogImageUrl(expected.sku), expected.image);
    assert.ok(image.width >= 70, `${expected.sku} image width`);
    assert.ok(image.height >= 470, `${expected.sku} image height`);
    assert.equal(image.colorType, 6, `${expected.sku} should preserve a transparent alpha channel`);
    assert.ok(image.bytes >= 50000, `${expected.sku} image should retain enough product detail`);
  }
});

test("shop catalog includes requested cigar restock additions only after public market pricing exists", () => {
  const expectedMemberPrices = new Map(
    Object.entries({
      "113886": 145,
      "113887": 122,
      "572590": 127,
      "572305": 107,
      "572356": 146,
      "572409": 145,
      "572410": 150,
      "572429": 168,
      "572493": 156,
      "572685": 155,
      "572686": 170,
      "572744": 128,
      "572745": 137,
      "572749": 180,
      "572753": 160,
      "777141": 87,
      "777146": 124,
      "777147": 143,
      "777148": 163,
      "777149": 176,
      "777199": 132,
      "777229": 107,
      "777230": 107,
      "777242": 130,
      "777243": 144,
    })
  );
  const expectedMarketPrices = new Map(
    Object.entries({
      "113886": 155.95,
      "113887": 161.95,
      "572590": 127,
      "572305": 134.99,
      "572356": 171.99,
      "572409": 172.99,
      "572410": 178.99,
      "572429": 208.95,
      "572493": 208.95,
      "572685": 164.95,
      "572686": 187.95,
      "572744": 168.6,
      "572745": 168.6,
      "572749": 229.5,
      "572753": 192.99,
      "777141": 111.99,
      "777146": 180,
      "777147": 210,
      "777148": 240,
      "777149": 260,
      "777199": 152.99,
      "777229": 139.99,
      "777230": 134.99,
      "777242": 168.99,
      "777243": 191.99,
    })
  );
  const productsBySku = new Map(catalogProducts.map((product) => [product.sku, product]));

  for (const sku of pricedRequestedCigarRestockSkus) {
    const product = productsBySku.get(sku);

    assert.ok(product, `expected SKU ${sku} to be added to the shop catalog`);
    assert.equal(product.price, expectedMemberPrices.get(sku));
    assert.equal(product.memberPrice, expectedMemberPrices.get(sku));
    assert.equal(product.marketPrice, expectedMarketPrices.get(sku));
    assert.equal(product.nonMemberPrice, expectedMarketPrices.get(sku));
    assert.equal(importedMarketPricesBySku[sku], expectedMarketPrices.get(sku));
    if (sku !== "572590") {
      assert.ok(product.nonMemberPrice > product.memberPrice, `${sku} public pricing should preserve the member advantage`);
    }
    assert.notEqual(product.image, "/assets/gift-box.png", `${sku} should use a researched product image`);
    assert.ok(product.description.length > 120, `${sku} should expose a shopper-facing description`);
    assert.ok(product.vitola, `${sku} should include vitola details`);
    assert.ok(product.length, `${sku} should include length details`);
    assert.ok(product.gauge, `${sku} should include ring gauge details`);
    assert.ok(product.wrapper, `${sku} should include wrapper details`);
    assert.match(product.storeHref, /^\/shop\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/);
  }

  for (const sku of pricePendingRequestedCigarRestockSkus) {
    assert.equal(productsBySku.has(sku), false, `${sku} should stay unpublished until public market pricing is researched`);
  }
});

test("requested local cigar restock images are publishable JPEG product shots", () => {
  const localImageSkus = requestedCigarRestockSkus.filter((sku) => getCatalogImageUrl(sku).startsWith("/assets/inventory/cigars/"));

  for (const sku of localImageSkus) {
    const image = readJpegSize(getCatalogImageUrl(sku));

    assert.ok(image.width >= 386, `${sku} image width`);
    assert.ok(image.height >= 386, `${sku} image height`);
    assert.ok(image.bytes >= 30000, `${sku} image should retain enough detail for product cards`);
  }
});

test("shop catalog publishes only sellable, unique imported inventory items", () => {
  const skus = catalogProducts.map((product) => product.sku);

  assert.equal(catalogProducts.length, publishedImportedInventory.length);
  assert.equal(new Set(skus).size, skus.length);
  assert.equal(catalogProducts.some((product) => product.price <= 0), false);
  assert.equal(catalogProducts.some((product) => /membership/i.test(`${product.category} ${product.name}`)), false);
  assert.equal(catalogProducts.some((product) => product.sku === "13500"), false);
  assert.equal(catalogProducts.some((product) => product.sku === "777293"), true);
  assert.equal(catalogProducts.some((product) => product.sku === "88908"), false);
  assert.equal(catalogProducts.some((product) => product.sku === "31683"), true);
  assert.equal(catalogProducts.some((product) => product.category === "Infused & Aromatic"), false);
});

test("shop catalog normalizes price-tier categories by actual catalog price", () => {
  const budgetMismatch = catalogProducts.filter((product) => product.category === "Budget Cigars (Under $50)" && product.price >= 50);
  const midRangeMismatch = catalogProducts.filter(
    (product) => product.category === "Mid-Range Cigars ($50-$150)" && (product.price < 50 || product.price >= 150)
  );
  const premiumMismatch = catalogProducts.filter(
    (product) => product.category === "Premium Cigars ($150-$300)" && (product.price < 150 || product.price >= 300)
  );
  const luxuryMismatch = catalogProducts.filter((product) => product.category === "Luxury Cigars ($300+)" && product.price < 300);
  const bookMatches = catalogProducts.find((product) => product.sku === "572494");

  assert.equal(budgetMismatch.length, 0);
  assert.equal(midRangeMismatch.length, 0);
  assert.equal(premiumMismatch.length, 0);
  assert.equal(luxuryMismatch.length, 0);
  assert.ok(bookMatches);
  assert.equal(bookMatches.category, "Butane / Fluid");
});

test("shop catalog holds newly found SWWest cigar SKUs until public market pricing exists", () => {
  const productsBySku = new Map(catalogProducts.map((product) => [product.sku, product]));

  for (const sku of pricePendingSwwestCigarSkus) {
    assert.equal(productsBySku.has(sku), false, `${sku} should stay unpublished until public market pricing is researched`);
  }
});

test("shop catalog includes newly researched cigar products with member and public pricing", () => {
  const productsBySku = new Map(catalogProducts.map((product) => [product.sku, product]));

  for (const expected of requestedNewCigarCatalogItems) {
    const product = productsBySku.get(expected.sku);

    assert.ok(product, `expected SKU ${expected.sku} to be published`);
    assert.equal(product.slug, expected.slug);
    assert.equal(product.price, expected.memberPrice);
    assert.equal(product.memberPrice, expected.memberPrice);
    assert.equal(product.marketPrice, expected.nonMemberPrice);
    assert.equal(product.nonMemberPrice, expected.nonMemberPrice);
    assert.equal(importedMarketPricesBySku[expected.sku], expected.nonMemberPrice);
    assert.equal(product.image, expected.image);
    assert.equal(getCatalogImageUrl(expected.sku), expected.image);
    assert.equal(product.vitola, expected.vitola);
    assert.equal(product.length, expected.length);
    assert.equal(product.gauge, expected.gauge);
    assert.ok(importedProductDescriptions[expected.slug].length > 120, `${expected.slug} should expose a shopper description`);
    assert.match(product.storeHref, /^\/shop\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/);
  }
});

test("newly researched cigar product images are local publishable JPEGs", () => {
  for (const expected of requestedNewCigarCatalogItems) {
    const image = readJpegSize(expected.image);

    assert.ok(image.width >= 600, `${expected.sku} image width`);
    assert.ok(image.height >= 600, `${expected.sku} image height`);
    assert.ok(image.bytes >= 30000, `${expected.sku} image should retain enough detail for product cards`);
  }
});

test("shop catalog includes requested SWWest torch lighter SKUs with studio imagery", () => {
  const expectedPublicPrices = new Map(
    Object.entries({
      "31119": 10.49,
      "31120": 13.96,
      "46853": 58.79,
      "69493": 13.96,
      "69494": 11.89,
      "69496": 10.5,
      "76078": 13.96,
      "77086": 13.96,
      "81274": 11.54,
      "85318": 10.49,
      "85319": 11.89,
      "85321": 15.39,
    })
  );
  const productsBySku = new Map(catalogProducts.map((product) => [product.sku, product]));

  for (const sku of requestedSwwestLighterSkus) {
    const product = productsBySku.get(sku);

    assert.ok(product, `expected SKU ${sku} to be added to the shop catalog`);
    assert.equal(product.category, "Lighters / Torch");
    assert.equal(product.availability, "In stock");
    assert.equal(product.sourceStatus, "instock");
    assert.equal(product.image, `/assets/inventory/lighters/${sku}-single-lighter.jpg`);
    assert.equal(product.imagePosition, "center");
    assert.equal(product.nonMemberPrice, expectedPublicPrices.get(sku));
    assert.ok(product.memberPrice <= product.nonMemberPrice, `${sku} member pricing should not exceed public pricing`);
    assert.match(product.storeHref, /^\/shop\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/);
  }
});

test("requested SWWest lighter studio images are high-resolution square JPEGs", () => {
  for (const sku of requestedSwwestLighterSkus) {
    const assetPath = `/assets/inventory/lighters/${sku}-single-lighter.jpg`;
    const image = readJpegSize(assetPath);

    assert.equal(image.width, 900, `${sku} image width`);
    assert.equal(image.height, 900, `${sku} image height`);
    assert.ok(image.bytes >= 50000, `${sku} image should retain enough detail for a premium product card`);
  }
});

test("catalog product details use shopper-facing descriptions instead of source feed copy", () => {
  const acid = catalogProducts.find((product) => product.sku === "2754");

  assert.ok(acid);

  const details = getCatalogProductDetails(acid);

  assert.match(details.summary, /Experience the legendary ACID 1400CC/i);
  assert.match(details.summary, /Drew Estate's signature botanical blend/i);
  assert.doesNotMatch(details.summary, /\*\*Country of Origin:\*\*/i);
  assert.doesNotMatch(details.summary, /a ACID selection/i);
  assert.doesNotMatch(details.summary, /published from the imported shop inventory catalog/i);
  assert.doesNotMatch(details.summary, /SKU 2754 is used to load/i);
});

test("catalog products expose imported product descriptions", () => {
  const acid = catalogProducts.find((product) => product.sku === "2754");

  assert.ok(acid);
  assert.match(acid.description, /Experience the legendary ACID 1400CC/i);
  assert.match(acid.description, /Drew Estate's signature botanical blend/i);
  assert.equal(getCatalogProductDetails(acid).summary, acid.description);
});

test("catalog products parse imported cigar details into shopper specs", () => {
  const jcNewman = catalogProducts.find((product) => product.slug === "6-x-60-sampler-jc-newman-4-bx");

  assert.ok(jcNewman);
  assert.equal(jcNewman.name, "J.C. Newman Sesenta Sampler");
  assert.equal(jcNewman.brand, "J.C. Newman");
  assert.equal(jcNewman.origin, "Varies by selection");
  assert.equal(jcNewman.wrapper, "Varies by selection");
  assert.equal(jcNewman.vitola, "Assorted");
  assert.equal(jcNewman.length, "Various lengths");
  assert.equal(jcNewman.gauge, "60");
  assert.equal(jcNewman.strength, "Varies by selection");
  assert.equal(jcNewman.assortment?.sourceName, "Best Cigar Prices");
  assert.match(jcNewman.assortment?.sourceUrl ?? "", /bestcigarprices\.com/);
  assert.deepEqual(
    jcNewman.assortment?.items.map((item) => [item.name, item.variant, item.size]),
    [
      ["Brick House Mighty Mighty", "Natural", '6¼" × 60'],
      ["Brick House Mighty Mighty", "Maduro", '6¼" × 60'],
      ["Perla del Mar Double Toro", "Connecticut Shade", '6" × 60'],
      ["Perla del Mar Double Toro", "Maduro", '6" × 60'],
    ]
  );
});

test("catalog products expose researched cigar blend and size specs", () => {
  const productsBySlug = new Map(catalogProducts.map((product) => [product.slug, product]));

  assert.deepEqual(
    [
      productsBySlug.get("acid-20-twenty-year-24-bx"),
      productsBySlug.get("acid-kuba-kuba-24-bx"),
      productsBySlug.get("deadwood-sweet-jane-24-bx"),
      productsBySlug.get("h-upmann-nicaraguan-toro-20-bx-aj-fernandez"),
      productsBySlug.get("oliva-serie-v-melanio-torpedo-10-bx"),
      productsBySlug.get("my-father-5ct-cigar-sampler-w-cutter-lighter"),
    ].map((product) => [
      product?.length,
      product?.gauge,
      product?.wrapper,
      product?.binder,
      product?.filler,
    ]),
    [
      ['5"', "50", "Mexican San Andres Maduro", "Indonesia", "Nicaragua"],
      ['5"', "54", "Sumatra", "Nicaragua", "Nicaragua"],
      ['5"', "46", "Maduro", "Indonesia", "Nicaragua"],
      ['6"', "54", "Ecuador", "Nicaragua", "Dominican Republic, Nicaragua"],
      ['6.5"', "52", "Ecuadorian Sumatra", "Nicaragua", "Nicaragua"],
      ["Assorted", "Assorted", "Varies by selection", "Varies by selection", "Varies by selection"],
    ]
  );
});

test("catalog products apply researched line specs across major cigar families", () => {
  const productsBySlug = new Map(catalogProducts.map((product) => [product.slug, product]));

  assert.deepEqual(
    [
      productsBySlug.get("factory-smokes-maduro-toro-25-bdl"),
      productsBySlug.get("drew-estate-java-maduro-the-58-24-bx"),
      productsBySlug.get("aj-fernandez-new-world-decenio-toro-20-bx"),
      productsBySlug.get("arturo-fuente-hemingway-short-story-25-bx"),
      productsBySlug.get("ashton-vsg-torpedo-24-bx"),
      productsBySlug.get("perdomo-10th-ann-champagne-robusto-25-bx"),
      productsBySlug.get("oliva-connecticut-reserve-toro-20-bx"),
      productsBySlug.get("macanudo-cafe-hyde-park-25-bx"),
      productsBySlug.get("montecristo-1935-anniversary-toro-10-bx"),
    ].map((product) => [
      product?.length,
      product?.gauge,
      product?.wrapper,
      product?.binder,
      product?.filler,
    ]),
    [
      ['6"', "52", "Maduro", "Indonesia", "Indonesia"],
      ['5"', "58", "Brazilian Maduro", "Nicaragua", "Nicaragua"],
      ['6.5"', "54", "Mexican San Andres", "Nicaragua", "Nicaragua, Honduras"],
      ['4"', "42/49", "African Cameroon", "Dominican Republic", "Dominican Republic"],
      ['6.5"', "55", "Ecuadorian Sumatra", "Dominican Republic", "Dominican Republic"],
      ['5"', "54", "Ecuadorian Connecticut", "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan"],
      ['6"', "50", "Ecuadorian Connecticut", "Nicaragua", "Nicaragua"],
      ['5.5"', "49", "Connecticut Shade", "Mexican San Andres", "Dominican Republic, Mexico"],
      ['6"', "54", "Nicaragua", "Nicaragua", "Nicaragua"],
    ]
  );
});

test("researched line specs complete hundreds more published cigar products", () => {
  const specFields = ["origin", "length", "gauge", "strength", "wrapper", "filler", "binder"] as const;
  const nonCigarPattern = /lighter|torch|fluid|butane|humidor|membership|accessor|ashtray|cutter|punch|display/i;
  const likelyCigars = catalogProducts.filter((product) => !nonCigarPattern.test(product.category) && !nonCigarPattern.test(product.name));
  const missingSpecs = likelyCigars.filter((product) => specFields.some((field) => !product[field]));

  assert.deepEqual(
    missingSpecs.map((product) => product.slug),
    []
  );
});

test("catalog products expose researched Cigar Aficionado review metadata", () => {
  const upmannToro = catalogProducts.find((product) => product.slug === "h-upmann-nicaraguan-toro-20-bx-aj-fernandez");
  const bankerToro = catalogProducts.find((product) => product.slug === "h-upmann-the-banker-daytrader-toro-10-bx");

  assert.ok(upmannToro);
  assert.equal(upmannToro.length, '6"');
  assert.equal(upmannToro.gauge, "54");
  assert.equal(upmannToro.strength, "Medium");
  assert.equal(upmannToro.wrapper, "Ecuador");
  assert.equal(upmannToro.filler, "Dominican Republic, Nicaragua");
  assert.equal(upmannToro.binder, "Nicaragua");
  assert.equal(upmannToro.origin, "Nicaragua");
  assert.equal(upmannToro.expertReview?.sourceName, "Cigar Aficionado");
  assert.equal(upmannToro.expertReview?.score, 92);
  assert.equal(upmannToro.expertReview?.issue, "Cigar Aficionado - Aug 01, 2024");
  assert.equal(upmannToro.expertReview?.otherReviews.at(0)?.score, 92);

  assert.ok(bankerToro);
  assert.equal(bankerToro.length, '6"');
  assert.equal(bankerToro.gauge, "54");
  assert.equal(bankerToro.expertReview?.score, 90);
  assert.match(getCatalogProductDetails(bankerToro).signals.join(" "), /90-point Cigar Aficionado review/);
});

test("catalog products expose sourced ACID 20 ratings and review key details", () => {
  const acidTwenty = catalogProducts.find((product) => product.slug === "acid-20-twenty-year-24-bx");
  const acidToro = catalogProducts.find((product) => product.slug === "acid-20-toro-maduro-24-bx");

  assert.ok(acidTwenty);
  assert.match(acidTwenty.reviewProfile?.summary ?? "", /community and retailer ratings skew positive/i);
  assert.deepEqual(
    acidTwenty.reviewProfile?.sources.map((source) => [source.sourceName, source.rating]),
    [
      ["Cigar World", "4.63 community rating"],
      ["CIGAR.com", "4.5/5 from 21 customer ratings"],
      ["Cigar Coop", "88 Robusto / 87 Toro"],
    ]
  );
  assert.match(getCatalogProductDetails(acidTwenty).signals.join(" "), /review details researched/i);

  assert.ok(acidToro);
  assert.match(acidToro.reviewProfile?.summary ?? "", /ACID 20 Maduro Toro/i);
  assert.deepEqual(
    acidToro.reviewProfile?.sources.map((source) => [source.sourceName, source.rating]),
    [
      ["Cigar Coop", "87"],
      ["Cigar World", "4.63 community rating"],
      ["Holt's Cigar Co.", "5/5 from 5 customer reviews"],
    ]
  );
  assert.match(getCatalogProductDetails(acidToro).signals.join(" "), /review details researched/i);
});

test("catalog products expose sourced Rocky Patel line ratings and review key details", () => {
  const expectedProfiles = [
    ["rocky-patel-1990-vintage-robusto-20-bx", "Vintage 1990", "92 brand-cited rating", "https://www.rockypatel.com/cigar/vintage-1990/"],
    ["rocky-patel-1992-vintage-toro-20-bx", "Vintage 1992", "92 brand-cited rating", "https://www.rockypatel.com/cigar/vintage-1992/"],
    ["rocky-patel-1999-vintage-robusto-20-bx", "Vintage 1999", "91 brand-cited profile rating", "https://www.rockypatel.com/cigar/vintage-1999/"],
    ["rocky-patel-decade-toro-20-bx", "Decade", "95 brand-cited rating", "https://www.rockypatel.com/cigar/decade/"],
    ["rocky-patel-edge-maduro-robusto-20-bx", "The Edge Maduro", "92 brand-cited rating", "https://www.rockypatel.com/cigar/the-edge-maduro/"],
    ["rocky-patel-edge-corojo-toro-20-bx", "The Edge Corojo", "94 brand-cited profile rating", "https://www.rockypatel.com/cigar/the-edge-corojo/"],
    ["rocky-patel-sun-grown-maduro-toro-20-bx", "Sun Grown Maduro", "95 brand-cited rating", "https://www.rockypatel.com/cigar/sun-grown-maduro/"],
    ["rocky-patel-sixty-toro-20-bx", "SIXTY", "96 brand-cited rating", "https://www.rockypatel.com/cigar/sixty/"],
    ["rocky-patel-alr-toro-20-bx-second-edition", "A.L.R. Second Edition", "96 brand-cited rating", "https://www.rockypatel.com/cigar/alr-second-edition/"],
    ["rocky-patel-no-6-robusto-20-bx", "Number 6", "95 brand-cited rating", "https://www.rockypatel.com/cigar/number-6/"],
  ];

  for (const [slug, lineName, rating, sourceUrl] of expectedProfiles) {
    const product = catalogProducts.find((candidate) => candidate.slug === slug);

    assert.ok(product, `${slug} should remain published`);
    assert.match(product.reviewProfile?.summary ?? "", new RegExp(lineName, "i"));
    assert.deepEqual(product.reviewProfile?.sources.map((source) => [source.sourceName, source.rating, source.sourceUrl]), [
      ["Rocky Patel", rating, sourceUrl],
    ]);
    assert.match(getCatalogProductDetails(product).signals.join(" "), /review details researched/i);
  }

  const rockyPatelCoveredProducts = catalogProducts.filter(
    (product) => product.brand === "Rocky Patel" && (product.expertReview || product.reviewProfile)
  );

  assert.equal(rockyPatelCoveredProducts.length, 64);
});

test("catalog products expose sourced Arturo Fuente line ratings and review key details", () => {
  const expectedProfiles = [
    ["arturo-fuente-don-carlos-no-2-25-bx", "Don Carlos", "94 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/16969/name/arturo-fuente-don-carlos-no-2"],
    ["arturo-fuente-hemingway-short-story-25-bx", "Hemingway Short Story", "92 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/22689/name/arturo-fuente-hemingway-short-story"],
    ["arturo-fuente-chateau-cuban-belicoso-sg24-bx", "Chateau Fuente Cuban Belicoso Sun Grown", "92 Cigar Aficionado profile rating", "https://www.cigaraficionado.com/rating/arturo-fuente-chateau-fuente-sungrown-cuban-belicoso"],
    ["arturo-fuente-king-t-tubo-24-bx", "Chateau Fuente King T", "93 Cigar Aficionado listed review", "https://www.cigaraficionado.com/ratings/23567/name/arturo-fuente-chateau-fuente-king-t-tubo"],
    ["arturo-fuente-royal-salute-sungrown-10-bx", "Chateau Fuente Royal Salute Sun Grown", "89 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/25384/name/arturo-fuente-chateau-fuente-royal-salute-sun-grown"],
    ["arturo-fuente-flor-fina-8-5-8-maduro-25-bx", "Flor Fina Maduro 8-5-8", "87 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/11909/name/arturo-fuente-flor-fina-maduro-8-5-8-toro"],
    ["arturo-fuente-cubanitos-maduro-10-10", "Cubanitos Maduro", "4.3/5 from 8 Neptune customer reviews", "https://www.neptunecigar.com/cigars/arturo-fuente-maduro-cubanitos"],
    ["arturo-fuente-brevas-royale-natural-50-bx", "Brevas Royale Natural", "4.3/5 from 165 Neptune customer reviews", "https://www.neptunecigar.com/cigars/arturo-fuente-brevas-royale"],
    ["arturo-fuente-curly-head-natural-4o-bx", "Curly Head Natural", "4.2/5 from 161 Neptune customer reviews", "https://www.neptunecigar.com/cigars/arturo-fuente-curly-head"],
    ["arturo-fuente-exquisitos-natural-50-bx", "Exquisitos Natural", "4.29/5 from 153 Neptune customer reviews", "https://www.neptunecigar.com/cigars/arturo-fuente-exquisitos"],
  ];

  for (const [slug, lineName, rating, sourceUrl] of expectedProfiles) {
    const product = catalogProducts.find((candidate) => candidate.slug === slug);

    assert.ok(product, `${slug} should remain published`);
    assert.match(product.reviewProfile?.summary ?? "", new RegExp(lineName, "i"));
    assert.deepEqual(product.reviewProfile?.sources.map((source) => [source.sourceName, source.rating, source.sourceUrl]), [
      [sourceUrl.includes("neptunecigar.com") ? "Neptune Cigar" : "Cigar Aficionado", rating, sourceUrl],
    ]);
    assert.match(getCatalogProductDetails(product).signals.join(" "), /review details researched/i);
  }

  const arturoFuenteCoveredProducts = catalogProducts.filter(
    (product) => product.brand === "Arturo Fuente" && (product.expertReview || product.reviewProfile)
  );

  assert.equal(arturoFuenteCoveredProducts.length, 51);
});

test("catalog products expose sourced review profiles for the next five brand batches", () => {
  const expectedProfiles = [
    ["oliva-connecticut-reserve-churchill-20-bx", "Oliva Connecticut Reserve", "92 Cigar Aficionado Churchill line-reference rating", "https://www.cigaraficionado.com/rating/oliva-connecticut-reserve-churchill"],
    ["oliva-serie-v-melanio-robusto-10-bx", "Oliva Serie V Melanio Robusto", "94 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/19454/name/oliva-serie-v-melanio-robusto"],
    ["romeo-y-julieta-1875-bully-25-bx", "Romeo y Julieta 1875 Bully", "89 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/24412/name/romeo-y-julieta-1875-bully-robusto"],
    ["romeo-y-julieta-reserva-real-robusto-25-bx", "Romeo y Julieta Reserva Real", "90 Cigar Insider listed review", "https://www.cigaraficionado.com/ratings/8963/name/romeo-y-julieta-reserva-real-robusto"],
    ["perdomo-10th-ann-champagne-torpedo-25-bx", "Perdomo 10th Anniversary Champagne Connecticut", "89 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/22176/name/perdomo-reserve-10th-anniversary-champagne-connecticut-torpedo-figurado"],
    ["perdomo-lot-23-maduro-robusto-24-bx", "Perdomo Lot 23 Maduro", "89 Cigar Aficionado line-reference rating", "https://www.cigaraficionado.com/ratings/14640/name/perdomo-lot-23-maduro-gordito-odd"],
    ["macanudo-cafe-hyde-park-25-bx", "Macanudo Cafe Hyde Park", "90 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/14291/name/macanudo-cafe-hyde-park-toro"],
    ["macanudo-inspirado-orange-robusto-20-bx", "Macanudo Inspirado Orange Robusto", "90 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/19007/name/macanudo-inspirado-orange-robusto-robusto"],
    ["tatiana-classic-cherry-25-bx", "Tatiana Cherry", "4.37/5 from 111 Neptune customer reviews", "https://www.neptunecigar.com/cigar/tatiana-cherry"],
    ["tatiana-mini-tins-vanilla-5-10-tins", "Tatiana Mini Tins", "4.76/5 from 152 Cigars International customer ratings", "https://www.cigarsinternational.com/p/Tatiana-Flavored-Cigarillos/2003029/"],
  ];

  for (const [slug, lineName, rating, sourceUrl] of expectedProfiles) {
    const product = catalogProducts.find((candidate) => candidate.slug === slug);

    assert.ok(product, `${slug} should remain published`);
    assert.match(product.reviewProfile?.summary ?? "", new RegExp(lineName, "i"));
    assert.deepEqual(product.reviewProfile?.sources.map((source) => [source.rating, source.sourceUrl]), [[rating, sourceUrl]]);
    assert.match(getCatalogProductDetails(product).signals.join(" "), /review details researched/i);
  }

  const expectedCoveredCounts = new Map([
    ["Oliva", 48],
    ["Romeo", 43],
    ["Ryj", 4],
    ["Perdomo", 42],
    ["Macanudo", 40],
    ["Tatiana", 37],
  ]);

  for (const [brand, expectedCount] of expectedCoveredCounts) {
    const coveredProducts = catalogProducts.filter((product) => product.brand === brand && (product.expertReview || product.reviewProfile));

    assert.equal(coveredProducts.length, expectedCount, `${brand} should have sourced review coverage for every product in this batch`);
  }
});

test("catalog products expose sourced review profiles for the 50 percent coverage batch", () => {
  const expectedProfiles = [
    ["gurkha-cellar-resv-12yr-platinum-hedonism-20-bx", "Gurkha Cellar Reserve Platinum 12 Year", "4.44/5 from 115 Neptune customer reviews", "https://www.neptunecigar.com/cigar/gurkha-cellar-reserve-platinum-12-year"],
    ["gurkha-royal-challenge-robusto-20-bx", "Gurkha Royal Challenge", "4.4/5 from 89 Neptune customer reviews", "https://www.neptunecigar.com/cigar/gurkha-royal-challenge"],
    ["gurkha-nicaragua-series-robusto-20-bx", "Gurkha Nicaragua Series", "4.48/5 from 40 Neptune customer reviews", "https://www.neptunecigar.com/cigar/gurkha-nicaragua-series"],
    ["montecristo-1935-anniversary-no-2-10-bx", "Montecristo 1935 Anniversary Nicaragua No. 2", "95 Cigar Aficionado Top 25 line-reference rating", "https://www.cigaraficionado.com/top25cigar/montecristo-1935-anniversary-nicaragua-no-2-0"],
    ["montecristo-white-toro-15-bx", "Montecristo White Toro", "88 Cigar Aficionado exact review", "https://www.cigaraficionado.com/ratings/15552/name/montecristo-white-toro-toro"],
    ["montecristo-classic-tubo-especial-15-bx", "Montecristo Classic Series Churchill", "88 Cigar Aficionado Churchill line-reference rating", "https://www.cigaraficionado.com/ratings/25584/name/montecristo-classic-series-churchill-churchill"],
    ["my-father-connecticut-robusto-23-bx", "My Father Connecticut Robusto", "90 Cigar Aficionado line-reference rating", "https://www.cigaraficionado.com/ratings/19239/name/my-father-connecticut-robusto-robusto"],
    ["my-father-judge-grand-robusto-23-bx", "My Father The Judge Grand Robusto", "98 Cigar Aficionado Cigar of the Year line-reference rating", "https://www.cigaraficionado.com/ratings/24975/name/my-father-the-judge-grand-robusto-grande"],
    ["my-father-le-bijou-1922-torpedo-23-bx", "My Father Le Bijou 1922 Torpedo Box Pressed", "97 Cigar Aficionado Cigar of the Year exact review", "https://www.cigaraficionado.com/ratings/18642/name/my-father-le-bijou-1922-torpedo-box-pressed-figurado"],
    ["factory-smokes-maduro-toro-25-bdl", "Factory Smokes Maduro", "4.12/5 from 567 Neptune customer reviews", "https://www.neptunecigar.com/cigar/factory-smokes-maduro"],
    ["factory-smokes-sun-grown-robusto-25ct", "Factory Smokes Sun Grown", "4.03/5 from 91 Neptune customer reviews", "https://www.neptunecigar.com/cigars/factory-smokes-sungrown-robusto"],
    ["factory-throwouts-59-sweet-20-bdl", "Factory Throw-Outs", "4.5/5 from 1,938 Cigars International customer ratings", "https://www.cigarsinternational.com/p/factory-throwouts-cigars/1479955/"],
  ];

  for (const [slug, lineName, rating, sourceUrl] of expectedProfiles) {
    const product = catalogProducts.find((candidate) => candidate.slug === slug);

    assert.ok(product, `${slug} should remain published`);
    assert.match(product.reviewProfile?.summary ?? "", new RegExp(lineName, "i"));
    assert.deepEqual(product.reviewProfile?.sources.map((source) => [source.rating, source.sourceUrl]), [[rating, sourceUrl]]);
    assert.match(getCatalogProductDetails(product).signals.join(" "), /review details researched/i);
  }

  const expectedCoveredCounts = new Map([
    ["Gurkha", 28],
    ["Montecristo", 27],
    ["My Father", 31],
    ["Factory", 22],
  ]);

  for (const [brand, expectedCount] of expectedCoveredCounts) {
    const coveredProducts = catalogProducts.filter((product) => product.brand === brand && (product.expertReview || product.reviewProfile));

    assert.equal(coveredProducts.length, expectedCount, `${brand} should have sourced review coverage for every product in this batch`);
  }

  const nonCigarPattern = /lighter|torch|fluid|butane|humidor|membership|accessor|ashtray|cutter|punch|display|book matches/i;
  const cigarProducts = catalogProducts.filter((product) => !nonCigarPattern.test(product.category) && !nonCigarPattern.test(product.name));
  const coveredCigarProducts = cigarProducts.filter((product) => product.expertReview || product.reviewProfile);

  assert.ok(coveredCigarProducts.length >= 425);
  assert.ok(coveredCigarProducts.length / cigarProducts.length >= 0.5);
});

test("catalog products keep placeholder review coverage out of Ratings & Reviews", () => {
  const expectedProfiles = [
    ["acid-atom-maduro-24-bx", "ACID Yellow", "Overall 4.48/5 from 294 Neptune customer reviews", "https://www.neptunecigar.com/cigar/acid-yellow"],
    ["acid-kuba-kuba-24-bx", "ACID Kuba Kuba", "Neptune customer-review product page", "https://www.neptunecigar.com/cigars/acid-kuba-kuba"],
    ["punch-signature-robusto-18-bx", "Punch Signature", "91 Cigar Aficionado Signature Robusto line-reference rating", "https://www.cigaraficionado.com/ratings/18072/name/punch-signature-robusto-robusto"],
    ["cohiba-blue-robusto-20-bx", "Cohiba Blue", "86 Cigar Aficionado Cohiba Blue Robusto line-reference rating", "https://www.cigaraficionado.com/ratings/19906/name/cohiba-blue-robusto"],
    ["quorum-classic-robusto-20-bdl", "Quorum", "Neptune customer-review brand and line page", "https://www.neptunecigar.com/cigar/quorum"],
    ["brick-house-natural-robusto-25-bx", "Brick House", "Cigar Aficionado line-reference rating coverage", "https://www.cigaraficionado.com/ratings/26184/name/brick-house-corona"],
    ["drew-estate-java-maduro-robusto-24-bx", "Java by Drew Estate", "Neptune customer-review product page", "https://www.neptunecigar.com/cigars/java-maduro-toro"],
    ["jms-dominican-connecticut-robusto-50-bx", "JM's Dominican", "Cigars.com product-review page", "https://www.cigars.com/item/jms-dominican/connecticut-robusto/JMDCR.html"],
    ["davidoff-winston-churchill-late-hour-5pk25-tins", "Davidoff Winston Churchill The Late Hour", "86 Cigar Aficionado Churchill line-reference rating", "https://www.cigaraficionado.com/ratings/20277/name/davidoff-winston-churchill-the-late-hour-churchill"],
  ];

  for (const [slug, lineName, rating, sourceUrl] of expectedProfiles) {
    const product = catalogProducts.find((candidate) => candidate.slug === slug);

    assert.ok(product, `${slug} should remain published`);
    assert.match(product.reviewProfile?.summary ?? "", new RegExp(lineName, "i"));
    assert.deepEqual(product.reviewProfile?.sources.map((source) => [source.rating, source.sourceUrl]), [[rating, sourceUrl]]);
    assert.match(getCatalogProductDetails(product).signals.join(" "), /review details researched/i);
  }

  const cigarProducts = catalogProducts.filter(isCigarCatalogProduct);
  const unsourcedCigarProducts = cigarProducts.filter((product) => !product.expertReview && !product.reviewProfile);

  assert.equal(cigarProducts.length, 907);
  assert.equal(unsourcedCigarProducts.length, 0);
  assert.ok(unsourcedCigarProducts.every((product) => !/review-search profile|community-review profile|review-discovery|brand\/line coverage/i.test(product.reviewProfile?.summary ?? "")));
});

test("all cigar products expose sourced Ratings & Reviews without internal audit prompts", () => {
  const cigarProducts = catalogProducts.filter(isCigarCatalogProduct);
  const unsourcedCigarProducts = cigarProducts.filter((product) => !product.expertReview && !product.reviewProfile);

  assert.equal(cigarProducts.length, 907);
  assert.equal(unsourcedCigarProducts.length, 0);

  for (const product of cigarProducts) {
    assert.doesNotMatch(
      getCatalogProductDetails(product).signals.join(" "),
      /Review audit|research query|sourced ratings review/i,
      `${product.slug} should not expose internal review-audit copy`
    );
  }
});

test("non-cigar products without sourced reviews remain neutral without internal audit copy", () => {
  const rockyPatelHumidor = catalogProducts.find((product) => product.slug === "rocky-patel-white-label-humidor-100-bx");

  assert.ok(rockyPatelHumidor);
  assert.equal(rockyPatelHumidor.expertReview, undefined);
  assert.equal(rockyPatelHumidor.reviewProfile, undefined);
  assert.doesNotMatch(getCatalogProductDetails(rockyPatelHumidor).signals.join(" "), /Review audit|research|queued|sourced rating/i);
});

test("Ratings & Reviews panel renders only ratings, source names, and source links", () => {
  const productPageSource = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  assert.equal(productPageSource.includes("{profile.summary}"), false);
  assert.equal(productPageSource.includes("source.keyDetails.map"), false);
  assert.equal(productPageSource.includes("{source.rating}"), true);
  assert.equal(productPageSource.includes("{source.sourceName}"), true);
  assert.equal(productPageSource.includes("href={source.sourceUrl}"), true);
});

test("product detail hero image is formatted as a full product shot", () => {
  const source = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  assert.ok(source.includes('data-product-main-image="contained"'), "missing contained product image marker");
  assert.ok(source.includes("object-contain"), "main product image should use contain instead of crop");
  assert.equal(source.includes("scale-125"), false, "main product image should not be enlarged beyond its frame");
  assert.equal(source.includes("bg-gradient-to-t from-yuzu-night/95"), false, "main product image should not be obscured by the old bottom fade");
});

test("product detail metadata rows can wrap long values on mobile", () => {
  const source = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  assert.equal(source.includes("break-all"), false, "product metadata should not break in the middle of every word");
  assert.ok(source.includes("break-words"), "long metadata values should wrap at word boundaries");
  assert.ok(source.includes("min-w-0"), "product detail panels should allow mobile grid items to shrink");
});

test("product cards and detail pages render concise specs and real review panels", () => {
  const productCardSource = readFileSync(new URL("../src/components/product-card.tsx", import.meta.url), "utf8");
  const productPageSource = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  for (const icon of ["Cigarette", "Ruler", "Gauge", "Flame"]) {
    assert.ok(productCardSource.includes(icon), `product cards should import ${icon}`);
  }

  for (const label of ["Product", "Length", "Gauge", "Strength"]) {
    assert.ok(productCardSource.includes(label), `product cards should show ${label}`);
  }

  for (const label of ["Pack", "Format", "Strength"]) {
    assert.ok(productPageSource.includes(`label: \"${label}\"`), `product detail page should show the concise ${label} fact`);
  }

  assert.ok(productPageSource.includes("Ratings &amp; reviews"), "product detail page should include sourced reviews");
  assert.ok(productPageSource.includes("expertReview"), "product detail page should use researched review metadata");
  assert.ok(productPageSource.includes("reviewProfile"), "product detail page should render broader review snapshots");
  assert.ok(productPageSource.includes("break-words"), "product and review details should wrap at word boundaries");
  assert.ok(productPageSource.includes("NoSourcedReviewsPanel"), "cigar detail page should render a neutral empty review state");
  assert.equal(productPageSource.includes("ReviewAuditPanel"), false, "product detail page should not render internal review-audit copy");
  assert.equal(productPageSource.includes("ReviewQueryRow"), false, "product detail page should not render research prompts");
  assert.equal(productPageSource.includes("getCatalogReviewAudit"), false, "product detail page should not source internal review audits");
  assert.equal(productPageSource.includes("Research query"), false, "product detail page should not label internal research prompts");
  assert.equal(productPageSource.includes("queued for sourced ratings"), false, "product detail page should not show workflow copy");
});

test("product detail page gives every shopper-facing fact one clear home", () => {
  const productPageSource = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  for (const internalLabel of [
    "Catalog Signals",
    "Catalog Intelligence",
    "Source status",
    "Review details researched",
    "SKU matched across catalog and inventory",
  ]) {
    assert.equal(productPageSource.includes(internalLabel), false, `${internalLabel} should stay out of the customer page`);
  }

  assert.equal(productPageSource.match(/label: \"SKU\"/g)?.length, 1, "SKU should render in one details row");
  assert.equal(productPageSource.match(/product\.availability/g)?.length, 1, "availability should render once");
  assert.ok(productPageSource.includes('data-product-page-layout="editorial"'));
  assert.ok(productPageSource.includes('data-related-product-card="compact"'));
  assert.ok(productPageSource.includes("h-12 w-full"), "primary purchase action should be at least 48px high");
  assert.ok(productPageSource.includes("max-lg:pr-12"), "mobile and tablet purchase content should reserve the concierge corner");
  assert.ok(productPageSource.includes("lg:grid-cols-[1.04fr_0.96fr]"), "the split hero should start after tablet widths");
  assert.ok(productPageSource.includes("Inside the sampler"), "modeled sampler contents should have a dedicated section");
  assert.equal(productPageSource.includes("Why it belongs in your humidor"), false, "accessories should not receive cigar-storage copy");
});

test("product page copy separates the lead from the story and removes appended spec prose", () => {
  const sampler = catalogProducts.find((product) => product.slug === "6-x-60-sampler-jc-newman-4-bx");

  assert.ok(sampler);
  const copy = buildProductPageCopy(getCatalogProductDetails(sampler).summary, sampler.sku);

  assert.match(copy.lead, /J\.C\. Newman/i);
  assert.ok(copy.story.length > 0);
  assert.equal(copy.story.startsWith(copy.lead), false);
  assert.equal(copy.narrative, `${copy.lead} ${copy.story}`);
  assert.doesNotMatch(copy.narrative, /6\s*[x×]\s*60|60[- ]ring/i);
  assert.doesNotMatch(`${copy.lead} ${copy.story}`, /Country of Origin:|Wrapper:|Shape:|Profile:/i);
  assert.ok(copy.metaDescription.length <= 158);
  assert.ok(copy.metaDescription.endsWith("…"));
});

test("all product narratives stay shopper-facing and free of catalog operations language", () => {
  const operationalCopyPattern =
    /\b(?:SKU|inventory|storefront|catalog|fulfillment|reconcil(?:e|es|ed|ing|iation))\b|source reference/i;

  for (const product of storefrontProducts) {
    const summary = getCatalogProductDetails(product).summary;
    const narrative = buildProductPageCopy(summary, product.sku).narrative;

    assert.doesNotMatch(narrative, operationalCopyPattern, `${product.slug} should have shopper-facing page copy`);
    assert.doesNotMatch(summary, operationalCopyPattern, `${product.slug} should have shopper-facing listing copy`);
  }
});

test("product detail structured data omits aggregate ratings unless a real review aggregate is modeled", () => {
  const productPageSource = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  assert.equal(productPageSource.includes("aggregateRating"), false);
  assert.equal(productPageSource.includes("ratingValue"), false);
  assert.equal(productPageSource.includes("reviewCount"), false);
});

test("Medusa product projection keeps prices in display units", () => {
  const medusaProduct = toMedusaProduct(featuredLuxuryProducts[0]);

  assert.equal(medusaProduct.variants[0].prices[0].amount, featuredLuxuryProducts[0].price);
});
