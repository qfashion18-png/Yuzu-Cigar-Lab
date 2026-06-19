import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type CheckStatus = "pass" | "fail" | "warn";

type CheckDefinition = {
  name: string;
  service: string;
  mutating: boolean;
};

type CheckResult = CheckDefinition & {
  status: CheckStatus;
  detail: string;
};

type LambdaConfig = {
  Version?: string;
  LastModified?: string;
  Environment?: { Variables?: Record<string, string> };
};

type IamStatement = {
  Sid?: string;
  Action?: string | string[];
  Resource?: string | string[];
  Condition?: Record<string, unknown>;
};

type HttpLambdaPayload = {
  statusCode?: number;
  body?: string;
};

const expectedAccountId = "374587466106";
const defaultRegion = "us-east-1";
const defaultProfile = "ycc-mcp";
const defaultLambdaFunction = "ycyyy:live";
const defaultLambdaAliasArn = "arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live";
const defaultApiBaseUrl = "https://api.yuzucigarclub.com";
const defaultHumidorAgentId = "XLN9JKVRDA";
const defaultHumidorAgentAliasId = "SOHCW5780U";
const defaultHumidorAgentVersion = "7";
const defaultHumidorActionGroupId = "5OHFAPSKIZ";
const defaultKnowledgeBaseId = "48GFMCLSTG";
const defaultGuardrailId = "xczjnv3f1wzs";
const defaultGuardrailVersion = "8";
const defaultImagePath = "public/assets/product-padron.png";
const imageCapableModelPattern = /^(amazon\.nova-(?:lite|pro|premier)(?:-[a-z0-9]+)?|anthropic\.claude-3|us\.anthropic\.claude-3)/i;

const region = getArgValue("--region") || process.env.AWS_REGION || defaultRegion;
const profile = getArgValue("--profile") || process.env.AWS_PROFILE || defaultProfile;
const lambdaFunction = getArgValue("--function-name") || process.env.YCC_HUMIDOR_IMAGE_E2E_LAMBDA_FUNCTION || defaultLambdaFunction;
const lambdaAliasArn = getArgValue("--lambda-alias-arn") || process.env.YCC_HUMIDOR_IMAGE_E2E_LAMBDA_ALIAS_ARN || defaultLambdaAliasArn;
const apiBaseUrl = (getArgValue("--api-base-url") || process.env.NEXT_PUBLIC_YCC_API_BASE_URL || defaultApiBaseUrl).replace(/\/$/, "");
const humidorAgentId = getArgValue("--humidor-agent-id") || process.env.BEDROCK_AGENT_YCCHUMIDORAGENT_ID || defaultHumidorAgentId;
const humidorAgentAliasId =
  getArgValue("--humidor-agent-alias-id") || process.env.BEDROCK_AGENT_YCCHUMIDORAGENT_ALIAS_ID || defaultHumidorAgentAliasId;
const humidorAgentVersion = getArgValue("--humidor-agent-version") || process.env.YCC_HUMIDOR_IMAGE_E2E_AGENT_VERSION || defaultHumidorAgentVersion;
const humidorActionGroupId = getArgValue("--humidor-action-group-id") || process.env.YCC_HUMIDOR_IMAGE_E2E_ACTION_GROUP_ID || defaultHumidorActionGroupId;
const knowledgeBaseId = getArgValue("--knowledge-base-id") || process.env.BEDROCK_KNOWLEDGE_BASE_ID || defaultKnowledgeBaseId;
const imagePath = resolve(getArgValue("--image") || process.env.YCC_HUMIDOR_IMAGE_E2E_IMAGE || defaultImagePath);
const jsonOutput = hasArg("--json");
const live = hasArg("--live");
const dryRun = hasArg("--dry-run") || !live;

export const checks: CheckDefinition[] = [
  { name: "confirm AWS caller account", service: "sts", mutating: false },
  { name: "verify local humidor image-agent wiring", service: "filesystem", mutating: false },
  { name: "verify live Lambda image-agent environment", service: "lambda", mutating: false },
  { name: "verify Lambda humidor image tool IAM", service: "iam", mutating: false },
  { name: "verify Humidor Agent action group and knowledge base", service: "bedrock-agent", mutating: false },
  { name: "verify unauthenticated humidor image API boundary", service: "api-gateway", mutating: false },
  { name: "invoke live humidor image identification through Lambda", service: "lambda/bedrock/rekognition", mutating: false },
];

