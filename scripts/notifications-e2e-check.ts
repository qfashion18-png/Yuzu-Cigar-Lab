import { spawnSync } from "node:child_process";

type ChildCheck = {
  name: string;
  script: string;
};

type ChildResult = ChildCheck & {
  exitCode: number | null;
  failed: number;
  mode: string;
  output: unknown;
  error: string;
};

const profile = getArgValue("--profile") || process.env.AWS_PROFILE || "ycc-mcp";
const region = getArgValue("--region") || process.env.AWS_REGION || "us-east-1";
const jsonOutput = hasArg("--json");
const live = hasArg("--live");
const dryRun = hasArg("--dry-run") || !live;

const childChecks: ChildCheck[] = [
  { name: "sms", script: "scripts/sms-signup-e2e-check.ts" },
  { name: "ses", script: "scripts/ses-e2e-check.ts" },
  { name: "push", script: "scripts/push-e2e-check.ts" },
];

if (dryRun) {
  emit({
    mode: "dry-run",
    profile,
    region,
    checks: childChecks,
    command: "npm run notifications:e2e -- --live --json",
  });
  process.exit(0);
}

const results = childChecks.map(runChildCheck);
const failed = results.reduce((sum, result) => sum + result.failed + (result.failed === 0 && result.exitCode ? 1 : 0), 0);

emit({
  mode: "live-read-only",
  profile,
  region,
  failed,
  results,
});

if (failed) {
  process.exitCode = 1;
}

function runChildCheck(check: ChildCheck): ChildResult {
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", check.script, "--live", "--json", "--profile", profile, "--region", region],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  const output = parseJson(child.stdout);
  const failed = typeof output?.failed === "number" ? output.failed : child.status ? 1 : 0;

  return {
    ...check,
    exitCode: child.status,
    failed,
    mode: typeof output?.mode === "string" ? output.mode : "unknown",
    output: output || child.stdout.trim(),
    error: child.stderr.trim(),
  };
}

function parseJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { failed?: unknown; mode?: unknown })
      : null;
  } catch {
    return null;
  }
}

function emit(value: unknown) {
  if (jsonOutput) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (dryRun) {
    process.stdout.write(`Notifications E2E dry run (${profile}/${region})\n`);
    for (const check of childChecks) {
      process.stdout.write(`- ${check.name}: ${check.script} [read-only]\n`);
    }
    process.stdout.write("Run live read-only check with: npm run notifications:e2e -- --live --json\n");
    return;
  }

  const payload = value as { failed?: number; results?: ChildResult[] };
  process.stdout.write(`Notifications E2E (${profile}/${region})\n`);
  for (const result of payload.results || []) {
    const status = result.failed || result.exitCode ? "FAIL" : "PASS";
    process.stdout.write(`- ${status} ${result.name}: mode=${result.mode}; failed=${result.failed}; exitCode=${result.exitCode ?? "none"}\n`);
  }
  process.stdout.write(`Failed checks: ${payload.failed || 0}\n`);
}

function hasArg(name: string) {
  return process.argv.slice(2).includes(name);
}

function getArgValue(name: string) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}
