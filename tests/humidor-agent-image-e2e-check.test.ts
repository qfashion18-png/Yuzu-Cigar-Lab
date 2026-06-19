import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("Humidor agent image E2E check defaults to dry-run and runs non-mutating live image checks", () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/humidor-agent-image-e2e-check.ts", "--dry-run", "--json"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  const result = JSON.parse(output) as {
    mode: string;
    checks: Array<{ name: string; service: string; mutating: boolean }>;
    command: string;
  };

  assert.equal(result.mode, "dry-run");
  assert.equal(result.command, "npm run humidor-agent:image-e2e -- --live --json");
  assert.ok(result.checks.every((check) => check.mutating === false), "live image audit should not mutate humidor records");
  assert.ok(result.checks.some((check) => check.name.includes("local humidor image-agent wiring") && check.service === "filesystem"));
  assert.ok(result.checks.some((check) => check.name.includes("Lambda humidor image tool IAM") && check.service === "iam"));
  assert.ok(result.checks.some((check) => check.name.includes("Humidor Agent action group") && check.service === "bedrock-agent"));
  assert.ok(result.checks.some((check) => check.name.includes("unauthenticated humidor image API boundary") && check.service === "api-gateway"));
  assert.ok(result.checks.some((check) => check.name.includes("live humidor image identification") && check.service === "lambda/bedrock/rekognition"));
});
