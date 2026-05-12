import assert from "node:assert/strict";
import test from "node:test";

import { cigarEducationStories } from "../src/lib/data";
import { filterJournalArticles, journalArticles } from "../src/lib/education-journal";

test("journal article filters combine category and search text", () => {
  const filtered = filterJournalArticles(journalArticles, {
    category: "Pairings",
    query: "whiskey",
  });

  assert.deepEqual(
    filtered.map((article) => article.title),
    ["Pairing Maduro with Whiskey"]
  );
});

test("journal article filters return every article for all articles with no search", () => {
  assert.equal(
    filterJournalArticles(journalArticles, { category: "All Articles", query: "" }).length,
    journalArticles.length
  );
});

test("journal stories expose valid reader targets", () => {
  const storyIds = new Set(cigarEducationStories.map((story) => story.storyId));
  const storyTargets = new Map(journalArticles.map((article) => [article.title, article.storyId]));

  assert.ok(storyTargets.has("2026 Vintage Preview"));
  assert.equal(storyTargets.has("2024 Vintage Preview"), false);

  for (const [title, storyId] of storyTargets) {
    assert.ok(storyId, `${title} should open a reader story`);
    assert.ok(storyIds.has(storyId), `${title} points at missing story ${storyId}`);
  }

  assert.equal(storyTargets.get("How to Age a Box the Right Way"), "aging-window");
  assert.equal(storyTargets.get("Notes from Nicaragua"), "notes-nicaragua");
  assert.equal(storyTargets.get("Pairing Maduro with Whiskey"), "pairing-maduro-whiskey");
  assert.equal(storyTargets.get("2026 Vintage Preview"), "vintage-preview-2026");
  assert.equal(storyTargets.get("Building a Humidor Worth Keeping"), "humidor-worth-keeping");
});
