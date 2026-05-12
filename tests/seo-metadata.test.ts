import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { storefrontProducts } from "../src/lib/catalog";
import { events } from "../src/lib/data";
import { siteUrl } from "../src/lib/site";

const productPageSource = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");
const rootLayoutSource = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const publicPageMetadataSources = [
  ["shop", readFileSync(new URL("../src/app/shop/page.tsx", import.meta.url), "utf8")],
  ["membership", readFileSync(new URL("../src/app/membership/page.tsx", import.meta.url), "utf8")],
  ["events", readFileSync(new URL("../src/app/events/page.tsx", import.meta.url), "utf8")],
] as const;

test("sitemap includes public products and event detail URLs with static-export-safe metadata", () => {
  const urls = sitemap().map((entry) => entry.url);
  const product = storefrontProducts.find((item) => item.slug === "acid-20-twenty-year-24-bx");
  const event = events.find((item) => item.slug === "aire-by-puro-open-event");

  assert.ok(product);
  assert.ok(event);
  assert.ok(urls.includes(`${siteUrl}/shop/${product.slug}/`));
  assert.ok(urls.includes(`${siteUrl}/events/${event.slug}/`));

  const productEntry = sitemap().find((entry) => entry.url === `${siteUrl}/shop/${product.slug}/`);
  const eventEntry = sitemap().find((entry) => entry.url === `${siteUrl}/events/${event.slug}/`);

  assert.equal(productEntry?.changeFrequency, "weekly");
  assert.equal(productEntry?.priority, 0.8);
  assert.ok(productEntry?.lastModified, "product sitemap entries should expose lastModified");
  assert.equal(eventEntry?.changeFrequency, "weekly");
});

test("product detail pages expose canonical metadata and ecommerce JSON-LD", () => {
  assert.ok(productPageSource.includes("alternates"), "product metadata should define canonical URLs");
  assert.ok(productPageSource.includes("openGraph"), "product metadata should define social share data");
  assert.ok(productPageSource.includes('type: "Product"'), "product JSON-LD should use schema.org Product");
  assert.ok(productPageSource.includes('type: "BreadcrumbList"'), "product pages should include breadcrumb JSON-LD");
  assert.ok(productPageSource.includes('"application/ld+json"'), "structured data should render as JSON-LD script tags");
  assert.ok(productPageSource.includes("priceCurrency"), "product offers should include currency");
  assert.ok(productPageSource.includes("availability"), "product offers should include dynamic availability");
});

test("public listing pages own their canonical metadata instead of inheriting home", () => {
  assert.equal(rootLayoutSource.includes("canonical: \"/\""), false, "root layout should not canonicalize every route to home");

  for (const [route, source] of publicPageMetadataSources) {
    assert.ok(source.includes("export const metadata"), `${route} should export route-specific metadata`);
    assert.ok(source.includes(`canonical: "/${route}"`), `${route} should define its own canonical URL`);
    assert.ok(source.includes("openGraph"), `${route} should expose route-specific social metadata`);
  }
});

test("robots allows public catalog indexing while excluding internal operations pages", () => {
  const value = robots();
  const rules = Array.isArray(value.rules) ? value.rules : [value.rules];
  const publicRule = rules.find((rule) => rule.userAgent === "*");

  assert.ok(publicRule);
  assert.deepEqual(publicRule.allow, "/");
  assert.deepEqual(publicRule.disallow, ["/admin/", "/account/", "/checkout/"]);
  assert.equal(value.sitemap, `${siteUrl}/sitemap.xml`);
});
