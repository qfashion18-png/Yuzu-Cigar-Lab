import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const membershipJoinButtonPath = new URL("../src/components/membership-join-button.tsx", import.meta.url);

test("membership checkout failures are visible instead of silent", () => {
  const membershipJoinButtonSource = readFileSync(membershipJoinButtonPath, "utf8");

  assert.ok(membershipJoinButtonSource.includes("showStatus = true"), "membership buttons should show status by default");
  assert.ok(membershipJoinButtonSource.includes('role="status"'), "membership checkout errors should be announced");
  assert.ok(
    membershipJoinButtonSource.includes("statusMessage &&"),
    "status text should render only after a checkout error to avoid empty layout space"
  );
});

test("membership checkout requires an account email before opening Stripe", () => {
  const membershipJoinButtonSource = readFileSync(membershipJoinButtonPath, "utf8");

  assert.ok(
    membershipJoinButtonSource.includes("auth.session?.email"),
    "membership checkout should derive the Stripe customer email from the signed-in account"
  );
  assert.ok(
    membershipJoinButtonSource.includes("Sign in with an email before membership checkout."),
    "membership checkout should block when Stripe would receive an empty customer email"
  );
});