async function main() {
  if (dryRun) {
    emit({
      mode: "dry-run",
      profile,
      region,
      lambdaFunction,
      apiBaseUrl,
      imagePath,
      checks,
      command: "npm run humidor-agent:image-e2e -- --live --json",
    });
    return;
  }

  const results: CheckResult[] = [];
  results.push(checkAwsCaller());
  results.push(checkLocalHumidorImageWiring());
  results.push(checkLambdaImageEnvironment());
  results.push(checkLambdaToolIam());
  results.push(checkHumidorAgentTools());
  results.push(await checkUnauthenticatedHumidorImageBoundary());
  results.push(invokeLiveHumidorImageIdentification());

  const failed = results.filter((result) => result.status === "fail");
  emit({
    mode: "live",
    profile,
    region,
    lambdaFunction,
    apiBaseUrl,
    imagePath,
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
    return fail(checks[0], error);
  }
}

function checkLocalHumidorImageWiring(): CheckResult {
  try {
    const lambdaSource = readFileSync("infra/lambda/ycc-api/index.js", "utf8");
    const liveApiSource = readFileSync("src/lib/live-api.ts", "utf8");
    const dashboardSource = readFileSync("src/components/humidor-dashboard.tsx", "utf8");
    const actionSchema = readFileSync("infra/bedrock/ycc-agent-action-group-functions.json", "utf8");
    const imageExists = existsSync(imagePath);
    const ok =
      imageExists &&
      lambdaSource.includes("POST /humidor/identify-cigar") &&
      lambdaSource.includes("ConverseCommand") &&
      lambdaSource.includes("DetectTextCommand") &&
      lambdaSource.includes("DetectLabelsCommand") &&
      liveApiSource.includes("identifyCigarFromImage") &&
      dashboardSource.includes('accept="image/*"') &&
      dashboardSource.includes('capture="environment"') &&
      actionSchema.includes('"AddHumidorItem"') &&
      actionSchema.includes('"requireConfirmation": "ENABLED"');

    return {
      ...checks[1],
      status: ok ? "pass" : "fail",
      detail: `imageFixture=${imageExists ? basename(imagePath) : "missing"}; route=${lambdaSource.includes("POST /humidor/identify-cigar")}; converse=${lambdaSource.includes("ConverseCommand")}; rekognitionText=${lambdaSource.includes("DetectTextCommand")}; rekognitionLabels=${lambdaSource.includes("DetectLabelsCommand")}; clientHelper=${liveApiSource.includes("identifyCigarFromImage")}; cameraCapture=${dashboardSource.includes('capture="environment"')}; addHumidorConfirmation=${actionSchema.includes('"requireConfirmation": "ENABLED"')}`,
    };
  } catch (error) {
    return fail(checks[1], error);
  }
}

function checkLambdaImageEnvironment(): CheckResult {
  try {
    const config = getLambdaConfig();
    const env = config.Environment?.Variables || {};
    const modelId = env.BEDROCK_VISION_MODEL_ID || env.BEDROCK_MODEL_ID || "";
    const featureBedrockReady = env.FEATURE_BEDROCK === "runtime_ready";
    const featureRekognitionReady = ["image_understanding_ready", "ready"].includes(env.FEATURE_REKOGNITION || "");
    const webSearchReady = env.HUMIDOR_ENRICHMENT_WEB_SEARCH === "ready";
    const ok =
      featureBedrockReady &&
      featureRekognitionReady &&
      imageCapableModelPattern.test(modelId) &&
      env.BEDROCK_ENABLE_GUARDRAILS === "1" &&
      env.BEDROCK_GUARDRAIL_ID === defaultGuardrailId &&
      env.BEDROCK_GUARDRAIL_VERSION === defaultGuardrailVersion &&
      env.BEDROCK_KNOWLEDGE_BASE_ID === knowledgeBaseId &&
      env.BEDROCK_AGENT_YCCHUMIDORAGENT_ID === humidorAgentId &&
      env.BEDROCK_AGENT_YCCHUMIDORAGENT_ALIAS_ID === humidorAgentAliasId &&
      Boolean(env.COMMERCE_PROVIDER_SECRET_ARN) &&
      Boolean(env.S3_APP_BUCKET) &&
      webSearchReady;

    return {
      ...checks[2],
      status: ok ? "pass" : "fail",
      detail: `version=${config.Version || "unknown"}; lastModified=${config.LastModified || "unknown"}; bedrock=${env.FEATURE_BEDROCK || "missing"}; rekognition=${env.FEATURE_REKOGNITION || "missing"}; model=${modelId || "missing"}; guardrails=${env.BEDROCK_ENABLE_GUARDRAILS || "missing"}/${env.BEDROCK_GUARDRAIL_VERSION || "missing"}; kb=${env.BEDROCK_KNOWLEDGE_BASE_ID || "missing"}; humidorAlias=${env.BEDROCK_AGENT_YCCHUMIDORAGENT_ALIAS_ID || "missing"}; webSearch=${env.HUMIDOR_ENRICHMENT_WEB_SEARCH || "missing"}; catalogSecretPresent=${Boolean(env.COMMERCE_PROVIDER_SECRET_ARN)}; s3BucketPresent=${Boolean(env.S3_APP_BUCKET)}`,
    };
  } catch (error) {
    return fail(checks[2], error);
  }
}

function checkLambdaToolIam(): CheckResult {
  try {
    const response = awsJson<{ PolicyDocument?: { Statement?: IamStatement[] } }>([
      "iam",
      "get-role-policy",
      "--role-name",
      "ycyyy-1778040454500",
      "--policy-name",
      "YccApiPhase2RuntimePolicy",
    ]);
    const statements = response.PolicyDocument?.Statement || [];
    const requirements = [
      hasAction(statements, "rekognition:DetectText"),
      hasAction(statements, "rekognition:DetectLabels"),
      hasActionOnResource(statements, "bedrock:InvokeModel", "foundation-model/amazon.nova-lite-v1:0"),
      hasAction(statements, "bedrock:ApplyGuardrail"),
      hasActionOnResource(statements, "bedrock:Retrieve", `knowledge-base/${knowledgeBaseId}`),
      hasAction(statements, "bedrock:InvokeAgent"),
      hasActionOnResource(statements, "s3:GetObject", "arn:aws:s3:::classroom2/ycc/*"),
      hasActionOnResource(statements, "s3:PutObject", "arn:aws:s3:::classroom2/ycc/*"),
    ];
    const ok = requirements.every(Boolean);

    return {
      ...checks[3],
      status: ok ? "pass" : "fail",
      detail: `detectText=${requirements[0]}; detectLabels=${requirements[1]}; novaLiteInvoke=${requirements[2]}; guardrail=${requirements[3]}; kbRetrieve=${requirements[4]}; invokeAgent=${requirements[5]}; s3GetYcc=${requirements[6]}; s3PutYcc=${requirements[7]}`,
    };
  } catch (error) {
    return fail(checks[3], error);
  }
}

function checkHumidorAgentTools(): CheckResult {
  try {
    const agent = awsJson<{
      agent?: {
        agentName?: string;
        agentStatus?: string;
        foundationModel?: string;
        guardrailConfiguration?: { guardrailIdentifier?: string; guardrailVersion?: string };
      };
    }>(["bedrock-agent", "get-agent", "--agent-id", humidorAgentId]);
    const alias = awsJson<{ agentAlias?: { agentAliasStatus?: string; agentAliasName?: string } }>([
      "bedrock-agent",
      "get-agent-alias",
      "--agent-id",
      humidorAgentId,
      "--agent-alias-id",
      humidorAgentAliasId,
    ]);
    const actionGroup = awsJson<{
      agentActionGroup?: {
        actionGroupName?: string;
        actionGroupState?: string;
        actionGroupExecutor?: { lambda?: string };
        functionSchema?: { functions?: Array<{ name?: string; requireConfirmation?: string }> };
      };
    }>([
      "bedrock-agent",
      "get-agent-action-group",
      "--agent-id",
      humidorAgentId,
      "--agent-version",
      humidorAgentVersion,
      "--action-group-id",
      humidorActionGroupId,
    ]);
    const knowledgeBases = awsJson<{
      agentKnowledgeBaseSummaries?: Array<{ knowledgeBaseId?: string; knowledgeBaseState?: string; description?: string }>;
    }>([
      "bedrock-agent",
      "list-agent-knowledge-bases",
      "--agent-id",
      humidorAgentId,
      "--agent-version",
      humidorAgentVersion,
    ]);
    const functions = actionGroup.agentActionGroup?.functionSchema?.functions || [];
    const addHumidorItem = functions.find((fn) => fn.name === "AddHumidorItem");
    const memberProfile = functions.find((fn) => fn.name === "GetMemberProfile");
    const kb = (knowledgeBases.agentKnowledgeBaseSummaries || []).find((candidate) => candidate.knowledgeBaseId === knowledgeBaseId);
    const ok =
      agent.agent?.agentStatus === "PREPARED" &&
      alias.agentAlias?.agentAliasStatus === "PREPARED" &&
      actionGroup.agentActionGroup?.actionGroupState === "ENABLED" &&
      actionGroup.agentActionGroup?.actionGroupExecutor?.lambda === lambdaAliasArn &&
      addHumidorItem?.requireConfirmation === "ENABLED" &&
      Boolean(memberProfile) &&
      kb?.knowledgeBaseState === "ENABLED";

    return {
      ...checks[4],
      status: ok ? "pass" : "fail",
      detail: `agent=${agent.agent?.agentName || humidorAgentId}:${agent.agent?.agentStatus || "missing"}; alias=${alias.agentAlias?.agentAliasName || humidorAgentAliasId}:${alias.agentAlias?.agentAliasStatus || "missing"}; model=${agent.agent?.foundationModel || "missing"}; actionGroup=${actionGroup.agentActionGroup?.actionGroupName || "missing"}:${actionGroup.agentActionGroup?.actionGroupState || "missing"}; executorLiveAlias=${actionGroup.agentActionGroup?.actionGroupExecutor?.lambda === lambdaAliasArn}; addHumidorConfirmation=${addHumidorItem?.requireConfirmation || "missing"}; memberProfileTool=${Boolean(memberProfile)}; kb=${kb?.knowledgeBaseState || "missing"}`,
    };
  } catch (error) {
    return fail(checks[4], error);
  }
}

async function checkUnauthenticatedHumidorImageBoundary(): Promise<CheckResult> {
  try {
    const response = await fetch(`${apiBaseUrl}/humidor/identify-cigar`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "codex-ycc-humidor-image-e2e/1.0",
      },
      body: JSON.stringify({ notes: "unauthenticated humidor image boundary probe" }),
    });
    const body = await response.text();
    const protectedBoundary = response.status === 401 || response.status === 403;

    return {
      ...checks[5],
      status: protectedBoundary ? "pass" : "fail",
      detail: `http=${response.status}; bodyPrefix=${body.slice(0, 80).replace(/\s+/g, " ")}`,
    };
  } catch (error) {
    return fail(checks[5], error);
  }
}

