import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("SES E2E check defaults to dry-run and guards simulator sends", () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/ses-e2e-check.ts", "--dry-run", "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  const result = JSON.parse(output) as {
    mode: string;
    checks: Array<{ name: string; mutating: boolean; requiresFlag?: string }>;
    command: string;
  };

  assert.equal(result.mode, "dry-run");
  assert.match(result.command, /--send-simulator/);
  assert.ok(result.checks.some((check) => check.name.includes("production outbound access") && check.mutating === false));
  assert.ok(result.checks.some((check) => check.name.includes("inbound receipt rules") && check.mutating === false));
  assert.ok(result.checks.some((check) => check.name.includes("feedback publishing") && check.mutating === false));
  assert.ok(
    result.checks.some(
      (check) =>
        check.name.includes("mailbox simulator") &&
        check.mutating === true &&
        check.requiresFlag === "--send-simulator",
    ),
  );
});
