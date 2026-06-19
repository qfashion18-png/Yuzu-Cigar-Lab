import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

type S3ObjectSummary = {
  Key?: string;
  LastModified?: string;
  Size?: number;
};

type CapturedEmailEvidence = {
  key: string;
  lastModified: string;
  subject: string;
  from: string;
  to: string;
  code: string;
  link: string;
  hasHtmlBody: boolean;
  hasBrandedButton: boolean;
};

const expectedAccountId = "374587466106";
const defaultRegion = "us-east-1";
const defaultProfile = "ycc-mcp";
const defaultUserPoolId = "us-east-1_63U9PflAX";
const defaultUserPoolClientId = "2i2nvtt41l94n0mivc4tu4f9ms";
const defaultRootEmailBucket = "classroom2";
const defaultRootEmailPrefix = "ycc/root-email/raw/";
const defaultConfirmationUrlPrefix = "https://yuzucigarclub.com/friends-family/?confirmation_code=";
const expectedSourceArn = "arn:aws:ses:us-east-1:374587466106:identity/support@yuzucigarclub.com";
const expectedReplyTo = "support@yuzucigarclub.com";
const expectedSubject = "Yuzu Cigar Club verification code";

const region = getArgValue("--region") || process.env.AWS_REGION || defaultRegion;
const profile = getArgValue("--profile") || process.env.AWS_PROFILE || defaultProfile;
const userPoolId = getArgValue("--user-pool-id") || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || defaultUserPoolId;
const clientId = getArgValue("--client-id") || process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || defaultUserPoolClientId;
const rootEmailBucket = getArgValue("--root-email-bucket") || process.env.YCC_COGNITO_EMAIL_E2E_ROOT_EMAIL_BUCKET || defaultRootEmailBucket;
const rootEmailPrefix = getArgValue("--root-email-prefix") || process.env.YCC_COGNITO_EMAIL_E2E_ROOT_EMAIL_PREFIX || defaultRootEmailPrefix;
const waitSeconds = Number(getArgValue("--wait-seconds") || process.env.YCC_COGNITO_EMAIL_E2E_WAIT_SECONDS || "120");
const jsonOutput = hasArg("--json");
const sendEmail = hasArg("--send-email");
const confirmSignup = hasArg("--confirm-signup");
const live = hasArg("--live") || sendEmail || confirmSignup;
const dryRun = hasArg("--dry-run") || !live;

export const checks: CheckDefinition[] = [
  { name: "confirm AWS caller account", service: "sts", mutating: false },
  { name: "verify Cognito email delivery configuration", service: "cognito-idp", mutating: false },
  { name: "verify Cognito verification template link and code placeholder", service: "cognito-idp", mutating: false },
  { name: "verify Cognito public app client for signup", service: "cognito-idp", mutating: false },
  { name: "verify root-domain inbound email capture path is readable", service: "s3", mutating: false },
  { name: "send disposable Cognito verification email and inspect captured raw email", service: "cognito-idp/s3", mutating: true, requiresFlag: "--send-email" },
  { name: "confirm disposable Cognito signup with captured code", service: "cognito-idp", mutating: true, requiresFlag: "--confirm-signup" },
];

