import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

type LogEvidence = {
  requestCompleted: boolean;
  smsSent: boolean;
  source: "cloudwatch" | "tail" | "none";
};

const expectedAccountId = "374587466106";
const defaultRegion = "us-east-1";
const defaultProfile = "ycc-mcp";
const defaultUserPoolId = "us-east-1_63U9PflAX";
const defaultLambdaFunction = "ycyyy:live";
const defaultLambdaAliasArn = "arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live";
const defaultUserPoolArn = "arn:aws:cognito-idp:us-east-1:374587466106:userpool/us-east-1_63U9PflAX";

const region = getArgValue("--region") || process.env.AWS_REGION || defaultRegion;
const profile = getArgValue("--profile") || process.env.AWS_PROFILE || defaultProfile;
const userPoolId = getArgValue("--user-pool-id") || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || defaultUserPoolId;
const lambdaFunction = getArgValue("--function-name") || process.env.YCC_SMS_E2E_LAMBDA_FUNCTION || defaultLambdaFunction;
const lambdaAliasArn = getArgValue("--lambda-alias-arn") || process.env.YCC_SMS_E2E_LAMBDA_ALIAS_ARN || defaultLambdaAliasArn;
const userPoolArn = getArgValue("--user-pool-arn") || process.env.YCC_SMS_E2E_USER_POOL_ARN || defaultUserPoolArn;
const jsonOutput = hasArg("--json");
const sendSms = hasArg("--send-sms");
const live = hasArg("--live") || sendSms;
const dryRun = hasArg("--dry-run") || !live;
let adminSmsDestinations: string[] = [];

export const checks: CheckDefinition[] = [
  { name: "confirm AWS caller account", service: "sts", mutating: false },
  { name: "verify Cognito post-confirmation trigger", service: "cognito-idp", mutating: false },
  { name: "verify Cognito invoke permission on live Lambda alias", service: "lambda", mutating: false },
  { name: "verify live Lambda SMS alert environment", service: "lambda", mutating: false },
  { name: "verify SNS sandbox destination readiness", service: "sns", mutating: false },
  { name: "verify US SMS origination readiness", service: "pinpoint-sms-voice-v2", mutating: false },
  { name: "synthetically invoke Cognito post-confirmation SMS alert", service: "lambda", mutating: true, requiresFlag: "--send-sms" },
];

