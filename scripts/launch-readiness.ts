import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type EnvMap = Record<string, string | undefined>;

export type ReadinessStatus = "pass" | "warn" | "fail";

export type ReadinessCheck = {
  id: string;
  status: ReadinessStatus;
  message: string;
};

export type LaunchReadinessOptions = {
  strictExternal?: boolean;
};

export type ArtifactInfo = {
  name: string;
  fullName: string;
  lastWriteTimeMs: number;
};

export type ArtifactCleanupPlan = {
  keepZip: ArtifactInfo | null;
  removePaths: string[];
};

type PlainObject = Record<string, unknown>;

const requiredPublicKeys = [
  "NEXT_PUBLIC_BASE_URL",
  "BASE_URL",
  "NEXT_PUBLIC_ADMIN_APP_URL",
  "NEXT_PUBLIC_YCC_API_BASE_URL",
  "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
  "NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID",
  "NEXT_PUBLIC_COGNITO_ISSUER",
  "NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE",
  "NEXT_PUBLIC_COGNITO_REDIRECT_PATH",
  "NEXT_PUBLIC_COGNITO_LOGOUT_PATH",
];

const requiredPushKeys = [
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];

const ageCheckerPublicKeyAliases = ["NEXT_PUBLIC_AGECHECKER_API_KEY", "NEXT_PUBLIC_AGE_VERIFICATION_API_KEY"];

const stripePriceKeys = [
  "STRIPE_PRICE_BOX_ACCESS_PASS_MONTHLY",
  "STRIPE_PRICE_BOX_ACCESS_PASS_QUARTERLY",
  "STRIPE_PRICE_BOX_ACCESS_PASS_YEARLY",
  "STRIPE_PRICE_KISHA_MONTHLY",
  "STRIPE_PRICE_KISHA_QUARTERLY",
  "STRIPE_PRICE_KISHA_YEARLY",
  "STRIPE_PRICE_SENSEI_MONTHLY",
  "STRIPE_PRICE_SENSEI_QUARTERLY",
  "STRIPE_PRICE_SENSEI_YEARLY",
  "STRIPE_PRICE_DAIMYO_MONTHLY",
  "STRIPE_PRICE_DAIMYO_QUARTERLY",
  "STRIPE_PRICE_DAIMYO_YEARLY",
];

const placeholderPatterns = [
  /^$/,
  /replace_me/i,
  /example\.com/i,
  /^pk_test_replace_me$/i,
  /^sk_test_replace_me$/i,
  /^whsec_replace_me$/i,
  /^price_replace_me$/i,
  /^bpc_replace_me$/i,
];

