import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  catalogProducts,
  featuredLuxuryProducts,
  getCatalogImageUrl,
  getCatalogProductDetails,
  getStorefrontProductBySlug,
  luxuryCatalogProducts,
  publishedImportedInventory,
  storefrontProducts,
} from "../src/lib/catalog";
import { toMedusaProduct } from "../src/lib/commerce/medusa";

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
      bySlug.get("cohiba-riviera-box-press-toro-20-bx"),
      bySlug.get("oliva-serie-v-melanio-soccer-edition-24-bx"),
    ].map((product) => [product?.length, product?.gauge, product?.strength, product?.wrapper, product?.filler, product?.binder]),
    [
      ['7.5"', "52", "Mild", "Connecticut Shade", "Dominican Republic", "Dominican Republic"],
      ['7"', "54", "Mild", "Connecticut Shade", "Dominican Republic", "Dominican Republic"],
      ['6.5"', "52", "Medium", "San Andres", "Honduran Jamastran, Honduran La Entrada, Nicaraguan Condega, Nicaraguan Esteli", "Honduran Connecticut"],
      ['6"', "60", "Medium-Full", "Ecuadorian Sumatra, Mexican San Andres Maduro", "Nicaragua", "Nicaragua"],
    ]
  );
});

test("shop catalog is generated from imported inventory and curated SKU image URLs", () => {
  const acidTwenty = catalogProducts.find((product) => product.sku === "39919");
  const vectorLighter = catalogProducts.find((product) => product.sku === "31683");

  assert.equal(catalogProducts.length, 923);
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

test("catalog SKUs with missing source images use local fallback assets", () => {
  const missingSourceImageSkus = ["48443", "572590", "572576"];
  const productsBySku = new Map(catalogProducts.map((product) => [product.sku, product]));

  for (const sku of missingSourceImageSkus) {
    const product = productsBySku.get(sku);

    assert.ok(product, `${sku} should remain publishable with a local fallback image`);
    assert.equal(product.image, "/assets/gift-box.png");
    assert.equal(getCatalogImageUrl(sku), "/assets/gift-box.png");
  }
});

test("shop catalog publishes only sellable, unique imported inventory items", () => {
  const skus = catalogProducts.map((product) => product.sku);

  assert.equal(catalogProducts.length, publishedImportedInventory.length);
  assert.equal(new Set(skus).size, skus.length);
  assert.equal(catalogProducts.some((product) => product.price <= 0), false);
  assert.equal(catalogProducts.some((product) => /membership/i.test(`${product.category} ${product.name}`)), false);
  assert.equal(catalogProducts.some((product) => product.sku === "13500"), false);
  assert.equal(catalogProducts.some((product) => product.sku === "777293"), false);
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

test("shop catalog includes newly found publishable SWWest cigar SKUs", () => {
  const expectedSkus = [
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
    "777287",
    "777292",
  ];
  const productsBySku = new Map(catalogProducts.map((product) => [product.sku, product]));

  for (const sku of expectedSkus) {
    const product = productsBySku.get(sku);

    assert.ok(product, `expected SKU ${sku} to be added to the shop catalog`);
    assert.equal(product.availability, "In stock");
    assert.equal(product.sourceStatus, "instock");
    assert.match(product.storeHref, /^\/shop\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/);
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
  assert.equal(jcNewman.origin, "Honduras/Nicaragua");
  assert.equal(jcNewman.wrapper, "Varies by selection");
  assert.equal(jcNewman.vitola, "Toro Gordo");
  assert.equal(jcNewman.length, '6"');
  assert.equal(jcNewman.gauge, "60");
  assert.equal(jcNewman.strength, "Medium-Full");
});

test("catalog products expose researched cigar blend and size specs", () => {
  const productsBySlug = new Map(catalogProducts.map((product) => [product.slug, product]));

  assert.deepEqual(
    [
      productsBySlug.get("acid-20-twenty-year-24-bx"),
      productsBySlug.get("acid-kuba-kuba-24-bx"),
      productsBySlug.get("deadwood-dominicana-noches-robusto-10-bx"),
      productsBySlug.get("h-upmann-nicaragua-sunrise-toro-20-bx"),
      productsBySlug.get("oliva-serie-v-melanio-maduro-dbl-toro-10-bx"),
      productsBySlug.get("plasencia-explorer-sampler-6-bx"),
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
      ['5"', "54", "Connecticut Broadleaf", "Mexican San Andres", "Dominican Republic, Nicaragua"],
      ['6"', "54", "Ecuadorian Connecticut", "Nicaragua", "Nicaragua"],
      ['6"', "60", "Mexican San Andres Maduro", "Nicaragua", "Nicaragua"],
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

test("product detail hero image is formatted as a full product shot", () => {
  const source = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  assert.ok(source.includes('data-product-main-image="contained"'), "missing contained product image marker");
  assert.ok(source.includes("object-contain"), "main product image should use contain instead of crop");
  assert.equal(source.includes("scale-125"), false, "main product image should not be enlarged beyond its frame");
  assert.equal(source.includes("bg-gradient-to-t from-yuzu-night/95"), false, "main product image should not be obscured by the old bottom fade");
});

test("product detail metadata rows can wrap long values on mobile", () => {
  const source = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  assert.ok(source.includes("break-all"), "long metadata values should wrap instead of widening the page");
  assert.ok(source.includes("min-w-0"), "product detail panels should allow mobile grid items to shrink");
});

test("product cards and detail pages render icon-led cigar specs and review panels", () => {
  const productCardSource = readFileSync(new URL("../src/components/product-card.tsx", import.meta.url), "utf8");
  const productPageSource = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");

  for (const icon of ["Cigarette", "Ruler", "Gauge", "Flame"]) {
    assert.ok(productCardSource.includes(icon), `product cards should import ${icon}`);
    assert.ok(productPageSource.includes(icon), `product detail page should import ${icon}`);
  }

  for (const label of ["Product", "Length", "Gauge", "Strength"]) {
    assert.ok(productCardSource.includes(label), `product cards should show ${label}`);
    assert.ok(productPageSource.includes(label), `product detail page should show ${label}`);
  }

  assert.ok(productPageSource.includes("Ratings & Reviews"), "product detail page should include review research");
  assert.ok(productPageSource.includes("expertReview"), "product detail page should use researched review metadata");
});

test("Medusa product projection keeps prices in display units", () => {
  const medusaProduct = toMedusaProduct(featuredLuxuryProducts[0]);

  assert.equal(medusaProduct.variants[0].prices[0].amount, featuredLuxuryProducts[0].price);
});