void main().catch((error: unknown) => {
  emit({
    mode: "error",
    profile,
    region,
    userPoolId,
    clientId,
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
      userPoolId,
      clientId,
      rootEmailBucket,
      rootEmailPrefix,
      checks,
      command: "npm run cognito-email:e2e -- --live --send-email --json",
    });
    return;
  }

  if (confirmSignup && !sendEmail) {
    emit({
      mode: "invalid",
      profile,
      region,
      userPoolId,
      clientId,
      failed: 1,
      error: "--confirm-signup requires --send-email so the captured verification code is available",
    });
    process.exitCode = 1;
    return;
  }

  const results: CheckResult[] = [];
  results.push(checkAwsCaller());
  results.push(checkCognitoEmailConfiguration());
  results.push(checkCognitoVerificationTemplate());
  results.push(checkCognitoPublicAppClient());
  results.push(checkRootEmailCapturePath());

  if (sendEmail) {
    results.push(await runDisposableCognitoEmailCheck());
  } else {
    results.push({
      ...checks[5],
      status: "warn",
      detail: "skipped; pass --send-email to create a disposable Cognito signup and inspect the captured verification email",
    });
  }

  if (!confirmSignup) {
    results.push({
      ...checks[6],
      status: "warn",
      detail: "skipped; pass --confirm-signup with --send-email to confirm the disposable account. This triggers the live Cognito post-confirmation Lambda path.",
    });
  }

  const failed = results.filter((result) => result.status === "fail");
  emit({
    mode: sendEmail ? (confirmSignup ? "live-send-email-and-confirm" : "live-send-email") : "live-read-only",
    profile,
    region,
    userPoolId,
    clientId,
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

function checkCognitoEmailConfiguration(): CheckResult {
  try {
    const userPool = describeUserPool();
    const email = userPool.UserPool?.EmailConfiguration || {};
    const template = userPool.UserPool?.VerificationMessageTemplate || {};
    const emailSendingAccount = email.EmailSendingAccount || "missing";
    const sourceArn = email.SourceArn || "missing";
    const replyTo = email.ReplyToEmailAddress || "missing";
    const defaultEmailOption = template.DefaultEmailOption || "missing";
    const subject = template.EmailSubject || userPool.UserPool?.EmailVerificationSubject || "";
    const ok =
      emailSendingAccount === "COGNITO_DEFAULT" &&
      sourceArn === expectedSourceArn &&
      replyTo === expectedReplyTo &&
      defaultEmailOption === "CONFIRM_WITH_CODE" &&
      subject === expectedSubject;

    return {
      ...checks[1],
      status: ok ? "pass" : "fail",
      detail: `EmailSendingAccount=${emailSendingAccount}; SourceArn=${sourceArn}; ReplyTo=${replyTo}; DefaultEmailOption=${defaultEmailOption}; Subject=${subject || "missing"}`,
    };
  } catch (error) {
    return fail(checks[1], error);
  }
}

function checkCognitoVerificationTemplate(): CheckResult {
  try {
    const userPool = describeUserPool();
    const template = userPool.UserPool?.VerificationMessageTemplate || {};
    const message = template.EmailMessage || userPool.UserPool?.EmailVerificationMessage || "";
    const hasCodePlaceholder = message.includes("{####}");
    const hasConfirmationLink = message.includes(`${defaultConfirmationUrlPrefix}{####}`);
    const hasButtonCopy = message.includes("Open Yuzu confirmation page");
    const hasHtml = /<a\s/i.test(message) && /<[^>]+\sstyle=/i.test(message);

    return {
      ...checks[2],
      status: hasCodePlaceholder && hasConfirmationLink && hasButtonCopy && hasHtml ? "pass" : "fail",
      detail: `codePlaceholder=${hasCodePlaceholder}; confirmationLink=${hasConfirmationLink}; brandedButton=${hasButtonCopy}; htmlTemplate=${hasHtml}; length=${message.length}`,
    };
  } catch (error) {
    return fail(checks[2], error);
  }
}

function checkCognitoPublicAppClient(): CheckResult {
  try {
    const [userPool, client] = [
      describeUserPool(),
      awsJson<{
        UserPoolClient?: {
          ClientId?: string;
          ClientName?: string;
          GenerateSecret?: boolean;
          ExplicitAuthFlows?: string[];
        };
      }>(["cognito-idp", "describe-user-pool-client", "--user-pool-id", userPoolId, "--client-id", clientId]),
    ];
    const allowSelfSignup = userPool.UserPool?.AdminCreateUserConfig?.AllowAdminCreateUserOnly !== true;
    const generateSecret = client.UserPoolClient?.GenerateSecret === true;
    const explicitAuthFlows = client.UserPoolClient?.ExplicitAuthFlows || [];
    const ok = allowSelfSignup && !generateSecret && client.UserPoolClient?.ClientId === clientId;

    return {
      ...checks[3],
      status: ok ? "pass" : "fail",
      detail: `client=${client.UserPoolClient?.ClientName || "unknown"}; allowSelfSignup=${allowSelfSignup}; generateSecret=${generateSecret}; explicitAuthFlows=${explicitAuthFlows.join(",") || "none"}`,
    };
  } catch (error) {
    return fail(checks[3], error);
  }
}

function checkRootEmailCapturePath(): CheckResult {
  try {
    const response = awsJson<{ KeyCount?: number }>([
      "s3api",
      "list-objects-v2",
      "--bucket",
      rootEmailBucket,
      "--prefix",
      rootEmailPrefix,
      "--max-keys",
      "1",
    ]);

    return {
      ...checks[4],
      status: "pass",
      detail: `s3://${rootEmailBucket}/${rootEmailPrefix} readable; keyCount=${response.KeyCount ?? 0}`,
    };
  } catch (error) {
    return fail(checks[4], error);
  }
}

async function runDisposableCognitoEmailCheck(): Promise<CheckResult> {
  const startedAtMs = Date.now() - 30_000;
  const email = `codex-cognito-email-e2e-${formatTimestamp(new Date())}@yuzucigarclub.com`;
  const password = `YuzuCognitoE2e-${Date.now()}!Aa1`;
  let deleted = false;

  try {
    awsJson<Record<string, unknown>>([
      "cognito-idp",
      "sign-up",
      "--client-id",
      clientId,
      "--username",
      email,
      "--password",
      password,
      "--user-attributes",
      `Name=email,Value=${email}`,
      "Name=name,Value=Codex Cognito Email E2E",
    ]);

    const evidence = await waitForCapturedEmail(email, startedAtMs, waitSeconds * 1000);

    let confirmDetail = "";
    if (confirmSignup) {
      awsJson<Record<string, unknown>>([
        "cognito-idp",
        "confirm-sign-up",
        "--client-id",
        clientId,
        "--username",
        email,
        "--confirmation-code",
        evidence.code,
      ]);
      confirmDetail = " disposable account confirmed;";
    }

    deleteCognitoUser(email);
    deleted = true;

    return {
      ...checks[5],
      status: "pass",
      detail: `sentTo=${maskEmail(email)}; capturedKey=${evidence.key}; subject=${evidence.subject}; from=${evidence.from}; to=${evidence.to}; link=${maskConfirmationLink(evidence.link)}; htmlBody=${evidence.hasHtmlBody}; brandedButton=${evidence.hasBrandedButton};${confirmDetail} tempUserDeleted=true`,
    };
  } catch (error) {
    if (!deleted) {
      try {
        deleteCognitoUser(email);
        deleted = true;
      } catch {
        // Best-effort cleanup; the failure below keeps the operator informed.
      }
    }

    return {
      ...checks[5],
      status: "fail",
      detail: `${errorMessage(error)}; sentTo=${maskEmail(email)}; tempUserDeleted=${deleted}`,
    };
  }
}

async function waitForCapturedEmail(email: string, startedAtMs: number, timeoutMs: number): Promise<CapturedEmailEvidence> {
  const deadline = Date.now() + timeoutMs;
  const seen = new Set<string>();

  while (Date.now() < deadline) {
    const candidates = listRecentRootEmailObjects(startedAtMs).sort((left, right) =>
      String(right.LastModified || "").localeCompare(String(left.LastModified || "")),
    );

    for (const candidate of candidates.slice(0, 50)) {
      const key = candidate.Key || "";
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      const raw = getS3ObjectText(key);
      const evidence = inspectCapturedEmail(raw, email, key, candidate.LastModified || "unknown");
      if (evidence) {
        return evidence;
      }
    }

    await sleep(5_000);
  }

  throw new Error(`Timed out after ${Math.round(timeoutMs / 1000)}s waiting for captured Cognito verification email`);
}

function listRecentRootEmailObjects(startedAtMs: number): S3ObjectSummary[] {
  const objects: S3ObjectSummary[] = [];
  let token = "";

  do {
    const args = [
      "s3api",
      "list-objects-v2",
      "--bucket",
      rootEmailBucket,
      "--prefix",
      rootEmailPrefix,
      "--max-keys",
      "1000",
    ];

    if (token) {
      args.push("--continuation-token", token);
    }

    const response = awsJson<{
      Contents?: S3ObjectSummary[];
      IsTruncated?: boolean;
      NextContinuationToken?: string;
    }>(args);
    objects.push(...(response.Contents || []));
    token = response.IsTruncated ? response.NextContinuationToken || "" : "";
  } while (token);

  return objects.filter((object) => {
    const modified = Date.parse(object.LastModified || "");
    return Number.isFinite(modified) && modified >= startedAtMs;
  });
}

function inspectCapturedEmail(raw: string, expectedRecipient: string, key: string, lastModified: string): CapturedEmailEvidence | null {
  const decoded = decodeEmailTransportText(raw);
  if (!decoded.toLowerCase().includes(expectedRecipient.toLowerCase())) {
    return null;
  }

  const linkMatch = decoded.match(/https:\/\/yuzucigarclub\.com\/friends-family\/\?confirmation_code=(\d{6})/);
  const code = linkMatch?.[1] || "";
  const link = linkMatch?.[0] || "";
  const subject = decodeHeader(findHeader(raw, "Subject")) || "missing";
  const from = decodeHeader(findHeader(raw, "From")) || "missing";
  const to = decodeHeader(findHeader(raw, "To")) || "missing";
  const hasHtmlBody = /Content-Type:\s*text\/html/i.test(raw) || /<html|<table|<a\s/i.test(decoded);
  const hasBrandedButton = decoded.includes("Open Yuzu confirmation page");
  const hasExpectedSubject = subject.includes(expectedSubject);
  const hasExpectedLink = Boolean(link);

  if (!code || !hasExpectedSubject || !hasExpectedLink || !hasHtmlBody || !hasBrandedButton) {
    throw new Error(
      `Captured Cognito email was missing expected content: code=${Boolean(code)}; subject=${hasExpectedSubject}; link=${hasExpectedLink}; html=${hasHtmlBody}; brandedButton=${hasBrandedButton}`,
    );
  }

  return {
    key,
    lastModified,
    subject,
    from,
    to,
    code,
    link,
    hasHtmlBody,
    hasBrandedButton,
  };
}

function getS3ObjectText(key: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), "ycc-cognito-email-e2e-"));
  const outputPath = join(tempDir, "message.eml");

  try {
    execFileSync("aws", withAwsOptions(["s3api", "get-object", "--bucket", rootEmailBucket, "--key", key, outputPath]), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return readFileSync(outputPath, "utf8");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function describeUserPool() {
  return awsJson<{
    UserPool?: {
      EmailConfiguration?: {
        EmailSendingAccount?: string;
        SourceArn?: string;
        ReplyToEmailAddress?: string;
      };
      VerificationMessageTemplate?: {
        DefaultEmailOption?: string;
        EmailSubject?: string;
        EmailMessage?: string;
      };
      EmailVerificationSubject?: string;
      EmailVerificationMessage?: string;
      AdminCreateUserConfig?: {
        AllowAdminCreateUserOnly?: boolean;
      };
    };
  }>(["cognito-idp", "describe-user-pool", "--user-pool-id", userPoolId]);
}

function deleteCognitoUser(username: string) {
  execFileSync(
    "aws",
    withAwsOptions(["cognito-idp", "admin-delete-user", "--user-pool-id", userPoolId, "--username", username]),
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

function awsJson<T>(args: string[]): T {
  const output = execFileSync("aws", [...withAwsOptions(args), "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  return (output ? JSON.parse(output) : {}) as T;
}

function withAwsOptions(args: string[]) {
  return ["--profile", profile, "--region", region, ...args];
}

function fail(check: CheckDefinition, error: unknown): CheckResult {
  return {
    ...check,
    status: "fail",
    detail: errorMessage(error),
  };
}

function decodeEmailTransportText(value: string) {
  const normalized = value.replace(/\r\n/g, "\n");
  const decodedTransport = /Content-Transfer-Encoding:\s*quoted-printable/i.test(value)
    ? decodeQuotedPrintable(normalized)
    : normalized;

  return decodeHtmlEntities(decodedTransport);
}

function decodeQuotedPrintable(value: string) {
  return value
    .replace(/=\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findHeader(raw: string, headerName: string) {
  const headerBlock = raw.split(/\r?\n\r?\n/, 1)[0] || "";
  const unfolded = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  const pattern = new RegExp(`^${escapeRegExp(headerName)}:\\s*(.*)$`, "im");
  return unfolded.match(pattern)?.[1]?.trim() || "";
}

function decodeHeader(value: string) {
  return value.replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_match, encoded: string) =>
    decodeQuotedPrintable(encoded.replace(/_/g, " ")),
  );
}

function maskConfirmationLink(link: string) {
  return link.replace(/confirmation_code=\d{6}/, "confirmation_code=******");
}

function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return email;
  }

  return `${localPart.slice(0, 8)}...@${domain}`;
}

function formatTimestamp(date: Date) {
  return date.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasArg(name: string) {
  return process.argv.slice(2).includes(name);
}

function getArgValue(name: string) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}

function emit(payload: unknown) {
  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (typeof payload === "object" && payload && "results" in payload) {
    const results = (payload as { results: CheckResult[] }).results;
    for (const result of results) {
      console.log(`${result.status.toUpperCase()} ${result.name}: ${result.detail}`);
    }
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}