const disallowedZipEntryPatterns = [/\\/u, /^out\//u, /^\.next\//u, /^node_modules\//u, /^output\//u, /^\.git\//u];
const requiredLambdaZipEntries = [
  "index.js",
  "event-sync.js",
  "commerce-rules.js",
  "stripe-commerce.js",
  "global-bundle.pem",
  "cigar-news-sources.json",
  "migrations/0001_phase3_app_schema.sql",
  "migrations/0002_commerce_schema.sql",
  "migrations/0003_site_content_schema.sql",
  "migrations/0004_newsroom_schema.sql",
  "migrations/0005_member_stripe_customer_link.sql",
  "migrations/0006_events_schema.sql",
  "migrations/0007_newsroom_dedup.sql",
];
const disallowedLambdaZipEntryPatterns = [/\\/u, /^out\//u, /^\.next\//u, /^output\//u, /^\.git\//u, /^infra\//u, /^src\//u];

export function parseEnvSource(source: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    env[key] = stripQuotes(rawValue.trim());
  }

  return env;
}

export function findPlaceholderKeys(env: EnvMap): string[] {
  return Object.entries(env)
    .filter(([, value]) => typeof value === "string" && isPlaceholderValue(value))
    .map(([key]) => key);
}

export function assessLaunchReadiness(env: EnvMap, options: LaunchReadinessOptions = {}): ReadinessCheck[] {
  const strictExternal = options.strictExternal ?? false;
  const checks: ReadinessCheck[] = [];

  for (const key of requiredPublicKeys) {
    const alwaysStrict = key === "NEXT_PUBLIC_ADMIN_APP_URL" ? strictExternal : true;
    checks.push(requiredValueCheck(`${key.toLowerCase().replaceAll("_", "-")}-configured`, key, env[key], alwaysStrict));
  }

  for (const key of requiredPushKeys) {
    checks.push(requiredValueCheck(`${key.toLowerCase().replaceAll("_", "-")}-configured`, key, env[key], strictExternal));
  }

  checks.push(ageCheckerPublicKeyCheck(env, strictExternal));
  checks.push(vapidPublicKeyMatchCheck(env, strictExternal));

  const adminAppUrl = resolveAdminAppUrl(env);
  const adminAppUrlStrict = strictExternal || process.env.CI === "1";
  checks.push({
    id: "admin-url-format",
    status: adminAppUrl ? "pass" : adminAppUrlStrict ? "fail" : "warn",
    message: adminAppUrl
      ? "NEXT_PUBLIC_ADMIN_APP_URL is a valid http(s) URL."
      : "NEXT_PUBLIC_ADMIN_APP_URL must be a full https or http URL (for example, https://admin.example.com) to enable backend hand-off.",
  });

  checks.push(booleanCheck("live-auth-required", "NEXT_PUBLIC_REQUIRE_LIVE_AUTH", env.NEXT_PUBLIC_REQUIRE_LIVE_AUTH, true, "Production storefront requires live Cognito auth.", strictExternal));
  checks.push(booleanCheck("backup-admin-disabled", "NEXT_PUBLIC_ENABLE_BACKUP_ADMIN", env.NEXT_PUBLIC_ENABLE_BACKUP_ADMIN, false, "Production backup admin must stay disabled unless a break-glass launch is explicitly approved.", strictExternal));
  checks.push(booleanCheck("stripe-approval", "STRIPE_TOBACCO_APPROVAL_CONFIRMED", env.STRIPE_TOBACCO_APPROVAL_CONFIRMED, true, "Written Stripe approval for cigar/tobacco commerce is required.", strictExternal));
  checks.push(secretCheck("stripe-secret", "STRIPE_SECRET_KEY", env.STRIPE_SECRET_KEY, "sk_live_", "Stripe live secret key is required server-side before live payments.", strictExternal));
  checks.push(secretCheck("stripe-webhook-secret", "STRIPE_WEBHOOK_SECRET", env.STRIPE_WEBHOOK_SECRET, "whsec_", "Stripe webhook secret is required for signed event verification.", strictExternal));
  checks.push(secretCheck("stripe-portal-configuration", "STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID", env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID, "bpc_", "Stripe Customer Portal configuration is required for subscription management.", strictExternal));

  for (const key of stripePriceKeys) {
    checks.push(secretCheck(`stripe-price-${key.toLowerCase().replace(/^stripe_price_/u, "").replaceAll("_", "-")}`, key, env[key], "price_", `${key} must point to a live Stripe recurring Price.`, strictExternal));
  }

  checks.push(booleanCheck("stripe-test-mode-e2e", "STRIPE_TEST_MODE_E2E_CONFIRMED", env.STRIPE_TEST_MODE_E2E_CONFIRMED, true, "Stripe test-mode Checkout and webhook replay must be verified before live cutover.", strictExternal));
  checks.push(booleanCheck("age-verification-provider", "AGE_VERIFICATION_PROVIDER_CONFIRMED", env.AGE_VERIFICATION_PROVIDER_CONFIRMED, true, "Age-verification provider credentials and server-side decision handling must be confirmed.", strictExternal));
  checks.push(booleanCheck("tax-provider", "TAX_PROVIDER_CONFIRMED", env.TAX_PROVIDER_CONFIRMED, true, "Tobacco tax/excise provider readiness must be confirmed.", strictExternal));
  checks.push(shippingProviderCheck(env.SHIPPING_PROVIDER, strictExternal));
  checks.push(booleanCheck("adult-signature-carrier", "ADULT_SIGNATURE_CARRIER_APPROVED", env.ADULT_SIGNATURE_CARRIER_APPROVED, true, "USPS Adult Signature service setup must be confirmed before fulfillment release.", strictExternal));
  checks.push(booleanCheck("aws-restore-drill", "AWS_RESTORE_DRILL_COMPLETED", env.AWS_RESTORE_DRILL_COMPLETED, true, "A restore drill must be completed or explicitly accepted before production commerce.", strictExternal));
  checks.push(booleanCheck("staging-browser-qa", "STAGING_BROWSER_QA_PASSED", env.STAGING_BROWSER_QA_PASSED, true, "Staging browser smoke QA must pass before production promotion.", strictExternal));
  checks.push(booleanCheck("waf-or-rate-limiting", "WAF_OR_RATE_LIMITING_ACCEPTED", env.WAF_OR_RATE_LIMITING_ACCEPTED, true, "WAF/rate limiting must be closed or explicitly risk-accepted.", strictExternal));

  return checks;
}

export function validateDeployZipEntries(entries: string[]): string[] {
  return entries.filter((entry) => disallowedZipEntryPatterns.some((pattern) => pattern.test(entry)));
}

export function assessDeployZipReadiness(zipPath: string | null, strictExternal: boolean): ReadinessCheck {
  if (!zipPath) {
    return {
      id: "deploy-zip-shape",
      status: strictExternal ? "fail" : "warn",
      message: "No deploy zip was found. Create one with npm run amplify:package before go-live promotion.",
    };
  }

  if (!existsSync(zipPath)) {
    return {
      id: "deploy-zip-shape",
      status: "fail",
      message: `Deploy zip does not exist: ${zipPath}`,
    };
  }

  try {
    const invalidEntries = validateDeployZipEntries(readZipEntryNames(zipPath));
    return {
      id: "deploy-zip-shape",
      status: invalidEntries.length ? (strictExternal ? "fail" : "warn") : "pass",
      message: invalidEntries.length
        ? `${basename(zipPath)} has invalid entries: ${invalidEntries.slice(0, 5).join(", ")}`
        : `${basename(zipPath)} uses static-export-safe entry paths.`,
    };
  } catch (error) {
    return {
      id: "deploy-zip-shape",
      status: "fail",
      message: error instanceof Error ? error.message : "Deploy zip could not be inspected.",
    };
  }
}

export function validateLambdaDeployZipEntries(entries: string[]): string[] {
  const entrySet = new Set(entries);
  const missingEntries = requiredLambdaZipEntries
    .filter((entry) => !entrySet.has(entry))
    .map((entry) => `missing:${entry}`);
  const invalidEntries = entries
    .filter((entry) => disallowedLambdaZipEntryPatterns.some((pattern) => pattern.test(entry)))
    .map((entry) => `invalid:${entry}`);

  return [...missingEntries, ...invalidEntries];
}

export function planGeneratedArtifactCleanup(zipFiles: ArtifactInfo[], outputPath: string | null): ArtifactCleanupPlan {
  const sortedZips = [...zipFiles].sort((a, b) => b.lastWriteTimeMs - a.lastWriteTimeMs);
  const keepZip = sortedZips[0] ?? null;
  const removePaths = sortedZips.slice(1).map((zip) => zip.fullName);

  if (outputPath) {
    removePaths.push(outputPath);
  }

  return { keepZip, removePaths };
}

function shippingProviderCheck(value: string | undefined, strictExternal: boolean): ReadinessCheck {
  const provider = String(value || "").trim().toUpperCase();
  return {
    id: "shipping-provider-usps",
    status: provider === "USPS" ? "pass" : strictExternal ? "fail" : "warn",
    message:
      provider === "USPS"
        ? "SHIPPING_PROVIDER is configured for USPS."
        : "SHIPPING_PROVIDER must be USPS for production fulfillment.",
  };
}

function ageCheckerPublicKeyCheck(env: EnvMap, strictExternal: boolean): ReadinessCheck {
  const configuredKey = ageCheckerPublicKeyAliases.find((key) => {
    const value = env[key]?.trim();
    return Boolean(value) && !isPlaceholderValue(value);
  });

  return {
    id: "agechecker-public-key-configured",
    status: configuredKey ? "pass" : strictExternal ? "fail" : "warn",
    message: configuredKey
      ? `${configuredKey} is configured for the checkout browser verifier.`
      : `${ageCheckerPublicKeyAliases.join(" or ")} is required for the checkout browser verifier.`,
  };
}

function requiredValueCheck(id: string, key: string, value: string | undefined, alwaysStrict = false): ReadinessCheck {
  const configured = Boolean(value?.trim()) && !isPlaceholderValue(value);

  return {
    id,
    status: configured ? "pass" : alwaysStrict ? "fail" : "warn",
    message: configured ? `${key} is configured.` : `${key} is missing or still a placeholder.`,
  };
}

function vapidPublicKeyMatchCheck(env: EnvMap, strictExternal: boolean): ReadinessCheck {
  const browserPublicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const serverPublicKey = env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const configured =
    Boolean(browserPublicKey) &&
    Boolean(serverPublicKey) &&
    !isPlaceholderValue(browserPublicKey) &&
    !isPlaceholderValue(serverPublicKey);
  const matches = configured && browserPublicKey === serverPublicKey;

  return {
    id: "vapid-public-key-match",
    status: matches ? "pass" : strictExternal ? "fail" : "warn",
    message: matches
      ? "Browser and Lambda VAPID public keys match."
      : "NEXT_PUBLIC_VAPID_PUBLIC_KEY must match VAPID_PUBLIC_KEY so mobile push subscriptions can be delivered.",
  };
}

function resolveAdminAppUrl(env: EnvMap) {
  const value = env.NEXT_PUBLIC_ADMIN_APP_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function booleanCheck(id: string, key: string, value: string | undefined, expected: boolean, message: string, strictExternal = true): ReadinessCheck {
  const normalized = value?.trim().toLowerCase();
  const actual = normalized === "true" || normalized === "1" || normalized === "yes";
  const matches = normalized !== undefined && normalized !== "" && actual === expected;

  return {
    id,
    status: matches ? "pass" : strictExternal ? "fail" : "warn",
    message: matches ? `${key} is ${expected ? "confirmed" : "disabled"}.` : message,
  };
}

function secretCheck(id: string, key: string, value: string | undefined, requiredPrefix: string, message: string, strictExternal: boolean): ReadinessCheck {
  const trimmed = value?.trim() ?? "";
  const valid = Boolean(trimmed) && !isPlaceholderValue(trimmed) && trimmed.startsWith(requiredPrefix);

  return {
    id,
    status: valid ? "pass" : strictExternal ? "fail" : "warn",
    message: valid ? `${key} is configured with the expected prefix.` : message,
  };
}

function isPlaceholderValue(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return placeholderPatterns.some((pattern) => pattern.test(trimmed));
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  return parseEnvSource(readFileSync(path, "utf8"));
}

function loadCommerceProviderSecretEnv(env: EnvMap): Record<string, string> {
  const secretId = env.COMMERCE_PROVIDER_SECRET_ID || env.COMMERCE_PROVIDER_SECRET_ARN;
  if (!secretId) {
    return {};
  }

  const args = [
    "secretsmanager",
    "get-secret-value",
    "--secret-id",
    secretId,
    "--query",
    "SecretString",
    "--output",
    "text",
  ];

  const profile = env.AWS_PROFILE || env.AWS_DEFAULT_PROFILE;
  if (profile) {
    args.push("--profile", profile);
  }

  const region = env.AWS_REGION || env.AWS_DEFAULT_REGION;
  if (region) {
    args.push("--region", region);
  }

  try {
    const secretSource = execFileSync("aws", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (!secretSource) {
      return {};
    }

    return materializeCommerceSecretEnv(JSON.parse(secretSource));
  } catch {
    return {};
  }
}

export function materializeCommerceSecretEnv(secret: unknown): Record<string, string> {
  const source = asPlainObject(secret);
  if (!source) {
    return {};
  }

  const env: Record<string, string> = {};
  const providers = asPlainObject(source.providers) || {};
  const stripe = asPlainObject(firstDefined(source.stripe, providers.stripe)) || {};
  const ageVerification = asPlainObject(firstDefined(source.ageVerification, source.age, providers.ageVerification, providers.age)) || {};
  const tax = asPlainObject(firstDefined(source.tax, source.stripeTax, providers.tax, providers.stripeTax)) || {};
  const shipping = asPlainObject(firstDefined(source.shipping, providers.shipping)) || {};
  const adultSignature = asPlainObject(firstDefined(shipping.adultSignature, shipping.adult_signature)) || {};

  putEnv(env, "STRIPE_SECRET_KEY", firstDefined(stripe.secretKey, stripe.secret_key, stripe.apiKey, stripe.api_key));
  putEnv(env, "STRIPE_WEBHOOK_SECRET", firstDefined(stripe.webhookSecret, stripe.webhook_secret, stripe.signingSecret, stripe.signing_secret));
  putEnv(env, "STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID", firstDefined(stripe.customerPortalConfigurationId, stripe.customer_portal_configuration_id, stripe.portalConfigurationId));
  mergeStripePriceIds(env, firstDefined(stripe.priceIds, stripe.price_ids, stripe.prices, source.stripePriceIds, source.stripe_price_ids));

  const stripeApprovalConfirmed = asBoolean(
    firstDefined(
      stripe.tobaccoApprovalConfirmed,
      stripe.tobacco_approval_confirmed,
      stripe.approvalConfirmed,
      stripe.approval_confirmed,
      source.stripeTobaccoApprovalConfirmed,
      source.stripe_tobacco_approval_confirmed
    )
  );
  if (stripeApprovalConfirmed !== undefined) {
    env.STRIPE_TOBACCO_APPROVAL_CONFIRMED = String(stripeApprovalConfirmed);
  }

  const stripeReplayConfirmed = asBoolean(firstDefined(stripe.testModeE2eConfirmed, stripe.test_mode_e2e_confirmed, stripe.webhookReplayConfirmed, stripe.webhook_replay_confirmed));
  if (stripeReplayConfirmed !== undefined) {
    env.STRIPE_TEST_MODE_E2E_CONFIRMED = String(stripeReplayConfirmed);
  }

  const ageProviderReady = Boolean(
    firstDefined(ageVerification.apiKey, ageVerification.api_key, ageVerification.clientId, ageVerification.client_id, ageVerification.signingSecret, ageVerification.signing_secret)
  );
  if (ageProviderReady) {
    env.AGE_VERIFICATION_PROVIDER_CONFIRMED = "true";
  }

  const rawTaxStatus = firstDefined(tax.status, tax.ready, tax.featureStripeTax, source.featureStripeTax);
  const taxStatus = rawTaxStatus === undefined ? "" : String(rawTaxStatus).trim().toLowerCase();
  if (taxStatus === "ready" || taxStatus === "true" || taxStatus === "1") {
    env.TAX_PROVIDER_CONFIRMED = "true";
  } else if (taxStatus) {
    env.TAX_PROVIDER_CONFIRMED = "false";
  }

  putEnv(env, "SHIPPING_PROVIDER", firstDefined(shipping.provider, source.shippingProvider));
  const adultSignatureReady = asBoolean(
    firstDefined(
      shipping.adultSignatureCarrierApproved,
      shipping.adult_signature_carrier_approved,
      shipping.adultSignatureApproved,
      shipping.adult_signature_approved,
      adultSignature.carrierApproved,
      adultSignature.carrier_approved,
      adultSignature.accountConfigured,
      adultSignature.account_configured,
      adultSignature.approved,
      adultSignature.ready
    )
  );
  if (adultSignatureReady !== undefined) {
    env.ADULT_SIGNATURE_CARRIER_APPROVED = String(adultSignatureReady);
  } else if (firstDefined(shipping.adultSignatureAccountId, shipping.adult_signature_account_id, adultSignature.accountId, adultSignature.account_id)) {
    env.ADULT_SIGNATURE_CARRIER_APPROVED = "true";
  }

  return env;
}

function asPlainObject(value: unknown): PlainObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as PlainObject) : null;
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function putEnv(env: Record<string, string>, key: string, value: unknown) {
  if (value !== undefined && value !== null && String(value).trim() !== "") {
    env[key] = String(value).trim();
  }
}

function asBoolean(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "ready"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "pending", "unavailable"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function mergeStripePriceIds(env: Record<string, string>, value: unknown) {
  const priceIds = asPlainObject(value);
  if (!priceIds) {
    return;
  }

  for (const [tierKey, tierValue] of Object.entries(priceIds)) {
    const tier = String(tierKey).replace(/-/g, "_").toUpperCase();
    const prices = asPlainObject(tierValue);

    if (!prices) {
      putEnv(env, `STRIPE_PRICE_${tier}`, tierValue);
      continue;
    }

    for (const [periodKey, priceId] of Object.entries(prices)) {
      const period = String(periodKey).replace(/-/g, "_").toUpperCase();
      putEnv(env, `STRIPE_PRICE_${tier}_${period}`, priceId);
    }
  }
}

function readZipEntryNames(path: string): string[] {
  const zip = readFileSync(path);
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;

  for (let index = zip.length - 22; index >= 0; index -= 1) {
    if (zip.readUInt32LE(index) === eocdSignature) {
      eocdOffset = index;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error(`Could not find ZIP central directory in ${path}`);
  }

  const totalEntries = zip.readUInt16LE(eocdOffset + 10);
  let centralDirectoryOffset = zip.readUInt32LE(eocdOffset + 16);
  const entries: string[] = [];

  for (let count = 0; count < totalEntries; count += 1) {
    if (zip.readUInt32LE(centralDirectoryOffset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory header in ${path}`);
    }

    const fileNameLength = zip.readUInt16LE(centralDirectoryOffset + 28);
    const extraLength = zip.readUInt16LE(centralDirectoryOffset + 30);
    const commentLength = zip.readUInt16LE(centralDirectoryOffset + 32);
    const fileNameStart = centralDirectoryOffset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    entries.push(zip.subarray(fileNameStart, fileNameEnd).toString("utf8"));
    centralDirectoryOffset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function getRootZipFiles(workspace: string): ArtifactInfo[] {
  return readdirSync(workspace, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
    .map((entry) => {
      const fullName = join(workspace, entry.name);
      return {
        name: entry.name,
        fullName,
        lastWriteTimeMs: statSync(fullName).mtimeMs,
      };
    });
}

function formatChecks(checks: ReadinessCheck[]): string {
  return checks.map((check) => `${check.status.toUpperCase().padEnd(4)} ${check.id}: ${check.message}`).join("\n");
}

function getArgValue(name: string) {
  const arg = process.argv.find((value) => value.startsWith(`${name}=`));
  if (arg) {
    return arg.slice(name.length + 1);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function printCliReport(workspace: string, strictExternal: boolean) {
  const baseEnv = {
    ...loadEnvFile(join(workspace, ".env.local")),
    ...process.env,
  };
  const env = {
    ...baseEnv,
    ...loadCommerceProviderSecretEnv(baseEnv),
  };
  const checks = assessLaunchReadiness(env, { strictExternal });
  const zipFiles = getRootZipFiles(workspace);
  const cleanupPlan = planGeneratedArtifactCleanup(zipFiles, existsSync(join(workspace, "output")) ? join(workspace, "output") : null);
  const requestedZipPath = getArgValue("--zip");
  const latestZip = requestedZipPath
    ? {
        name: basename(requestedZipPath),
        fullName: resolve(workspace, requestedZipPath),
        lastWriteTimeMs: existsSync(resolve(workspace, requestedZipPath)) ? statSync(resolve(workspace, requestedZipPath)).mtimeMs : 0,
      }
    : cleanupPlan.keepZip;
  checks.push(assessDeployZipReadiness(latestZip?.fullName ?? null, strictExternal));

  console.log(`Yuzu launch readiness (${strictExternal ? "strict go-live" : "local ops"} mode)`);
  console.log("");
  console.log(formatChecks(checks));

  if (cleanupPlan.removePaths.length) {
    console.log("");
    console.log(`WARN generated-artifacts-cleanup: ${cleanupPlan.removePaths.length} old/generated artifact path(s) can be removed after preserving ${cleanupPlan.keepZip?.name ?? "the current artifact"}.`);
  }

  const failed = checks.filter((check) => check.status === "fail");
  if (failed.length) {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = resolve(process.argv[1] ?? "");

if (currentFile === invokedFile) {
  printCliReport(process.cwd(), process.argv.includes("--strict"));
}