async function main() {
  if (dryRun) {
    emit({
      mode: "dry-run",
      profile,
      region,
      userPoolId,
      lambdaFunction,
      checks,
      command: "npm run sms-signup:e2e -- --live --send-sms --json",
    });
    return;
  }

  const results: CheckResult[] = [];
  results.push(checkAwsCaller());
  results.push(checkCognitoTrigger());
  results.push(checkLambdaInvokePermission());
  results.push(checkLambdaSmsEnvironment());
  results.push(checkSnsSandboxDestinationReadiness());
  results.push(checkSmsOriginationReadiness());

  if (sendSms) {
    results.push(runSyntheticPostConfirmationInvoke());
  } else {
    results.push({
      ...checks[6],
      status: "warn",
      detail: "skipped; pass --send-sms to invoke the live Lambda alias and send the configured admin SMS alert",
    });
  }

  const failed = results.filter((result) => result.status === "fail");
  emit({
    mode: sendSms ? "live-send-sms" : "live-read-only",
    profile,
    region,
    userPoolId,
    lambdaFunction,
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

function checkCognitoTrigger(): CheckResult {
  try {
    const response = awsJson<{
      UserPool?: {
        LambdaConfig?: { PostConfirmation?: string };
      };
    }>([
      "cognito-idp",
      "describe-user-pool",
      "--user-pool-id",
      userPoolId,
    ]);
    const postConfirmation = response.UserPool?.LambdaConfig?.PostConfirmation || "";

    return {
      ...checks[1],
      status: postConfirmation === lambdaAliasArn ? "pass" : "fail",
      detail: postConfirmation ? `PostConfirmation=${postConfirmation}` : "PostConfirmation trigger is not configured",
    };
  } catch (error) {
    return fail(checks[1], error);
  }
}

function checkLambdaInvokePermission(): CheckResult {
  try {
    const response = awsJson<{ Policy?: string }>([
      "lambda",
      "get-policy",
      "--function-name",
      stripLambdaQualifier(lambdaFunction),
      "--qualifier",
      getLambdaQualifier(lambdaFunction),
    ]);
    const policy = JSON.parse(response.Policy || "{}") as {
      Statement?: Array<{
        Principal?: string | Record<string, string>;
        Action?: string | string[];
        Resource?: string;
        Condition?: {
          ArnLike?: Record<string, string>;
          StringEquals?: Record<string, string>;
        };
      }>;
    };
    const statement = (policy.Statement || []).find((candidate) => {
      const principal =
        typeof candidate.Principal === "string" ? candidate.Principal : candidate.Principal?.Service || "";
      const actions = Array.isArray(candidate.Action) ? candidate.Action : [candidate.Action || ""];
      const sourceArn = candidate.Condition?.ArnLike?.["AWS:SourceArn"] || "";

      return (
        principal === "cognito-idp.amazonaws.com" &&
        actions.includes("lambda:InvokeFunction") &&
        candidate.Resource === lambdaAliasArn &&
        (sourceArn === userPoolArn || sourceArn.endsWith(":userpool/*"))
      );
    });

    return {
      ...checks[2],
      status: statement ? "pass" : "fail",
      detail: statement ? "Cognito can invoke the live Lambda alias" : "missing Cognito lambda:InvokeFunction permission on live alias",
    };
  } catch (error) {
    return fail(checks[2], error);
  }
}

function checkLambdaSmsEnvironment(): CheckResult {
  try {
    const config = awsJson<{
      Version?: string;
      LastModified?: string;
      Environment?: { Variables?: Record<string, string> };
    }>(["lambda", "get-function-configuration", "--function-name", lambdaFunction]);
    const env = config.Environment?.Variables || {};
    adminSmsDestinations = normalizePhoneNumbers([
      env.YCC_ADMIN_ALERT_PHONE_E164,
      env.YCC_ADMIN_ALERT_PHONE_NUMBERS,
      env.ADMIN_ALERT_PHONE_E164,
    ]);
    const hasPhone = adminSmsDestinations.length > 0;
    const hasRegion = Boolean(env.YCC_ADMIN_ALERT_SMS_REGION || env.AWS_REGION || env.AWS_DEFAULT_REGION || region);

    if (!hasPhone || !hasRegion) {
      return {
        ...checks[3],
        status: "fail",
        detail: `adminSmsPhoneConfigured=${hasPhone}; smsRegionConfigured=${hasRegion}`,
      };
    }

    return {
      ...checks[3],
      status: "pass",
      detail: `version=${config.Version || "unknown"}; lastModified=${config.LastModified || "unknown"}; adminSmsDestinations=${adminSmsDestinations.map(maskPhoneNumber).join(",")}; smsRegion=${env.YCC_ADMIN_ALERT_SMS_REGION || env.AWS_REGION || env.AWS_DEFAULT_REGION || region}; maxPriceConfigured=${Boolean(env.YCC_ADMIN_ALERT_SMS_MAX_PRICE_USD)}`,
    };
  } catch (error) {
    return fail(checks[3], error);
  }
}

function checkSnsSandboxDestinationReadiness(): CheckResult {
  try {
    const [sandbox, destinations, attributes] = [
      awsJson<{ IsInSandbox?: boolean }>(["sns", "get-sms-sandbox-account-status"]),
      awsJson<{ PhoneNumbers?: Array<{ PhoneNumber?: string; Status?: string }> }>(["sns", "list-sms-sandbox-phone-numbers"]),
      awsJson<{ attributes?: Record<string, string> }>(["sns", "get-sms-attributes"]),
    ];
    const monthlySpendLimit = attributes.attributes?.MonthlySpendLimit || "missing";

    if (!sandbox.IsInSandbox) {
      return {
        ...checks[4],
        status: "pass",
        detail: `IsInSandbox=false; MonthlySpendLimit=${monthlySpendLimit}`,
      };
    }

    const destinationStatuses = adminSmsDestinations.map((phoneNumber) => {
      const match = (destinations.PhoneNumbers || []).find((candidate) => candidate.PhoneNumber === phoneNumber);
      return {
        phoneNumber,
        status: match?.Status || "missing",
      };
    });
    const unverified = destinationStatuses.filter((destination) => destination.status !== "Verified");

    return {
      ...checks[4],
      status: unverified.length ? "fail" : "pass",
      detail: `IsInSandbox=true; MonthlySpendLimit=${monthlySpendLimit}; destinations=${destinationStatuses.map((destination) => `${maskPhoneNumber(destination.phoneNumber)}:${destination.status}`).join(",") || "none"}`,
    };
  } catch (error) {
    return fail(checks[4], error);
  }
}

function checkSmsOriginationReadiness(): CheckResult {
  try {
    const [phoneNumbers, registrations] = [
      awsJson<{
        PhoneNumbers?: Array<{
          PhoneNumber?: string;
          Status?: string;
          IsoCountryCode?: string;
          MessageType?: string;
          NumberCapabilities?: string[];
          NumberType?: string;
          RegistrationId?: string;
        }>;
      }>(["pinpoint-sms-voice-v2", "describe-phone-numbers"]),
      awsJson<{
        Registrations?: Array<{
          RegistrationId?: string;
          RegistrationType?: string;
          RegistrationStatus?: string;
        }>;
      }>(["pinpoint-sms-voice-v2", "describe-registrations"]),
    ];
    const smsCapableUsNumbers = (phoneNumbers.PhoneNumbers || []).filter(
      (phoneNumber) =>
        phoneNumber.IsoCountryCode === "US" &&
        (phoneNumber.NumberCapabilities || []).includes("SMS") &&
        phoneNumber.MessageType === "TRANSACTIONAL",
    );
    const activeNumbers = smsCapableUsNumbers.filter((phoneNumber) => phoneNumber.Status === "ACTIVE");
    const registrationStatusById = new Map(
      (registrations.Registrations || []).map((registration) => [
        registration.RegistrationId || "",
        registration.RegistrationStatus || "missing",
      ]),
    );
    const numberDetails =
      smsCapableUsNumbers
        .map((phoneNumber) => {
          const registrationStatus = phoneNumber.RegistrationId
            ? registrationStatusById.get(phoneNumber.RegistrationId) || "missing_registration"
            : "no_registration";
          return `${maskPhoneNumber(phoneNumber.PhoneNumber || "")}:${phoneNumber.NumberType || "unknown"}:${phoneNumber.Status || "missing"}:${registrationStatus}`;
        })
        .join(",") || "none";

    return {
      ...checks[5],
      status: activeNumbers.length ? "pass" : "fail",
      detail: `usTransactionalSmsOriginators=${numberDetails}`,
    };
  } catch (error) {
    return fail(checks[5], error);
  }
}

function runSyntheticPostConfirmationInvoke(): CheckResult {
  const tempDir = mkdtempSync(join(tmpdir(), "ycc-sms-e2e-"));
  const eventPath = join(tempDir, "event.json");
  const responsePath = join(tempDir, "response.json");
  const nonce = Date.now();
  const email = `codex-sms-e2e-${nonce}@yuzucigarclub.com`;
  const invokeStartMs = Date.now() - 1000;

  try {
    writeFileSync(
      eventPath,
      JSON.stringify({
        version: "1",
        region,
        userPoolId,
        userName: email,
        triggerSource: "PostConfirmation_ConfirmSignUp",
        callerContext: {
          clientId: "codex-sms-e2e",
        },
        request: {
          userAttributes: {
            sub: `codex-sms-e2e-${nonce}`,
            email,
            email_verified: "true",
            name: "Codex SMS E2E",
            "custom:member_status": "non_member",
            "custom:membership_tier": "",
          },
        },
        response: {},
      }),
      "utf8",
    );

    const response = awsJson<{
      StatusCode?: number;
      FunctionError?: string;
      ExecutedVersion?: string;
      LogResult?: string;
    }>([
      "lambda",
      "invoke",
      "--function-name",
      lambdaFunction,
      "--payload",
      `fileb://${eventPath}`,
      "--log-type",
      "Tail",
      responsePath,
    ]);
    const payload = readFileSync(responsePath, "utf8");
    const logs = response.LogResult ? Buffer.from(response.LogResult, "base64").toString("utf8") : "";
    const tailEvidence = readLogEvidence(logs, "tail");
    const evidence =
      tailEvidence.smsSent && tailEvidence.requestCompleted
        ? tailEvidence
        : pollCloudWatchLogEvidence(invokeStartMs);
    const ok = response.StatusCode === 200 && !response.FunctionError && evidence.smsSent && evidence.requestCompleted;

    return {
      ...checks[5],
      status: ok ? "pass" : "fail",
      detail: `statusCode=${response.StatusCode || "missing"}; executedVersion=${response.ExecutedVersion || "unknown"}; functionError=${response.FunctionError || "none"}; smsSent=${evidence.smsSent}; requestCompleted=${evidence.requestCompleted}; evidence=${evidence.source}; payloadPrefix=${payload.slice(0, 120).replace(/\s+/g, " ")}`,
    };
  } catch (error) {
    return fail(checks[5], error);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
}

function pollCloudWatchLogEvidence(startTimeMs: number): LogEvidence {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const evidence = readCloudWatchLogEvidence(startTimeMs);
    if (evidence.smsSent && evidence.requestCompleted) {
      return evidence;
    }

    sleepMs(2500);
  }

  return { requestCompleted: false, smsSent: false, source: "none" };
}

function readCloudWatchLogEvidence(startTimeMs: number): LogEvidence {
  try {
    const [alertLogs, completionLogs] = [
      filterLambdaLogs(startTimeMs, '"admin_operational_alert_dispatched" "new_user"'),
      filterLambdaLogs(startTimeMs, '"COGNITO PostConfirmation_ConfirmSignUp"'),
    ];
    const combined = [...alertLogs, ...completionLogs].join("\n");
    return readLogEvidence(combined, "cloudwatch");
  } catch {
    return { requestCompleted: false, smsSent: false, source: "none" };
  }
}

function filterLambdaLogs(startTimeMs: number, filterPattern: string): string[] {
  const response = awsJson<{
    events?: Array<{ message?: string }>;
  }>([
    "logs",
    "filter-log-events",
    "--log-group-name",
    "/aws/lambda/ycyyy",
    "--start-time",
    String(startTimeMs),
    "--filter-pattern",
    filterPattern,
    "--max-items",
    "20",
  ]);

  return (response.events || []).map((event) => event.message || "");
}

function readLogEvidence(logs: string, source: LogEvidence["source"]): LogEvidence {
  return {
    requestCompleted: logs.includes('"routeKey":"COGNITO PostConfirmation_ConfirmSignUp"'),
    smsSent: logs.includes('"alertType":"new_user"') && logs.includes('"sms":{"sent":1') && logs.includes('"failed":0'),
    source,
  };
}

function fail(check: CheckDefinition, error: unknown): CheckResult {
  return {
    ...check,
    status: "fail",
    detail: getErrorMessage(error),
  };
}

function awsJson<T>(args: string[]): T {
  const output = execFileSync("aws", [...args, "--profile", profile, "--region", region, "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return JSON.parse(output) as T;
}

function stripLambdaQualifier(value: string) {
  const lastColon = value.lastIndexOf(":");
  return lastColon > -1 && !value.startsWith("arn:") ? value.slice(0, lastColon) : value;
}

function getLambdaQualifier(value: string) {
  const lastColon = value.lastIndexOf(":");
  return lastColon > -1 && !value.startsWith("arn:") ? value.slice(lastColon + 1) : "live";
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

function normalizePhoneNumbers(values: Array<string | undefined>) {
  const phoneNumbers = values
    .filter(Boolean)
    .join(",")
    .split(/[,\s;]+/)
    .map(normalizeE164PhoneNumber)
    .filter(Boolean);

  return [...new Set(phoneNumbers)];
}

function normalizeE164PhoneNumber(value: string) {
  const normalized = String(value || "").replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(normalized)) {
    return normalized;
  }

  const digits = normalized.replace(/\D/g, "");
  if (/^\d{10}$/.test(digits)) {
    return `+1${digits}`;
  }

  if (/^1\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  return "";
}

function maskPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "unconfigured";
}

function emit(value: unknown) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }

  if (dryRun) {
    process.stdout.write(`SMS signup E2E dry run (${profile}/${region})\n`);
    for (const check of checks) {
      const suffix = check.mutating ? ` [mutating, requires ${check.requiresFlag}]` : " [read-only]";
      process.stdout.write(`- ${check.service}: ${check.name}${suffix}\n`);
    }
    process.stdout.write("Run live read-only check with: npm run sms-signup:e2e -- --live --json\n");
    process.stdout.write("Run live SMS send check with: npm run sms-signup:e2e -- --live --send-sms --json\n");
    return;
  }

  const result = value as { failed?: number; results?: CheckResult[] };

  process.stdout.write(`SMS signup E2E (${profile}/${region})\n`);
  for (const check of result.results || []) {
    process.stdout.write(`- ${check.status.toUpperCase()} ${check.service}: ${check.name} - ${check.detail}\n`);
  }
  process.stdout.write(`Failed checks: ${result.failed || 0}\n`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sleepMs(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = resolve(process.argv[1] ?? "");

if (currentFile === invokedFile) {
  main().catch((error: unknown) => {
    process.stderr.write(`${getErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
