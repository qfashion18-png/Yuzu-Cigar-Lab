import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceWorker = readFileSync("public/sw.js", "utf8");

test("service worker uses a fresh cache version for the deployment", () => {
  assert.match(serviceWorker, /CACHE_NAME = "yuzu-cigar-club-v3"/);
});

test("service worker checks the network before cached navigation pages", () => {
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);

  const networkLookup = serviceWorker.indexOf("fetch(event.request)");
  const cacheFallback = serviceWorker.indexOf("caches.match(event.request)");

  assert.ok(networkLookup >= 0, "navigation handler should request the network first");
  assert.ok(cacheFallback > networkLookup, "cached navigation pages should only be fallback responses");
});

test("service worker constrains notification click targets to same-origin paths", () => {
  assert.match(serviceWorker, /function getSafeNotificationTargetUrl/);
  assert.match(serviceWorker, /target\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /return self\.clients\.openWindow\(targetUrl\)/);
});
