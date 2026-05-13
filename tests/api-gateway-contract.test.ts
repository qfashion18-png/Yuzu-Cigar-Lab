import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const templateSource = readFileSync(new URL("../infra/ycc-phase1-edge.yaml", import.meta.url), "utf8");

const expectedRouteAuth = new Map([
  ["GET /health", "NONE"],
  ["GET /account/me", "JWT"],
  ["GET /content/pages", "NONE"],
  ["POST /newsletter/subscribe", "NONE"],
  ["GET /news/stories", "NONE"],
  ["POST /news/story-drafts", "JWT"],
  ["POST /news/stories", "JWT"],
  ["POST /commerce/checkout-session", "NONE"],
  ["POST /commerce/membership-session", "NONE"],
  ["POST /commerce/webhook/stripe", "NONE"],
  ["GET /commerce/checkout-session/{id}", "NONE"],
  ["POST /commerce/customer-portal-session", "JWT"],
  ["GET /commerce/membership", "JWT"],
  ["GET /commerce/orders", "JWT"],
  ["GET /commerce/orders/{id}", "JWT"],
  ["POST /admin/commerce/stripe-sync-products", "JWT"],
  ["GET /admin/commerce/webhook-events", "JWT"],
  ["GET /admin/commerce/compliance-holds", "JWT"],
  ["POST /concierge/chat", "JWT"],
  ["POST /concierge/voice", "JWT"],
  ["POST /support/email-draft", "JWT"],
  ["POST /support/email-send", "JWT"],
  ["POST /humidor/identify-cigar", "JWT"],
  ["GET /humidor/items", "JWT"],
  ["POST /humidor/items", "JWT"],
  ["GET /humidor/alerts", "JWT"],
  ["POST /humidor/alerts", "JWT"],
  ["POST /humidor/alerts/dispatch", "NONE"],
]);

function getRouteAuthorization(routeKey: string) {
  const escapedRoute = routeKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = templateSource.match(new RegExp(`RouteKey:\\s*["']?${escapedRoute}["']?[\\s\\S]*?AuthorizationType:\\s*(\\w+)`));
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
});

test("API Gateway CORS allows the deployed storefront origins", () => {
  assert.match(templateSource, /AllowOrigins:[\s\S]*https:\/\/yuzucigarclub\.com/);
  assert.match(templateSource, /AllowOrigins:[\s\S]*https:\/\/www\.yuzucigarclub\.com/);
  assert.match(templateSource, /AmplifyStagingOrigin:[\s\S]*Default: https:\/\/staging\.d2yxcklt245wh0\.amplifyapp\.com/);
  assert.match(templateSource, /AllowOrigins:[\s\S]*!Ref AmplifyStagingOrigin/);
});

test("local callback, logout, and CORS overrides are restricted to non-production stacks", () => {
  assert.match(templateSource, /IsProdEnvironment:\s*!Equals \[!Ref EnvironmentName, prod\]/);
  assert.match(templateSource, /HasLocalCallbackUrl:\s*!And[\s\S]*!Condition IsNonProdEnvironment/);
  assert.match(templateSource, /HasLocalLogoutUrl:\s*!And[\s\S]*!Condition IsNonProdEnvironment/);
  assert.match(templateSource, /HasLocalCorsOrigin:\s*!And[\s\S]*!Condition IsNonProdEnvironment/);
});
