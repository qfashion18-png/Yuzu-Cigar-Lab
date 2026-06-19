import { execFileSync } from "node:child_process";

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

const expectedAccountId = "374587466106";
const defaultRegion = "us-east-1";
const defaultProfile = "ycc-mcp";
const defaultLambdaFunction = "ycyyy:live";
const defaultLambdaAliasArn = "arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live";
const supportIdentity = "support@yuzucigarclub.com";
const supportDomainIdentity = "ses-support.yuzucigarclub.com";
const rootDomainIdentity = "yuzucigarclub.com";
const receiptRuleSetName = "ycc-support-email";
const supportReceiptRuleName = "ycc-support-email-inbound";
const rootReceiptRuleName = "ycc-root-domain-email-inbound";
const rootEmailBucket = "classroom2";
const supportRawPrefix = "ycc/support-email/raw/";
const rootRawPrefix = "ycc/root-email/raw/";
const configurationSetName = "ycc-support-email-events";
const feedbackTopicArn = "arn:aws:sns:us-east-1:374587466106:ycc-ses-email-events";
const feedbackQueueName = "ycc-ses-email-events";

const region = getArgValue("--region") || process.env.AWS_REGION || defaultRegion;
const profile = getArgValue("--profile") || process.env.AWS_PROFILE || defaultProfile;
const lambdaFunction = getArgValue("--function-name") || process.env.YCC_SES_E2E_LAMBDA_FUNCTION || defaultLambdaFunction;
const lambdaAliasArn = getArgValue("--lambda-alias-arn") || process.env.YCC_SES_E2E_LAMBDA_ALIAS_ARN || defaultLambdaAliasArn;
const jsonOutput = hasArg("--json");
const sendSimulator = hasArg("--send-simulator");
const live = hasArg("--live") || sendSimulator;
const dryRun = hasArg("--dry-run") || !live;

export const checks: CheckDefinition[] = [
  { name: "confirm AWS caller account", service: "sts", mutating: false },
  { name: "verify SES production outbound access", service: "sesv2", mutating: false },
  { name: "verify SES sending identities", service: "sesv2", mutating: false },
  { name: "verify Lambda outbound SES feature guard", service: "lambda", mutating: false },
  { name: "verify SES inbound receipt rules", service: "ses", mutating: false },
  { name: "verify SES can invoke live Lambda receipt handler", service: "lambda", mutating: false },
  { name: "verify SES raw email capture prefixes are readable", service: "s3", mutating: false },
  { name: "verify SES feedback publishing to SNS/SQS", service: "sesv2/sns/sqs", mutating: false },
  { name: "send SES mailbox simulator test", service: "sesv2", mutating: true, requiresFlag: "--send-simulator" },
];

