import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assessLaunchReadiness,
  findPlaceholderKeys,
  materializeCommerceSecretEnv,
  parseEnvSource,
  planGeneratedArtifactCleanup,
  validateDeployZipEntries,
  validateLambdaDeployZipEntries,
} from "../scripts/launch-readiness";

const fakeLiveStripeSecret = ["sk", "live_validlaunchkey"].join("_");
const fakeWebhookSecret = ["whsec", "validlaunchsecret"].join("_");

const completeEnv = {
  NEXT_PUBLIC_BASE_URL: "https://www.yuzucigarclub.com",
  BASE_URL: "https://www.yuzucigarclub.com",
  NEXT_PUBLIC_YCC_API_BASE_URL: "https://13710cp67l.execute-api.us-east-1.amazonaws.com",
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: "us-east-1_63U9PflAX",
  NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID: "2i2nvtt41l94n0mivc4tu4f9ms",
  NEXT_PUBLIC_COGNITO_ISSUER: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_63U9PflAX",
  NEXT_PUBLIC_COGNITO_HOSTED_UI_BASE: "https://ycc-members-374587466106.auth.us-east-1.amazoncognito.com",
  NEXT_PUBLIC_COGNITO_REDIRECT_PATH: "/auth/callback",
  NEXT_PUBLIC_COGNITO_LOGOUT_PATH: "/auth/logout",
  NEXT_PUBLIC_REQUIRE_LIVE_AUTH: "true",
  NEXT_PUBLIC_ENABLE_BACKUP_ADMIN: "false",
  NEXT_PUBLIC_ADMIN_APP_URL: "https://admin.yuzucigarclub.com",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "vapid-public-key",
  VAPID_PUBLIC_KEY: "vapid-public-key",
  VAPID_PRIVATE_KEY: "vapid-private-key",
  VAPID_SUBJECT: "mailto:alerts@yuzucigarclub.com",
  STRIPE_TOBACCO_APPROVAL_CONFIRMED: "true",
  STRIPE_SECRET_KEY: fakeLiveStripeSecret,
  STRIPE_WEBHOOK_SECRET: fakeWebhookSecret,
  STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID: "bpc_validlaunchportal",
  STRIPE_PRICE_BOX_ACCESS_PASS_MONTHLY: "price_boxmonthly",
  STRIPE_PRICE_BOX_ACCESS_PASS_QUARTERLY: "price_boxquarterly",
  STRIPE_PRICE_BOX_ACCESS_PASS_YEARLY: "price_boxyearly",
  STRIPE_PRICE_KISHA_MONTHLY: "price_kishamonthly",
  STRIPE_PRICE_KISHA_QUARTERLY: "price_kishaquarterly",
  STRIPE_PRICE_KISHA_YEARLY: "price_kishayearly",
  STRIPE_PRICE_SENSEI_MONTHLY: "price_senseimonthly",
  STRIPE_PRICE_SENSEI_QUARTERLY: "price_senseiquarterly",
  STRIPE_PRICE_SENSEI_YEARLY: "price_senseiyearly",
  STRIPE_PRICE_DAIMYO_MONTHLY: "price_daimyomonthly",
  STRIPE_PRICE_DAIMYO_QUARTERLY: "price_daimyoquarterly",
  STRIPE_PRICE_DAIMYO_YEARLY: "price_daimyoyearly",
  STRIPE_TEST_MODE_E2E_CONFIRMED: "true",
  AGE_VERIFICATION_PROVIDER_CONFIRMED: "true",
  TAX_PROVIDER_CONFIRMED: "true",
  SHIPPING_PROVIDER: "USPS",
  ADULT_SIGNATURE_CARRIER_APPROVED: "true",
  AWS_RESTORE_DRILL_COMPLETED: "true",
  STAGING_BROWSER_QA_PASSED: "true",
  WAF_OR_RATE_LIMITING_ACCEPTED: "true",
};

test("parses env files without retaining comments or quotes", () => {
  assert.deepEqual(
    parseEnvSource(`
      # Comment
      NEXT_PUBLIC_BASE_URL="https://www.yuzucigarclub.com"
      EMPTY=
      STRIPE_SECRET_KEY='sk_test_replace_me'
    `),
    {
      NEXT_PUBLIC_BASE_URL: "https://www.yuzucigarclub.com",
      EMPTY: "",
      STRIPE_SECRET_KEY: "sk_test_replace_me",
    },
  );
});

test("detects placeholders without exposing secret values", () => {
  assert.deepEqual(
    findPlaceholderKeys({
      STRIPE_SECRET_KEY: "sk_test_replace_me",
      STRIPE_WEBHOOK_SECRET: "whsec_replace_me",
      STRIPE_PRICE_SENSEI_MONTHLY: "price_123",
    }),
    ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  );
});