function invokeLiveHumidorImageIdentification(): CheckResult {
  try {
    if (!existsSync(imagePath)) {
      return {
        ...checks[6],
        status: "fail",
        detail: `image fixture is missing at ${imagePath}`,
      };
    }

    const imageBytes = readFileSync(imagePath);
    const payload = invokeLambda({
      routeKey: "POST /humidor/identify-cigar",
      rawPath: "/humidor/identify-cigar",
      body: JSON.stringify({
        imageBase64: imageBytes.toString("base64"),
        mimeType: "image/png",
        fileName: basename(imagePath),
        notes: "Identify the visible cigar from the uploaded image. Do not save it to the humidor.",
      }),
      headers: {
        "content-type": "application/json",
        "user-agent": "codex-ycc-humidor-image-e2e/1.0",
      },
      requestContext: {
        requestId: `codex-humidor-image-e2e-${Date.now()}`,
        http: { method: "POST", sourceIp: "198.51.100.42" },
        authorizer: {
          jwt: {
            claims: {
              sub: "codex-humidor-image-e2e-member",
              email: "codex-humidor-image-e2e@yuzucigarclub.com",
              email_verified: "true",
              name: "Codex Humidor Image E2E",
              "cognito:groups": "member",
              "custom:member_status": "active",
              "custom:membership_tier": "Sensei",
            },
          },
        },
      },
    });
    const body = parseJsonObject(payload.body || "");
    const suggestion = isRecord(body?.suggestion) ? body.suggestion : null;
    const ai = isRecord(body?.ai) ? body.ai : null;
    const input = isRecord(body?.input) ? body.input : null;
    const rekognition = isRecord(ai?.rekognition) ? ai.rekognition : null;
    const nextActions = Array.isArray(body?.nextActions) ? body.nextActions.map(String) : [];
    const name = getString(suggestion, "name");
    const brand = getString(suggestion, "brand");
    const confidence = getString(suggestion, "confidence");
    const detectedPadron = /padr[oó]n/i.test(`${name} ${brand}`);
    const rekognitionHealthy =
      ["detected_text", "no_text"].includes(getString(rekognition, "status")) &&
      ["detected_labels", "no_labels"].includes(getString(rekognition, "labelStatus"));
    const ok =
      payload.statusCode === 200 &&
      getString(ai, "status") === "bedrock_runtime" &&
      getBoolean(input, "accepted") &&
      detectedPadron &&
      rekognitionHealthy &&
      nextActions.includes("confirm_add_to_humidor");

    return {
      ...checks[6],
      status: ok ? "pass" : "fail",
      detail: `statusCode=${payload.statusCode || "missing"}; ai=${getString(ai, "status") || "missing"}; name=${name || "missing"}; brand=${brand || "missing"}; confidence=${confidence || "missing"}; rekognitionText=${getString(rekognition, "status") || "missing"}:${formatUnknown(rekognition?.textCount)}; rekognitionLabels=${getString(rekognition, "labelStatus") || "missing"}:${formatUnknown(rekognition?.labelCount)}; imageBytes=${formatUnknown(input?.imageBytes)}; nextConfirm=${nextActions.includes("confirm_add_to_humidor")}; persisted=false`,
    };
  } catch (error) {
    return fail(checks[6], error);
  }
}