void main().catch((error: unknown) => {
  emit({
    mode: "error",
    profile,
    region,
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
      lambdaFunction,
      checks,
      command: "npm run ses:e2e -- --live --send-simulator --json",
    });
    return;
  }

  const results: CheckResult[] = [];
  results.push(checkAwsCaller());
  results.push(checkSesProductionAccess());
  results.push(checkSesSendingIdentities());
  results.push(checkLambdaSesGuard());
  results.push(checkReceiptRules());
  results.push(checkLambdaSesInvokePermission());
  results.push(checkRawEmailCapturePrefixes());
  results.push(checkFeedbackPublishing());

  if (sendSimulator) {
    results.push(sendSesMailboxSimulatorTest());
  } else {
    results.push({
      ...checks[8],
      status: "warn",
      detail: "skipped; pass --send-simulator to send one SES mailbox simulator message from the verified YCC support identity",
    });
  }

  const failed = results.filter((result) => result.status === "fail");
  emit({
    mode: sendSimulator ? "live-send-simulator" : "live-read-only",
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
    return fail(checks[0], error);
  }
}

function checkSesProductionAccess(): CheckResult {
  try {
    const account = getSesAccount();
    const review = account.Details?.ReviewDetails;
    const status = account.ProductionAccessEnabled && account.SendingEnabled ? "pass" : "fail";

    return {
      ...checks[1],
      status,
      detail: `ProductionAccessEnabled=${Boolean(account.ProductionAccessEnabled)}; SendingEnabled=${Boolean(account.SendingEnabled)}; ReviewStatus=${review?.Status || "none"}; CaseId=${review?.CaseId || "none"}; Max24HourSend=${account.SendQuota?.Max24HourSend ?? "unknown"}; MaxSendRate=${account.SendQuota?.MaxSendRate ?? "unknown"}`,
    };
  } catch (error) {
    return fail(checks[1], error);
  }
}

function checkSesSendingIdentities(): CheckResult {
  try {
    const response = awsJson<{
      EmailIdentities?: Array<{
        IdentityName?: string;
        IdentityType?: string;
        SendingEnabled?: boolean;
        VerificationStatus?: string;
      }>;
    }>(["sesv2", "list-email-identities"]);
    const required = [rootDomainIdentity, supportDomainIdentity, supportIdentity];
    const byName = new Map((response.EmailIdentities || []).map((identity) => [identity.IdentityName || "", identity]));
    const missingOrUnverified = required.filter((name) => {
      const identity = byName.get(name);
      return !identity || identity.VerificationStatus !== "SUCCESS" || identity.SendingEnabled !== true;
    });

    return {
      ...checks[2],
      status: missingOrUnverified.length ? "fail" : "pass",
      detail: required
        .map((name) => {
          const identity = byName.get(name);
          return `${name}:${identity?.IdentityType || "missing"}:${identity?.VerificationStatus || "missing"}:sending=${Boolean(identity?.SendingEnabled)}`;
        })
        .join("; "),
    };
  } catch (error) {
    return fail(checks[2], error);
  }
}

function checkLambdaSesGuard(): CheckResult {
  try {
    const [account, config] = [
      getSesAccount(),
      awsJson<{
        Version?: string;
        LastModified?: string;
        Environment?: { Variables?: Record<string, string> };
      }>(["lambda", "get-function-configuration", "--function-name", lambdaFunction]),
    ];
    const featureSes = config.Environment?.Variables?.FEATURE_SES || "missing";
    const guardMatchesAccount = account.ProductionAccessEnabled ? featureSes === "ready" : featureSes !== "ready";

    return {
      ...checks[3],
      status: guardMatchesAccount ? "pass" : "fail",
      detail: `version=${config.Version || "unknown"}; lastModified=${config.LastModified || "unknown"}; FEATURE_SES=${featureSes}; productionAccess=${Boolean(account.ProductionAccessEnabled)}`,
    };
  } catch (error) {
    return fail(checks[3], error);
  }
}

function checkReceiptRules(): CheckResult {
  try {
    const ruleSet = awsJson<{
      Metadata?: { Name?: string };
      Rules?: Array<{
        Name?: string;
        Enabled?: boolean;
        Recipients?: string[];
        Actions?: Array<{
          S3Action?: { BucketName?: string; ObjectKeyPrefix?: string };
          LambdaAction?: { FunctionArn?: string; InvocationType?: string };
        }>;
      }>;
    }>(["ses", "describe-active-receipt-rule-set"]);
    const supportRule = (ruleSet.Rules || []).find((rule) => rule.Name === supportReceiptRuleName);
    const rootRule = (ruleSet.Rules || []).find((rule) => rule.Name === rootReceiptRuleName);
    const supportHasS3 = hasS3Action(supportRule, rootEmailBucket, supportRawPrefix);
    const supportHasLambda = hasLambdaAction(supportRule, lambdaAliasArn);
    const rootHasS3 = hasS3Action(rootRule, rootEmailBucket, rootRawPrefix);
    const ok =
      ruleSet.Metadata?.Name === receiptRuleSetName &&
      supportRule?.Enabled === true &&
      rootRule?.Enabled === true &&
      supportRule.Recipients?.includes("support@ses-support.yuzucigarclub.com") &&
      rootRule.Recipients?.includes(rootDomainIdentity) &&
      supportHasS3 &&
      supportHasLambda &&
      rootHasS3;

    return {
      ...checks[4],
      status: ok ? "pass" : "fail",
      detail: `activeRuleSet=${ruleSet.Metadata?.Name || "missing"}; supportRule=${Boolean(supportRule)}; supportS3=${supportHasS3}; supportLambda=${supportHasLambda}; rootRule=${Boolean(rootRule)}; rootS3=${rootHasS3}`,
    };
  } catch (error) {
    return fail(checks[4], error);
  }
}

function checkLambdaSesInvokePermission(): CheckResult {
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
    const expectedSourceArn = `arn:aws:ses:${region}:${expectedAccountId}:receipt-rule-set/${receiptRuleSetName}:receipt-rule/${supportReceiptRuleName}`;
    const statement = (policy.Statement || []).find((candidate) => {
      const principal =
        typeof candidate.Principal === "string" ? candidate.Principal : candidate.Principal?.Service || "";
      const actions = Array.isArray(candidate.Action) ? candidate.Action : [candidate.Action || ""];
      const sourceArn = candidate.Condition?.ArnLike?.["AWS:SourceArn"] || "";

      return (
        principal === "ses.amazonaws.com" &&
        actions.includes("lambda:InvokeFunction") &&
        candidate.Resource === lambdaAliasArn &&
        sourceArn === expectedSourceArn
      );
    });

    return {
      ...checks[5],
      status: statement ? "pass" : "fail",
      detail: statement ? "SES receipt rule can invoke the live Lambda alias" : "missing SES lambda:InvokeFunction permission on live alias",
    };
  } catch (error) {
    return fail(checks[5], error);
  }
}

