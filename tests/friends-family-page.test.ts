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
  assert.ok(claimSource.includes('I already have a confirmation code'), "unconfirmed users should have a reload-safe confirmation recovery path");
  assert.ok(claimSource.includes('result.status === "confirmation_required"'), "unconfirmed sign-in should reopen the confirmation step");
  assert.ok(claimSource.includes('resend.status === "signed_up"'), "already-confirmed resend should move users back to sign-in");
  assert.ok(claimSource.includes('activateFriendsFamilyPass'), "pass activation should be split from sign-in so confirmed users get a Stripe billing profile");
  assert.ok(claimSource.includes("createBearerHeaders(signIn.session.tokens.idToken)"), "pass activation should send the signed-in Cognito token");
  assert.ok(claimSource.includes("createBearerHeaders(result.session.tokens.idToken)"), "sign-in claim should send the signed-in Cognito token");
  assert.ok(claimSource.includes("await auth.createApiHeaders()"), "already signed-in claim should use refreshed Cognito API headers");
  assert.equal(claimSource.includes("await activateFriendsFamilyPass(customer)"), false, "confirmation should not activate a pass before sign-in");
  assert.ok(claimSource.includes('if (!password)'), "recovered confirmations without a password should not stay stuck on the code form");
  assert.ok(claimSource.includes('setAuthMode("signin")'), "recovered confirmations should move confirmed users back to sign-in");
  assert.ok(claimSource.includes('Your Yuzu account is confirmed. Sign in below to claim the pass.'), "confirmed recovery should give clear sign-in guidance");
  assert.ok(claimSource.includes('Yuzu Cigar Club verification code'), "confirmation help should point users to the branded code email");
  assert.ok(claimSource.includes('"confirmation_code"'), "email return links should be able to prefill the confirmation code");
  assert.ok(claimSource.includes("window.localStorage.setItem(pendingConfirmationEmailStorageKey"), "same-browser confirmation links should remember the pending signup email");
  assert.ok(claimSource.includes("setConfirmationCode(normalizedCode)"), "return links should enter the code automatically");
  assert.ok(claimSource.includes("window.history.replaceState"), "return links should clean the confirmation code from the visible URL after capture");
  assert.ok(
    claimSource.indexOf("await auth.signInWithCognitoPassword({ username: email, password })") < claimSource.indexOf("createBearerHeaders(signIn.session.tokens.idToken)"),
    "Cognito confirmation should sign in before claiming the Friends & Family pass"
  );
  assert.equal(claimSource.includes("startCognitoLogin"), false, "invite claim should not send users to hosted Cognito");
});
