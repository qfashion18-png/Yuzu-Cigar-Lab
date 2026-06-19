import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("Notifications E2E check aggregates SMS, SES, and push scripts", () => {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/notifications-e2e-check.ts", "--dry-run", "--json"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    },
  );
  const result = JSON.parse(output) as {
    mode: string;
    checks: Array<{ name: string; script: string }>;
    command: string;
  };

  assert.equal(result.mode, "dry-run");
  assert.match(result.command, /notifications:e2e/);
  assert.deepEqual(
    result.checks.map((check) => check.name),
    ["sms", "ses", "push"],
  );
  assert.ok(result.checks.some((check) => check.script.includes("sms-signup-e2e-check")));
  assert.ok(result.checks.some((check) => check.script.includes("ses-e2e-check")));
  assert.ok(result.checks.some((check) => check.script.includes("push-e2e-check")));
});
