import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const videoLibrarySource = readFileSync(new URL("../src/components/education-video-library.tsx", import.meta.url), "utf8");

test("education video library renders as a curated four-video story shelf", () => {
  assert.ok(videoLibrarySource.includes('data-education-video-library="compact"'));
  assert.equal(videoLibrarySource.match(/videoSrc: "\/assets\//g)?.length, 4);
  assert.ok(videoLibrarySource.includes('videoSrc: "/assets/yuzu-founder-brand-story.mp4"'));
  assert.ok(videoLibrarySource.includes('videoSrc: "/assets/yuzu-box-only-storefront-promo.mp4"'));
  assert.ok(videoLibrarySource.includes('videoSrc: "/assets/yuzu-membership-tiers-promo.mp4"'));
  assert.ok(videoLibrarySource.includes('videoSrc: "/assets/yuzu-digital-humidor-notification-promo.mp4"'));
  assert.equal(videoLibrarySource.includes("/assets/digital-humidor-explainer.mp4"), false);
  assert.equal(videoLibrarySource.includes("/assets/yuzu-full-website-overview.mp4"), false);
  assert.equal(videoLibrarySource.includes("/assets/yuzu-product-promo.mp4"), false);
});

test("education video library uses stable non-overlapping video card sizing", () => {
  assert.ok(videoLibrarySource.includes("grid-cols-1"));
  assert.ok(videoLibrarySource.includes("sm:grid-cols-2"));
  assert.ok(videoLibrarySource.includes("xl:grid-cols-4"));
  assert.ok(videoLibrarySource.includes("flex h-full min-w-0 flex-col"));
  assert.ok(videoLibrarySource.includes("relative aspect-video w-full shrink-0 overflow-hidden"));
  assert.ok(videoLibrarySource.includes("absolute inset-0 block h-full w-full object-contain"));
  assert.ok(videoLibrarySource.includes('preload="none"'));
  assert.equal(videoLibrarySource.includes("sm:text-3xl"), false);
  assert.equal(videoLibrarySource.includes("max-h-44"), false);
});
