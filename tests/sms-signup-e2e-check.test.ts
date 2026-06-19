import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("SMS signup E2E check defaults to dry-run and guards live SMS sends", () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/sms-signup-e2e-check.ts", "--dry-run", "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  const result = JSON.parse(output) as {
    mode: string;
    checks: Array<{ name: string; mutating: boolean; requiresFlag?: string }>;
    command: string;
  };

  assert.equal(result.mode, "dry-run");
  assert.match(result.command, /--send-sms/);
  assert.ok(result.checks.some((check) => check.name.includes("Cognito post-confirmation trigger") && check.mutating === false));
  assert.ok(result.checks.some((check) => check.name.includes("invoke permission") && check.mutating === false));
  assert.ok(
    result.checks.some(
      (check) =>
        check.name.includes("synthetically invoke Cognito post-confirmation SMS alert") &&
        check.mutating === true &&
        check.requiresFlag === "--send-sms",
    ),
  );
});
