import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseHealthEndpoint, isDatabaseNetworkError } from "../src/lib/database/readiness";

test("database readiness detects private network connection failures", () => {
  assert.equal(isDatabaseNetworkError(new Error("Connection terminated due to connection timeout")), true);
  assert.equal(isDatabaseNetworkError(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" })), true);
  assert.equal(isDatabaseNetworkError(Object.assign(new Error("password authentication failed"), { code: "28P01" })), false);
});

test("database readiness builds the API deep health endpoint without exposing database secrets", () => {
  const endpoint = getDatabaseHealthEndpoint({
    NEXT_PUBLIC_YCC_API_BASE_URL: "https://example.execute-api.us-east-1.amazonaws.com/",
  });

  assert.equal(endpoint, "https://example.execute-api.us-east-1.amazonaws.com/health?deep=1");
  assert.equal(getDatabaseHealthEndpoint({}), null);
});
