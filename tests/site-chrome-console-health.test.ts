import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const siteHeaderSource = readFileSync(new URL("../src/components/site-header.tsx", import.meta.url), "utf8");
const floatingConciergeSource = readFileSync(new URL("../src/components/floating-concierge.tsx", import.meta.url), "utf8");
const motionPrimitivesSource = readFileSync(new URL("../src/components/motion-primitives.tsx", import.meta.url), "utf8");
const referenceImageSource = readFileSync(new URL("../src/components/reference-image.tsx", import.meta.url), "utf8");
const customHttpSource = readFileSync(new URL("../customHttp.yml", import.meta.url), "utf8");

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

test("floating concierge plays synthesized speech through CSP-allowed blob URLs", () => {
  assert.ok(customHttpSource.includes("media-src 'self' blob:"), "production CSP should allow blob media playback");
  assert.ok(floatingConciergeSource.includes("URL.createObjectURL"), "Polly audio should be converted to a blob URL before playback");
  assert.ok(floatingConciergeSource.includes("URL.revokeObjectURL"), "temporary speech blob URLs should be released");
  assert.equal(floatingConciergeSource.includes("new Audio(`data:"), false, "data URI audio is blocked by the deployed media-src CSP");
  assert.equal(
    floatingConciergeSource.includes("!voiceEnabled || !speech?.audioBase64"),
    false,
    "an existing synthesized reply should remain playable even if voice is later toggled off"
  );
});

test("floating concierge renders AI replies as readable text blocks", () => {
  assert.ok(floatingConciergeSource.includes("formatConciergeReply"), "raw AI reply text should be normalized before rendering");
  assert.ok(floatingConciergeSource.includes("replyBlocks.map"), "reply blocks should be rendered individually");
  assert.ok(floatingConciergeSource.includes('block.type === "list"'), "markdown-style recommendation runs should render as lists");
  assert.ok(floatingConciergeSource.includes("cleanConciergeText"), "markdown emphasis markers should not be shown to members");
  assert.equal(floatingConciergeSource.includes("{response.reply}</p>"), false, "the widget should not render the reply as one raw paragraph");
});
