import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const siteHeaderSource = readFileSync(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");
const floatingConciergeSource = readFileSync(new URL("../src/components/floating-concierge.tsx", import.meta.url), "utf8");
const motionPrimitivesSource = readFileSync(new URL("../src/components/motion-primitives.tsx", import.meta.url), "utf8");
const referenceImageSource = readFileSync(new URL("../src/components/reference-image.tsx", import.meta.url), "utf8");

test("site chrome keeps always-visible motion styles hydration-stable", () => {
  assert.ok(siteHeaderSource.includes("<motion.header"));
  assert.ok(siteHeaderSource.includes("initial={false}"));
  assert.equal(siteHeaderSource.includes("initial={shouldReduceMotion ? false : { opacity: 0, y: -18 }}"), false);
  assert.equal(siteHeaderSource.includes("initial={shouldReduceMotion ? false : { scale: 0.72 }}"), false);

  assert.ok(floatingConciergeSource.includes('data-concierge-launcher="sitewide"'));
  assert.ok(floatingConciergeSource.includes("initial={false}"));
  assert.equal(floatingConciergeSource.includes("initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.9 }}"), false);

  assert.ok(motionPrimitivesSource.includes("export function PageFade"));
  assert.ok(motionPrimitivesSource.includes("initial={false}"));
  assert.equal(motionPrimitivesSource.includes("initial={shouldReduceMotion ? false : { opacity: 0 }}"), false);
});

test("priority reference images request eager loading for LCP candidates", () => {
  assert.ok(referenceImageSource.includes('loading={priority ? "eager" : "lazy"}'));
});
