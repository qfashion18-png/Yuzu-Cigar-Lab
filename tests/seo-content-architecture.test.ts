import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import CategoryPage, { generateStaticParams as generateCategoryParams } from "../src/app/shop/categories/[slug]/page";
import sitemap from "../src/app/sitemap";
import { storefrontCategories } from "../src/lib/catalog";
import {
  getCategorySeoPage,
  getCategorySlug,
  getSeoGuide,
  getSeoLandingPage,
  seoFooterLinks,
  seoGuides,
  seoLandingPages,
} from "../src/lib/seo-content";
import { siteUrl } from "../src/lib/site";

const footerSource = readFileSync(new URL("../src/components/site-footer.tsx", import.meta.url), "utf8");
const landingPageSource = readFileSync(new URL("../src/components/seo-landing-page.tsx", import.meta.url), "utf8");
const guidePageSource = readFileSync(new URL("../src/app/guides/[slug]/page.tsx", import.meta.url), "utf8");
const categoryPageSource = readFileSync(new URL("../src/app/shop/categories/[slug]/page.tsx", import.meta.url), "utf8");
const interactiveGuideComponentUrl = new URL("../src/components/interactive-guide-experience.tsx", import.meta.url);

test("high-intent SEO landing pages cover the first ranking clusters", () => {
  const expectedSlugs = [
    "cigar-subscription",
    "cigar-gifts",
    "cigars-for-beginners",
    "humidor-guide",
    "limited-edition-cigars",
  ];

  assert.deepEqual(
    seoLandingPages.map((page) => page.slug),
    expectedSlugs
  );

  for (const slug of expectedSlugs) {
    const page = getSeoLandingPage(slug);

    assert.ok(page, `${slug} should resolve from the SEO landing registry`);
    assert.equal(page.path, `/${slug}/`);
    assert.ok(page.metadataTitle.length >= 35, `${slug} should have a search-ready title`);
    assert.ok(page.description.length >= 120, `${slug} should have a compelling meta description`);
    assert.ok(page.sections.length >= 3, `${slug} should have enough indexable body depth`);
    assert.ok(page.faqs.length >= 3, `${slug} should support FAQ rich understanding`);
    assert.ok(page.internalLinks.length >= 4, `${slug} should link into the wider cigar hub`);
  }
});

test("editorial guide pages cover the cigar education cluster with article and FAQ depth", () => {
  const expectedSlugs = [
    "wrapper-types",
    "cigar-strength",
    "cigar-pairings",
    "cigar-storage",
    "cigar-etiquette",
  ];

  assert.deepEqual(
    seoGuides.map((guide) => guide.slug),
    expectedSlugs
  );

  for (const slug of expectedSlugs) {
    const guide = getSeoGuide(slug);

    assert.ok(guide, `${slug} should resolve from the SEO guide registry`);
    assert.equal(guide.path, `/guides/${slug}/`);
    assert.ok(guide.sections.length >= 3, `${slug} should have article sections`);
    assert.ok(guide.faqs.length >= 3, `${slug} should have guide FAQs`);
    assert.ok(guide.internalLinks.some((link) => link.href.startsWith("/shop")), `${slug} should link to commercial intent`);
  }
});

test("rich category SEO pages cover every storefront category with stable slugs", () => {
  const params = generateCategoryParams();

  assert.equal(params.length, storefrontCategories.length);

  for (const category of storefrontCategories) {
    const slug = getCategorySlug(category);
    const page = getCategorySeoPage(slug);

    assert.ok(page, `${category} should have a rich category SEO page`);
    assert.ok(params.some((param) => param.slug === slug), `${category} should be statically generated`);
    assert.equal(page.category, category);
    assert.equal(page.path, `/shop/categories/${slug}/`);
    assert.ok(page.products.length > 0, `${category} should render product-grid candidates`);
    assert.ok(page.faqs.length >= 3, `${category} should publish category FAQs`);
    assert.ok(page.internalLinks.some((link) => link.href === "/shop/"), `${category} should link back to shop`);
  }

  assert.equal(getCategorySlug("Luxury Cigars ($300+)"), "luxury-cigars-300");
  assert.equal(getCategorySlug("Lighters / Torch"), "lighters-torch");
  assert.equal(typeof CategoryPage, "function");
});

