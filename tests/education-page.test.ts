import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import EducationPage from "../src/app/education/page";

test("education page uses the journal-style editorial layout", () => {
  const html = renderToStaticMarkup(createElement(EducationPage));

  const layout = html.indexOf('data-education-layout="journal"');
  const headline = html.indexOf("Stories Worth Savoring.");
  const featuredStory = html.indexOf("Featured Story");
  const articleFilters = html.indexOf("All Articles");
  const popularReads = html.indexOf("Popular Reads");
  const featuredLesson = html.indexOf("Featured Lesson");

  assert.ok(layout >= 0, "missing journal education layout marker");
  assert.ok(headline > layout, "headline should belong to journal layout");
  assert.ok(featuredStory > headline, "featured story should follow the editorial headline");
  assert.ok(articleFilters > featuredStory, "article filters should follow the hero");
  assert.ok(popularReads > articleFilters, "popular reads sidebar should follow article filters");
  assert.ok(featuredLesson > articleFilters, "featured lesson panel should anchor the story area");
});

test("education page starts as the main journal without the opened story view", () => {
  const html = renderToStaticMarkup(createElement(EducationPage));

  assert.ok(html.includes('data-story-trigger="featured-lesson"'), "missing featured story opener");
  assert.equal(html.includes('data-story-layout="focused-reader"'), false, "story reader should open only after a click");
});

test("education page renders clickable journal story targets", () => {
  const html = renderToStaticMarkup(createElement(EducationPage));

  assert.ok(html.includes("2026 Vintage Preview"));
  assert.equal(html.includes("2024 Vintage Preview"), false);

  for (const storyId of [
    "aging-window",
    "notes-nicaragua",
    "pairing-maduro-whiskey",
    "vintage-preview-2026",
    "humidor-worth-keeping",
  ]) {
    assert.ok(html.includes(`data-story-open-id="${storyId}"`), `missing journal opener for ${storyId}`);
  }
});