function getLambdaConfig() {
  return awsJson<LambdaConfig>(["lambda", "get-function-configuration", "--function-name", lambdaFunction]);
}

function invokeLambda(event: Record<string, unknown>) {
  const tempDir = mkdtempSync(join(tmpdir(), "ycc-humidor-image-e2e-"));
  const eventPath = join(tempDir, "event.json");
  const responsePath = join(tempDir, "response.json");

  try {
    writeFileSync(eventPath, JSON.stringify(event), "utf8");
    awsJson<{
      StatusCode?: number;
      FunctionError?: string;
      ExecutedVersion?: string;
    }>([
      "lambda",
      "invoke",
      "--function-name",
      lambdaFunction,
      "--payload",
      `fileb://${eventPath}`,
      responsePath,
    ]);

    return JSON.parse(readFileSync(responsePath, "utf8")) as HttpLambdaPayload;
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function hasAction(statements: IamStatement[], action: string) {
  return statements.some((statement) => actionsFor(statement).includes(action));
}

function hasActionOnResource(statements: IamStatement[], action: string, resourceNeedle: string) {
  return statements.some(
    (statement) =>
      actionsFor(statement).includes(action) &&
      resourcesFor(statement).some((resource) => resource === resourceNeedle || resource.includes(resourceNeedle)),
  );
}

function actionsFor(statement: IamStatement) {
  return Array.isArray(statement.Action) ? statement.Action : statement.Action ? [statement.Action] : [];
}

function resourcesFor(statement: IamStatement) {
  return Array.isArray(statement.Resource) ? statement.Resource : statement.Resource ? [statement.Resource] : [];
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

function getBoolean(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return value === true;
}

function formatUnknown(value: unknown) {
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return String(value);
  }

  return "unknown";
}

function awsJson<T>(args: string[]): T {
  const output = execFileSync("aws", [...args, "--profile", profile, "--region", region, "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  return (output ? JSON.parse(output) : {}) as T;
}

function fail(check: CheckDefinition, error: unknown): CheckResult {
  return {
    ...check,
    status: "fail",
    detail: errorMessage(error),
  };
}

function emit(value: unknown) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }

  if (dryRun) {
    process.stdout.write(`Humidor agent image E2E dry run (${profile}/${region})\n`);
    for (const check of checks) {
      process.stdout.write(`- ${check.service}: ${check.name} [${check.mutating ? "mutating" : "non-mutating"}]\n`);
    }
    process.stdout.write("Run live check with: npm run humidor-agent:image-e2e -- --live --json\n");
    return;
  }

  const result = value as { failed?: number; results?: CheckResult[] };
  process.stdout.write(`Humidor agent image E2E (${profile}/${region})\n`);
  for (const check of result.results || []) {
    process.stdout.write(`- ${check.status.toUpperCase()} ${check.service}: ${check.name} - ${check.detail}\n`);
  }
  process.stdout.write(`Failed checks: ${result.failed || 0}\n`);
}

function hasArg(name: string) {
  return process.argv.includes(name);
}

function getArgValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = resolve(process.argv[1] ?? "");

if (currentFile === invokedFile) {
  main().catch((error: unknown) => {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
