import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CigarEducationExperience } from "../src/components/cigar-education-experience";
import { cigarEducationStories } from "../src/lib/data";

test("education story reader is closed until opened from the journal", () => {
  const html = renderToStaticMarkup(
    createElement(CigarEducationExperience, { stories: cigarEducationStories })
  );

  assert.equal(html.includes('data-story-layout="focused-reader"'), false);
  assert.equal(html.includes('data-story-region="complete-story"'), false);
});

test("opened education story panels render as one focused reader with actions at the bottom", () => {
  const html = renderToStaticMarkup(
    createElement(CigarEducationExperience, { stories: cigarEducationStories, initialOpen: true })
  );

  const focusedReader = html.indexOf('data-story-layout="focused-reader"');
  const completeStory = html.indexOf('data-story-region="complete-story"');
  const readStory = html.indexOf("Read the Story");
  const tastingCue = html.indexOf("Tasting Cue");
  const practice = html.indexOf("Practice");
  const fieldNotes = html.indexOf("Field Notes");
  const cigarLab = html.indexOf("Cigar Lab");
  const humidorAction = html.indexOf("Humidor action");
  const storyActions = html.indexOf('data-story-actions="complete-story"');

  assert.ok(focusedReader >= 0, "missing focused reader layout");
  assert.ok(completeStory >= focusedReader, "complete story should be inside the focused reader layout");
  assert.ok(storyActions >= 0, "missing complete story action bar");
  assert.equal(html.includes("Learning Progress"), false, "focused reader should not include the old curriculum sidebar");

  for (const panel of [readStory, tastingCue, practice, fieldNotes, cigarLab]) {
    assert.ok(panel > completeStory, "story panel should be grouped in the complete story region");
  }

  assert.ok(storyActions > fieldNotes, "actions should render below field notes");
  assert.ok(storyActions > cigarLab, "actions should render below cigar lab");
  assert.ok(storyActions > humidorAction, "actions should render after the last story detail");
});

test("education story section establishes its own stacking context", () => {
  const html = renderToStaticMarkup(
    createElement(CigarEducationExperience, { stories: cigarEducationStories })
  );

  assert.match(
    html,
    /<section id="stories" class="[^"]*\brelative\b[^"]*\bz-10\b/,
    "story section should sit above the page-wide education backdrop"
  );
});

test("education story reader renders a controlled active story", () => {
  const html = renderToStaticMarkup(
    createElement(CigarEducationExperience, {
      stories: cigarEducationStories,
      initialOpen: true,
      activeStoryId: "strength-map",
    })
  );

  assert.ok(html.includes("Reading Strength Without Guessing"));
  assert.equal(html.includes("The Wrapper That Changed the Room"), false);
});
