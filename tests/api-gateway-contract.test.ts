import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const templateSource = readFileSync(new URL("../infra/ycc-phase1-edge.yaml", import.meta.url), "utf8");

const expectedRouteAuth = new Map([
  ["GET /health", "NONE"],
  ["GET /account/me", "JWT"],
  ["PATCH /account/me", "JWT"],
  ["GET /content/pages", "NONE"],
  ["POST /newsletter/subscribe", "NONE"],
  ["GET /news/stories", "NONE"],
  ["POST /news/story-drafts", "JWT"],
  ["POST /news/stories", "JWT"],
  ["POST /commerce/checkout-session", "NONE"],
  ["POST /commerce/age-verification-token", "NONE"],
  ["POST /commerce/membership-session", "NONE"],
  ["POST /commerce/webhook/stripe", "NONE"],
  ["GET /commerce/checkout-session/{id}", "NONE"],
  ["POST /commerce/customer-portal-session", "JWT"],
  ["GET /commerce/membership", "JWT"],
  ["GET /commerce/orders", "JWT"],
  ["GET /commerce/orders/{id}", "JWT"],
  ["GET /admin/commerce/orders", "JWT"],
  ["PATCH /admin/commerce/orders/{id}", "JWT"],
  ["POST /admin/commerce/stripe-sync-products", "JWT"],
  ["GET /admin/commerce/webhook-events", "JWT"],
  ["GET /admin/commerce/compliance-holds", "JWT"],
  ["GET /admin/members", "JWT"],
  ["PATCH /admin/members/{id}/access", "JWT"],
  ["POST /concierge/chat", "JWT"],
  ["POST /concierge/voice", "JWT"],
  ["POST /support/email-draft", "JWT"],
  ["POST /support/email-send", "JWT"],
  ["POST /humidor/identify-cigar", "JWT"],
  ["GET /humidor/items", "JWT"],
  ["POST /humidor/items", "JWT"],
  ["PATCH /humidor/items/{id}", "JWT"],
  ["PATCH /humidor/items/{id}/enrich", "JWT"],
  ["GET /humidor/alerts", "JWT"],
  ["POST /humidor/alerts", "JWT"],
  ["POST /humidor/alerts/dispatch", "NONE"],
]);

function getRouteAuthorization(routeKey: string) {
  const escapedRoute = routeKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = templateSource.match(new RegExp(`RouteKey:\\s*(?:"${escapedRoute}"|'${escapedRoute}'|${escapedRoute})\\s*(?:\\r?\\n)[\\s\\S]*?AuthorizationType:\\s*(\\w+)`));
  return match?.[1] ?? null;
}

test("API Gateway template exposes every frontend commerce and humidor Lambda route", () => {
  for (const [routeKey, authorizationType] of expectedRouteAuth) {
    assert.equal(getRouteAuthorization(routeKey), authorizationType, `${routeKey} should be routable with ${authorizationType} auth`);
  }
});

test("API Gateway template allows Bedrock action groups to invoke the shared Lambda", () => {
  assert.match(templateSource, /Principal:\s*bedrock\.amazonaws\.com/);
  assert.match(templateSource, /Action:\s*lambda:InvokeFunction/);

  for (const agentId of ["NDIEDXNZAV", "EJI2VA7AVF", "SJJ2DVNYES", "XLN9JKVRDA", "UQWB6AKMBT", "TUVBTVKNXG"]) {
    assert.match(templateSource, new RegExp(`bedrock:[\\s\\S]*:agent/${agentId}`));
  }
});

test("API Gateway CORS allows Stripe webhook signatures", () => {
  assert.match(templateSource, /AllowHeaders:[\s\S]*stripe-signature/);
  assert.match(templateSource, /AllowHeaders:[\s\S]*x-humidor-alert-dispatch-secret/);
  assert.match(templateSource, /AllowMethods:[\s\S]*PATCH/);
});

test("API Gateway CORS allows the deployed storefront origins", () => {
  assert.match(templateSource, /AllowOrigins:[\s\S]*https:\/\/yuzucigarclub\.com/);
  assert.match(templateSource, /AllowOrigins:[\s\S]*https:\/\/www\.yuzucigarclub\.com/);
  assert.match(templateSource, /AdminAppOrigin:[\s\S]*Default: https:\/\/admin\.yuzucigarclub\.com/);
  assert.match(templateSource, /AllowOrigins:[\s\S]*!Ref AdminAppOrigin/);
  assert.match(templateSource, /AmplifyStagingOrigin:[\s\S]*Default: https:\/\/staging\.d2yxcklt245wh0\.amplifyapp\.com/);
  assert.match(templateSource, /AllowOrigins:[\s\S]*!Ref AmplifyStagingOrigin/);
});

test("local callback, logout, and CORS overrides are restricted to non-production stacks", () => {
  assert.match(templateSource, /IsProdEnvironment:\s*!Equals \[!Ref EnvironmentName, prod\]/);
  assert.match(templateSource, /HasLocalCallbackUrl:\s*!And[\s\S]*!Condition IsNonProdEnvironment/);
  assert.match(templateSource, /HasLocalLogoutUrl:\s*!And[\s\S]*!Condition IsNonProdEnvironment/);
  assert.match(templateSource, /HasLocalCorsOrigin:\s*!And[\s\S]*!Condition IsNonProdEnvironment/);
});

test("Cognito OAuth redirects include admin and deployed storefront origins", () => {
  assert.match(templateSource, /AdminCallbackUrl:[\s\S]*Default: https:\/\/admin\.yuzucigarclub\.com\/auth\/callback/);
  assert.match(templateSource, /AdminLogoutUrl:[\s\S]*Default: https:\/\/admin\.yuzucigarclub\.com\/auth\/logout/);
  assert.match(templateSource, /CallbackURLs:[\s\S]*!Ref AdminCallbackUrl/);
  assert.match(templateSource, /LogoutURLs:[\s\S]*!Ref AdminLogoutUrl/);
});

test("API Gateway integration invokes the live Lambda alias", () => {
  assert.match(templateSource, /ExistingLambdaLiveAliasArn:[\s\S]*Default: arn:aws:lambda:us-east-1:374587466106:function:ycyyy:live/);
  assert.match(templateSource, /IntegrationUri:\s*!Ref ExistingLambdaLiveAliasArn/);
  assert.match(templateSource, /ApiInvokePermission:[\s\S]*FunctionName:\s*!Ref ExistingLambdaLiveAliasArn/);

  for (const liveAliasLogicalId of [
    "BedrockYccConciergeInvokePermission",
    "BedrockYccCigarGuideInvokePermission",
    "BedrockYccSupportInvokePermission",
    "BedrockYccHumidorInvokePermission",
    "BedrockYccAdminInvokePermission",
    "BedrockYccNewsInvokePermission",
  ]) {
    const permissionBlock = templateSource.match(
      new RegExp(`\\n  ${liveAliasLogicalId}:[\\s\\S]*?(?=\\n  [A-Za-z0-9]+:|\\nOutputs:)`),
    )?.[0];

    assert.ok(permissionBlock, `${liveAliasLogicalId} should exist`);
    assert.match(permissionBlock, /FunctionName:\s*!Ref ExistingLambdaLiveAliasArn/);
    assert.doesNotMatch(permissionBlock, /FunctionName:\s*!Ref ExistingLambdaName/);
  }

  assert.doesNotMatch(
    templateSource,
    /BedrockYcc(?:Concierge|CigarGuide|Support|Humidor|Admin|News)UnqualifiedInvokePermission/,
    "Bedrock action groups should not recreate unqualified Lambda invoke permissions",
  );
});
