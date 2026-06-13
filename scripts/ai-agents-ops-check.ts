import { execFileSync } from "node:child_process";

type ExpectedAgent = {
  name: string;
  id: string;
  aliasId: string;
};

type ReadOnlyCheck = {
  name: string;
  service: string;
  mutating: false;
};

type CheckResult = ReadOnlyCheck & {
  status: "pass" | "fail" | "warn";
  detail: string;
};

const region = getArgValue("--region") || process.env.AWS_REGION || "us-east-1";
const profile = getArgValue("--profile") || process.env.AWS_PROFILE || "ycc-mcp";
const jsonOutput = hasArg("--json");
const dryRun = hasArg("--dry-run") || !hasArg("--live");
const apiBaseUrl = process.env.NEXT_PUBLIC_YCC_API_BASE_URL || "https://api.yuzucigarclub.com";

const expectedAccountId = "374587466106";
const lambdaFunction = "ycyyy:live";
const guardrailId = "xczjnv3f1wzs";
const guardrailVersion = "8";
const knowledgeBaseId = "48GFMCLSTG";
const expectedAgents: ExpectedAgent[] = [
  { name: "YCCConcierge", id: "NDIEDXNZAV", aliasId: "XXAQKDKDC0" },
  { name: "YCCCigarGuide", id: "EJI2VA7AVF", aliasId: "1JO8IAN4BL" },
  { name: "YCCSupportAgent", id: "SJJ2DVNYES", aliasId: "LIFBQL76AE" },
  { name: "YCCHumidorAgent", id: "XLN9JKVRDA", aliasId: "SOHCW5780U" },
  { name: "YCCAdminAgent", id: "UQWB6AKMBT", aliasId: "IHCMS7T9PB" },
  { name: "YCCNewsAgent", id: "TUVBTVKNXG", aliasId: "G25GBEUUMG" },
];

const checks: ReadOnlyCheck[] = [
  { name: "confirm AWS caller account", service: "sts", mutating: false },
  { name: "list prepared YCC Bedrock agents", service: "bedrock-agent", mutating: false },
  { name: "verify prepared prod aliases", service: "bedrock-agent", mutating: false },
  { name: "read live Lambda Bedrock environment", service: "lambda", mutating: false },
  { name: "read ready guardrail version", service: "bedrock", mutating: false },
  { name: "read active knowledge base", service: "bedrock-agent", mutating: false },
  { name: "read latest knowledge base ingestion", service: "bedrock-agent", mutating: false },
  { name: "probe API deep health", service: "api-gateway", mutating: false },
  { name: "probe unauthenticated concierge boundary", service: "api-gateway", mutating: false },
];

async function main() {
  if (dryRun) {
    emit({
      mode: "dry-run",
      profile,
      region,
      checks,
      command: "npm run ai-agents:ops-check -- --live --json",
    });
    return;
  }

  const results: CheckResult[] = [];

  results.push(checkAwsCaller());
  const agentSummaries = results[results.length - 1].status === "fail" ? [] : listAgentSummaries(results);
  verifyAgentSummaries(agentSummaries, results);
  verifyAliases(results);
  verifyLambdaEnvironment(results);
  verifyGuardrail(results);
  verifyKnowledgeBase(results);
  await verifyApiHealth(results);
  await verifyConciergeAuthBoundary(results);

  const failed = results.filter((result) => result.status === "fail");
  emit({
    mode: "live",
    profile,
    region,
    failed: failed.length,
    results,
  });

  if (failed.length) {
    process.exitCode = 1;
  }
}

function checkAwsCaller(): CheckResult {
  try {
    const identity = awsJson<{ Account?: string; Arn?: string }>(["sts", "get-caller-identity"]);
    const account = identity.Account || "unknown";

    return {
      ...checks[0],
      status: account === expectedAccountId ? "pass" : "fail",
      detail: `account=${account}; arn=${identity.Arn || "unknown"}`,
    };
  } catch (error) {
    return {
      ...checks[0],
      status: "fail",
      detail: getErrorMessage(error),
    };
  }
}

function listAgentSummaries(results: CheckResult[]) {
  try {
    const response = awsJson<{
      agentSummaries?: Array<{
        agentId?: string;
        agentName?: string;
        agentStatus?: string;
        latestAgentVersion?: string;
        guardrailConfiguration?: {
          guardrailIdentifier?: string;
          guardrailVersion?: string;
        };
      }>;
    }>(["bedrock-agent", "list-agents"]);

    return response.agentSummaries || [];
  } catch (error) {
    results.push({
      ...checks[1],
      status: "fail",
      detail: getErrorMessage(error),
    });
    return [];
  }
}

