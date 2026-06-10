import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Metadata } from "next";

import { generateMetadata as generateEventMetadata } from "../src/app/events/[slug]/page";
import { metadata as eventsMetadata } from "../src/app/events/page";
import { metadata as membershipMetadata } from "../src/app/membership/page";
import { metadata as friendsFamilyMetadata } from "../src/app/friends-family/page";
import { generateMetadata as generateProductMetadata } from "../src/app/shop/[slug]/page";
import { metadata as shopMetadata } from "../src/app/shop/page";
import robots from "../src/app/robots";
import sitemap from "../src/app/sitemap";
import { getCatalogProductDetails, storefrontProducts } from "../src/lib/catalog";
import { events } from "../src/lib/data";
import { buildProductJsonLd } from "../src/lib/seo";
import { getCategorySlug } from "../src/lib/seo-content";
import { siteUrl } from "../src/lib/site";
import { metadata as privacyMetadata } from "../src/app/privacy/page";
import { metadata as termsMetadata } from "../src/app/terms/page";

const homePageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const productPageSource = readFileSync(new URL("../src/app/shop/[slug]/page.tsx", import.meta.url), "utf8");
const productCardSource = readFileSync(new URL("../src/components/product-card.tsx", import.meta.url), "utf8");
const eventPageSource = readFileSync(new URL("../src/app/events/[slug]/page.tsx", import.meta.url), "utf8");
const rootLayoutSource = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const privateRouteMetadataSources = [
  ["account", readFileSync(new URL("../src/app/account/page.tsx", import.meta.url), "utf8")],
  ["cart", readFileSync(new URL("../src/app/cart/page.tsx", import.meta.url), "utf8")],
  ["checkout", readFileSync(new URL("../src/app/checkout/page.tsx", import.meta.url), "utf8")],
  ["admin", readFileSync(new URL("../src/app/admin/layout.tsx", import.meta.url), "utf8")],
] as const;
const publicPageMetadataSources = [
  ["shop", readFileSync(new URL("../src/app/shop/page.tsx", import.meta.url), "utf8")],
  ["membership", readFileSync(new URL("../src/app/membership/page.tsx", import.meta.url), "utf8")],
  ["events", readFileSync(new URL("../src/app/events/page.tsx", import.meta.url), "utf8")],
  ["privacy", readFileSync(new URL("../src/app/privacy/page.tsx", import.meta.url), "utf8")],
  ["terms", readFileSync(new URL("../src/app/terms/page.tsx", import.meta.url), "utf8")],
] as const;
const publicPageMetadataValues = [
  ["shop", shopMetadata],
  ["membership", membershipMetadata],
  ["events", eventsMetadata],
  ["privacy", privacyMetadata],
  ["terms", termsMetadata],
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

test("sitemap canonical URLs match trailing-slash static export routes", () => {
  const urls = sitemap().map((entry) => entry.url);
  const luxuryCategoryPath = `/shop/categories/${getCategorySlug("Luxury Cigars ($300+)")}/`;

  assert.ok(urls.includes(`${siteUrl}/shop/`), "shop should use the exported trailing-slash route");
  assert.equal(urls.includes(`${siteUrl}/shop`), false, "shop should not have a duplicate non-trailing URL");
  assert.ok(urls.includes(`${siteUrl}/privacy/`), "policy pages should use trailing-slash canonical sitemap URLs");
  assert.ok(urls.includes(`${siteUrl}/terms/`), "terms pages should use trailing-slash canonical sitemap URLs");
  assert.ok(urls.includes(`${siteUrl}${luxuryCategoryPath}`), "rich category sitemap URL should be present");
  assert.equal(
    urls.some((url) => new URL(url).pathname === "/shop/" && new URL(url).searchParams.has("category")),
    false,
    "category sitemap URLs should not duplicate the shop filter query route"
  );
});

test("public sitemap entries expose route images for Google image discovery", () => {
  const entries = sitemap();
  const homeEntry = entries.find((entry) => entry.url === `${siteUrl}/`);
  const shopEntry = entries.find((entry) => entry.url === `${siteUrl}/shop/`);
  const membershipEntry = entries.find((entry) => entry.url === `${siteUrl}/membership/`);

  assert.deepEqual(homeEntry?.images, [`${siteUrl}/assets/hero-boxes.png`]);
  assert.deepEqual(shopEntry?.images, [`${siteUrl}/assets/shop-hero.png`]);
  assert.deepEqual(membershipEntry?.images, [`${siteUrl}/assets/membership-boxes.png`]);
});

test("generated detail metadata carries complete canonical social cards", async () => {
  const product = storefrontProducts.find((item) => item.slug === "acid-20-twenty-year-24-bx");
  const event = events.find((item) => item.slug === "aire-by-puro-open-event");

  assert.ok(product);
  assert.ok(event);

  const productMetadata = await generateProductMetadata({ params: Promise.resolve({ slug: product.slug }) });
  const eventMetadata = await generateEventMetadata({ params: Promise.resolve({ slug: event.slug }) });

  assertCompleteSocialMetadata(productMetadata, `/shop/${product.slug}/`);
  assertCompleteSocialMetadata(eventMetadata, `/events/${event.slug}/`);
});

test("product detail pages expose canonical metadata and ecommerce JSON-LD", () => {
  const product = storefrontProducts.find((item) => item.slug === "acid-20-twenty-year-24-bx");

  assert.ok(product);

  const productJsonLd = buildProductJsonLd(product, getCatalogProductDetails(product)) as {
    [key: string]: unknown;
    offers?: { [key: string]: unknown };
  };

  assert.ok(productPageSource.includes("buildPageMetadata"), "product metadata should use the shared canonical/social helper");
  assert.ok(productPageSource.includes("buildProductJsonLd"), "product JSON-LD should use the shared Product builder");
  assert.ok(productPageSource.includes("buildBreadcrumbJsonLd"), "product pages should include breadcrumb JSON-LD");
  assert.ok(productPageSource.includes("jsonLdScriptProps"), "structured data should render as safe JSON-LD script tags");
  assert.equal(productJsonLd["@type"], "Product");
  assert.equal(productJsonLd.sku, product.sku);
  assert.equal(productJsonLd.offers?.priceCurrency, "USD");
  assert.equal(typeof productJsonLd.offers?.availability, "string");
});

test("product image metadata and rendered product surfaces use descriptive product alt text", async () => {
  const product = storefrontProducts.find((item) => item.slug === "acid-20-twenty-year-24-bx");

  assert.ok(product);

  const metadata = await generateProductMetadata({ params: Promise.resolve({ slug: product.slug }) });
  const openGraph = metadata.openGraph as {
    images?: Array<{ alt?: string }>;
  };
  const [image] = openGraph.images ?? [];

  assert.ok(image?.alt);
  assert.match(image.alt, /ACID 20 TWENTY YEAR 24\/BX/);
  assert.match(image.alt, /Box of 24/);
  assert.match(image.alt, /Mexican San Andres Maduro wrapper/);
  assert.doesNotMatch(image.alt, /\bproduct image\b|\bpremium cigar box$/i);
  assert.ok(productPageSource.includes("buildProductImageAlt(product"), "product detail image alt should use the shared image SEO helper");
  assert.ok(productCardSource.includes("buildProductImageAlt(product"), "product cards should use the shared image SEO helper");
});

test("public structured data covers brand, site search context, products, events, and breadcrumbs", () => {
  assert.ok(homePageSource.includes("buildOrganizationJsonLd"), "home page should expose Organization JSON-LD");
  assert.ok(homePageSource.includes("buildWebsiteJsonLd"), "home page should expose WebSite JSON-LD");
  assert.ok(productPageSource.includes("buildProductJsonLd"), "product pages should use the shared Product JSON-LD builder");
  assert.ok(productPageSource.includes("jsonLdScriptProps"), "JSON-LD should be serialized through the safe shared script helper");
  assert.ok(eventPageSource.includes("buildEventJsonLd"), "event detail pages should expose Event JSON-LD");
  assert.ok(eventPageSource.includes("buildBreadcrumbJsonLd"), "event detail pages should expose BreadcrumbList JSON-LD");
});

test("public listing pages own their canonical metadata instead of inheriting home", () => {
  assert.equal(rootLayoutSource.includes("canonical: \"/\""), false, "root layout should not canonicalize every route to home");

  for (const [route, source] of publicPageMetadataSources) {
    assert.ok(source.includes("export const metadata"), `${route} should export route-specific metadata`);
    assert.ok(source.includes("buildPageMetadata"), `${route} should use the shared route metadata helper`);
  }

  for (const [route, metadata] of publicPageMetadataValues) {
    assertCompleteSocialMetadata(metadata, `/${route}/`);
  }
});

test("private commerce, account, and admin routes opt out of indexing at metadata layer", () => {
  for (const [route, source] of privateRouteMetadataSources) {
    assert.match(source, /privatePageMetadata|noIndexPageMetadata|index:\s*false/, `${route} should publish noindex metadata`);
  }
});

test("friends and family invite route is hidden from public discovery", () => {
  const value = robots();
  const urls = sitemap().map((entry) => entry.url);
  const rules = Array.isArray(value.rules) ? value.rules : [value.rules];
  const publicRule = rules.find((rule) => rule.userAgent === "*");
  const robotsMetadata = friendsFamilyMetadata.robots as { index?: boolean; follow?: boolean };

  assert.equal(robotsMetadata.index, false);
  assert.equal(robotsMetadata.follow, false);
  assert.equal(friendsFamilyMetadata.alternates?.canonical, "/friends-family/");
  assert.equal(urls.includes(`${siteUrl}/friends-family/`), false, "hidden invite page should not be listed in sitemap");
  assert.ok(publicRule?.disallow?.includes("/friends-family/"), "robots should disallow the hidden invite route");
});

test("robots allows public catalog indexing while excluding internal operations pages", () => {
  const value = robots();
  const urls = sitemap().map((entry) => entry.url);
  const rules = Array.isArray(value.rules) ? value.rules : [value.rules];
  const publicRule = rules.find((rule) => rule.userAgent === "*");

  assert.ok(publicRule);
  assert.deepEqual(publicRule.allow, "/");
  assert.deepEqual(publicRule.disallow, ["/admin/", "/account/", "/auth/", "/cart/", "/checkout/", "/friends-family/"]);
  assert.equal(urls.includes(`${siteUrl}/account/`), false, "sitemap should not list account pages blocked by robots");
  assert.equal(urls.includes(`${siteUrl}/cart/`), false, "sitemap should not list cart pages blocked by robots");
  assert.equal(urls.includes(`${siteUrl}/checkout/`), false, "sitemap should not list checkout pages blocked by robots");
  assert.ok(urls.includes(`${siteUrl}/privacy/`), "sitemap should list the privacy policy for production trust review");
  assert.ok(urls.includes(`${siteUrl}/terms/`), "sitemap should list the terms page for production trust review");
  assert.equal(value.sitemap, `${siteUrl}/sitemap.xml`);
});

function assertCompleteSocialMetadata(metadata: Metadata, canonicalPath: string) {
  const openGraph = metadata.openGraph as {
    siteName?: string;
    type?: string;
    url?: string | URL;
    images?: unknown;
  };
  const twitter = metadata.twitter as {
    card?: string;
    images?: unknown;
  };

  assert.equal(metadata.alternates?.canonical, canonicalPath);
  assert.equal(openGraph.siteName, "Yuzu Cigar Club");
  assert.equal(openGraph.type, "website");
  assert.equal(openGraph.url, canonicalPath);
  assert.ok(Array.isArray(openGraph.images), "Open Graph should include image metadata");
  assert.equal(twitter.card, "summary_large_image");
  assert.ok(Array.isArray(twitter.images), "Twitter should include image metadata");
}
