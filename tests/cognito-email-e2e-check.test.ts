import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

test("Cognito email E2E check defaults to dry-run and guards live email sends", () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/cognito-email-e2e-check.ts", "--dry-run", "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  const result = JSON.parse(output) as {
    mode: string;
    checks: Array<{ name: string; mutating: boolean; requiresFlag?: string }>;
    command: string;
  };

  assert.equal(result.mode, "dry-run");
  assert.match(result.command, /--send-email/);
  assert.ok(result.checks.some((check) => check.name.includes("email delivery configuration") && check.mutating === false));
  assert.ok(result.checks.some((check) => check.name.includes("verification template link") && check.mutating === false));
  assert.ok(
    result.checks.some(
      (check) =>
        check.name.includes("send disposable Cognito verification email") &&
        check.mutating === true &&
        check.requiresFlag === "--send-email",
    ),
  );
  assert.ok(
    result.checks.some(
      (check) =>
        check.name.includes("confirm disposable Cognito signup") &&
        check.mutating === true &&
        check.requiresFlag === "--confirm-signup",
    ),
  );
});

test("Cognito email E2E check refuses confirmation without a captured email", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/cognito-email-e2e-check.ts", "--confirm-signup", "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });

  const output = JSON.parse(result.stdout) as {
    mode: string;
    failed: number;
    error: string;
  };

  assert.equal(result.status, 1);
  assert.equal(output.mode, "invalid");
  assert.equal(output.failed, 1);
  assert.match(output.error, /--confirm-signup requires --send-email/);
});