function verifyAgentSummaries(
  agentSummaries: Array<{
    agentId?: string;
    agentName?: string;
    agentStatus?: string;
    latestAgentVersion?: string;
    guardrailConfiguration?: {
      guardrailIdentifier?: string;
      guardrailVersion?: string;
    };
  }>,
  results: CheckResult[],
) {
  const failures = expectedAgents.flatMap((expected) => {
    const summary = agentSummaries.find((agent) => agent.agentId === expected.id || agent.agentName === expected.name);

    if (!summary) {
      return [`missing ${expected.name}`];
    }

    const issues: string[] = [];

    if (summary.agentStatus !== "PREPARED") {
      issues.push(`${expected.name} status=${summary.agentStatus || "unknown"}`);
    }

    if (summary.guardrailConfiguration?.guardrailIdentifier !== guardrailId) {
      issues.push(`${expected.name} guardrail=${summary.guardrailConfiguration?.guardrailIdentifier || "missing"}`);
    }

    if (summary.guardrailConfiguration?.guardrailVersion !== guardrailVersion) {
      issues.push(`${expected.name} guardrailVersion=${summary.guardrailConfiguration?.guardrailVersion || "missing"}`);
    }

    return issues;
  });

  results.push({
    ...checks[1],
    status: failures.length ? "fail" : "pass",
    detail: failures.length ? failures.join("; ") : `all ${expectedAgents.length} expected agents are PREPARED on guardrail ${guardrailVersion}`,
  });
}

function verifyAliases(results: CheckResult[]) {
  const failures: string[] = [];

  for (const expected of expectedAgents) {
    try {
      const response = awsJson<{
        agentAliasSummaries?: Array<{ agentAliasId?: string; agentAliasName?: string; agentAliasStatus?: string }>;
      }>(["bedrock-agent", "list-agent-aliases", "--agent-id", expected.id]);
      const alias = (response.agentAliasSummaries || []).find((candidate) => candidate.agentAliasId === expected.aliasId);

      if (!alias) {
        failures.push(`${expected.name} missing prod alias ${expected.aliasId}`);
      } else if (alias.agentAliasName !== "prod" || alias.agentAliasStatus !== "PREPARED") {
        failures.push(`${expected.name} alias=${alias.agentAliasName || "unknown"} status=${alias.agentAliasStatus || "unknown"}`);
      }
    } catch (error) {
      failures.push(`${expected.name}: ${getErrorMessage(error)}`);
    }
  }

  results.push({
    ...checks[2],
    status: failures.length ? "fail" : "pass",
    detail: failures.length ? failures.join("; ") : "all prod aliases are present and PREPARED",
  });
}

function verifyLambdaEnvironment(results: CheckResult[]) {
  try {
    const config = awsJson<{
      Version?: string;
      LastModified?: string;
      Environment?: { Variables?: Record<string, string> };
    }>(["lambda", "get-function-configuration", "--function-name", lambdaFunction]);
    const env = config.Environment?.Variables || {};
    const failures = [
      env.FEATURE_BEDROCK === "runtime_ready" ? "" : `FEATURE_BEDROCK=${env.FEATURE_BEDROCK || "missing"}`,
      env.BEDROCK_ENABLE_GUARDRAILS === "1" ? "" : `BEDROCK_ENABLE_GUARDRAILS=${env.BEDROCK_ENABLE_GUARDRAILS || "missing"}`,
      env.BEDROCK_GUARDRAIL_ID === guardrailId ? "" : `BEDROCK_GUARDRAIL_ID=${env.BEDROCK_GUARDRAIL_ID || "missing"}`,
      env.BEDROCK_GUARDRAIL_VERSION === guardrailVersion ? "" : `BEDROCK_GUARDRAIL_VERSION=${env.BEDROCK_GUARDRAIL_VERSION || "missing"}`,
      env.BEDROCK_KNOWLEDGE_BASE_ID === knowledgeBaseId ? "" : `BEDROCK_KNOWLEDGE_BASE_ID=${env.BEDROCK_KNOWLEDGE_BASE_ID || "missing"}`,
      ...expectedAgents.flatMap((agent) => {
        const envPrefix = agent.name.toUpperCase();
        return [
          env[`BEDROCK_AGENT_${envPrefix}_ID`] === agent.id ? "" : `${agent.name} id env mismatch`,
          env[`BEDROCK_AGENT_${envPrefix}_ALIAS_ID`] === agent.aliasId ? "" : `${agent.name} alias env mismatch`,
        ];
      }),
    ].filter(Boolean);

    results.push({
      ...checks[3],
      status: failures.length ? "fail" : "pass",
      detail: failures.length ? failures.join("; ") : `lambda ${lambdaFunction} version=${config.Version || "unknown"} lastModified=${config.LastModified || "unknown"}`,
    });
  } catch (error) {
    results.push({
      ...checks[3],
      status: "fail",
      detail: getErrorMessage(error),
    });
  }
}

function verifyGuardrail(results: CheckResult[]) {
  try {
    const guardrail = awsJson<{ name?: string; status?: string; version?: string }>([
      "bedrock",
      "get-guardrail",
      "--guardrail-identifier",
      guardrailId,
      "--guardrail-version",
      guardrailVersion,
    ]);

    results.push({
      ...checks[4],
      status: guardrail.status === "READY" && guardrail.version === guardrailVersion ? "pass" : "fail",
      detail: `${guardrail.name || guardrailId} status=${guardrail.status || "unknown"} version=${guardrail.version || "unknown"}`,
    });
  } catch (error) {
    results.push({
      ...checks[4],
      status: "fail",
      detail: getErrorMessage(error),
    });
  }
}

