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
  assert.ok(result.checks.some((check) => check.service === "bedrock-agent" && check.name.includes("action group tools")));
  assert.ok(result.checks.some((check) => check.service === "lambda" && check.name.includes("live")));
  assert.ok(result.checks.some((check) => check.service === "bedrock" && check.name.includes("guardrail")));
});

test("AI agents ops check has a least-privilege action-group contract for each YCC agent", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("../infra/bedrock/ycc-agent-action-group-functions.json", import.meta.url), "utf8"),
  ) as {
    functions: Array<{ name: string; requireConfirmation?: string }>;
  };
  const config = JSON.parse(
    readFileSync(new URL("../infra/bedrock/ycc-agent-action-group-config.json", import.meta.url), "utf8"),
  ) as {
    actionGroupName: string;
    lambdaExecutorArn: string;
    agents: Array<{
      name: string;
      id: string;
      aliasId: string;
      actionGroupId: string;
      functions: string[];
    }>;
  };
  const catalogByName = new Map(catalog.functions.map((fn) => [fn.name, fn]));

  assert.equal(config.actionGroupName, "YCCOperations");
  assert.match(config.lambdaExecutorArn, /:function:ycyyy:live$/);
  assert.equal(config.agents.length, 6);

  for (const agent of config.agents) {
    assert.equal(new Set(agent.functions).size, agent.functions.length, `${agent.name} should not duplicate functions`);
    for (const functionName of agent.functions) {
      assert.ok(catalogByName.has(functionName), `${agent.name} references unknown function ${functionName}`);
    }
  }

  const admin = config.agents.find((agent) => agent.name === "YCCAdminAgent");
  const news = config.agents.find((agent) => agent.name === "YCCNewsAgent");
  const humidor = config.agents.find((agent) => agent.name === "YCCHumidorAgent");
  const cigarGuide = config.agents.find((agent) => agent.name === "YCCCigarGuide");

  assert.deepEqual(
    admin?.functions,
    ["GetMemberProfile", "DraftSupportReply", "GetAdminQueueSummary", "UpdateAdminOrder", "UpdateAdminMemberAccess"],
  );
  assert.deepEqual(news?.functions, ["DraftWeeklyNews"]);
  assert.deepEqual(humidor?.functions, ["GetMemberProfile", "AddHumidorItem"]);
  assert.deepEqual(cigarGuide?.functions, ["GetMemberProfile"]);

  assert.equal(catalogByName.get("AddHumidorItem")?.requireConfirmation, "ENABLED");
  assert.equal(catalogByName.get("UpdateAdminOrder")?.requireConfirmation, "ENABLED");
  assert.equal(catalogByName.get("UpdateAdminMemberAccess")?.requireConfirmation, "ENABLED");

  for (const agent of config.agents.filter((candidate) => candidate.name !== "YCCAdminAgent")) {
    assert.ok(!agent.functions.includes("UpdateAdminOrder"), `${agent.name} must not expose admin order updates`);
    assert.ok(!agent.functions.includes("UpdateAdminMemberAccess"), `${agent.name} must not expose member access updates`);
  }
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
