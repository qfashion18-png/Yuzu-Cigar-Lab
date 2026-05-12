import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accountExperienceSource = readFileSync(new URL("../src/components/account-experience.tsx", import.meta.url), "utf8");
const backupAuthPanelSource = readFileSync(new URL("../src/components/backup-auth-panel.tsx", import.meta.url), "utf8");
const backupAuthProviderSource = readFileSync(new URL("../src/components/backup-auth-provider.tsx", import.meta.url), "utf8");
const cognitoTemplateSource = readFileSync(new URL("../infra/ycc-phase1-edge.yaml", import.meta.url), "utf8");

test("account experience only loads live account data with a Cognito API session", () => {
  assert.ok(accountExperienceSource.includes('auth.authSource !== "cognito"'), "backup sessions must not call live account APIs");
  assert.ok(accountExperienceSource.includes("Live API Session Required"), "backup sessions need a clear live-auth boundary state");
  assert.ok(accountExperienceSource.includes("BackupAuthPanel"), "account access should keep a visible sign-in path");
});

test("account Cognito sign-in is inline instead of an automatic redirect loop", () => {
  assert.ok(accountExperienceSource.includes("shouldShowInlineCognitoSignIn"));
  assert.equal(accountExperienceSource.includes("shouldStartSeamlessCognitoLogin"), false);
});

test("account page shows complete member account details after authentication", () => {
  assert.ok(accountExperienceSource.includes("Account Readiness"));
  assert.ok(accountExperienceSource.includes("Membership Details"));
  assert.ok(accountExperienceSource.includes("Shipping and Compliance"));
  assert.ok(accountExperienceSource.includes("Open Digital Humidor"));
});

test("account profile saves a shipping address for checkout reuse", () => {
  assert.ok(accountExperienceSource.includes("Shipping Address"), "account profile should expose saved shipping fields");
  assert.ok(accountExperienceSource.includes("shippingAddress"), "account profile should submit a saved shipping address");
  assert.ok(accountExperienceSource.includes("auth.updateAccountProfile({ name, phone, shippingAddress })"), "profile save should persist address with account details");
});

test("account page exposes the authenticated concierge chat surface", () => {
  assert.ok(accountExperienceSource.includes("sendConciergeChat"), "account page should call the live concierge chat API helper");
  assert.ok(accountExperienceSource.includes("ConciergeChatPanel"), "account page should mount the concierge chat panel for Cognito sessions");
  assert.ok(accountExperienceSource.includes("Yuzu Concierge"), "members should see a concrete concierge entry point");
});

test("Cognito password sign-in helper is wired through the account UI provider", () => {
  assert.ok(backupAuthProviderSource.includes("signInWithCognitoPassword"), "provider should expose the Cognito password sign-in action");
  assert.ok(backupAuthProviderSource.includes("writeStoredCognitoSession"), "successful Cognito password sign-in must persist the Cognito session");
  assert.ok(backupAuthPanelSource.includes("handleCognitoPasswordLogin"), "account panel should submit an inline Cognito password form");
  assert.ok(backupAuthPanelSource.includes("auth.signInWithCognitoPassword({ username: email, password })"), "account panel should call the provider Cognito password action");
  assert.equal(backupAuthProviderSource.includes("buildCognitoAuthorizeUrl"), false, "provider sign-in must not build a Hosted UI redirect");
  assert.equal(backupAuthProviderSource.includes("window.location.assign"), false, "provider sign-in must not navigate away from the app");
});

test("Cognito app client infrastructure enables the inline password auth flow", () => {
  assert.ok(cognitoTemplateSource.includes("ALLOW_USER_PASSWORD_AUTH"), "inline Cognito sign-in requires ALLOW_USER_PASSWORD_AUTH on the app client");
});
