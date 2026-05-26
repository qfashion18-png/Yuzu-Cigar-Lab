import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const videoLibrarySource = readFileSync(new URL("../src/components/education-video-library.tsx", import.meta.url), "utf8");

test("education video library renders as a compact video shelf", () => {
  assert.ok(videoLibrarySource.includes('data-education-video-library="compact"'));
  assert.ok(videoLibrarySource.includes("lg:grid-cols-3 2xl:grid-cols-4"));
  assert.ok(videoLibrarySource.includes("max-h-44"));
  assert.ok(videoLibrarySource.includes("font-heading text-lg leading-snug"));
  assert.equal(videoLibrarySource.includes("sm:text-3xl"), false);
});
