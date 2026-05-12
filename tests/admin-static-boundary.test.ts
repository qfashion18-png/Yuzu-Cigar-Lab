import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPageSource = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
const adminConsolePageSource = readFileSync(new URL("../src/app/admin/console/page.tsx", import.meta.url), "utf8");
const adminGateSource = readFileSync(new URL("../src/components/admin/admin-access-gate.tsx", import.meta.url), "utf8");
const backupAuthPanelSource = readFileSync(new URL("../src/components/backup-auth-panel.tsx", import.meta.url), "utf8");
const envExampleSource = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

test("static admin route does not import or render the private console bundle", () => {
  assert.equal(adminPageSource.includes("YuzuAdminConsole"), false, "static /admin must not ship console code or seeded data");
  assert.equal(adminPageSource.includes("AdminAccessGate"), true, "static /admin should still render the access hand-off");
});

test("admin access gate points production admins to an authenticated backend boundary", () => {
  assert.match(adminGateSource, /authenticated backend admin/i);
  assert.match(adminGateSource, /static storefront/i);
  assert.match(adminGateSource, /admin\/newsroom/);
});

test("admin access gate prefers Cognito copy whenever Cognito is configured", () => {
  assert.match(
    adminGateSource,
    /auth\.isCognitoConfigured\s+\?\s+"Production admin access requires Cognito\."/,
    "the left-hand admin gate copy should match the Cognito sign-in panel when Cognito is available"
  );
});

test("static admin hand-off uses a configured backend URL instead of looping to /admin", () => {
  assert.match(envExampleSource, /NEXT_PUBLIC_ADMIN_APP_URL/);
  assert.match(adminGateSource, /resolveAdminAppUrl/);
  assert.match(backupAuthPanelSource, /adminAppUrl/);
  assert.equal(
    backupAuthPanelSource.includes('render={<Link href="/admin"'),
    false,
    "signed-in admin CTA must not link back to the static /admin hand-off"
  );
});

test("admin console route does not render the seeded local console", () => {
  assert.match(adminConsolePageSource, /AdminAccessGate/);
  assert.equal(adminConsolePageSource.includes("YuzuAdminConsole"), false);
  assert.equal(adminConsolePageSource.includes("createAdminSeedState"), false);
});
