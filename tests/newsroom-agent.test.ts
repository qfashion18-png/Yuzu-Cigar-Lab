import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNewsAgentPrompt,
  draftToBodyMarkdown,
  hasUsableNewsDraftReply,
  normalizeNewsDraftFromAgentReply,
  normalizeNewsSourceCandidate,
  type NewsroomDraftInput,
} from "../src/lib/newsroom";

const draftInput: NewsroomDraftInput = {
  angle: "Rocky Patel official release update",
  timeframe: "this week",
  sourceUrls: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
  sourceNotes: ["Rocky Patel announced availability details on its official cigar news page."],
};

test("newsroom source vetting accepts official brand locations and blocks magazine rewrites", () => {
  const official = normalizeNewsSourceCandidate("https://www.rockypatel.com/cigar-news/sixty-release/");
  assert.equal(official.status, "official");
  assert.equal(official.domain, "rockypatel.com");

  const secondary = normalizeNewsSourceCandidate("https://halfwheel.com/rocky-patel-release-story/");
  assert.equal(secondary.status, "blocked_secondary");
  assert.match(secondary.reviewNote, /do not rewrite/i);
});

test("news agent prompt requires primary-source facts, attribution, and human approval", () => {
  const prompt = buildNewsAgentPrompt(draftInput);

  assert.match(prompt, /rockypatel\.com\/cigar-news\/sixty-release/);
  assert.match(prompt, /official brand/i);
  assert.match(prompt, /Do not rewrite magazine articles/i);
  assert.match(prompt, /human approval/i);
  assert.match(prompt, /Return JSON/i);
});

test("news draft normalization reads structured agent JSON and preserves compliance review", () => {
  const reply = [
    "```json",
    JSON.stringify({
      title: "Rocky Patel Updates Its Release Calendar",
      dek: "A concise official-source update for adult cigar readers.",
      category: "Industry News",
      sections: [
        {
          heading: "What changed",
          body: "Rocky Patel shared release timing and retail availability details through its official news channel.",
        },
      ],
      sourceNotes: [
        {
          label: "Rocky Patel",
          url: "https://www.rockypatel.com/cigar-news/sixty-release/",
          note: "Official brand news page.",
        },
      ],
    }),
    "```",
  ].join("\n");

  const draft = normalizeNewsDraftFromAgentReply(reply, draftInput);

  assert.equal(draft.title, "Rocky Patel Updates Its Release Calendar");
  assert.equal(draft.publishStatus, "draft");
  assert.equal(draft.operatorReviewRequired, true);
  assert.equal(draft.sections[0].heading, "What changed");
  assert.equal(draft.sourceNotes[0].sourceType, "official");
  assert.ok(draft.complianceReview.prohibitedClaims.includes("health"));
});

test("news draft fallback stays original and keeps every factual claim tied to review notes", () => {
  const draft = normalizeNewsDraftFromAgentReply("", draftInput);

  assert.match(draft.title, /Rocky Patel official release update/i);
  assert.equal(draft.sections.length >= 3, true);
  assert.equal(draft.sourceNotes[0].url, "https://www.rockypatel.com/cigar-news/sixty-release/");
  assert.match(draft.sections.at(-1)?.body || "", /Verify/i);
  assert.equal(draft.operatorReviewRequired, true);
});

test("news draft normalization prefers the full article body over a thinner section summary", () => {
  const reply = [
    "```json",
    JSON.stringify({
      title: "Rocky Patel Updates Its Release Calendar",
      dek: "A concise official-source update for adult cigar readers.",
      category: "Industry News",
      bodyMarkdown: [
        "## Release timing",
        "Rocky Patel shared release timing details through its official news channel, giving retailers and adult cigar readers a clearer window for the next rollout.",
        "",
        "## Availability outlook",
        "The update centered on availability and launch pacing rather than commentary, which gives operators a cleaner source trail for publication review.",
      ].join("\n"),
      sections: [
        {
          heading: "What changed",
          body: "Rocky Patel shared release timing and availability details.",
        },
      ],
      sourceNotes: [
        {
          label: "Rocky Patel",
          url: "https://www.rockypatel.com/cigar-news/sixty-release/",
          note: "Official brand news page.",
        },
      ],
    }),
    "```",
  ].join("\n");

  const draft = normalizeNewsDraftFromAgentReply(reply, draftInput);

  assert.equal(draft.sections[0].heading, "Release timing");
  assert.match(draft.sections[0].body, /clearer window for the next rollout/i);
  assert.equal(draft.sections[1].heading, "Availability outlook");
});

test("draft markdown output drops empty editorial sections", () => {
  const bodyMarkdown = draftToBodyMarkdown({
    sections: [
      {
        heading: "Release timing",
        body: "Rocky Patel shared release timing details through its official news channel.",
      },
      {
        heading: "Additional context",
        body: "   ",
      },
    ],
  });

  assert.match(bodyMarkdown, /## Release timing/);
  assert.doesNotMatch(bodyMarkdown, /## Additional context/);
});

test("news draft reply usability rejects missing and placeholder article bodies", () => {
  assert.equal(hasUsableNewsDraftReply(""), false);
  assert.equal(
    hasUsableNewsDraftReply(
      JSON.stringify({
        title: "Daily Cigar Flow Update",
        bodyMarkdown: [
          "## What changed",
          "Yuzu is tracking daily cigar flow based on the official source notes supplied for today. Keep this section factual and concise until an operator verifies each detail against the source URLs.",
          "",
          "## Why adult members may care",
          "Frame the update around release timing, availability, craftsmanship, events, or education value. Avoid sales pressure and do not make health, cessation, medical, therapeutic, disease, or safety claims.",
          "",
          "## Operator review notes",
          "Verify every product name, date, quote, MSRP, distributor note, and availability claim before publication. Attribute the company announcement and link to the primary source.",
        ].join("\n"),
      })
    ),
    false
  );
  assert.equal(
    hasUsableNewsDraftReply(
      JSON.stringify({
        title: "Rocky Patel Updates Its Release Calendar",
        bodyMarkdown: "## Release timing\nRocky Patel shared release timing details through its official news channel.",
      })
    ),
    true
  );
});