function checkRawEmailCapturePrefixes(): CheckResult {
  try {
    const [supportObjects, rootObjects] = [
      listS3Prefix(rootEmailBucket, supportRawPrefix),
      listS3Prefix(rootEmailBucket, rootRawPrefix),
    ];

    return {
      ...checks[6],
      status: "pass",
      detail: `s3://${rootEmailBucket}/${supportRawPrefix} readable; supportKeyCount=${supportObjects.KeyCount ?? 0}; s3://${rootEmailBucket}/${rootRawPrefix} readable; rootKeyCount=${rootObjects.KeyCount ?? 0}`,
    };
  } catch (error) {
    return fail(checks[6], error);
  }
}

function checkFeedbackPublishing(): CheckResult {
  try {
    const destinations = awsJson<{
      EventDestinations?: Array<{
        Name?: string;
        Enabled?: boolean;
        MatchingEventTypes?: string[];
        SnsDestination?: { TopicArn?: string };
      }>;
    }>(["sesv2", "get-configuration-set-event-destinations", "--configuration-set-name", configurationSetName]);
    const destination = (destinations.EventDestinations || []).find(
      (candidate) => candidate.Enabled && candidate.SnsDestination?.TopicArn === feedbackTopicArn,
    );
    const requiredEvents = ["BOUNCE", "COMPLAINT", "DELIVERY_DELAY", "REJECT"];
    const hasEvents = requiredEvents.every((eventType) => destination?.MatchingEventTypes?.includes(eventType));
    const topic = awsJson<{ Attributes?: Record<string, string> }>(["sns", "get-topic-attributes", "--topic-arn", feedbackTopicArn]);
    const queue = awsJson<{ QueueUrl?: string }>(["sqs", "get-queue-url", "--queue-name", feedbackQueueName]);
    const queueAttributes = awsJson<{ Attributes?: Record<string, string> }>([
      "sqs",
      "get-queue-attributes",
      "--queue-url",
      queue.QueueUrl || "",
      "--attribute-names",
      "Policy",
      "ApproximateNumberOfMessages",
    ]);
    const queuePolicy = queueAttributes.Attributes?.Policy || "";
    const ok =
      Boolean(destination) &&
      hasEvents &&
      Number(topic.Attributes?.SubscriptionsConfirmed || "0") > 0 &&
      queuePolicy.includes(feedbackTopicArn);

    return {
      ...checks[7],
      status: ok ? "pass" : "fail",
      detail: `configurationSet=${configurationSetName}; eventDestination=${destination?.Name || "missing"}; requiredEvents=${hasEvents}; snsSubscriptions=${topic.Attributes?.SubscriptionsConfirmed || "0"}; queueLinked=${queuePolicy.includes(feedbackTopicArn)}; queueMessages=${queueAttributes.Attributes?.ApproximateNumberOfMessages || "0"}`,
    };
  } catch (error) {
    return fail(checks[7], error);
  }
}

