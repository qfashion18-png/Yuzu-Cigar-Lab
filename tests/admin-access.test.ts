import assert from "node:assert/strict";
import test from "node:test";

import { resolveAdminAppUrl } from "../src/lib/admin-access";

test("admin hand-off requires an explicit backend admin URL", () => {
  assert.equal(
    resolveAdminAppUrl({
      NEXT_PUBLIC_BASE_URL: "https://www.yuzucigarclub.com",
    }),
    null
  );
});

test("explicit admin hand-off URL resolves to the live backend admin", () => {
  assert.equal(
    resolveAdminAppUrl({
      NEXT_PUBLIC_ADMIN_APP_URL: "https://admin.yuzucigarclub.com",
      NEXT_PUBLIC_BASE_URL: "https://www.yuzucigarclub.com",
    }),
    "https://admin.yuzucigarclub.com/"
  );
});

test("admin hand-off rejects non-http URLs", () => {
  assert.equal(
    resolveAdminAppUrl({
      NEXT_PUBLIC_ADMIN_APP_URL: "/admin/console",
    }),
    null
  );
});
