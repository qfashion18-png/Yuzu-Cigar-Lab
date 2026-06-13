import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { navItems } from "../src/lib/data";

const pageSource = readFileSync(new URL("../src/app/friends-family/page.tsx", import.meta.url), "utf8");
const claimSource = readFileSync(new URL("../src/components/friends-family-pass-claim.tsx", import.meta.url), "utf8");

test("friends and family page is unlinked and claims the yearly Box Access Pass offer", () => {
  assert.equal(navItems.some((item) => item.href === "/friends-family"), false, "invite page should not be in visible site navigation");
  assert.ok(pageSource.includes('noIndex: true'), "invite page should publish noindex metadata");
  assert.ok(pageSource.includes('Friends & Family Box Pass'), "page should use the requested headline");
  assert.ok(pageSource.includes('1 year of Box Access Pass access'), "page should explain the annual pass");
  assert.ok(claimSource.includes('tierName: "Box Access Pass"'), "claim flow should target Box Access Pass");
  assert.ok(claimSource.includes('billingPeriod: "yearly"'), "claim flow should request yearly billing");
  assert.ok(claimSource.includes('trialPeriodDays: 365'), "claim flow should attach the one-year offer");
  assert.ok(claimSource.includes('Claim 1-Year Pass'), "primary CTA should match the offer");
  assert.ok(claimSource.includes('Create Yuzu Account'), "unsigned visitors should have a Yuzu-branded signup path");
  assert.ok(claimSource.includes('Sign In and Claim Pass'), "existing users should have a Yuzu-branded signin path");
  assert.ok(claimSource.includes('Confirm and Claim Pass'), "new users should confirm Cognito signup without leaving the page");
  assert.ok(claimSource.includes('Yuzu Cigar Club verification code'), "confirmation help should point users to the branded code email");
  assert.equal(claimSource.includes("startCognitoLogin"), false, "invite claim should not send users to hosted Cognito");
});
