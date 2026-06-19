import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type CheckStatus = "pass" | "fail" | "warn";

type CheckDefinition = {
  name: string;
  service: string;
  mutating: boolean;
  requiresFlag?: string;
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

const expectedAccountId = "374587466106";
const defaultRegion = "us-east-1";
const defaultProfile = "ycc-mcp";
const defaultLambdaFunction = "ycyyy:live";
const defaultLambdaAliasArn = "arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live";
const defaultApiId = "13710cp67l";
const defaultSiteUrl = "https://www.yuzucigarclub.com";
const dispatchRuleName = "YccHumidorAlertDispatchDaily";
const dispatchRouteKey = "POST /humidor/alerts/dispatch";
const dispatchSecretHeader = "x-humidor-alert-dispatch-secret";

const region = getArgValue("--region") || process.env.AWS_REGION || defaultRegion;
const profile = getArgValue("--profile") || process.env.AWS_PROFILE || defaultProfile;
const lambdaFunction = getArgValue("--function-name") || process.env.YCC_PUSH_E2E_LAMBDA_FUNCTION || defaultLambdaFunction;
const lambdaAliasArn = getArgValue("--lambda-alias-arn") || process.env.YCC_PUSH_E2E_LAMBDA_ALIAS_ARN || defaultLambdaAliasArn;
const apiId = getArgValue("--api-id") || process.env.YCC_PUSH_E2E_API_ID || defaultApiId;
const siteUrl = (getArgValue("--site-url") || process.env.YCC_PUSH_E2E_SITE_URL || defaultSiteUrl).replace(/\/$/, "");
const jsonOutput = hasArg("--json");
const dispatch = hasArg("--dispatch");
const live = hasArg("--live") || dispatch;
const dryRun = hasArg("--dry-run") || !live;

export const checks: CheckDefinition[] = [
  { name: "confirm AWS caller account", service: "sts", mutating: false },
  { name: "verify deployed PWA service worker and humidor route", service: "web", mutating: false },
  { name: "verify local Web Push implementation wiring", service: "filesystem", mutating: false },
  { name: "verify live Lambda Web Push environment", service: "lambda", mutating: false },
  { name: "verify API Gateway humidor alert routes", service: "apigatewayv2", mutating: false },
  { name: "verify EventBridge scheduled push dispatcher", service: "events/lambda", mutating: false },
  { name: "verify live dispatch auth boundary", service: "lambda", mutating: false },
  { name: "inventory AWS native mobile push resources", service: "sns/pinpoint", mutating: false },
  { name: "invoke live humidor push dispatcher", service: "lambda", mutating: true, requiresFlag: "--dispatch" },
];

void main().catch((error: unknown) => {
  emit({
    mode: "error",
    profile,
    region,
    siteUrl,
    failed: 1,
    error: errorMessage(error),
  });
  process.exitCode = 1;
});

async function main() {
  if (dryRun) {
    emit({
      mode: "dry-run",
      profile,
      region,
      siteUrl,
      lambdaFunction,
      checks,
      command: "npm run push:e2e -- --live --dispatch --json",
    });
    return;
  }

  const results: CheckResult[] = [];
  results.push(checkAwsCaller());
  results.push(await checkDeployedPwaAssets());
  results.push(checkLocalWebPushWiring());
  results.push(checkLambdaPushEnvironment());
  results.push(checkApiGatewayRoutes());
  results.push(checkEventBridgeDispatcher());
  results.push(checkDispatchAuthBoundary());
  results.push(checkAwsNativePushResources());

  if (dispatch) {
    results.push(invokeLiveDispatch());
  } else {
    results.push({
      ...checks[8],
      status: "warn",
      detail: "skipped; pass --dispatch to run the live dispatcher, which can send real push notifications and update humidor alert metadata",
    });
  }

  const failed = results.filter((result) => result.status === "fail");
  emit({
    mode: dispatch ? "live-dispatch" : "live-read-only",
    profile,
    region,
    siteUrl,
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

async function checkDeployedPwaAssets(): Promise<CheckResult> {
  try {
    const [serviceWorker, manifest, humidorPage] = await Promise.all([
      fetchText(`${siteUrl}/sw.js`),
      fetchText(`${siteUrl}/manifest.webmanifest`),
      fetchText(`${siteUrl}/humidor/`),
    ]);
    const serviceWorkerHasPush = serviceWorker.includes('self.addEventListener("push"');
    const serviceWorkerHasClick = serviceWorker.includes('self.addEventListener("notificationclick"');
    const serviceWorkerConstrainsTargets = serviceWorker.includes("getSafeNotificationTargetUrl") && serviceWorker.includes("target.origin !== self.location.origin");
    const manifestHasIcons = manifest.includes("icons") && manifest.includes("yuzu");
    const humidorRouteRendered = humidorPage.includes("<html") && humidorPage.includes("__next");
    const ok = serviceWorkerHasPush && serviceWorkerHasClick && serviceWorkerConstrainsTargets && manifestHasIcons && humidorRouteRendered;

    return {
      ...checks[1],
      status: ok ? "pass" : "fail",
      detail: `swPush=${serviceWorkerHasPush}; swClick=${serviceWorkerHasClick}; safeClickTarget=${serviceWorkerConstrainsTargets}; manifestIcons=${manifestHasIcons}; humidorRouteRendered=${humidorRouteRendered}`,
    };
  } catch (error) {
    return fail(checks[1], error);
  }
}

function checkLocalWebPushWiring(): CheckResult {
  try {
    const serviceWorker = readFileSync("public/sw.js", "utf8");
    const pwaRegister = readFileSync("src/components/pwa-register.tsx", "utf8");
    const humidorDashboard = readFileSync("src/components/humidor-dashboard.tsx", "utf8");
    const packageJson = readFileSync("package.json", "utf8");
    const ok =
      serviceWorker.includes('self.addEventListener("push"') &&
      serviceWorker.includes('self.addEventListener("notificationclick"') &&
      pwaRegister.includes('navigator.serviceWorker') &&
      pwaRegister.includes('register("/sw.js"') &&
      humidorDashboard.includes("NEXT_PUBLIC_VAPID_PUBLIC_KEY") &&
      humidorDashboard.includes("pushManager.subscribe") &&
      packageJson.includes('"web-push"');

    return {
      ...checks[2],
      status: ok ? "pass" : "fail",
      detail: `serviceWorkerPush=${serviceWorker.includes('self.addEventListener("push"')}; pwaRegister=${pwaRegister.includes('register("/sw.js"')}; browserVapidUsage=${humidorDashboard.includes("NEXT_PUBLIC_VAPID_PUBLIC_KEY")}; pushSubscription=${humidorDashboard.includes("pushManager.subscribe")}; webPushDependency=${packageJson.includes('"web-push"')}`,
    };
  } catch (error) {
    return fail(checks[2], error);
  }
}

function checkLambdaPushEnvironment(): CheckResult {
  try {
    const config = getLambdaConfig();
    const env = config.Environment?.Variables || {};
    const localEnv = loadDotEnvFile(".env.local");
    const browserPublicKey = (localEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
    const serverPublicKey = (env.VAPID_PUBLIC_KEY || "").trim();
    const publicKeysMatch = browserPublicKey ? browserPublicKey === serverPublicKey : true;
    const ok = Boolean(serverPublicKey && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT && env.HUMIDOR_ALERT_DISPATCH_SECRET && publicKeysMatch);

    return {
      ...checks[3],
      status: ok ? "pass" : "fail",
      detail: `version=${config.Version || "unknown"}; lastModified=${config.LastModified || "unknown"}; hasVapidPublic=${Boolean(serverPublicKey)}; hasVapidPrivate=${Boolean(env.VAPID_PRIVATE_KEY)}; hasVapidSubject=${Boolean(env.VAPID_SUBJECT)}; hasDispatchSecret=${Boolean(env.HUMIDOR_ALERT_DISPATCH_SECRET)}; localBrowserPublicKeyPresent=${Boolean(browserPublicKey)}; publicKeysMatch=${publicKeysMatch}`,
    };
  } catch (error) {
    return fail(checks[3], error);
  }
}

function checkApiGatewayRoutes(): CheckResult {
  try {
    const response = awsJson<{
      Items?: Array<{
        RouteKey?: string;
        AuthorizationType?: string;
        Target?: string;
      }>;
    }>(["apigatewayv2", "get-routes", "--api-id", apiId]);
    const routes = new Map((response.Items || []).map((route) => [route.RouteKey || "", route]));
    const getAlerts = routes.get("GET /humidor/alerts");
    const postAlerts = routes.get("POST /humidor/alerts");
    const dispatchRoute = routes.get(dispatchRouteKey);
    const ok =
      getAlerts?.AuthorizationType === "JWT" &&
      postAlerts?.AuthorizationType === "JWT" &&
      dispatchRoute?.AuthorizationType === "NONE" &&
      Boolean(getAlerts.Target && postAlerts.Target && dispatchRoute.Target);

    return {
      ...checks[4],
      status: ok ? "pass" : "fail",
      detail: `GET /humidor/alerts=${getAlerts?.AuthorizationType || "missing"}; POST /humidor/alerts=${postAlerts?.AuthorizationType || "missing"}; ${dispatchRouteKey}=${dispatchRoute?.AuthorizationType || "missing"}`,
    };
  } catch (error) {
    return fail(checks[4], error);
  }
}

function checkEventBridgeDispatcher(): CheckResult {
  try {
    const [config, rule, targets, policyResponse] = [
      getLambdaConfig(),
      awsJson<{ Arn?: string; State?: string; ScheduleExpression?: string }>(["events", "describe-rule", "--name", dispatchRuleName]),
      awsJson<{ Targets?: Array<{ Id?: string; Arn?: string; Input?: string }> }>(["events", "list-targets-by-rule", "--rule", dispatchRuleName]),
      awsJson<{ Policy?: string }>([
        "lambda",
        "get-policy",
        "--function-name",
        stripLambdaQualifier(lambdaFunction),
        "--qualifier",
        getLambdaQualifier(lambdaFunction),
      ]),
    ];
    const dispatchSecret = config.Environment?.Variables?.HUMIDOR_ALERT_DISPATCH_SECRET || "";
    const target = (targets.Targets || []).find((candidate) => candidate.Arn === lambdaAliasArn);
    const targetInput = parseJsonObject(target?.Input || "");
    const targetHeaders = isRecord(targetInput?.headers) ? targetInput.headers : null;
    const inputSecret = getString(targetHeaders, dispatchSecretHeader);
    const targetRouteKey = getString(targetInput, "routeKey");
    const policy = JSON.parse(policyResponse.Policy || "{}") as {
      Statement?: Array<{
        Principal?: string | Record<string, string>;
        Action?: string | string[];
        Resource?: string;
        Condition?: { ArnLike?: Record<string, string> };
      }>;
    };
    const hasInvokePermission = (policy.Statement || []).some((statement) => {
      const principal = typeof statement.Principal === "string" ? statement.Principal : statement.Principal?.Service || "";
      const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action || ""];
      const sourceArn = statement.Condition?.ArnLike?.["AWS:SourceArn"] || "";
      return principal === "events.amazonaws.com" && actions.includes("lambda:InvokeFunction") && sourceArn === rule.Arn;
    });
    const ok =
      rule.State === "ENABLED" &&
      Boolean(rule.ScheduleExpression) &&
      Boolean(target) &&
      targetRouteKey === dispatchRouteKey &&
      Boolean(inputSecret) &&
      inputSecret === dispatchSecret &&
      hasInvokePermission;

    return {
      ...checks[5],
      status: ok ? "pass" : "fail",
      detail: `ruleState=${rule.State || "missing"}; schedule=${rule.ScheduleExpression || "missing"}; targetLiveAlias=${Boolean(target)}; targetRoute=${targetRouteKey || "missing"}; targetHasSecret=${Boolean(inputSecret)}; secretMatchesLambda=${Boolean(inputSecret && inputSecret === dispatchSecret)}; lambdaInvokePermission=${hasInvokePermission}`,
    };
  } catch (error) {
    return fail(checks[5], error);
  }
}

function checkDispatchAuthBoundary(): CheckResult {
  try {
    const payload = invokeLambda({
      routeKey: dispatchRouteKey,
      rawPath: "/humidor/alerts/dispatch",
      requestContext: {
        http: {
          method: "POST",
          path: "/humidor/alerts/dispatch",
        },
        requestId: "codex-push-e2e-auth-boundary",
      },
      headers: {},
    });
    const body = parseJsonObject(payload.body || "");
    const error = getString(body, "error");
    const ok = payload.statusCode === 403 && error === "humidor_dispatch_forbidden";

    return {
      ...checks[6],
      status: ok ? "pass" : "fail",
      detail: `statusCode=${payload.statusCode || "missing"}; error=${error || "missing"}`,
    };
  } catch (error) {
    return fail(checks[6], error);
  }
}

function checkAwsNativePushResources(): CheckResult {
  try {
    const [snsApps, pinpointApps] = [
      awsJson<{ PlatformApplications?: Array<Record<string, unknown>> }>(["sns", "list-platform-applications"]),
      awsJson<{ ApplicationsResponse?: { Item?: Array<Record<string, unknown>> } }>(["pinpoint", "get-apps"]),
    ];
    const snsCount = snsApps.PlatformApplications?.length || 0;
    const pinpointCount = pinpointApps.ApplicationsResponse?.Item?.length || 0;

    return {
      ...checks[7],
      status: snsCount || pinpointCount ? "pass" : "warn",
      detail:
        snsCount || pinpointCount
          ? `SNS platformApplications=${snsCount}; EndUserMessagingPushApplications=${pinpointCount}`
          : "no SNS platform applications or End User Messaging Push apps found; current Yuzu mobile browser alerts use Web Push/VAPID instead of AWS native APNs/FCM push",
    };
  } catch (error) {
    return fail(checks[7], error);
  }
}

function invokeLiveDispatch(): CheckResult {
  try {
    const config = getLambdaConfig();
    const dispatchSecret = config.Environment?.Variables?.HUMIDOR_ALERT_DISPATCH_SECRET || "";
    if (!dispatchSecret) {
      return {
        ...checks[8],
        status: "fail",
        detail: "HUMIDOR_ALERT_DISPATCH_SECRET is missing from the live Lambda environment",
      };
    }

    const payload = invokeLambda({
      routeKey: dispatchRouteKey,
      rawPath: "/humidor/alerts/dispatch",
      requestContext: {
        http: {
          method: "POST",
          path: "/humidor/alerts/dispatch",
        },
        requestId: "codex-push-e2e-live-dispatch",
      },
      headers: {
        [dispatchSecretHeader]: dispatchSecret,
      },
    });
    const body = parseJsonObject(payload.body || "");
    const dispatchResult = isRecord(body?.dispatch) ? body.dispatch : null;
    const dispatchStatus = getString(dispatchResult, "status");
    const ok = payload.statusCode === 200 && dispatchStatus === "complete";

    return {
      ...checks[8],
      status: ok ? "pass" : "fail",
      detail: `statusCode=${payload.statusCode || "missing"}; dispatchStatus=${dispatchStatus || "missing"}; sent=${formatUnknown(dispatchResult?.sent)}; failed=${formatUnknown(dispatchResult?.failed)}; skipped=${formatUnknown(dispatchResult?.skipped)}`,
    };
  } catch (error) {
    return fail(checks[8], error);
  }
}

function getLambdaConfig() {
  return awsJson<LambdaConfig>(["lambda", "get-function-configuration", "--function-name", lambdaFunction]);
}

function invokeLambda(event: Record<string, unknown>) {
  const tempDir = mkdtempSync(join(tmpdir(), "ycc-push-e2e-"));
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

    return JSON.parse(readFileSync(responsePath, "utf8")) as {
      statusCode?: number;
      body?: string;
    };
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "codex-ycc-push-e2e/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return response.text();
}

function loadDotEnvFile(path: string) {
  const resolved = resolve(path);
  const values: Record<string, string> = {};

  try {
    const text = readFileSync(resolved, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const index = trimmed.indexOf("=");
      if (index <= 0) {
        continue;
      }

      const key = trimmed.slice(0, index).trim();
      const rawValue = trimmed.slice(index + 1).trim();
      values[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch {
    return values;
  }

  return values;
}

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
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

function stripLambdaQualifier(value: string) {
  const lastColon = value.lastIndexOf(":");
  return lastColon > -1 && !value.startsWith("arn:") ? value.slice(0, lastColon) : value;
}

function getLambdaQualifier(value: string) {
  const lastColon = value.lastIndexOf(":");
  return lastColon > -1 && !value.startsWith("arn:") ? value.slice(lastColon + 1) : "live";
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
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (dryRun) {
    process.stdout.write(`Push E2E dry run (${profile}/${region})\n`);
    for (const check of checks) {
      const suffix = check.mutating ? ` [mutating, requires ${check.requiresFlag}]` : " [read-only]";
      process.stdout.write(`- ${check.service}: ${check.name}${suffix}\n`);
    }
    process.stdout.write("Run live read-only check with: npm run push:e2e -- --live --json\n");
    process.stdout.write("Run live dispatcher with: npm run push:e2e -- --live --dispatch --json\n");
    return;
  }

  const result = value as { failed?: number; results?: CheckResult[] };
  process.stdout.write(`Push E2E (${profile}/${region})\n`);
  for (const check of result.results || []) {
    process.stdout.write(`- ${check.status.toUpperCase()} ${check.service}: ${check.name} - ${check.detail}\n`);
  }
  process.stdout.write(`Failed checks: ${result.failed || 0}\n`);
}

function hasArg(name: string) {
  return process.argv.slice(2).includes(name);
}

function getArgValue(name: string) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
