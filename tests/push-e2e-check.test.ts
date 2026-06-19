import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("Push E2E check defaults to dry-run and guards live dispatch", () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/push-e2e-check.ts", "--dry-run", "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  const result = JSON.parse(output) as {
    mode: string;
    checks: Array<{ name: string; mutating: boolean; requiresFlag?: string }>;
    command: string;
  };

  assert.equal(result.mode, "dry-run");
  assert.match(result.command, /--dispatch/);
  assert.ok(result.checks.some((check) => check.name.includes("deployed PWA service worker") && check.mutating === false));
  assert.ok(result.checks.some((check) => check.name.includes("Lambda Web Push environment") && check.mutating === false));
  assert.ok(result.checks.some((check) => check.name.includes("EventBridge scheduled push dispatcher") && check.mutating === false));
  assert.ok(
    result.checks.some(
      (check) =>
        check.name.includes("live humidor push dispatcher") &&
        check.mutating === true &&
        check.requiresFlag === "--dispatch",
    ),
  );
});
