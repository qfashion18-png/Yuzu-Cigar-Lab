import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BrandMark } from "../src/components/brand-mark";

test("brand mark logo uses explicit image dimensions instead of fill layout", () => {
  const html = renderToStaticMarkup(createElement(BrandMark));

  assert.match(html, /src="\/assets\/yuzu-logo\.png"/);
  assert.match(html, /width="48"/);
  assert.match(html, /height="48"/);
  assert.equal(html.includes('data-nimg="fill"'), false);
});

test("compact brand mark still renders the visible wordmark", () => {
  const html = renderToStaticMarkup(createElement(BrandMark, { compact: true }));

  assert.match(html, />YUZU</);
  assert.match(html, />Cigar Club</);
  assert.equal(html.includes("hidden sm:flex"), false);
});
