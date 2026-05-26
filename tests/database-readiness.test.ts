import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("RDS check can fall back to Windows system trust for live API health", () => {
  const source = readFileSync(new URL("../scripts/check-rds-connection.ts", import.meta.url), "utf8");

  assert.ok(source.includes("Invoke-WebRequest"), "Windows fallback should use system-trusted HTTPS");
  assert.ok(source.includes("YCC_HEALTH_ENDPOINT"), "health endpoint should be passed through the environment");
  assert.ok(source.includes("windowsHide: true"), "fallback should not open an interactive PowerShell window");
});
