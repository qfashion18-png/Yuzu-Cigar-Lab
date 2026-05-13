import assert from "node:assert/strict";
import test from "node:test";

import { getAdminHostRedirectPath } from "../src/lib/admin-host-redirect";

test("admin hostname root redirects to the backend admin console", () => {
  assert.equal(
    getAdminHostRedirectPath({
      hash: "",
      hostname: "admin.yuzucigarclub.com",
      pathname: "/",
      search: "",
    }),
    "/admin/console/"
  );
});

test("admin hostname root redirect preserves query and hash state", () => {
  assert.equal(
    getAdminHostRedirectPath({
      hash: "#invite",
      hostname: "ADMIN.YUZUCIGARCLUB.COM",
      pathname: "/",
      search: "?from=bookmark",
    }),
    "/admin/console/?from=bookmark#invite"
  );
});

test("admin hostname redirect does not loop or affect public hosts", () => {
  assert.equal(
    getAdminHostRedirectPath({
      hash: "",
      hostname: "admin.yuzucigarclub.com",
      pathname: "/admin/",
      search: "",
    }),
    null
  );
  assert.equal(
    getAdminHostRedirectPath({
      hash: "",
      hostname: "www.yuzucigarclub.com",
      pathname: "/",
      search: "",
    }),
    null
  );
});
