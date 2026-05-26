import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const adminPageSource = readFileSync(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
const adminConsolePageSource = readFileSync(new URL("../src/app/admin/console/page.tsx", import.meta.url), "utf8");
const backendAdminConsoleSource = readFileSync(new URL("../src/components/admin/backend-admin-console.tsx", import.meta.url), "utf8");
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
  assert.match(adminConsolePageSource, /BackendAdminConsole/);
  assert.match(backendAdminConsoleSource, /fetchAdminComplianceHolds/);
  assert.match(backendAdminConsoleSource, /fetchAdminOrders/);
  assert.match(backendAdminConsoleSource, /fetchAdminMembers/);
  assert.match(backendAdminConsoleSource, /updateAdminOrder/);
  assert.match(backendAdminConsoleSource, /updateAdminMemberAccess/);
  assert.match(backendAdminConsoleSource, /sendConciergeChat/);
  assert.equal(adminConsolePageSource.includes("YuzuAdminConsole"), false);
  assert.equal(adminConsolePageSource.includes("createAdminSeedState"), false);
  assert.equal(backendAdminConsoleSource.includes("createAdminSeedState"), false);
});

test("admin console user access tile opens the full user list", () => {
  const userAccessTarget = backendAdminConsoleSource.indexOf('id="admin-user-access"');
  const operationsQueueHeading = backendAdminConsoleSource.indexOf(">Operations Queue<");
  const customerOrdersHeading = backendAdminConsoleSource.indexOf(">Customer Orders<");
  const userAccessHeading = backendAdminConsoleSource.indexOf(">User Access<", operationsQueueHeading + 1);

  assert.match(backendAdminConsoleSource, /handleOpenUserAccess/);
  assert.notEqual(userAccessTarget, -1);
  assert.notEqual(operationsQueueHeading, -1);
  assert.notEqual(customerOrdersHeading, -1);
  assert.notEqual(userAccessHeading, -1);
  assert.ok(userAccessTarget > operationsQueueHeading, "the click target must not point at the operations queue");
  assert.ok(userAccessTarget > customerOrdersHeading, "the click target must not point at the customer orders list");
  assert.ok(userAccessTarget < userAccessHeading, "the click target should be on the user access roster section");
  assert.match(backendAdminConsoleSource, /ariaLabel="Open user access list"/);
  assert.match(backendAdminConsoleSource, /aria-label=\{ariaLabel \|\| label\}/);
  assert.match(backendAdminConsoleSource, /itemsToRender = limit \? items\.slice\(0, limit\) : items/);
  assert.match(backendAdminConsoleSource, /limit=\{null\}/);
});
