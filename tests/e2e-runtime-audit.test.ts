import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  extractCssUrlReferences,
  extractHtmlRouteLinks,
  extractHtmlRuntimeReferences,
  isExternalReference,
  routeFromOutHtmlPath,
} from "../scripts/e2e-runtime-audit";

test("maps exported html files to static-preview routes", () => {
  assert.equal(routeFromOutHtmlPath("out", path.join("out", "index.html")), "/");
  assert.equal(routeFromOutHtmlPath("out", path.join("out", "shop", "index.html")), "/shop/");
  assert.equal(routeFromOutHtmlPath("out", path.join("out", "shop", "padron", "index.html")), "/shop/padron/");
  assert.equal(routeFromOutHtmlPath("out", path.join("out", "404.html")), null);
  assert.equal(routeFromOutHtmlPath("out", path.join("elsewhere", "index.html")), null);
});

test("extracts runtime asset references from html without treating anchors as assets", () => {
  const html = `
    <link rel="stylesheet" href="/_next/static/css/app.css" />
    <link rel="preload" as="image" href="/assets/hero-boxes.png" />
    <link rel="canonical" href="https://www.yuzucigarclub.com/shop/" />
    <script src="/_next/static/chunks/app.js" async></script>
    <img src="/assets/yuzu-logo.png" srcset="/assets/yuzu-logo-180.png 180w, https://cdn.example.test/logo.png 2x" />
    <source src="/assets/yuzu-product-promo.mp4" />
    <a href="/shop/">Shop</a>
  `;

  assert.deepEqual(extractHtmlRuntimeReferences(html).sort(), [
    "/_next/static/chunks/app.js",
    "/_next/static/css/app.css",
    "/assets/hero-boxes.png",
    "/assets/yuzu-logo-180.png",
    "/assets/yuzu-logo.png",
    "/assets/yuzu-product-promo.mp4",
  ]);
});

test("extracts internal route links separately from runtime assets", () => {
  const html = `
    <a href="/shop/">Shop</a>
    <a href="/shop/?category=Humidors#catalog">Humidors</a>
    <a href="#catalog">Catalog</a>
    <a href="mailto:hello@example.test">Email</a>
    <a href="https://example.test/events/">External</a>
  `;

  assert.deepEqual(extractHtmlRouteLinks(html), ["/shop/", "/shop/?category=Humidors#catalog"]);
});

test("extracts local css url references while ignoring external and data urls", () => {
  const css = `
    .hero { background: url("/assets/hero-boxes.png"); }
    .logo { mask-image: url('../icons/yuzu.svg'); }
    .skip { background: url(data:image/svg+xml;base64,AAAA); }
    .cdn { background: url("https://cdn.example.test/image.png"); }
  `;

  assert.deepEqual(extractCssUrlReferences(css), ["/assets/hero-boxes.png", "../icons/yuzu.svg"]);
});

test("classifies external references and local references", () => {
  assert.equal(isExternalReference("https://example.test/app.js"), true);
  assert.equal(isExternalReference("//cdn.example.test/app.js"), true);
  assert.equal(isExternalReference("data:image/svg+xml;base64,AAAA"), true);
  assert.equal(isExternalReference("mailto:hello@example.test"), true);
  assert.equal(isExternalReference("#section"), true);
  assert.equal(isExternalReference("/_next/static/app.js"), false);
  assert.equal(isExternalReference("../icons/yuzu.svg"), false);
});