function sendSesMailboxSimulatorTest(): CheckResult {
  try {
    const response = awsJson<{ MessageId?: string }>([
      "sesv2",
      "send-email",
      "--from-email-address",
      supportIdentity,
      "--destination",
      JSON.stringify({ ToAddresses: ["success@simulator.amazonses.com"] }),
      "--content",
      JSON.stringify({
        Simple: {
          Subject: {
            Data: "YCC SES E2E simulator",
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: `Yuzu Cigar Club SES simulator check from Codex at ${new Date().toISOString()}.`,
              Charset: "UTF-8",
            },
          },
        },
      }),
      "--configuration-set-name",
      configurationSetName,
    ]);

    return {
      ...checks[8],
      status: response.MessageId ? "pass" : "fail",
      detail: `sent to SES mailbox simulator; messageId=${response.MessageId || "missing"}`,
    };
  } catch (error) {
    return fail(checks[8], error);
  }
}

function getSesAccount() {
  return awsJson<{
    ProductionAccessEnabled?: boolean;
    SendingEnabled?: boolean;
    SendQuota?: {
      Max24HourSend?: number;
      MaxSendRate?: number;
      SentLast24Hours?: number;
    };
    Details?: {
      ReviewDetails?: {
        Status?: string;
        CaseId?: string;
      };
    };
  }>(["sesv2", "get-account"]);
}

function listS3Prefix(bucket: string, prefix: string) {
  return awsJson<{ KeyCount?: number }>([
    "s3api",
    "list-objects-v2",
    "--bucket",
    bucket,
    "--prefix",
    prefix,
    "--max-keys",
    "1",
  ]);
}

function hasS3Action(
  rule: { Actions?: Array<{ S3Action?: { BucketName?: string; ObjectKeyPrefix?: string } }> } | undefined,
  bucket: string,
  prefix: string,
) {
  return Boolean(
    rule?.Actions?.some((action) => action.S3Action?.BucketName === bucket && action.S3Action?.ObjectKeyPrefix === prefix),
  );
}

function hasLambdaAction(rule: { Actions?: Array<{ LambdaAction?: { FunctionArn?: string } }> } | undefined, functionArn: string) {
  return Boolean(rule?.Actions?.some((action) => action.LambdaAction?.FunctionArn === functionArn));
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
    process.stdout.write(`SES E2E dry run (${profile}/${region})\n`);
    for (const check of checks) {
      const suffix = check.mutating ? ` [mutating, requires ${check.requiresFlag}]` : " [read-only]";
      process.stdout.write(`- ${check.service}: ${check.name}${suffix}\n`);
    }
    process.stdout.write("Run live read-only check with: npm run ses:e2e -- --live --json\n");
    process.stdout.write("Run SES simulator send check with: npm run ses:e2e -- --live --send-simulator --json\n");
    return;
  }

  const result = value as { failed?: number; results?: CheckResult[] };
  process.stdout.write(`SES E2E (${profile}/${region})\n`);
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
