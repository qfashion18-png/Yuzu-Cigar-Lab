import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("AI agents ops check is wired as a safe dry-run script", async () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts: Record<string, string>;
  };
  const scriptPath = new URL("../scripts/ai-agents-ops-check.ts", import.meta.url);

  assert.equal(packageJson.scripts["ai-agents:ops-check"], "tsx scripts/ai-agents-ops-check.ts");
  assert.ok(existsSync(scriptPath), "ai agents ops check script should exist");

  const output = await runScript(["--import", "tsx", "scripts/ai-agents-ops-check.ts", "--dry-run", "--json"]);
  const result = JSON.parse(output.stdout) as {
    mode: string;
    checks: Array<{ name: string; service: string; mutating: boolean }>;
  };

  assert.equal(output.code, 0, output.stderr || output.stdout);
  assert.equal(result.mode, "dry-run");
  assert.ok(result.checks.length >= 8);
  assert.ok(result.checks.every((check) => check.mutating === false), "ops check should be read-only");
  assert.ok(result.checks.some((check) => check.service === "bedrock-agent" && check.name.includes("agents")));
  assert.ok(result.checks.some((check) => check.service === "lambda" && check.name.includes("live")));
  assert.ok(result.checks.some((check) => check.service === "bedrock" && check.name.includes("guardrail")));
});

function runScript(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