function verifyKnowledgeBase(results: CheckResult[]) {
  try {
    const kb = awsJson<{ knowledgeBase?: { name?: string; status?: string } }>([
      "bedrock-agent",
      "get-knowledge-base",
      "--knowledge-base-id",
      knowledgeBaseId,
    ]);
    const dataSources = awsJson<{
      dataSourceSummaries?: Array<{ dataSourceId?: string; name?: string; status?: string }>;
    }>(["bedrock-agent", "list-data-sources", "--knowledge-base-id", knowledgeBaseId]);
    const dataSource = (dataSources.dataSourceSummaries || [])[0];

    results.push({
      ...checks[5],
      status: kb.knowledgeBase?.status === "ACTIVE" && dataSource?.status === "AVAILABLE" ? "pass" : "fail",
      detail: `kb=${kb.knowledgeBase?.name || knowledgeBaseId} status=${kb.knowledgeBase?.status || "unknown"}; dataSource=${dataSource?.name || "missing"} status=${dataSource?.status || "missing"}`,
    });

    if (!dataSource?.dataSourceId) {
      results.push({
        ...checks[6],
        status: "fail",
        detail: "missing data source id",
      });
      return;
    }

    const jobs = awsJson<{
      ingestionJobSummaries?: Array<{ ingestionJobId?: string; status?: string; updatedAt?: string }>;
    }>([
      "bedrock-agent",
      "list-ingestion-jobs",
      "--knowledge-base-id",
      knowledgeBaseId,
      "--data-source-id",
      dataSource.dataSourceId,
    ]);
    const latestJob = (jobs.ingestionJobSummaries || []).sort((left, right) =>
      String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")),
    )[0];

    results.push({
      ...checks[6],
      status: latestJob?.status === "COMPLETE" ? "pass" : "fail",
      detail: `latestIngestion=${latestJob?.ingestionJobId || "missing"} status=${latestJob?.status || "missing"} updatedAt=${latestJob?.updatedAt || "unknown"}`,
    });
  } catch (error) {
    results.push({
      ...checks[5],
      status: "fail",
      detail: getErrorMessage(error),
    });
  }
}

async function verifyApiHealth(results: CheckResult[]) {
  try {
    const response = await fetch(`${apiBaseUrl}/health?deep=1`);
    const body = (await response.json()) as {
      status?: string;
      bedrock?: string;
      databaseWrites?: string;
      capabilities?: { bedrock?: string; databaseWrites?: string };
      db?: { proxyReachable?: boolean };
    };
    const bedrockStatus = body.bedrock || body.capabilities?.bedrock;
    const databaseWriteStatus = body.databaseWrites || body.capabilities?.databaseWrites;
    const healthy =
      response.status === 200 &&
      body.status === "ok" &&
      bedrockStatus === "runtime_ready" &&
      databaseWriteStatus === "schema_ready" &&
      body.db?.proxyReachable === true;

    results.push({
      ...checks[7],
      status: healthy ? "pass" : "fail",
      detail: `http=${response.status}; status=${body.status || "missing"}; bedrock=${bedrockStatus || "missing"}; databaseWrites=${databaseWriteStatus || "missing"}; proxyReachable=${String(body.db?.proxyReachable ?? "missing")}`,
    });
  } catch (error) {
    results.push({
      ...checks[7],
      status: "fail",
      detail: getErrorMessage(error),
    });
  }
}

async function verifyConciergeAuthBoundary(results: CheckResult[]) {
  try {
    const response = await fetch(`${apiBaseUrl}/concierge/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "readiness boundary probe" }),
    });
    const body = await response.text();
    const protectedBoundary = response.status === 401 || response.status === 403;

    results.push({
      ...checks[8],
      status: protectedBoundary ? "pass" : "fail",
      detail: `http=${response.status}; bodyPrefix=${body.slice(0, 80).replace(/\s+/g, " ")}`,
    });
  } catch (error) {
    results.push({
      ...checks[8],
      status: "fail",
      detail: getErrorMessage(error),
    });
  }
}

function awsJson<T>(args: string[]): T {
  const output = execFileSync("aws", [...args, "--profile", profile, "--region", region, "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return JSON.parse(output) as T;
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return "";
  }

  return process.argv[index + 1] || "";
}

function emit(value: unknown) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }

  if (dryRun) {
    process.stdout.write(`AI agents ops check dry run (${profile}/${region})\n`);
    for (const check of checks) {
      process.stdout.write(`- ${check.service}: ${check.name} [read-only]\n`);
    }
    process.stdout.write("Run live check with: npm run ai-agents:ops-check -- --live --json\n");
    return;
  }

  const result = value as { failed?: number; results?: CheckResult[] };

  process.stdout.write(`AI agents ops check (${profile}/${region})\n`);
  for (const check of result.results || []) {
    process.stdout.write(`- ${check.status.toUpperCase()} ${check.service}: ${check.name} - ${check.detail}\n`);
  }
  process.stdout.write(`Failed checks: ${result.failed || 0}\n`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`${getErrorMessage(error)}\n`);
  process.exitCode = 1;
});