test("go-live readiness passes when storefront, commerce, compliance, QA, and AWS gates are confirmed", () => {
  const checks = assessLaunchReadiness(completeEnv, { strictExternal: true });
  assert.deepEqual(
    checks.filter((check) => check.status === "fail"),
    [],
  );
});

test("go-live readiness requires mobile push VAPID settings", () => {
  const checks = assessLaunchReadiness(
    {
      ...completeEnv,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
      VAPID_SUBJECT: "",
    },
    { strictExternal: true },
  );
  const failedIds = checks.filter((check) => check.status === "fail").map((check) => check.id);

  assert.deepEqual(failedIds.sort(), [
    "next-public-vapid-public-key-configured",
    "vapid-public-key-configured",
    "vapid-private-key-configured",
    "vapid-subject-configured",
    "vapid-public-key-match",
  ].sort());
});

test("go-live readiness requires matching browser and server VAPID public keys", () => {
  const checks = assessLaunchReadiness(
    {
      ...completeEnv,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "browser-public-key",
      VAPID_PUBLIC_KEY: "server-public-key",
      VAPID_PRIVATE_KEY: "private-key",
      VAPID_SUBJECT: "mailto:alerts@yuzucigarclub.com",
    },
    { strictExternal: true },
  );

  const matchCheck = checks.find((check) => check.id === "vapid-public-key-match");
  assert.ok(matchCheck, "VAPID public key parity check should run");
  assert.equal(matchCheck.status, "fail");
});

test("commerce provider secret marks tax unconfirmed unless the live provider is ready", () => {
  assert.equal(materializeCommerceSecretEnv({ tax: { ready: true } }).TAX_PROVIDER_CONFIRMED, "true");
  assert.equal(materializeCommerceSecretEnv({ tax: { status: "ready" } }).TAX_PROVIDER_CONFIRMED, "true");
  assert.equal(materializeCommerceSecretEnv({ tax: { ready: false } }).TAX_PROVIDER_CONFIRMED, "false");
  assert.equal(materializeCommerceSecretEnv({ tax: { status: "pending" } }).TAX_PROVIDER_CONFIRMED, "false");
});

test("commerce provider secret carries confirmed Stripe tobacco approval", () => {
  assert.equal(
    materializeCommerceSecretEnv({
      stripe: {
        tobaccoApprovalConfirmed: true,
      },
    }).STRIPE_TOBACCO_APPROVAL_CONFIRMED,
    "true",
  );
  assert.equal(
    materializeCommerceSecretEnv({
      stripe_tobacco_approval_confirmed: "yes",
    }).STRIPE_TOBACCO_APPROVAL_CONFIRMED,
    "true",
  );
});

test("commerce provider secret carries nested USPS adult-signature readiness", () => {
  assert.equal(
    materializeCommerceSecretEnv({
      shipping: {
        provider: "USPS",
        adultSignature: {
          accountConfigured: true,
        },
      },
    }).ADULT_SIGNATURE_CARRIER_APPROVED,
    "true",
  );
});

test("local ops readiness warns instead of blocking on external launch gates", () => {
  const checks = assessLaunchReadiness(
    {
      ...completeEnv,
      STRIPE_TOBACCO_APPROVAL_CONFIRMED: "false",
      STRIPE_SECRET_KEY: "",
      SHIPPING_PROVIDER: "UPS",
      ADULT_SIGNATURE_CARRIER_APPROVED: "false",
    },
    { strictExternal: false },
  );

  assert.deepEqual(
    checks.filter((check) => check.status === "fail"),
    [],
  );
  assert.ok(checks.some((check) => check.status === "warn" && check.id === "stripe-approval"));
  assert.ok(checks.some((check) => check.status === "warn" && check.id === "stripe-secret"));
  assert.ok(checks.some((check) => check.status === "warn" && check.id === "shipping-provider-usps"));
  assert.ok(checks.some((check) => check.status === "warn" && check.id === "adult-signature-carrier"));
});

test("strict readiness fails when external launch gates are missing or unsafe", () => {
  const checks = assessLaunchReadiness(
    {
      ...completeEnv,
      NEXT_PUBLIC_ADMIN_APP_URL: "admin.example.com",
      NEXT_PUBLIC_REQUIRE_LIVE_AUTH: "false",
      NEXT_PUBLIC_ENABLE_BACKUP_ADMIN: "true",
      STRIPE_TOBACCO_APPROVAL_CONFIRMED: "false",
      STRIPE_SECRET_KEY: "sk_test_replace_me",
      AGE_VERIFICATION_PROVIDER_CONFIRMED: "false",
      SHIPPING_PROVIDER: "UPS",
    },
    { strictExternal: true },
  );
  const failedIds = checks.filter((check) => check.status === "fail").map((check) => check.id);

  assert.deepEqual(failedIds.sort(), [
    "live-auth-required",
    "backup-admin-disabled",
    "stripe-approval",
    "stripe-secret",
    "age-verification-provider",
    "shipping-provider-usps",
    "next-public-admin-app-url-configured",
    "admin-url-format",
  ].sort());
});

