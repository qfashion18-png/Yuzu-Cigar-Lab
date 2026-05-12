import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import sitemap from "../src/app/sitemap";
import { storefrontCategories, storefrontProductCards, storefrontProducts } from "../src/lib/catalog";

const shopPageSource = readFileSync(new URL("../src/app/shop/page.tsx", import.meta.url), "utf8");
const shopCatalogSource = readFileSync(new URL("../src/components/shop-catalog.tsx", import.meta.url), "utf8");
const newArrivalsPageSource = readFileSync(new URL("../src/app/new-arrivals/page.tsx", import.meta.url), "utf8");
const memberDropsPageSource = readFileSync(new URL("../src/app/member-drops/page.tsx", import.meta.url), "utf8");

test("shop category filters cover every storefront product category", () => {
  const storefrontCategoryNames = new Set(storefrontProducts.map((product) => product.category));
  const curatedBoxes = storefrontProducts.filter((product) => product.category === "Curated Boxes");

  for (const category of storefrontCategoryNames) {
    assert.ok(storefrontCategories.includes(category), `${category} should be available as a shop category filter`);
  }

  assert.equal(curatedBoxes.length, 0);
  assert.equal(storefrontCategories.includes("Curated Boxes"), false);
  assert.equal(storefrontCategories.length, storefrontCategoryNames.size);
});

test("shop category links preserve the selected category in the URL", () => {
  assert.ok(shopPageSource.includes("storefrontProductCards"), "shop page should pass the slim storefront product registry to the catalog");
  assert.ok(shopPageSource.includes("storefrontCategories"), "shop page should pass storefront categories to the catalog");
  assert.ok(
    shopPageSource.includes("getShopCategoryHref(category)"),
    "sidebar category links should point to a category-specific shop URL"
  );
  assert.equal(
    shopPageSource.includes('href="#catalog" className="border border-yuzu-line/65'),
    false,
    "sidebar category links should not collapse every category to the same #catalog anchor"
  );
});

test("shop listing payload omits detail-only catalog fields", () => {
  const fullPayloadSize = JSON.stringify(storefrontProducts).length;
  const cardPayloadSize = JSON.stringify(storefrontProductCards).length;

  assert.equal(storefrontProductCards.length, storefrontProducts.length);
  assert.ok(cardPayloadSize < fullPayloadSize * 0.55, "listing payload should stay well below the full product registry size");

  for (const product of storefrontProductCards) {
    const serializedProduct = JSON.stringify(product);

    assert.equal(serializedProduct.includes("sourceQuantity"), false);
    assert.equal(serializedProduct.includes("reviewSearchUrl"), false);
    assert.equal(serializedProduct.includes("tastingSummary"), false);
    assert.ok((product.description?.length ?? 0) <= 180, `${product.slug} listing description should stay compact`);
  }
});

test("shop catalog category filter syncs with URL search params", () => {
  assert.ok(shopCatalogSource.includes("categoryParamKey"), "catalog should define a stable category query parameter");
  assert.ok(shopCatalogSource.includes("window.history.pushState"), "category changes should write to browser history");
  assert.ok(shopCatalogSource.includes("window.location.search"), "catalog should read the category from the current URL");
  assert.ok(shopCatalogSource.includes('window.addEventListener("popstate"'), "catalog should react to browser back/forward navigation");
});

test("sitemap includes shareable shop category URLs", () => {
  const urls = sitemap().map((entry) => entry.url);
  const hasLuxuryCategoryUrl = urls.some((url) => {
    const parsedUrl = new URL(url);

    return parsedUrl.pathname === "/shop" && parsedUrl.searchParams.get("category") === "Luxury Cigars ($300+)";
  });
  const hasEmptyCuratedBoxesUrl = urls.some((url) => {
    const parsedUrl = new URL(url);

    return parsedUrl.pathname === "/shop" && parsedUrl.searchParams.get("category") === "Curated Boxes";
  });

  assert.ok(hasLuxuryCategoryUrl, "sitemap should include category-specific shop URLs");
  assert.equal(hasEmptyCuratedBoxesUrl, false, "sitemap should omit empty curated box category URLs");
});

test("secondary product listing pages use catalog product exports", () => {
  assert.ok(newArrivalsPageSource.includes('from "@/lib/catalog"'), "new arrivals should use catalog products");
  assert.ok(memberDropsPageSource.includes('from "@/lib/catalog"'), "member drops should use catalog products");
  assert.equal(newArrivalsPageSource.includes('from "@/lib/data"'), false, "new arrivals should not import removed product data");
  assert.equal(memberDropsPageSource.includes('from "@/lib/data"'), false, "member drops should not import removed product data");
});
