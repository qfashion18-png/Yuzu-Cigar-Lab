import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guardrail = JSON.parse(readFileSync("infra/ycc-phase4-guardrail.json", "utf8"));

test("YCC guardrail avoids adult cigar editorial false positives while blocking underage tobacco", () => {
  const topics = guardrail.topicPolicyConfig.topicsConfig;
  const underageTopic = topics.find((topic: { name: string }) => topic.name === "MinorTobaccoBypass");
  const sexualOffDomainTopic = topics.find(
    (topic: { name: string }) => topic.name === "OffDomainSexualContent"
  );
  const sexualFilter = guardrail.contentPolicyConfig.filtersConfig.find(
    (filter: { type: string }) => filter.type === "SEXUAL"
  );

  assert.ok(underageTopic, "MinorTobaccoBypass topic must remain configured");
  assert.equal(underageTopic.inputAction, "BLOCK");
  assert.equal(underageTopic.inputEnabled, true);
  assert.match(underageTopic.definition, /Do not match adult members/i);

  assert.ok(sexualOffDomainTopic, "explicit off-domain sexual content should remain denied by topic");
  assert.equal(sexualOffDomainTopic.inputAction, "BLOCK");
  assert.match(sexualOffDomainTopic.definition, /unrelated to adult cigar/i);

  assert.ok(sexualFilter, "SEXUAL content filter must remain present for output assessment");
  assert.equal(sexualFilter.inputStrength, "NONE");
  assert.equal(sexualFilter.inputAction, "NONE");
  assert.equal(sexualFilter.inputEnabled, true);
});