test("non-strict readiness warns if admin app URL is not configured", () => {
  const checks = assessLaunchReadiness(
    {
      ...completeEnv,
      NEXT_PUBLIC_ADMIN_APP_URL: "",
    },
    { strictExternal: false },
  );

  const adminAppCheck = checks.find((check) => check.id === "admin-url-format");
  assert.ok(adminAppCheck, "admin app URL check should be present in readiness output");
  assert.equal(adminAppCheck.status, "warn");
});

test("admin hand-off URL fails strict checks when not absolute", () => {
  const checks = assessLaunchReadiness(
    {
      ...completeEnv,
      NEXT_PUBLIC_ADMIN_APP_URL: "admin.example.com",
    },
    { strictExternal: true },
  );

  const adminUrlFormatCheck = checks.find((check) => check.id === "admin-url-format");
  assert.ok(adminUrlFormatCheck, "admin URL format check should run");
  assert.equal(adminUrlFormatCheck.status, "fail");
});

test("deploy zip validation rejects Windows paths and nested build folders", () => {
  assert.deepEqual(validateDeployZipEntries(["index.html", "_next/static/app.js", "assets/yuzu-logo.png"]), []);
  assert.deepEqual(validateDeployZipEntries(["out/index.html", "assets\\yuzu-logo.png", ".next/server/app.js"]), [
    "out/index.html",
    "assets\\yuzu-logo.png",
    ".next/server/app.js",
  ]);
});

test("Amplify custom headers include production browser security headers", () => {
  const customHeaders = readFileSync("customHttp.yml", "utf8");

  assert.match(customHeaders, /pattern:\s*"?\*\*"?/u);

  for (const headerName of [
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-Content-Type-Options",
  ]) {
    assert.match(customHeaders, new RegExp(`key:\\s*"${headerName}"`, "u"));
  }

  assert.match(customHeaders, /frame-ancestors 'none'/u);
  assert.match(customHeaders, /object-src 'none'/u);
  assert.match(customHeaders, /connect-src 'self' https:\/\/api\.yuzucigarclub\.com/u);
  assert.match(customHeaders, /script-src[^"]*https:\/\/www\.googletagmanager\.com/u);
  assert.match(customHeaders, /img-src[^"]*https:\/\/www\.google-analytics\.com/u);
  assert.match(customHeaders, /img-src[^"]*https:\/\/classroom2\.s3\.us-east-1\.amazonaws\.com/u);
  assert.match(customHeaders, /connect-src[^"]*https:\/\/www\.google-analytics\.com/u);
});

test("Lambda deploy zip validation requires runtime files, CA bundle, and migrations", () => {
  assert.deepEqual(
    validateLambdaDeployZipEntries([
      "index.js",
      "commerce-rules.js",
      "stripe-commerce.js",
      "global-bundle.pem",
      "migrations/0001_phase3_app_schema.sql",
      "migrations/0002_commerce_schema.sql",
      "migrations/0003_site_content_schema.sql",
      "migrations/0004_newsroom_schema.sql",
      "migrations/0005_member_stripe_customer_link.sql",
      "node_modules/pg/package.json",
    ]),
    [],
  );

  assert.deepEqual(validateLambdaDeployZipEntries(["index.js", "infra/lambda/ycc-api/index.js", "assets\\bad.js"]), [
    "missing:commerce-rules.js",
    "missing:stripe-commerce.js",
    "missing:global-bundle.pem",
    "missing:migrations/0001_phase3_app_schema.sql",
    "missing:migrations/0002_commerce_schema.sql",
    "missing:migrations/0003_site_content_schema.sql",
    "missing:migrations/0004_newsroom_schema.sql",
    "missing:migrations/0005_member_stripe_customer_link.sql",
    "invalid:infra/lambda/ycc-api/index.js",
    "invalid:assets\\bad.js",
  ]);
});

test("artifact cleanup plan preserves the newest deploy zip and removes generated leftovers", () => {
  const plan = planGeneratedArtifactCleanup(
    [
      { name: "old.zip", fullName: "C:/repo/old.zip", lastWriteTimeMs: 10 },
      { name: "new.zip", fullName: "C:/repo/new.zip", lastWriteTimeMs: 20 },
    ],
    "C:/repo/output",
  );

  assert.equal(plan.keepZip?.name, "new.zip");
  assert.deepEqual(
    plan.removePaths,
    ["C:/repo/old.zip", "C:/repo/output"],
  );
});

test("local browser automation evidence artifacts stay out of commits", () => {
  const gitignore = readFileSync(".gitignore", "utf8");

  assert.match(gitignore, /^\.playwright-cli\/$/m);
});