test("sitemap promotes SEO landing, guide, and category pages without duplicate query category URLs", () => {
  const urls = sitemap().map((entry) => entry.url);
  const parsedUrls = urls.map((url) => new URL(url));

  for (const page of [...seoLandingPages, ...seoGuides]) {
    assert.ok(urls.includes(`${siteUrl}${page.path}`), `${page.path} should be in the sitemap`);
  }

  assert.ok(urls.includes(`${siteUrl}/shop/categories/luxury-cigars-300/`));
  assert.equal(
    parsedUrls.some((url) => url.pathname === "/shop/" && url.searchParams.has("category")),
    false,
    "sitemap should not split category equity across query URLs once rich category pages exist"
  );
});

test("SEO page templates expose safe structured data and crawlable internal links", () => {
  assert.ok(landingPageSource.includes("buildFaqPageJsonLd"), "landing pages should render FAQPage JSON-LD");
  assert.ok(landingPageSource.includes("buildCollectionPageJsonLd"), "landing pages should render CollectionPage JSON-LD");
  assert.ok(guidePageSource.includes("buildArticleJsonLd"), "guide pages should render Article JSON-LD");
  assert.ok(guidePageSource.includes("buildBreadcrumbJsonLd"), "guide pages should render breadcrumb JSON-LD");
  assert.ok(categoryPageSource.includes("ProductCard"), "category pages should render product-grid cards");
  assert.ok(categoryPageSource.includes("buildCollectionPageJsonLd"), "category pages should render CollectionPage JSON-LD");
  assert.ok(footerSource.includes("seoFooterLinks"), "footer should expose crawlable SEO hub links");
  assert.ok(seoFooterLinks.length >= 6, "footer should link to a compact set of SEO hubs");
});

test("editorial guide template is an interactive cigar-oriented reading experience", () => {
  assert.ok(
    guidePageSource.includes("InteractiveGuideExperience"),
    "guide pages should delegate the article body to an interactive client component"
  );
  assert.ok(existsSync(interactiveGuideComponentUrl), "interactive guide component should exist");

  const interactiveGuideSource = readFileSync(interactiveGuideComponentUrl, "utf8");

  assert.ok(interactiveGuideSource.includes('"use client"'), "interactive guide should hydrate as a client component");
  assert.ok(interactiveGuideSource.includes("data-guide-interactive"), "interactive guide should expose a stable QA hook");
  assert.ok(interactiveGuideSource.includes("aria-pressed"), "chapter controls should expose selected state");
  assert.ok(interactiveGuideSource.includes("Smoke Session"), "guide UX should be cigar-oriented, not a generic article shell");
  assert.ok(interactiveGuideSource.includes("setCompletedActions"), "guide UX should include local checklist progress");
});

test("editorial guides use dedicated luxury guide imagery", () => {
  const interactiveGuideSource = readFileSync(interactiveGuideComponentUrl, "utf8");

  for (const guide of seoGuides) {
    assert.match(guide.image, /^\/assets\/guides\/luxury-[a-z-]+\.png$/, `${guide.slug} should use a luxury guide hero asset`);
    assert.ok(existsSync(new URL(`../public${guide.image}`, import.meta.url)), `${guide.image} should exist in public assets`);
  }

  assert.ok(interactiveGuideSource.includes("ReferenceImage"), "interactive guide visual should use a real image asset");
  assert.ok(interactiveGuideSource.includes("atelierImage"), "interactive guide visual should support a dedicated luxury atelier image");
  assert.ok(
    existsSync(new URL("../public/assets/guides/luxury-guide-atelier.png", import.meta.url)),
    "interactive guide atelier image should exist in public assets"
  );
});
