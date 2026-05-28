import { createRequire } from "node:module";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import tls from "node:tls";

const require = createRequire(import.meta.url);
const Module = require("node:module");

type HttpLambdaResponse = {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
};

type BedrockActionGroupResponse = {
  messageVersion: "1.0";
  response: {
    actionGroup: string;
    function: string;
    functionResponse: {
      responseState?: "FAILURE" | "REPROMPT";
      responseBody: {
        TEXT: {
          body: string;
        };
      };
    };
  };
  sessionAttributes: Record<string, unknown>;
  promptSessionAttributes: Record<string, unknown>;
};

const { handler } = require("../infra/lambda/ycc-api/index.js") as {
  handler: (event: Record<string, unknown>, context?: Record<string, unknown>) => Promise<HttpLambdaResponse>;
};

const originalModuleLoad = Module._load;

function createAuthenticatedEvent(
  routeKey: string,
  body?: Record<string, unknown>,
  claims: Record<string, unknown> = actorClaims
) {
  const [method, rawPath] = routeKey.split(" ");

  return {
    routeKey,
    rawPath,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "user-agent": "node-test",
    },
    requestContext: {
      requestId: `req-${routeKey.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      http: { method, sourceIp: "198.51.100.42" },
      authorizer: { jwt: { claims } },
    },
  };
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

type TestCheckoutAgeIdentity = {
  customer?: {
    email?: string;
    phone?: string;
    fullName?: string;
    name?: string;
  };
  shippingAddress?: {
    address1?: string;
    address2?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    zip?: string;
    country?: string;
  };
};

const defaultCheckoutAgeIdentity: TestCheckoutAgeIdentity = {
  customer: {
    email: "member@example.com",
    phone: "",
    fullName: "",
  },
  shippingAddress: {
    address1: "123 Yuzu Way",
    address2: "",
    city: "Chandler",
    state: "AZ",
    postalCode: "85225",
    country: "US",
  },
};

function createTestCheckoutAgeIdentityHash(identity: TestCheckoutAgeIdentity = defaultCheckoutAgeIdentity) {
  const customer = identity.customer || {};
  const shippingAddress = identity.shippingAddress || {};
  const normalized = {
    email: String(customer.email || "").trim().toLowerCase(),
    phone: String(customer.phone || "").trim().replace(/\s+/g, " "),
    fullName: String(customer.fullName || customer.name || "").trim().replace(/\s+/g, " ").toLowerCase(),
    address1: String(shippingAddress.address1 || shippingAddress.line1 || "").trim().replace(/\s+/g, " ").toLowerCase(),
    address2: String(shippingAddress.address2 || shippingAddress.line2 || "").trim().replace(/\s+/g, " ").toLowerCase(),
    city: String(shippingAddress.city || "").trim().replace(/\s+/g, " ").toLowerCase(),
    state: String(shippingAddress.state || "").trim().toUpperCase(),
    postalCode: String(shippingAddress.postalCode || shippingAddress.zip || "").trim().replace(/\s+/g, "").toUpperCase(),
    country: String(shippingAddress.country || "US").trim().toUpperCase(),
  };

  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("base64url");
}

function decodeSignedTokenPayload(token: string) {
  const payloadSegment = token.split(".")[1] || "";
  return JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
}

function createSignedAgeVerificationToken(
  secret = "age-secret",
  vendorTransactionId = "age_txn_12345678",
  identityHash = createTestCheckoutAgeIdentityHash()
) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    txn: vendorTransactionId,
    iat: nowSeconds,
    exp: nowSeconds + 15 * 60,
    verifiedAt: new Date(nowSeconds * 1000).toISOString(),
    identityHash,
  };
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const signedMessage = `yccav1.${payloadSegment}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedMessage)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${signedMessage}.${signature}`;
}

function createSignedMembershipEntitlementToken(secret = "membership-secret", email = "member@example.com") {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    sub: "member-123",
    email,
    status: "member",
    tiers: ["sensei"],
    iat: nowSeconds,
    exp: nowSeconds + 15 * 60,
  };
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const signedMessage = `yccmem1.${payloadSegment}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedMessage)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${signedMessage}.${signature}`;
}

function installPersistenceMocks(
  options: {
    agentReply?: string;
    agentRuntimeError?: boolean;
    bedrockReply?: string;
    rekognitionError?: boolean;
    rekognitionTextDetections?: Array<Record<string, unknown>>;
    lexIntentName?: string;
    lexConfidence?: number;
    lexDialogActionType?: string;
    lexSlotToElicit?: string;
    lexSlots?: Record<string, string>;
    lexMessages?: Array<Record<string, unknown>>;
    lexError?: boolean;
    pollyAudio?: string;
    retrieveText?: string;
    transcribeTranscript?: string;
    dispatchRows?: Array<Record<string, unknown>>;
    climateRows?: Array<Record<string, unknown>>;
    memberProfileRows?: Array<Record<string, unknown>>;
    humidorItemRows?: Array<Record<string, unknown>>;
    adminOrderRows?: Array<Record<string, unknown>>;
    adminMemberRows?: Array<Record<string, unknown>>;
    memberStripeCustomerId?: string | null;
    memberSubscriptionRows?: Array<Record<string, unknown>>;
    memberUpsertEmailConflict?: boolean;
    commerceSecret?: Record<string, unknown>;
    s3Objects?: Record<string, unknown>;
    webPushOutcomes?: Record<string, "ok" | "gone" | "not_found">;
  } = {}
) {
  const clients: Array<{
      queries: Array<{ sql: string; params: unknown[] }>;
      config: Record<string, unknown>;
      connected: boolean;
      ended: boolean;
  }> = [];
  const rekognitionInvocations: Record<string, unknown>[] = [];
  let memberUpsertAttempts = 0;

  class RecordingPgClient {
    queries: Array<{ sql: string; params: unknown[] }> = [];
    config: Record<string, unknown>;
    connected = false;
    ended = false;

    constructor(config: Record<string, unknown>) {
      this.config = config;
      clients.push(this);
    }

    async connect() {
      this.connected = true;
    }

    async end() {
      this.ended = true;
    }

    async query(sql: string, params: unknown[] = []) {
      this.queries.push({ sql: String(sql), params });
      const normalized = String(sql).replace(/\s+/g, " ").toLowerCase();

      if (normalized.includes("from pg_database")) {
        return {
          rows: [{ "?column?": 1 }],
          rowCount: 1,
        };
      }

      if (normalized.includes("from information_schema.tables")) {
        const requestedTables = Array.isArray(params[0]) ? params[0] : ["site_page_content"];
        return {
          rows: requestedTables.map((table) => ({ table_name: table })),
          rowCount: requestedTables.length,
        };
      }

      if (normalized.includes("from public.schema_migrations")) {
        const version = normalized.includes("'0003'") ? "0003" : normalized.includes("'0002'") ? "0002" : "0001";
        return {
          rows: [
            {
              version,
              name: version === "0003" ? "site_content_schema" : version === "0002" ? "commerce_schema" : "phase3_app_schema",
              applied_at: "2026-05-08T10:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("from pg_indexes")) {
        return {
          rows: [{ index_count: 42 }],
          rowCount: 1,
        };
      }

      if (
        normalized.includes("select stripe_customer_id") &&
        normalized.includes("from public.members") &&
        normalized.includes("where id = $1")
      ) {
        return {
          rows:
            options.memberStripeCustomerId === undefined
              ? []
              : [{ stripe_customer_id: options.memberStripeCustomerId }],
          rowCount: options.memberStripeCustomerId === undefined ? 0 : 1,
        };
      }

      if (normalized.includes("select stripe_customer_id") && normalized.includes("from public.member_subscriptions")) {
        return {
          rows: [{ stripe_customer_id: "cus_member_123" }],
          rowCount: 1,
        };
      }

      if (
        normalized.includes("from public.member_subscriptions") &&
        normalized.includes("stripe_subscription_id") &&
        normalized.includes("tier_key") &&
        normalized.includes("billing_period") &&
        normalized.includes("limit 1")
      ) {
        const rows = options.memberSubscriptionRows || [
          {
            id: "33333333-3333-4333-8333-333333333333",
            email: actorClaims.email,
            stripe_customer_id: "cus_member_123",
            stripe_subscription_id: "sub_member_123",
            stripe_price_id: "price_sensei_monthly",
            stripe_checkout_session_id: "cs_member_123",
            tier_key: "sensei",
            billing_period: "monthly",
            status: "active",
            current_period_end: "2026-06-20T00:00:00.000Z",
            created_at: "2026-05-20T00:00:00.000Z",
            updated_at: "2026-05-20T00:00:00.000Z",
          },
        ];
        return {
          rows,
          rowCount: rows.length,
        };
      }

      if (normalized.includes("select stripe_customer_id") && normalized.includes("from public.commerce_orders")) {
        return {
          rows: [{ stripe_customer_id: "cus_order_123" }],
          rowCount: 1,
        };
      }

      if (
        normalized.includes("select id, status, fulfillment_status") &&
        normalized.includes("from public.commerce_orders") &&
        normalized.includes("stripe_checkout_session_id = $1")
      ) {
        return {
          rows: [{ id: "88888888-8888-4888-8888-888888888888", status: "paid", fulfillment_status: "pending" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("select id from public.members") && normalized.includes("where lower(email) = lower($1)")) {
        return {
          rows: [{ id: "11111111-1111-4111-8111-111111111111" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("select id from public.stripe_events") && normalized.includes("where id = $1")) {
        return {
          rows: [],
          rowCount: 0,
        };
      }

      if (normalized.includes("insert into public.stripe_events")) {
        return {
          rows: [{ id: "evt_test_123" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("update public.stripe_events")) {
        return {
          rows: [{ id: "evt_test_123" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.commerce_orders")) {
        return {
          rows: [{ id: "88888888-8888-4888-8888-888888888888", status: "paid", fulfillment_status: "pending" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.member_subscriptions")) {
        return {
          rows: [{ id: "33333333-3333-4333-8333-333333333333", status: params[8] || "active" }],
          rowCount: 1,
        };
      }

      if (
        normalized.includes("update public.members") &&
        normalized.includes("stripe_customer_id = coalesce") &&
        normalized.includes("where id = $1") &&
        normalized.includes("other.stripe_customer_id")
      ) {
        return {
          rows: [
            {
              id: params[0],
              stripe_customer_id: params[1],
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.commerce_audit_log")) {
        return {
          rows: [{ id: "99999999-9999-4999-8999-999999999999" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("admin_orders_summary")) {
        return {
          rows: [
            {
              orders_total: 1,
              orders_paid: 1,
              orders_pending: 0,
              orders_fulfilled: 0,
              orders_needs_attention: 1,
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("admin_orders_list")) {
        return {
          rows: options.adminOrderRows || [
            {
              id: "88888888-8888-4888-8888-888888888888",
              stripe_checkout_session_id: "cs_test_admin",
              email: "member@example.com",
              status: "paid",
              fulfillment_status: "not_started",
              compliance_status: "verified",
              subtotal_cents: 12000,
              tax_cents: 792,
              shipping_cents: 0,
              total_cents: 12792,
              currency: "usd",
              item_count: 2,
              customer_name: "Yuzu Member",
              member_role: "customer",
              membership_tier: "sensei",
              member_status: "active",
              created_at: "2026-05-12T10:00:00.000Z",
              updated_at: "2026-05-12T10:05:00.000Z",
            },
          ],
          rowCount: options.adminOrderRows?.length || 1,
        };
      }

      if (normalized.includes("admin_order_update")) {
        return {
          rows: [
            {
              id: params[0],
              stripe_checkout_session_id: "cs_test_admin",
              email: "member@example.com",
              status: params[1] || "paid",
              fulfillment_status: params[2] || "not_started",
              compliance_status: params[3] || "verified",
              subtotal_cents: 12000,
              tax_cents: 792,
              shipping_cents: 0,
              total_cents: 12792,
              currency: "usd",
              item_count: 2,
              customer_name: "Yuzu Member",
              member_role: "customer",
              membership_tier: "sensei",
              member_status: "active",
              created_at: "2026-05-12T10:00:00.000Z",
              updated_at: "2026-05-12T10:10:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("admin_members_summary")) {
        return {
          rows: [
            {
              members_total: 1,
              members_admins: 0,
              members_operators: 0,
              members_active: 1,
              members_non_member: 0,
              members_banned: 0,
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("admin_members_list")) {
        return {
          rows: options.adminMemberRows || [
            {
              id: "11111111-1111-4111-8111-111111111111",
              cognito_sub: "member-123",
              email: "member@example.com",
              email_verified: true,
              display_name: "Yuzu Member",
              role: "customer",
              membership_tier: "sensei",
              member_status: "active",
              last_seen_at: "2026-05-12T09:00:00.000Z",
              created_at: "2026-05-06T09:00:00.000Z",
              updated_at: "2026-05-12T09:10:00.000Z",
              subscription_status: "active",
              subscription_tier: "sensei",
              subscription_period: "monthly",
              order_count: 1,
              total_spend_cents: 12792,
              humidor_item_count: 3,
            },
          ],
          rowCount: options.adminMemberRows?.length || 1,
        };
      }

      if (normalized.includes("admin_member_access_update")) {
        return {
          rows: [
            {
              id: params[0],
              cognito_sub: "member-123",
              email: "member@example.com",
              email_verified: true,
              display_name: "Yuzu Member",
              role: params[1] || "customer",
              membership_tier: params[2],
              member_status: params[4] || "active",
              last_seen_at: "2026-05-12T09:00:00.000Z",
              created_at: "2026-05-06T09:00:00.000Z",
              updated_at: "2026-05-12T10:15:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.members")) {
        memberUpsertAttempts += 1;
        if (options.memberUpsertEmailConflict && memberUpsertAttempts === 1) {
          const error = new Error("duplicate key value violates unique constraint \"members_email_lower_uidx\"") as Error & {
            code?: string;
            constraint?: string;
          };
          error.code = "23505";
          error.constraint = "members_email_lower_uidx";
          throw error;
        }

        return {
          rows: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              cognito_sub: actorClaims.sub,
              email: actorClaims.email,
              display_name: actorClaims.name,
              role: "customer",
              membership_tier: "sensei",
              member_status: "active",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("update public.members") && normalized.includes("where lower(email) = lower($1)")) {
        return {
          rows: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              cognito_sub: params[1],
              email: params[0],
              display_name: params[3],
              role: params[4],
              membership_tier: params[5],
              member_status: params[6],
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("select preferences") && normalized.includes("from public.member_profiles")) {
        return {
          rows: [
            {
              preferences: {
                pushEnabled: true,
                reorderRemindersEnabled: true,
                climateAlertsEnabled: false,
                humidorProfile: {
                  humidorName: "Home cabinet",
                  defaultLocation: "Walk-in Humidor",
                  locations: [
                    { name: "Walk-in Humidor", kind: "humidor", trays: ["Top Tray", "Bottom Tray"] },
                    { name: "Locker B", kind: "other", trays: [] },
                  ],
                },
                pushSubscription: {
                  endpoint: "https://example.com/endpoint",
                  keys: {
                    p256dh: "p256dh-key",
                    auth: "auth-key",
                  },
                },
              },
            },
          ],
          rowCount: 1,
        };
      }

      if (
        normalized.includes("from public.member_profiles") &&
        normalized.includes("jsonb_array_length") &&
        normalized.includes("paireddevices")
      ) {
        return {
          rows: options.memberProfileRows || [],
          rowCount: options.memberProfileRows?.length || 0,
        };
      }

      if (normalized.includes("select phone, shipping_profile") && normalized.includes("from public.member_profiles")) {
        return {
          rows: [
            {
              phone: "4805552121",
              shipping_profile: {
                address1: "111 W Boston St",
                address2: "Suite 5",
                city: "Chandler",
                state: "AZ",
                postalCode: "85225",
                country: "US",
              },
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.member_profiles") && normalized.includes("shipping_profile")) {
        return {
          rows: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              phone: params[1],
              shipping_profile: JSON.parse(String(params[2] || "{}")),
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.member_profiles")) {
        return {
          rows: [
            {
              preferences: JSON.parse(String(params[1] || "{}")),
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.conversations")) {
        return {
          rows: [{ id: "22222222-2222-4222-8222-222222222222", status: "open" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.conversation_messages")) {
        return {
          rows: [{ id: "23232323-2323-4232-8232-232323232323" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.support_cases")) {
        return {
          rows: [{ id: "33333333-3333-4333-8333-333333333333", case_number: "YCC-TESTCASE" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.support_email_messages")) {
        return {
          rows: [{ id: "44444444-4444-4444-8444-444444444444" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.newsletter_subscribers")) {
        return {
          rows: [
            {
              id: "66666666-6666-4666-8666-666666666666",
              email: "reader@example.com",
              wants_monthly_membership: true,
              preferred_tier: "sensei",
              updated_at: "2026-05-06T09:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("select") && normalized.includes("from public.news_stories")) {
        return {
          rows: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              slug: "rocky-patel-official-release-update",
              title: "Rocky Patel Official Release Update",
              dek: "A short official-source update for adult cigar readers.",
              category: "Industry News",
              body_markdown: "## What changed\nRocky Patel posted official release details.",
              source_notes: [
                {
                  label: "Rocky Patel",
                  url: "https://www.rockypatel.com/cigar-news/sixty-release/",
                  note: "Official brand page.",
                  sourceType: "official",
                },
              ],
              official_sources: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
              metadata: {
                images: [
                  {
                    label: "Rocky Patel Sixty",
                    image: "https://www.rockypatel.com/wp-content/uploads/2026/05/rocky-patel-sixty.jpg",
                    imagePosition: "50% 45%",
                    alt: "Rocky Patel Sixty story image",
                    sourceUrl: "https://www.rockypatel.com/cigar-news/sixty-release/",
                  },
                ],
              },
              status: "published",
              published_at: "2026-05-11T19:00:00.000Z",
              updated_at: "2026-05-11T19:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.news_stories")) {
        return {
          rows: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              slug: params[0],
              title: params[1],
              dek: params[2],
              category: params[3],
              body_markdown: params[4],
              source_notes: JSON.parse(String(params[5] || "[]")),
              official_sources: JSON.parse(String(params[6] || "[]")),
              metadata: JSON.parse(String(params[9] || "{}")),
              status: params[7],
              published_at: "2026-05-11T19:00:00.000Z",
              updated_at: "2026-05-11T19:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.humidor_items")) {
        return {
          rows: [{ id: "55555555-5555-4555-8555-555555555555", created_at: "2026-05-06T09:00:00.000Z" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("humidor_item_enrichment_lookup")) {
        return {
          rows: options.humidorItemRows || [],
          rowCount: options.humidorItemRows?.length || 0,
        };
      }

      if (
        normalized.includes("select") &&
        normalized.includes("from public.humidor_items") &&
        normalized.includes("where member_id = $1") &&
        normalized.includes("archived_at is null")
      ) {
        return {
          rows: options.humidorItemRows || [],
          rowCount: options.humidorItemRows?.length || 0,
        };
      }

      if (normalized.includes("humidor_item_enrichment_update")) {
        const existing = options.humidorItemRows?.[0] || {};
        return {
          rows: [
            {
              ...existing,
              id: params[0],
              brand: params[2],
              line: params[3],
              vitola: params[4],
              wrapper: params[5],
              origin: params[6],
              strength: params[7],
              tasting_notes: params[8],
              metadata: JSON.parse(String(params[9] || "{}")),
              created_at: existing.created_at || "2026-05-06T09:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("humidor_item_location_update")) {
        const existing = options.humidorItemRows?.[0] || {};
        return {
          rows: [
            {
              ...existing,
              id: params[0],
              aging_start_date: params[5] || existing.aging_start_date,
              humidor_location: params[2] || existing.humidor_location,
              tray: params[3] ? params[4] : existing.tray,
              created_at: existing.created_at || "2026-05-06T09:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (
        normalized.includes("from public.members m") &&
        normalized.includes("join public.member_profiles mp") &&
        normalized.includes("join public.humidor_items hi")
      ) {
        return {
          rows: options.dispatchRows || [],
          rowCount: options.dispatchRows?.length || 0,
        };
      }

      if (
        normalized.includes("from public.members m") &&
        normalized.includes("join public.member_profiles mp") &&
        normalized.includes("climatealertsenabled")
      ) {
        return {
          rows: options.climateRows || [],
          rowCount: options.climateRows?.length || 0,
        };
      }

      if (normalized.includes("update public.humidor_items") && normalized.includes("metadata = coalesce(metadata")) {
        return {
          rows: [{ id: String(params[1] || "55555555-5555-4555-8555-555555555555"), metadata: {} }],
          rowCount: 1,
        };
      }

      if (normalized.includes("select route, edits, published_at, updated_at from public.site_page_content")) {
        return {
          rows: [
            {
              route: params[0],
              edits: { "home.hero.title": "Published live headline" },
              published_at: "2026-05-08T10:00:00.000Z",
              updated_at: "2026-05-08T10:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.site_page_content")) {
        return {
          rows: [
            {
              route: params[0],
              edits: JSON.parse(String(params[1] || "{}")),
              published_at: "2026-05-08T10:05:00.000Z",
              updated_at: "2026-05-08T10:05:00.000Z",
            },
          ],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 0 };
    }
  }

  const agentInvocations: Array<Record<string, unknown>> = [];
  const bedrockInvocations: Array<Record<string, unknown>> = [];
  const knowledgeBaseRetrievals: Array<Record<string, unknown>> = [];
  const lexInvocations: Array<Record<string, unknown>> = [];
  const pollyInvocations: Array<Record<string, unknown>> = [];
  const s3Invocations: Array<Record<string, unknown>> = [];
  const secretsManagerInvocations: Array<Record<string, unknown>> = [];
  const sesInvocations: Array<Record<string, unknown>> = [];
  const transcribeInvocations: Array<Record<string, unknown>> = [];
  type WebPushSetVapidDetails = (vapidSubject: string, vapidPublicKey: string, vapidPrivateKey: string) => void;
  type WebPushSendNotification = (subscription: Record<string, unknown>, payload: string) => Promise<unknown>;
  type WebPushModule = {
    setVapidDetails: WebPushSetVapidDetails;
    sendNotification: WebPushSendNotification;
  };
  const webPushInvocations: Array<{ subscription: unknown; payload: string }> = [];
  let webPushModule: WebPushModule | null = null;
  let originalWebPushSetVapidDetails: WebPushSetVapidDetails | undefined;
  let originalWebPushSendNotification: WebPushSendNotification | undefined;

  try {
    webPushModule = require("web-push") as WebPushModule;
    originalWebPushSetVapidDetails = webPushModule.setVapidDetails;
    originalWebPushSendNotification = webPushModule.sendNotification;
  } catch {
    webPushModule = null;
  }

  if (webPushModule) {
    webPushModule.setVapidDetails = (vapidSubject: string, vapidPublicKey: string, vapidPrivateKey: string) => {
      webPushInvocations.push({
        subscription: { action: "setVapidDetails", vapidSubject, vapidPublicKey, vapidPrivateKey },
        payload: "",
      });
    };

    webPushModule.sendNotification = async (subscription: Record<string, unknown>, payload: string) => {
      webPushInvocations.push({ subscription, payload });

      const endpoint = String(subscription.endpoint || "unknown");
      const result = options.webPushOutcomes?.[endpoint] || "ok";
      if (result === "gone") {
        const error = new Error("Endpoint gone") as Error & { statusCode: number };
        error.statusCode = 410;
        error.name = "WebPushEndpointGone";
        throw error;
      }

      if (result === "not_found") {
        const error = new Error("Endpoint not found") as Error & { statusCode: number };
        error.statusCode = 404;
        error.name = "WebPushEndpointNotFound";
        throw error;
      }
    };
  }

  class InvokeAgentCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class RetrieveCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class BedrockAgentRuntimeClient {
    async send(command: InvokeAgentCommand | RetrieveCommand) {
      if (command instanceof RetrieveCommand) {
        knowledgeBaseRetrievals.push(command.input);
        return {
          retrievalResults: [
            {
              content: {
                text: options.retrieveText || "Published YCC catalog context says Connecticut shade wrappers pair well with morning coffee.",
              },
              location: {
                s3Location: {
                  uri: "s3://classroom2/ycc/knowledge-base/catalog.md",
                },
              },
              score: 0.91,
            },
          ],
        };
      }

      agentInvocations.push(command.input);
      if (options.agentRuntimeError) {
        throw new Error("agent runtime unavailable");
      }

      const reply = options.agentReply || "YCC agent says the answer should use the published knowledge base.";
      return {
        completion: (async function* completion() {
          yield { chunk: { bytes: Buffer.from(reply, "utf8") } };
        })(),
      };
    }
  }

  class ConverseCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class BedrockRuntimeClient {
    async send(command: ConverseCommand) {
      bedrockInvocations.push(command.input);
      return {
        output: {
          message: {
            content: [{ text: options.bedrockReply || "Bedrock says the wrapper pairing should stay balanced and age-gated." }],
          },
        },
        usage: {
          inputTokens: 30,
          outputTokens: 18,
          totalTokens: 48,
        },
        stopReason: "end_turn",
      };
    }
  }

  class DetectTextCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class RekognitionClient {
    async send(command: DetectTextCommand) {
      rekognitionInvocations.push(command.input);
      if (options.rekognitionError) {
        throw new Error("rekognition unavailable");
      }

      return {
        TextDetections:
          options.rekognitionTextDetections || [
            {
              DetectedText: "PADRON 1964",
              Type: "LINE",
              Confidence: 98.4,
            },
          ],
      };
    }
  }

  class RecognizeTextCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class LexRuntimeV2Client {
    async send(command: RecognizeTextCommand) {
      lexInvocations.push(command.input);
      if (options.lexError) {
        throw new Error("lex unavailable");
      }

      const intentName = options.lexIntentName || "YCCConciergeIntent";
      const slots = Object.fromEntries(
        Object.entries(options.lexSlots || {}).map(([slotName, interpretedValue]) => [
          slotName,
          {
            value: {
              interpretedValue,
              originalValue: interpretedValue,
              resolvedValues: [interpretedValue],
            },
          },
        ])
      );
      const dialogActionType = options.lexDialogActionType || "Close";

      return {
        interpretations: [
          {
            intent: {
              name: intentName,
              slots,
              state: dialogActionType === "ElicitSlot" ? "InProgress" : "ReadyForFulfillment",
            },
            nluConfidence: {
              score: options.lexConfidence ?? 0.91,
            },
          },
        ],
        messages: options.lexMessages || [],
        sessionId: String(command.input.sessionId || "lex-session"),
        sessionState: {
          dialogAction: {
            type: dialogActionType,
            slotToElicit: options.lexSlotToElicit,
          },
          intent: {
            name: intentName,
            slots,
            state: dialogActionType === "ElicitSlot" ? "InProgress" : "ReadyForFulfillment",
          },
          sessionAttributes: {
            lexSession: "active",
          },
        },
      };
    }
  }

  class GetSecretValueCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class GetObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class PutObjectCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class S3Client {
    async send(command: GetObjectCommand | PutObjectCommand) {
      s3Invocations.push(command.input);

      if (command instanceof PutObjectCommand) {
        return { ETag: '"voice-object-etag"' };
      }

      const key = String(command.input.Key || "");
      if (Object.prototype.hasOwnProperty.call(options.s3Objects || {}, key)) {
        const value = options.s3Objects?.[key];
        return {
          Body: {
            async transformToString() {
              return typeof value === "string" ? value : JSON.stringify(value);
            },
          },
        };
      }

      if (key.endsWith(".json")) {
        return {
          Body: {
            async transformToString() {
              return JSON.stringify({
                results: {
                  transcripts: [
                    {
                      transcript: options.transcribeTranscript || "Track the humidity in my desktop humidor",
                    },
                  ],
                },
              });
            },
          },
        };
      }

      return {
        Body: {
          async transformToString() {
            return [
              "From: Customer One <customer@example.com>",
              "To: support@yuzucigarclub.com",
              "Subject: Renewal charge question",
              "Message-ID: <ses-message-123@example.com>",
              "",
              "Can someone help me understand my renewal charge?",
            ].join("\r\n");
          },
        },
      };
    }
  }

  class StartTranscriptionJobCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class GetTranscriptionJobCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class DeleteTranscriptionJobCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class TranscribeClient {
    async send(command: StartTranscriptionJobCommand | GetTranscriptionJobCommand | DeleteTranscriptionJobCommand) {
      transcribeInvocations.push(command.input);

      if (command instanceof GetTranscriptionJobCommand) {
        return {
          TranscriptionJob: {
            TranscriptionJobStatus: "COMPLETED",
          },
        };
      }

      return {};
    }
  }

  class SynthesizeSpeechCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class PollyClient {
    async send(command: SynthesizeSpeechCommand) {
      pollyInvocations.push(command.input);
      return {
        ContentType: "audio/mpeg",
        AudioStream: {
          async transformToByteArray() {
            return Buffer.from(options.pollyAudio || "fake-mp3", "utf8");
          },
        },
      };
    }
  }

  class SendEmailCommand {
    input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class SESv2Client {
    async send(command: SendEmailCommand) {
      sesInvocations.push(command.input);
      return { MessageId: "ses-outbound-message-123" };
    }
  }

  class WebPushClient {
    setVapidDetails(vapidSubject: string, vapidPublicKey: string, vapidPrivateKey: string) {
      webPushInvocations.push({
        subscription: { action: "setVapidDetails", vapidSubject, vapidPublicKey, vapidPrivateKey },
        payload: "",
      });
    }

    async sendNotification(subscription: Record<string, unknown>, payload: string) {
      webPushInvocations.push({ subscription, payload });

      const endpoint = String((subscription as { endpoint?: string }).endpoint || "unknown");
      const result = options.webPushOutcomes?.[endpoint] || "ok";
      if (result === "gone") {
        const error = new Error("Endpoint gone") as Error & { statusCode: number };
        error.statusCode = 410;
        error.name = "WebPushEndpointGone";
        throw error;
      }

      if (result === "not_found") {
        const error = new Error("Endpoint not found") as Error & { statusCode: number };
        error.statusCode = 404;
        error.name = "WebPushEndpointNotFound";
        throw error;
      }
    }
  }

  class SecretsManagerClient {
    async send(command: GetSecretValueCommand) {
      secretsManagerInvocations.push(command.input);
      const secretId = String(command.input.SecretId || "");
      if (secretId.includes("/commerce") || secretId.includes(":secret:ycc/commerce/")) {
        return {
          SecretString: JSON.stringify(options.commerceSecret || {}),
        };
      }

      return {
        SecretString: JSON.stringify({ username: "postgres", password: "secret" }),
      };
    }
  }

  Module._load = function load(request: string, parent: unknown, isMain: boolean) {
    if (request === "pg") {
      return { Client: RecordingPgClient };
    }

    if (request === "web-push") {
      return webPushModule || new WebPushClient();
    }

    if (request === "@aws-sdk/client-secrets-manager") {
      return { GetSecretValueCommand, SecretsManagerClient };
    }

    if (request === "@aws-sdk/client-s3") {
      return { GetObjectCommand, PutObjectCommand, S3Client };
    }

    if (request === "@aws-sdk/client-sesv2") {
      return { SendEmailCommand, SESv2Client };
    }

    if (request === "@aws-sdk/client-transcribe") {
      return { DeleteTranscriptionJobCommand, GetTranscriptionJobCommand, StartTranscriptionJobCommand, TranscribeClient };
    }

    if (request === "@aws-sdk/client-polly") {
      return { PollyClient, SynthesizeSpeechCommand };
    }

    if (request === "@aws-sdk/client-bedrock-runtime") {
      return { BedrockRuntimeClient, ConverseCommand };
    }

    if (request === "@aws-sdk/client-rekognition") {
      return { DetectTextCommand, RekognitionClient };
    }

    if (request === "@aws-sdk/client-lex-runtime-v2") {
      return { LexRuntimeV2Client, RecognizeTextCommand };
    }

    if (request === "@aws-sdk/client-bedrock-agent-runtime") {
      return { BedrockAgentRuntimeClient, InvokeAgentCommand, RetrieveCommand };
    }

    return originalModuleLoad.call(this, request, parent, isMain);
  };

  const previousEnv = {
    DB_PROXY_ENDPOINT: process.env.DB_PROXY_ENDPOINT,
    DB_SECRET_ARN: process.env.DB_SECRET_ARN,
    DB_NAME: process.env.DB_NAME,
    HUMIDOR_ALERT_DISPATCH_SECRET: process.env.HUMIDOR_ALERT_DISPATCH_SECRET,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    FEATURE_DB_WRITES: process.env.FEATURE_DB_WRITES,
    FEATURE_BEDROCK: process.env.FEATURE_BEDROCK,
    FEATURE_LEX_ROUTER: process.env.FEATURE_LEX_ROUTER,
    LEX_ROUTER_BOT_ID: process.env.LEX_ROUTER_BOT_ID,
    LEX_ROUTER_BOT_ALIAS_ID: process.env.LEX_ROUTER_BOT_ALIAS_ID,
    LEX_ROUTER_LOCALE_ID: process.env.LEX_ROUTER_LOCALE_ID,
    FEATURE_REKOGNITION: process.env.FEATURE_REKOGNITION,
    REKOGNITION_MIN_TEXT_CONFIDENCE: process.env.REKOGNITION_MIN_TEXT_CONFIDENCE,
    FEATURE_CONCIERGE_VOICE: process.env.FEATURE_CONCIERGE_VOICE,
    FEATURE_SES: process.env.FEATURE_SES,
    SUPPORT_CONTACT_EMAIL_TO: process.env.SUPPORT_CONTACT_EMAIL_TO,
    SUPPORT_EMAIL_FROM: process.env.SUPPORT_EMAIL_FROM,
    SUPPORT_EMAIL_INBOUND_RECIPIENT: process.env.SUPPORT_EMAIL_INBOUND_RECIPIENT,
    SUPPORT_EMAIL_RAW_BUCKET: process.env.SUPPORT_EMAIL_RAW_BUCKET,
    SUPPORT_EMAIL_RAW_PREFIX: process.env.SUPPORT_EMAIL_RAW_PREFIX,
    CONCIERGE_POLLY_ENGINE: process.env.CONCIERGE_POLLY_ENGINE,
    CONCIERGE_POLLY_VOICE_ID: process.env.CONCIERGE_POLLY_VOICE_ID,
    CONCIERGE_VOICE_BUCKET: process.env.CONCIERGE_VOICE_BUCKET,
    CONCIERGE_VOICE_PREFIX: process.env.CONCIERGE_VOICE_PREFIX,
    CONCIERGE_VOICE_TRANSCRIBE_MAX_WAIT_MS: process.env.CONCIERGE_VOICE_TRANSCRIBE_MAX_WAIT_MS,
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    BEDROCK_ENABLE_GUARDRAILS: process.env.BEDROCK_ENABLE_GUARDRAILS,
    BEDROCK_GUARDRAIL_ID: process.env.BEDROCK_GUARDRAIL_ID,
    BEDROCK_GUARDRAIL_VERSION: process.env.BEDROCK_GUARDRAIL_VERSION,
    BEDROCK_KNOWLEDGE_BASE_ID: process.env.BEDROCK_KNOWLEDGE_BASE_ID,
    BEDROCK_AGENT_YCCCIGARGUIDE_ID: process.env.BEDROCK_AGENT_YCCCIGARGUIDE_ID,
    BEDROCK_AGENT_YCCCIGARGUIDE_ALIAS_ID: process.env.BEDROCK_AGENT_YCCCIGARGUIDE_ALIAS_ID,
    BEDROCK_AGENT_YCCSUPPORTAGENT_ID: process.env.BEDROCK_AGENT_YCCSUPPORTAGENT_ID,
    BEDROCK_AGENT_YCCSUPPORTAGENT_ALIAS_ID: process.env.BEDROCK_AGENT_YCCSUPPORTAGENT_ALIAS_ID,
    BEDROCK_AGENT_YCCHUMIDORAGENT_ID: process.env.BEDROCK_AGENT_YCCHUMIDORAGENT_ID,
    BEDROCK_AGENT_YCCHUMIDORAGENT_ALIAS_ID: process.env.BEDROCK_AGENT_YCCHUMIDORAGENT_ALIAS_ID,
    BEDROCK_AGENT_YCCNEWSAGENT_ID: process.env.BEDROCK_AGENT_YCCNEWSAGENT_ID,
    BEDROCK_AGENT_YCCNEWSAGENT_ALIAS_ID: process.env.BEDROCK_AGENT_YCCNEWSAGENT_ALIAS_ID,
    RDS_SSLMODE: process.env.RDS_SSLMODE,
    RDS_SSLROOTCERT: process.env.RDS_SSLROOTCERT,
    COMMERCE_PROVIDER_SECRET_ARN: process.env.COMMERCE_PROVIDER_SECRET_ARN,
    COMMERCE_PROVIDER_SECRET_ID: process.env.COMMERCE_PROVIDER_SECRET_ID,
    YCC_COMMERCE_SECRET_ARN: process.env.YCC_COMMERCE_SECRET_ARN,
    YCC_COMMERCE_SECRET_ID: process.env.YCC_COMMERCE_SECRET_ID,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_LAUNCH_CATALOG_READY: process.env.STRIPE_LAUNCH_CATALOG_READY,
    STRIPE_LAUNCH_CATALOG_JSON: process.env.STRIPE_LAUNCH_CATALOG_JSON,
    FEATURE_STRIPE_TAX: process.env.FEATURE_STRIPE_TAX,
    STRIPE_PRICE_SENSEI_MONTHLY: process.env.STRIPE_PRICE_SENSEI_MONTHLY,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
    AGE_VERIFICATION_SIGNING_SECRET: process.env.AGE_VERIFICATION_SIGNING_SECRET,
    MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET: process.env.MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET,
    ALLOW_LEGACY_AGE_VERIFICATION_TOKEN: process.env.ALLOW_LEGACY_AGE_VERIFICATION_TOKEN,
  };

  process.env.DB_PROXY_ENDPOINT = "proxy.test.local";
  process.env.DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:ycc/test";
  process.env.DB_NAME = "postgresycc";
  process.env.HUMIDOR_ALERT_DISPATCH_SECRET = "humidor-dispatch-secret";
  process.env.VAPID_PUBLIC_KEY = "BOGUS_PUBLIC_KEY";
  process.env.VAPID_PRIVATE_KEY = "BOGUS_PRIVATE_KEY";
  process.env.VAPID_SUBJECT = "mailto:alerts@yuzucigarclub.com";
  process.env.FEATURE_DB_WRITES = "schema_ready";
  process.env.FEATURE_BEDROCK = "runtime_ready";
  process.env.FEATURE_LEX_ROUTER = "pending_bot";
  process.env.LEX_ROUTER_BOT_ID = "";
  process.env.LEX_ROUTER_BOT_ALIAS_ID = "";
  process.env.LEX_ROUTER_LOCALE_ID = "en_US";
  process.env.FEATURE_REKOGNITION = "pending_service";
  process.env.REKOGNITION_MIN_TEXT_CONFIDENCE = "70";
  process.env.FEATURE_CONCIERGE_VOICE = "ready";
  process.env.FEATURE_SES = "ready";
  process.env.SUPPORT_CONTACT_EMAIL_TO = "support@yuzucigarclub.com";
  process.env.SUPPORT_EMAIL_FROM = "support@yuzucigarclub.com";
  process.env.SUPPORT_EMAIL_INBOUND_RECIPIENT = "support@ses-support.yuzucigarclub.com";
  process.env.SUPPORT_EMAIL_RAW_BUCKET = "classroom2";
  process.env.SUPPORT_EMAIL_RAW_PREFIX = "ycc/support-email/raw/";
  process.env.CONCIERGE_POLLY_ENGINE = "neural";
  process.env.CONCIERGE_POLLY_VOICE_ID = "Joanna";
  process.env.CONCIERGE_VOICE_BUCKET = "classroom2";
  process.env.CONCIERGE_VOICE_PREFIX = "ycc/concierge-voice/";
  process.env.CONCIERGE_VOICE_TRANSCRIBE_MAX_WAIT_MS = "2000";
  process.env.BEDROCK_MODEL_ID = "amazon.nova-lite-v1:0";
  process.env.BEDROCK_ENABLE_GUARDRAILS = "1";
  process.env.BEDROCK_GUARDRAIL_ID = "guardrail-test";
  process.env.BEDROCK_GUARDRAIL_VERSION = "1";
  process.env.BEDROCK_KNOWLEDGE_BASE_ID = "KBTEST1";
  process.env.BEDROCK_AGENT_YCCCIGARGUIDE_ID = "AGENTGUIDE1";
  process.env.BEDROCK_AGENT_YCCCIGARGUIDE_ALIAS_ID = "ALIASGUIDE";
  process.env.BEDROCK_AGENT_YCCSUPPORTAGENT_ID = "AGENTSUPPORT1";
  process.env.BEDROCK_AGENT_YCCSUPPORTAGENT_ALIAS_ID = "ALIASSUPPORT";
  process.env.BEDROCK_AGENT_YCCNEWSAGENT_ID = "AGENTNEWS1";
  process.env.BEDROCK_AGENT_YCCNEWSAGENT_ALIAS_ID = "ALIASNEWS";

  return {
    agentInvocations,
    bedrockInvocations,
    clients,
    knowledgeBaseRetrievals,
    lexInvocations,
    pollyInvocations,
    rekognitionInvocations,
    s3Invocations,
    secretsManagerInvocations,
    sesInvocations,
    transcribeInvocations,
    webPushInvocations,
    restore() {
      if (webPushModule) {
        if (originalWebPushSetVapidDetails) {
          webPushModule.setVapidDetails = originalWebPushSetVapidDetails;
        }
        if (originalWebPushSendNotification) {
          webPushModule.sendNotification = originalWebPushSendNotification;
        }
      }
      Module._load = originalModuleLoad;
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
  };
}

function installStripeMock(
  options: {
    createSession?: Record<string, unknown>;
    portalSession?: Record<string, unknown>;
    retrieveSession?: Record<string, unknown>;
    retrieveError?: unknown;
    webhookEvent?: Record<string, unknown>;
  } = {}
) {
  const checkoutSessionsCreated: Record<string, unknown>[] = [];
  const checkoutSessionsRetrieved: string[] = [];
  const billingPortalSessionsCreated: Record<string, unknown>[] = [];
  const previousModuleLoad = Module._load;
  const previousEnv = {
    COMMERCE_PROVIDER_SECRET_ARN: process.env.COMMERCE_PROVIDER_SECRET_ARN,
    COMMERCE_PROVIDER_SECRET_ID: process.env.COMMERCE_PROVIDER_SECRET_ID,
    YCC_COMMERCE_SECRET_ARN: process.env.YCC_COMMERCE_SECRET_ARN,
    YCC_COMMERCE_SECRET_ID: process.env.YCC_COMMERCE_SECRET_ID,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_LAUNCH_CATALOG_READY: process.env.STRIPE_LAUNCH_CATALOG_READY,
    STRIPE_LAUNCH_CATALOG_JSON: process.env.STRIPE_LAUNCH_CATALOG_JSON,
    FEATURE_STRIPE_TAX: process.env.FEATURE_STRIPE_TAX,
    STRIPE_PRICE_SENSEI_MONTHLY: process.env.STRIPE_PRICE_SENSEI_MONTHLY,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
    AGE_VERIFICATION_SIGNING_SECRET: process.env.AGE_VERIFICATION_SIGNING_SECRET,
    MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET: process.env.MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET,
    ALLOW_LEGACY_AGE_VERIFICATION_TOKEN: process.env.ALLOW_LEGACY_AGE_VERIFICATION_TOKEN,
  };

  class Stripe {
    checkout = {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          checkoutSessionsCreated.push(params);
          return options.createSession || { id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" };
        },
        retrieve: async (sessionId: string) => {
          checkoutSessionsRetrieved.push(sessionId);
          if (options.retrieveError) {
            throw options.retrieveError;
          }
          return options.retrieveSession || { id: sessionId, payment_status: "paid", status: "complete", metadata: { order_id: "order_123" } };
        },
      },
    };

    billingPortal = {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          billingPortalSessionsCreated.push(params);
          return options.portalSession || { url: "https://billing.stripe.com/p/session/test" };
        },
      },
    };

    webhooks = {
      constructEvent: () =>
        options.webhookEvent || {
          id: "evt_test_123",
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_123",
              customer: "cus_test_123",
              customer_details: {
                email: "member@example.com",
                name: "Member",
                address: {
                  line1: "123 Yuzu Way",
                  city: "Chandler",
                  state: "AZ",
                  postal_code: "85225",
                  country: "US",
                },
              },
              payment_intent: "pi_test_123",
              payment_status: "paid",
              amount_subtotal: 12000,
              amount_total: 12792,
              currency: "usd",
              status: "complete",
              total_details: {
                amount_shipping: 0,
                amount_tax: 792,
              },
              metadata: {
                age_verification_id: "age_txn_12345678",
                shipping_method_id: "usps-adult-signature-ground",
              },
            },
          },
        },
    };
  }

  Module._load = function load(request: string, parent: unknown, isMain: boolean) {
    if (request === "stripe") {
      return Stripe;
    }

    return previousModuleLoad.call(this, request, parent, isMain);
  };

  return {
    billingPortalSessionsCreated,
    checkoutSessionsCreated,
    checkoutSessionsRetrieved,
    restore() {
      Module._load = previousModuleLoad;
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    },
  };
}

const actorClaims = {
  sub: "member-123",
  email: "member@yuzucigarclub.example",
  email_verified: "true",
  name: "Yuzu Member",
  "cognito:groups": "member,sensei",
  "custom:membership_tier": "Sensei",
  "custom:member_status": "member",
};

const adminClaims = {
  ...actorClaims,
  sub: "admin-123",
  email: "admin@yuzucigarclub.example",
  name: "Yuzu Admin",
  "cognito:groups": "admin,concierge_operator",
};

test("health route returns service contract", async () => {
  const response = await handler({
    routeKey: "GET /health",
    rawPath: "/health",
    requestContext: { requestId: "req-health", http: { method: "GET" } },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.service, "ycc-api");
  assert.equal(body.capabilities.conciergeContract, true);
});

test("health route reports degraded when the configured RDS CA bundle is missing", async () => {
  const previousFeatureDbWrites = process.env.FEATURE_DB_WRITES;
  const previousSslMode = process.env.RDS_SSLMODE;
  const previousSslRootCert = process.env.RDS_SSLROOTCERT;

  try {
    process.env.FEATURE_DB_WRITES = "schema_ready";
    process.env.RDS_SSLMODE = "verify-full";
    process.env.RDS_SSLROOTCERT = "missing-global-bundle.pem";

    const response = await handler({
      routeKey: "GET /health",
      rawPath: "/health",
      requestContext: { requestId: "req-health-missing-ca", http: { method: "GET" } },
    });

    assert.equal(response.statusCode, 503);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "degraded");
    assert.equal(body.db.ssl.mode, "verify-full");
    assert.equal(body.db.ssl.rootCertConfigured, true);
    assert.equal(body.db.ssl.rootCertReadable, false);
  } finally {
    if (previousFeatureDbWrites === undefined) {
      delete process.env.FEATURE_DB_WRITES;
    } else {
      process.env.FEATURE_DB_WRITES = previousFeatureDbWrites;
    }

    if (previousSslMode === undefined) {
      delete process.env.RDS_SSLMODE;
    } else {
      process.env.RDS_SSLMODE = previousSslMode;
    }

    if (previousSslRootCert === undefined) {
      delete process.env.RDS_SSLROOTCERT;
    } else {
      process.env.RDS_SSLROOTCERT = previousSslRootCert;
    }
  }
});

test("protected routes reject missing Cognito claims", async () => {
  const response = await handler({
    routeKey: "GET /account/me",
    rawPath: "/account/me",
    requestContext: { requestId: "req-account", http: { method: "GET" } },
  });

  assert.equal(response.statusCode, 401);
});

test("commerce checkout route is registered as a public pre-auth route", async () => {
  const response = await handler({
    routeKey: "POST /commerce/checkout-session",
    rawPath: "/commerce/checkout-session",
    body: JSON.stringify({
      items: [{ sku: "APPROVED-BOX", quantity: 1 }],
      customer: { email: "member@example.com" },
      shippingMethodId: "usps-adult-signature-ground",
    }),
    requestContext: { requestId: "req-commerce-checkout", http: { method: "POST" } },
  });

  assert.notEqual(response.statusCode, 401);
  assert.notEqual(response.statusCode, 404);
});

test("commerce age verification route exchanges an accepted AgeChecker UUID for a signed checkout token", async () => {
  const previousApiKey = process.env.AGE_VERIFICATION_API_KEY;
  const previousApiSecret = process.env.AGE_VERIFICATION_API_SECRET;
  const previousSigningSecret = process.env.AGE_VERIFICATION_SIGNING_SECRET;
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  try {
    process.env.AGE_VERIFICATION_API_KEY = "agechecker-domain-api-key";
    process.env.AGE_VERIFICATION_API_SECRET = "agechecker-account-secret";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ status: "accepted", uuid: "12345678901234567890123456789012" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const response = await handler({
      routeKey: "POST /commerce/age-verification-token",
      rawPath: "/commerce/age-verification-token",
      body: JSON.stringify({
        vendorTransactionId: "12345678901234567890123456789012",
        ...defaultCheckoutAgeIdentity,
      }),
      requestContext: { requestId: "req-commerce-age-token", http: { method: "POST" } },
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.match(body.ageVerificationToken, /^yccav1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(decodeSignedTokenPayload(body.ageVerificationToken).identityHash, createTestCheckoutAgeIdentityHash());
    assert.equal(body.vendorTransactionId, "age_txn_12345678901234567890123456789012");
    assert.equal(calls[0].url, "https://api.agechecker.net/v1/status/12345678901234567890123456789012");
    assert.equal(calls[0].init?.method, "GET");
    assert.equal(new Headers(calls[0].init?.headers).get("X-AgeChecker-Secret"), "agechecker-account-secret");
    assert.equal(calls[0].init?.body, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.AGE_VERIFICATION_API_KEY;
    } else {
      process.env.AGE_VERIFICATION_API_KEY = previousApiKey;
    }

    if (previousApiSecret === undefined) {
      delete process.env.AGE_VERIFICATION_API_SECRET;
    } else {
      process.env.AGE_VERIFICATION_API_SECRET = previousApiSecret;
    }

    if (previousSigningSecret === undefined) {
      delete process.env.AGE_VERIFICATION_SIGNING_SECRET;
    } else {
      process.env.AGE_VERIFICATION_SIGNING_SECRET = previousSigningSecret;
    }
  }
});

test("commerce age verification route requires checkout identity details before signing a token", async () => {
  const previousApiKey = process.env.AGE_VERIFICATION_API_KEY;
  const previousApiSecret = process.env.AGE_VERIFICATION_API_SECRET;
  const previousSigningSecret = process.env.AGE_VERIFICATION_SIGNING_SECRET;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  try {
    process.env.AGE_VERIFICATION_API_KEY = "agechecker-domain-api-key";
    process.env.AGE_VERIFICATION_API_SECRET = "agechecker-account-secret";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ status: "accepted" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const response = await handler({
      routeKey: "POST /commerce/age-verification-token",
      rawPath: "/commerce/age-verification-token",
      body: JSON.stringify({ vendorTransactionId: "12345678901234567890123456789012" }),
      requestContext: { requestId: "req-commerce-age-token-missing-identity", http: { method: "POST" } },
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 400);
    assert.equal(body.error, "age_verification_identity_required");
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.AGE_VERIFICATION_API_KEY;
    } else {
      process.env.AGE_VERIFICATION_API_KEY = previousApiKey;
    }

    if (previousApiSecret === undefined) {
      delete process.env.AGE_VERIFICATION_API_SECRET;
    } else {
      process.env.AGE_VERIFICATION_API_SECRET = previousApiSecret;
    }

    if (previousSigningSecret === undefined) {
      delete process.env.AGE_VERIFICATION_SIGNING_SECRET;
    } else {
      process.env.AGE_VERIFICATION_SIGNING_SECRET = previousSigningSecret;
    }
  }
});

test("commerce age verification route requires an AgeChecker account secret for status lookups", async () => {
  const previousApiKey = process.env.AGE_VERIFICATION_API_KEY;
  const previousApiSecret = process.env.AGE_VERIFICATION_API_SECRET;
  const previousAccountSecret = process.env.AGE_VERIFICATION_ACCOUNT_SECRET;
  const previousSigningSecret = process.env.AGE_VERIFICATION_SIGNING_SECRET;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  try {
    process.env.AGE_VERIFICATION_API_KEY = "agechecker-domain-api-key";
    delete process.env.AGE_VERIFICATION_API_SECRET;
    delete process.env.AGE_VERIFICATION_ACCOUNT_SECRET;
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(JSON.stringify({ status: "accepted" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const response = await handler({
      routeKey: "POST /commerce/age-verification-token",
      rawPath: "/commerce/age-verification-token",
      body: JSON.stringify({ vendorTransactionId: "12345678901234567890123456789012" }),
      requestContext: { requestId: "req-commerce-age-token-missing-secret", http: { method: "POST" } },
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 409);
    assert.equal(body.error, "age_verification_not_configured");
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.AGE_VERIFICATION_API_KEY;
    } else {
      process.env.AGE_VERIFICATION_API_KEY = previousApiKey;
    }

    if (previousApiSecret === undefined) {
      delete process.env.AGE_VERIFICATION_API_SECRET;
    } else {
      process.env.AGE_VERIFICATION_API_SECRET = previousApiSecret;
    }

    if (previousAccountSecret === undefined) {
      delete process.env.AGE_VERIFICATION_ACCOUNT_SECRET;
    } else {
      process.env.AGE_VERIFICATION_ACCOUNT_SECRET = previousAccountSecret;
    }

    if (previousSigningSecret === undefined) {
      delete process.env.AGE_VERIFICATION_SIGNING_SECRET;
    } else {
      process.env.AGE_VERIFICATION_SIGNING_SECRET = previousSigningSecret;
    }
  }
});

test("commerce age verification route rejects pending AgeChecker verifications", async () => {
  const previousApiKey = process.env.AGE_VERIFICATION_API_KEY;
  const previousApiSecret = process.env.AGE_VERIFICATION_API_SECRET;
  const previousSigningSecret = process.env.AGE_VERIFICATION_SIGNING_SECRET;
  const originalFetch = globalThis.fetch;

  try {
    process.env.AGE_VERIFICATION_API_KEY = "agechecker-domain-api-key";
    process.env.AGE_VERIFICATION_API_SECRET = "agechecker-account-secret";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ status: "photo_id", uuid: "12345678901234567890123456789012" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const response = await handler({
      routeKey: "POST /commerce/age-verification-token",
      rawPath: "/commerce/age-verification-token",
      body: JSON.stringify({
        vendorTransactionId: "12345678901234567890123456789012",
        ...defaultCheckoutAgeIdentity,
      }),
      requestContext: { requestId: "req-commerce-age-token-pending", http: { method: "POST" } },
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 409);
    assert.equal(body.error, "age_verification_pending");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.AGE_VERIFICATION_API_KEY;
    } else {
      process.env.AGE_VERIFICATION_API_KEY = previousApiKey;
    }

    if (previousApiSecret === undefined) {
      delete process.env.AGE_VERIFICATION_API_SECRET;
    } else {
      process.env.AGE_VERIFICATION_API_SECRET = previousApiSecret;
    }

    if (previousSigningSecret === undefined) {
      delete process.env.AGE_VERIFICATION_SIGNING_SECRET;
    } else {
      process.env.AGE_VERIFICATION_SIGNING_SECRET = previousSigningSecret;
    }
  }
});

test("commerce age verification route maps AgeChecker status misses to a controlled failure", async () => {
  const previousApiKey = process.env.AGE_VERIFICATION_API_KEY;
  const previousApiSecret = process.env.AGE_VERIFICATION_API_SECRET;
  const previousSigningSecret = process.env.AGE_VERIFICATION_SIGNING_SECRET;
  const originalFetch = globalThis.fetch;

  try {
    process.env.AGE_VERIFICATION_API_KEY = "agechecker-domain-api-key";
    process.env.AGE_VERIFICATION_API_SECRET = "agechecker-account-secret";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ status: "not_created" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });

    const response = await handler({
      routeKey: "POST /commerce/age-verification-token",
      rawPath: "/commerce/age-verification-token",
      body: JSON.stringify({
        vendorTransactionId: "12345678901234567890123456789012",
        ...defaultCheckoutAgeIdentity,
      }),
      requestContext: { requestId: "req-commerce-age-token-missing", http: { method: "POST" } },
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 400);
    assert.equal(body.error, "age_verification_failed");
    assert.equal(body.status, "not_created");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiKey === undefined) {
      delete process.env.AGE_VERIFICATION_API_KEY;
    } else {
      process.env.AGE_VERIFICATION_API_KEY = previousApiKey;
    }

    if (previousApiSecret === undefined) {
      delete process.env.AGE_VERIFICATION_API_SECRET;
    } else {
      process.env.AGE_VERIFICATION_API_SECRET = previousApiSecret;
    }

    if (previousSigningSecret === undefined) {
      delete process.env.AGE_VERIFICATION_SIGNING_SECRET;
    } else {
      process.env.AGE_VERIFICATION_SIGNING_SECRET = previousSigningSecret;
    }
  }
});

test("commerce checkout loads approved catalog from server configuration before creating Stripe sessions", async () => {
  const mock = installStripeMock();
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_LAUNCH_CATALOG_READY = "true";
    process.env.FEATURE_STRIPE_TAX = "ready";
    process.env.PUBLIC_SITE_URL = "https://www.yuzucigarclub.com";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    delete process.env.ALLOW_LEGACY_AGE_VERIFICATION_TOKEN;
    process.env.STRIPE_LAUNCH_CATALOG_JSON = JSON.stringify([
      {
        sku: "APPROVED-BOX",
        slug: "approved-box",
        name: "Approved Box",
        price: 120,
        publishStatus: "published",
        inventoryPolicy: "track",
        sourceQuantity: 5,
        shippable: true,
        adultSignatureRequired: true,
        stripePriceId: "price_approved",
      },
    ]);

    const response = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify({
        items: [{ sku: "APPROVED-BOX", quantity: 1, unitPrice: 120 }],
        customer: { email: "member@example.com" },
        shippingAddress: {
          address1: "123 Yuzu Way",
          city: "Chandler",
          country: "US",
          state: "AZ",
          postalCode: "85225",
        },
        shippingMethodId: "usps-adult-signature-ground",
        compliance: { ageVerificationToken: createSignedAgeVerificationToken("age-secret") },
      }),
      requestContext: { requestId: "req-commerce-checkout-ready", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).url, "https://checkout.stripe.com/c/pay/cs_test_123");
    assert.deepEqual(mock.checkoutSessionsCreated[0].line_items, [{ price: "price_approved", quantity: 1 }]);
    assert.deepEqual(mock.checkoutSessionsCreated[0].shipping_options, [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "USPS Adult Signature Ground + non-member handling",
          fixed_amount: {
            amount: 2800,
            currency: "usd",
          },
        },
      },
    ]);
    assert.deepEqual(mock.checkoutSessionsCreated[0].shipping_address_collection, { allowed_countries: ["US"] });
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_method_id, "usps-adult-signature-ground");
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_carrier, "USPS");
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_amount_cents, "2800");
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_handling_fee_cents, "1000");
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).adult_signature_required, "true");
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_state, "AZ");
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_postal_code, "85225");
    assert.match((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).checkout_status_token, /^chkst_[A-Za-z0-9_-]{32,}$/);
    assert.ok(
      String(mock.checkoutSessionsCreated[0].success_url).includes("status_token=chkst_"),
      "Stripe success URL should carry the status token for the post-payment poller"
    );
  } finally {
    mock.restore();
  }
});

test("commerce checkout allows AgeChecker-verified non-required states to use USPS Ground Advantage", async () => {
  const mock = installStripeMock();
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_LAUNCH_CATALOG_READY = "true";
    process.env.FEATURE_STRIPE_TAX = "ready";
    process.env.PUBLIC_SITE_URL = "https://www.yuzucigarclub.com";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    delete process.env.ALLOW_LEGACY_AGE_VERIFICATION_TOKEN;
    process.env.STRIPE_LAUNCH_CATALOG_JSON = JSON.stringify([
      {
        sku: "APPROVED-BOX",
        slug: "approved-box",
        name: "Approved Box",
        price: 120,
        publishStatus: "published",
        inventoryPolicy: "track",
        sourceQuantity: 5,
        shippable: true,
        adultSignatureRequired: true,
        stripePriceId: "price_approved",
      },
    ]);

    const response = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify({
        items: [{ sku: "APPROVED-BOX", quantity: 1, unitPrice: 120 }],
        customer: { email: "member@example.com" },
        shippingAddress: {
          address1: "123 Yuzu Way",
          city: "Chandler",
          country: "US",
          state: "AZ",
          postalCode: "85225",
        },
        shippingMethodId: "usps-ground-advantage",
        compliance: { ageVerificationToken: createSignedAgeVerificationToken("age-secret") },
      }),
      requestContext: { requestId: "req-commerce-checkout-usps-ground-advantage", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 200);
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_method_id, "usps-ground-advantage");
    assert.deepEqual(mock.checkoutSessionsCreated[0].shipping_options, [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "USPS Ground Advantage + non-member handling",
          fixed_amount: {
            amount: 1900,
            currency: "usd",
          },
        },
      },
    ]);
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).adult_signature_required, "false");
  } finally {
    mock.restore();
  }
});

test("commerce checkout rejects an age verification token bound to a different identity", async () => {
  const mock = installStripeMock();
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_LAUNCH_CATALOG_READY = "true";
    process.env.FEATURE_STRIPE_TAX = "ready";
    process.env.PUBLIC_SITE_URL = "https://www.yuzucigarclub.com";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    delete process.env.ALLOW_LEGACY_AGE_VERIFICATION_TOKEN;
    process.env.STRIPE_LAUNCH_CATALOG_JSON = JSON.stringify([
      {
        sku: "APPROVED-BOX",
        slug: "approved-box",
        name: "Approved Box",
        price: 120,
        publishStatus: "published",
        inventoryPolicy: "track",
        sourceQuantity: 5,
        shippable: true,
        adultSignatureRequired: true,
        stripePriceId: "price_approved",
      },
    ]);

    const mismatchedIdentityHash = createTestCheckoutAgeIdentityHash({
      customer: {
        email: "verified-adult@example.com",
        phone: "",
        fullName: "Verified Adult",
      },
      shippingAddress: defaultCheckoutAgeIdentity.shippingAddress,
    });

    const response = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify({
        items: [{ sku: "APPROVED-BOX", quantity: 1, unitPrice: 120 }],
        customer: { email: "member@example.com" },
        shippingAddress: defaultCheckoutAgeIdentity.shippingAddress,
        shippingMethodId: "usps-ground-advantage",
        compliance: {
          ageVerificationToken: createSignedAgeVerificationToken("age-secret", "age_txn_mismatched_identity", mismatchedIdentityHash),
        },
      }),
      requestContext: { requestId: "req-commerce-checkout-age-identity-mismatch", http: { method: "POST" } },
    });

    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 400);
    assert.equal(body.error, "age_verification_identity_mismatch");
    assert.equal(mock.checkoutSessionsCreated.length, 0);
  } finally {
    mock.restore();
  }
});

test("commerce checkout loads Stripe and compliance settings from Secrets Manager", async () => {
  const secretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:ycc/commerce/test";
  const persistenceMock = installPersistenceMocks({
    commerceSecret: {
      stripe: {
        secretKey: "sk_test_secret_manager",
        launchCatalogReady: true,
        launchCatalog: [
          {
            sku: "APPROVED-BOX",
            slug: "approved-box",
            name: "Approved Box",
            price: 120,
            publishStatus: "published",
            inventoryPolicy: "track",
            sourceQuantity: 5,
            shippable: true,
            adultSignatureRequired: true,
            stripePriceId: "price_secret_box",
          },
        ],
      },
      ageVerification: {
        vendor: "AgeChecker.Net",
        signingSecret: "age-secret-from-secrets-manager",
      },
      tax: {
        provider: "Stripe Tax",
        ready: true,
      },
      shipping: {
        provider: "USPS",
      },
      membership: {
        entitlementSigningSecret: "membership-secret-from-secrets-manager",
      },
    },
  });
  const stripeMock = installStripeMock();

  try {
    process.env.COMMERCE_PROVIDER_SECRET_ARN = secretArn;
    process.env.PUBLIC_SITE_URL = "https://www.yuzucigarclub.com";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_LAUNCH_CATALOG_READY;
    delete process.env.STRIPE_LAUNCH_CATALOG_JSON;
    delete process.env.FEATURE_STRIPE_TAX;
    delete process.env.AGE_VERIFICATION_SIGNING_SECRET;
    delete process.env.MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET;

    const response = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify({
        items: [{ sku: "APPROVED-BOX", quantity: 1, unitPrice: 120 }],
        customer: { email: "member@example.com" },
        shippingAddress: {
          address1: "123 Yuzu Way",
          city: "Chandler",
          country: "US",
          state: "AZ",
          postalCode: "85225",
        },
        shippingMethodId: "usps-adult-signature-ground",
        compliance: { ageVerificationToken: createSignedAgeVerificationToken("age-secret-from-secrets-manager") },
      }),
      requestContext: { requestId: "req-commerce-checkout-secret", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(stripeMock.checkoutSessionsCreated[0].line_items, [{ price: "price_secret_box", quantity: 1 }]);
    assert.ok(
      persistenceMock.secretsManagerInvocations.some((input) => input.SecretId === secretArn),
      "commerce checkout should read the configured commerce provider secret"
    );
  } finally {
    stripeMock.restore();
    persistenceMock.restore();
  }
});

test("commerce checkout can load a large launch catalog from S3 when the commerce secret points to it", async () => {
  const secretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:ycc/commerce/s3-test";
  const catalogKey = "ycc/commerce/stripe-launch-catalog-test.json";
  const persistenceMock = installPersistenceMocks({
    commerceSecret: {
      stripe: {
        secretKey: "sk_test_secret_manager",
        launchCatalogReady: true,
        launchCatalogS3Uri: `s3://classroom2/${catalogKey}`,
      },
      ageVerification: {
        signingSecret: "age-secret-from-s3-secret",
      },
      tax: {
        ready: true,
      },
      shipping: {
        provider: "USPS",
      },
    },
    s3Objects: {
      [catalogKey]: [
        {
          sku: "S3-BOX",
          name: "S3 Box",
          price: 88,
          publishStatus: "published",
          inventoryPolicy: "manual",
          shippable: true,
          adultSignatureRequired: true,
          stripePriceId: "price_s3_box",
        },
      ],
    },
  });
  const stripeMock = installStripeMock();

  try {
    process.env.COMMERCE_PROVIDER_SECRET_ARN = secretArn;
    process.env.PUBLIC_SITE_URL = "https://www.yuzucigarclub.com";
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_LAUNCH_CATALOG_JSON;
    delete process.env.AGE_VERIFICATION_SIGNING_SECRET;

    const response = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify({
        items: [{ sku: "S3-BOX", quantity: 1, unitPrice: 88 }],
        customer: { email: "member@example.com" },
        shippingAddress: {
          address1: "123 Yuzu Way",
          city: "Chandler",
          country: "US",
          state: "AZ",
          postalCode: "85225",
        },
        shippingMethodId: "usps-adult-signature-ground",
        compliance: { ageVerificationToken: createSignedAgeVerificationToken("age-secret-from-s3-secret") },
      }),
      requestContext: { requestId: "req-commerce-checkout-s3-catalog", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(stripeMock.checkoutSessionsCreated[0].line_items, [{ price: "price_s3_box", quantity: 1 }]);
    assert.ok(
      persistenceMock.s3Invocations.some((input) => input.Bucket === "classroom2" && input.Key === catalogKey),
      "commerce checkout should read the launch catalog from S3"
    );
  } finally {
    stripeMock.restore();
    persistenceMock.restore();
  }
});

test("commerce checkout rejects cart lines without client price snapshots", async () => {
  const mock = installStripeMock();
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_LAUNCH_CATALOG_READY = "true";
    process.env.FEATURE_STRIPE_TAX = "ready";
    process.env.PUBLIC_SITE_URL = "https://www.yuzucigarclub.com";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    process.env.STRIPE_LAUNCH_CATALOG_JSON = JSON.stringify([
      {
        sku: "APPROVED-BOX",
        slug: "approved-box",
        name: "Approved Box",
        price: 120,
        publishStatus: "published",
        inventoryPolicy: "track",
        sourceQuantity: 5,
        shippable: true,
        adultSignatureRequired: true,
        stripePriceId: "price_approved",
      },
    ]);

    const response = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify({
        items: [{ sku: "APPROVED-BOX", quantity: 1 }],
        customer: { email: "member@example.com" },
        shippingAddress: {
          address1: "123 Yuzu Way",
          city: "Chandler",
          country: "US",
          state: "AZ",
          postalCode: "85225",
        },
        shippingMethodId: "usps-adult-signature-ground",
        compliance: { ageVerificationToken: createSignedAgeVerificationToken("age-secret") },
      }),
      requestContext: { requestId: "req-commerce-checkout-missing-price", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).errors[0].code, "price_snapshot_required");
    assert.equal(mock.checkoutSessionsCreated.length, 0);
  } finally {
    mock.restore();
  }
});

test("commerce checkout blocks member-only SKUs unless a signed membership entitlement is supplied", async () => {
  const mock = installStripeMock();
  const requestBody = {
    items: [{ sku: "MEMBER-BOX", quantity: 1, unitPrice: 140 }],
    customer: { email: "member@example.com" },
    shippingAddress: {
      address1: "123 Yuzu Way",
      city: "Chandler",
      country: "US",
      state: "AZ",
      postalCode: "85225",
    },
    shippingMethodId: "usps-adult-signature-ground",
    compliance: { ageVerificationToken: createSignedAgeVerificationToken("age-secret") },
  };

  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_LAUNCH_CATALOG_READY = "true";
    process.env.FEATURE_STRIPE_TAX = "ready";
    process.env.PUBLIC_SITE_URL = "https://www.yuzucigarclub.com";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    process.env.MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET = "membership-secret";
    process.env.STRIPE_LAUNCH_CATALOG_JSON = JSON.stringify([
      {
        sku: "MEMBER-BOX",
        slug: "member-box",
        name: "Member Box",
        price: 140,
        publishStatus: "published",
        inventoryPolicy: "track",
        sourceQuantity: 5,
        shippable: true,
        memberOnly: true,
        adultSignatureRequired: true,
        stripePriceId: "price_member",
      },
    ]);

    const blockedResponse = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify(requestBody),
      requestContext: { requestId: "req-commerce-checkout-member-blocked", http: { method: "POST" } },
    });

    const allowedResponse = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify({
        ...requestBody,
        membership: {
          entitlementToken: createSignedMembershipEntitlementToken("membership-secret", "member@example.com"),
        },
      }),
      requestContext: { requestId: "req-commerce-checkout-member-allowed", http: { method: "POST" } },
    });

    assert.equal(blockedResponse.statusCode, 400);
    assert.equal(JSON.parse(blockedResponse.body).errors[0].code, "membership_required");
    assert.equal(allowedResponse.statusCode, 200);
    assert.equal(mock.checkoutSessionsCreated.length, 1);
    assert.deepEqual(mock.checkoutSessionsCreated[0].shipping_options, [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "USPS Adult Signature Ground",
          fixed_amount: {
            amount: 1800,
            currency: "usd",
          },
        },
      },
    ]);
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_handling_fee_cents, "0");
  } finally {
    mock.restore();
  }
});

test("commerce checkout rejects unsigned age verification tokens", async () => {
  const mock = installStripeMock();
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_LAUNCH_CATALOG_READY = "true";
    process.env.FEATURE_STRIPE_TAX = "ready";
    process.env.PUBLIC_SITE_URL = "https://www.yuzucigarclub.com";
    process.env.AGE_VERIFICATION_SIGNING_SECRET = "age-secret";
    delete process.env.ALLOW_LEGACY_AGE_VERIFICATION_TOKEN;
    process.env.STRIPE_LAUNCH_CATALOG_JSON = JSON.stringify([
      {
        sku: "APPROVED-BOX",
        slug: "approved-box",
        name: "Approved Box",
        price: 120,
        publishStatus: "published",
        inventoryPolicy: "track",
        sourceQuantity: 5,
        shippable: true,
        adultSignatureRequired: true,
        stripePriceId: "price_approved",
      },
    ]);

    const response = await handler({
      routeKey: "POST /commerce/checkout-session",
      rawPath: "/commerce/checkout-session",
      body: JSON.stringify({
        items: [{ sku: "APPROVED-BOX", quantity: 1, unitPrice: 120 }],
        customer: { email: "member@example.com" },
        shippingAddress: {
          address1: "123 Yuzu Way",
          city: "Chandler",
          country: "US",
          state: "AZ",
          postalCode: "85225",
        },
        shippingMethodId: "usps-adult-signature-ground",
        compliance: { ageVerificationToken: "age_txn_12345678" },
      }),
      requestContext: { requestId: "req-commerce-checkout-invalid-age-token", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.error, "age_verification_untrusted");
    assert.equal(mock.checkoutSessionsCreated.length, 0);
  } finally {
    mock.restore();
  }
});

test("membership checkout rejects client-supplied Stripe price ids when the server price env is missing", async () => {
  const mock = installStripeMock();
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    delete process.env.STRIPE_PRICE_SENSEI_MONTHLY;

    const response = await handler({
      routeKey: "POST /commerce/membership-session",
      rawPath: "/commerce/membership-session",
      body: JSON.stringify({
        tierKey: "sensei",
        billingPeriod: "monthly",
        stripePriceId: "price_attacker_controlled",
        customer: { email: "member@example.com" },
      }),
      requestContext: { requestId: "req-membership-price", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 409);
    assert.equal(JSON.parse(response.body).priceEnvKey, "STRIPE_PRICE_SENSEI_MONTHLY");
    assert.equal(mock.checkoutSessionsCreated.length, 0);
  } finally {
    mock.restore();
  }
});

test("customer portal sessions are bound to the authenticated member customer id", async () => {
  const mock = installStripeMock();
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    const claims = {
      ...actorClaims,
      "custom:stripe_customer_id": "cus_member_123",
    };

    const forbiddenResponse = await handler(
      createAuthenticatedEvent(
        "POST /commerce/customer-portal-session",
        {
          stripeCustomerId: "cus_other_999",
        },
        claims
      )
    );

    assert.equal(forbiddenResponse.statusCode, 403);
    assert.equal(JSON.parse(forbiddenResponse.body).error, "customer_portal_forbidden");

    const response = await handler(createAuthenticatedEvent("POST /commerce/customer-portal-session", {}, claims));
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).url, "https://billing.stripe.com/p/session/test");
    assert.equal(mock.billingPortalSessionsCreated.length, 1);
    assert.equal(mock.billingPortalSessionsCreated[0].customer, "cus_member_123");
  } finally {
    mock.restore();
  }
});

test("customer portal sessions prefer the linked member Stripe customer id", async () => {
  const persistenceMock = installPersistenceMocks({
    memberStripeCustomerId: "cus_profile_456",
  });
  const stripeMock = installStripeMock();

  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.FEATURE_DB_WRITES = "schema_ready";

    const response = await handler(createAuthenticatedEvent("POST /commerce/customer-portal-session", {}));

    assert.equal(response.statusCode, 200);
    assert.equal(stripeMock.billingPortalSessionsCreated.length, 1);
    assert.equal(stripeMock.billingPortalSessionsCreated[0].customer, "cus_profile_456");

    const queries = persistenceMock.clients.flatMap((client) => client.queries.map((query) => query.sql));
    assert.ok(
      queries.some((sql) => sql.includes("select stripe_customer_id") && sql.includes("from public.members")),
      "portal lookup should read the linked Stripe customer id from members first"
    );
  } finally {
    stripeMock.restore();
    persistenceMock.restore();
  }
});

test("checkout session status reads Stripe before reporting paid orders as recorded", async () => {
  const mock = installStripeMock({
    retrieveSession: {
      id: "cs_paid_123",
      payment_status: "paid",
      status: "complete",
      metadata: { order_id: "order_123", checkout_status_token: "chkst_status_123456789012345678901234567890" },
    },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    const response = await handler({
      routeKey: "GET /commerce/checkout-session/{id}",
      rawPath: "/commerce/checkout-session/cs_paid_123",
      queryStringParameters: { status_token: "chkst_status_123456789012345678901234567890" },
      requestContext: { requestId: "req-checkout-status", http: { method: "GET" } },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.paymentStatus, "paid");
    assert.equal(body.orderRecorded, true);
    assert.equal(body.orderId, "order_123");
    assert.deepEqual(mock.checkoutSessionsRetrieved, ["cs_paid_123"]);
  } finally {
    mock.restore();
  }
});

test("checkout session status reads persisted order records when Stripe metadata has no order id", async () => {
  const persistenceMock = installPersistenceMocks();
  const stripeMock = installStripeMock({
    retrieveSession: {
      id: "cs_paid_without_metadata_order",
      payment_status: "paid",
      status: "complete",
      metadata: { checkout_status_token: "chkst_status_123456789012345678901234567890" },
    },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.FEATURE_DB_WRITES = "schema_ready";

    const response = await handler({
      routeKey: "GET /commerce/checkout-session/{id}",
      rawPath: "/commerce/checkout-session/cs_paid_without_metadata_order",
      queryStringParameters: { status_token: "chkst_status_123456789012345678901234567890" },
      requestContext: { requestId: "req-checkout-status-db-order", http: { method: "GET" } },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.paymentStatus, "paid");
    assert.equal(body.orderRecorded, true);
    assert.equal(body.orderId, "88888888-8888-4888-8888-888888888888");
    assert.equal(body.fulfillmentStatus, "pending");
    assert.deepEqual(stripeMock.checkoutSessionsRetrieved, ["cs_paid_without_metadata_order"]);
    const queries = persistenceMock.clients.flatMap((client) => client.queries.map((query) => query.sql));
    assert.ok(
      queries.some((sql) => sql.includes("from public.commerce_orders") && sql.includes("stripe_checkout_session_id = $1")),
      "checkout status should query persisted order records by checkout session id"
    );
  } finally {
    stripeMock.restore();
    persistenceMock.restore();
  }
});

test("checkout session status rejects requests without the Stripe success status token", async () => {
  const mock = installStripeMock({
    retrieveSession: {
      id: "cs_paid_123",
      payment_status: "paid",
      status: "complete",
      metadata: { order_id: "order_123", checkout_status_token: "chkst_status_123456789012345678901234567890" },
    },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    const response = await handler({
      routeKey: "GET /commerce/checkout-session/{id}",
      rawPath: "/commerce/checkout-session/cs_paid_123",
      requestContext: { requestId: "req-checkout-status-no-token", http: { method: "GET" } },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).error, "checkout_status_forbidden");
    assert.deepEqual(mock.checkoutSessionsRetrieved, ["cs_paid_123"]);
  } finally {
    mock.restore();
  }
});

test("checkout session status returns not found when Stripe cannot find the session", async () => {
  const stripeError = Object.assign(new Error("No such checkout.session"), {
    code: "resource_missing",
    type: "StripeInvalidRequestError",
    statusCode: 404,
  });
  const mock = installStripeMock({ retrieveError: stripeError });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    const response = await handler({
      routeKey: "GET /commerce/checkout-session/{id}",
      rawPath: "/commerce/checkout-session/cs_test_missing",
      requestContext: { requestId: "req-checkout-status-missing", http: { method: "GET" } },
    });

    assert.equal(response.statusCode, 404);
    assert.equal(JSON.parse(response.body).error, "checkout_session_not_found");
    assert.deepEqual(mock.checkoutSessionsRetrieved, ["cs_test_missing"]);
  } finally {
    mock.restore();
  }
});

test("checkout session status returns a controlled error for malformed path escapes", async () => {
  const stripeError = Object.assign(new Error("Invalid checkout.session id"), {
    type: "StripeInvalidRequestError",
    statusCode: 400,
  });

  const mock = installStripeMock({ retrieveError: stripeError });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    const response = await handler({
      routeKey: "GET /commerce/checkout-session/{id}",
      rawPath: "/commerce/checkout-session/%E0%A4%A",
      requestContext: { requestId: "req-checkout-status-malformed-path", http: { method: "GET" } },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).error, "invalid_checkout_session");
    assert.deepEqual(mock.checkoutSessionsRetrieved, ["%E0%A4%A"]);
  } finally {
    mock.restore();
  }
});

test("Stripe webhook route rejects unsigned events before Cognito auth", async () => {
  const response = await handler({
    routeKey: "POST /commerce/webhook/stripe",
    rawPath: "/commerce/webhook/stripe",
    body: JSON.stringify({ id: "evt_unsigned" }),
    headers: {},
    requestContext: { requestId: "req-commerce-webhook", http: { method: "POST" } },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).error, "missing_stripe_signature");
});

test("Stripe webhook persists signed checkout events into commerce order records", async () => {
  const persistenceMock = installPersistenceMocks();
  const stripeMock = installStripeMock({
    webhookEvent: {
      id: "evt_checkout_completed_123",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_webhook_123",
          customer: "cus_member_123",
          customer_details: {
            email: "member@example.com",
            name: "Yuzu Member",
            phone: "+14805550123",
            address: {
              line1: "123 Yuzu Way",
              city: "Chandler",
              state: "AZ",
              postal_code: "85225",
              country: "US",
            },
          },
          payment_intent: "pi_webhook_123",
          payment_status: "paid",
          status: "complete",
          currency: "usd",
          amount_subtotal: 12000,
          amount_total: 12792,
          total_details: {
            amount_tax: 792,
            amount_shipping: 0,
          },
          metadata: {
            age_verification_id: "age_txn_12345678",
            shipping_method_id: "usps-adult-signature-ground",
          },
        },
      },
    },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
    process.env.FEATURE_DB_WRITES = "schema_ready";

    const response = await handler({
      routeKey: "POST /commerce/webhook/stripe",
      rawPath: "/commerce/webhook/stripe",
      body: JSON.stringify({ id: "evt_checkout_completed_123" }),
      headers: {
        "stripe-signature": "t=123,v1=sig",
      },
      requestContext: { requestId: "req-commerce-webhook-signed", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.processing.duplicate, false);
    assert.equal(body.processing.eventStored, true);
    assert.equal(body.processing.orderId, "88888888-8888-4888-8888-888888888888");

    const queries = persistenceMock.clients.flatMap((client) => client.queries.map((query) => query.sql));
    assert.ok(queries.some((sql) => sql.includes("insert into public.stripe_events")), "stripe events should be persisted");
    assert.ok(queries.some((sql) => sql.includes("insert into public.commerce_orders")), "commerce orders should be upserted");
    assert.ok(
      queries.some((sql) => sql.includes("update public.members") && sql.includes("stripe_customer_id")),
      "checkout webhook should link the matched member row to the Stripe customer"
    );
    assert.ok(queries.some((sql) => sql.includes("insert into public.commerce_audit_log")), "commerce audit log should be written");
  } finally {
    stripeMock.restore();
    persistenceMock.restore();
  }
});

test("Stripe subscription webhooks create member subscription records", async () => {
  const persistenceMock = installPersistenceMocks();
  const stripeMock = installStripeMock({
    webhookEvent: {
      id: "evt_subscription_created_123",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_member_123",
          customer: "cus_member_123",
          current_period_end: 1771459200,
          metadata: {
            customer_email: "member@example.com",
            tier_key: "sensei",
            billing_period: "monthly",
            checkout_session_id: "cs_member_123",
          },
          items: {
            data: [
              {
                price: {
                  id: "price_sensei_monthly",
                  recurring: { interval: "month" },
                },
              },
            ],
          },
        },
      },
    },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
    process.env.FEATURE_DB_WRITES = "schema_ready";

    const response = await handler({
      routeKey: "POST /commerce/webhook/stripe",
      rawPath: "/commerce/webhook/stripe",
      body: JSON.stringify({ id: "evt_subscription_created_123" }),
      headers: {
        "stripe-signature": "t=123,v1=sig",
      },
      requestContext: { requestId: "req-commerce-subscription-webhook", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.processing.duplicate, false);
    assert.equal(body.processing.eventStored, true);

    const queries = persistenceMock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.member_subscriptions")),
      "subscription webhook should insert or update the member subscription row"
    );
    assert.ok(
      queries.some((query) => query.sql.includes("on conflict (stripe_subscription_id)")),
      "subscription webhook should be idempotent by Stripe subscription id"
    );
    assert.ok(
      queries.some((query) => query.sql.includes("update public.members") && query.sql.includes("stripe_customer_id")),
      "subscription webhook should link the matched member row to the Stripe customer"
    );
  } finally {
    stripeMock.restore();
    persistenceMock.restore();
  }
});

test("newsletter subscribe accepts public lead capture and stores monthly member interest", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler({
      routeKey: "POST /newsletter/subscribe",
      rawPath: "/newsletter/subscribe",
      body: JSON.stringify({
        email: "Reader@Example.com",
        firstName: "Yuzu",
        lastName: "Reader",
        consent: true,
        wantsMonthlyMembership: true,
        preferredTier: "Sensei",
        source: "join-now-header",
        pagePath: "/membership",
      }),
      headers: {
        "user-agent": "node-test",
      },
      requestContext: {
        requestId: "req-newsletter-public",
        http: { method: "POST", sourceIp: "198.51.100.42" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.subscriber.email, "reader@example.com");
    assert.equal(body.subscriber.persisted, true);
    assert.equal(body.subscriber.wantsMonthlyMembership, true);
    assert.equal(body.subscriber.preferredTier, "sensei");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.newsletter_subscribers")),
      "newsletter subscriber should be upserted"
    );
    assert.ok(queries.some((query) => query.sql.includes("insert into public.audit_log")), "audit row should be inserted");
  } finally {
    mock.restore();
  }
});

test("newsletter subscribe sends a brand preference email to the new subscriber", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler({
      routeKey: "POST /newsletter/subscribe",
      rawPath: "/newsletter/subscribe",
      body: JSON.stringify({
        email: "Reader@Example.com",
        firstName: "Yuzu",
        lastName: "Reader",
        consent: true,
        wantsMonthlyMembership: true,
        preferredTier: "Sensei",
        source: "join-now-header",
        pagePath: "/membership",
      }),
      headers: {
        "user-agent": "node-test",
      },
      requestContext: {
        requestId: "req-newsletter-brand-preference-email",
        http: { method: "POST", sourceIp: "198.51.100.42" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.subscriber.brandPreferenceEmail.status, "sent");
    assert.equal(body.subscriber.brandPreferenceEmail.sesMessageId, "ses-outbound-message-123");
    assert.ok(body.nextActions.includes("collect_brand_preferences"));
    assert.equal(mock.sesInvocations.length, 1);
    assert.equal(mock.sesInvocations[0].FromEmailAddress, "support@yuzucigarclub.com");
    assert.deepEqual(mock.sesInvocations[0].Destination, { ToAddresses: ["reader@example.com"] });
    assert.deepEqual(mock.sesInvocations[0].ReplyToAddresses, ["support@ses-support.yuzucigarclub.com"]);

    const simpleEmail = (mock.sesInvocations[0].Content as { Simple: { Subject: { Data: string }; Body: { Text: { Data: string } } } }).Simple;
    assert.match(simpleEmail.Subject.Data, /top cigar brands/i);
    assert.match(simpleEmail.Body.Text.Data, /Hi Yuzu/i);
    assert.match(simpleEmail.Body.Text.Data, /reply with your top 3-5 cigar brands/i);
    assert.match(simpleEmail.Body.Text.Data, /Padron, Arturo Fuente, Davidoff/i);
    assert.match(simpleEmail.Body.Text.Data, /21\+/);
  } finally {
    mock.restore();
  }
});

test("newsletter subscribe sends a selected cigar cost newsletter with branded html", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler({
      routeKey: "POST /newsletter/subscribe",
      rawPath: "/newsletter/subscribe",
      body: JSON.stringify({
        email: "Reader@Example.com",
        firstName: "Yuzu",
        consent: true,
        brandPreferences: ["Padron", "Davidoff", "Unknown Brand"],
        promotedCigars: [
          {
            slug: "padron-1964-anniversary-toro",
            name: "Padron 1964 Anniversary Toro",
            brand: "Padron",
            storeHref: "/shop/padron-1964-anniversary-toro/",
            nonMemberPrice: 320,
            memberPrice: 260,
            packageLabel: "Box of 20",
            image: "/assets/product-padron.png",
          },
          {
            slug: "davidoff-grand-cru-robusto",
            name: "Davidoff Grand Cru Robusto",
            brand: "Davidoff",
            storeHref: "/shop/davidoff-grand-cru-robusto/",
            nonMemberPrice: 410,
            memberPrice: 335,
            packageLabel: "Box of 25",
            image: "/assets/product-davidoff.png",
          },
        ],
        source: "education-newsletter",
        pagePath: "/education",
      }),
      headers: {
        "user-agent": "node-test",
      },
      requestContext: {
        requestId: "req-newsletter-selected-cigars",
        http: { method: "POST", sourceIp: "198.51.100.42" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.deepEqual(body.subscriber.brandPreferences, ["padron", "davidoff"]);
    assert.equal(body.subscriber.promotedCigars.length, 2);
    assert.equal(body.subscriber.brandPreferenceEmail.status, "sent");
    assert.equal(body.subscriber.brandPreferenceEmail.kind, "cigar_cost_promotions");
    assert.ok(body.nextActions.includes("send_selected_cigar_promotions"));
    assert.equal(mock.sesInvocations.length, 1);

    const simpleEmail = mock.sesInvocations[0].Content as {
      Simple: {
        Subject: { Data: string };
        Body: { Text: { Data: string }; Html: { Data: string } };
      };
    };
    assert.match(simpleEmail.Simple.Subject.Data, /selected yuzu cigar picks/i);
    assert.match(simpleEmail.Simple.Body.Text.Data, /Padron 1964 Anniversary Toro/);
    assert.match(simpleEmail.Simple.Body.Text.Data, /Public cost: \$320\.00/);
    assert.match(simpleEmail.Simple.Body.Text.Data, /Member cost: \$260\.00/);
    assert.match(simpleEmail.Simple.Body.Html.Data, /Yuzu Cigar Club/);
    assert.match(simpleEmail.Simple.Body.Html.Data, /background:#11100d/);
    assert.match(simpleEmail.Simple.Body.Html.Data, /View cigar/);
    assert.match(simpleEmail.Simple.Body.Html.Data, /product-padron\.png/);

    const newsletterQuery = mock.clients
      .flatMap((client) => client.queries)
      .find((query) => query.sql.includes("insert into public.newsletter_subscribers"));
    assert.ok(newsletterQuery, "newsletter subscriber should be upserted");
    const metadata = JSON.parse(String(newsletterQuery.params[9] || "{}"));
    assert.deepEqual(metadata.brandPreferences, ["padron", "davidoff"]);
    assert.equal(metadata.promotedCigars[0].slug, "padron-1964-anniversary-toro");
  } finally {
    mock.restore();
  }
});

test("newsletter subscribe keeps the signup when brand preference email is not ready", async () => {
  const mock = installPersistenceMocks();
  try {
    process.env.FEATURE_SES = "pending_production_access";

    const response = await handler({
      routeKey: "POST /newsletter/subscribe",
      rawPath: "/newsletter/subscribe",
      body: JSON.stringify({
        email: "reader@example.com",
        consent: true,
        source: "education-newsletter",
      }),
      requestContext: {
        requestId: "req-newsletter-brand-preference-email-pending",
        http: { method: "POST", sourceIp: "198.51.100.42" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.subscriber.email, "reader@example.com");
    assert.deepEqual(body.subscriber.brandPreferenceEmail, {
      status: "pending_ses",
      sesMessageId: null,
    });
    assert.equal(mock.sesInvocations.length, 0);
  } finally {
    mock.restore();
  }
});

test("newsletter subscribe validates email and marketing consent", async () => {
  const invalidEmail = await handler({
    routeKey: "POST /newsletter/subscribe",
    rawPath: "/newsletter/subscribe",
    body: JSON.stringify({ email: "bad", consent: true }),
    requestContext: { requestId: "req-newsletter-invalid", http: { method: "POST" } },
  });

  assert.equal(invalidEmail.statusCode, 400);
  assert.equal(JSON.parse(invalidEmail.body).error, "missing_newsletter_email");

  const missingConsent = await handler({
    routeKey: "POST /newsletter/subscribe",
    rawPath: "/newsletter/subscribe",
    body: JSON.stringify({ email: "reader@example.com", consent: false }),
    requestContext: { requestId: "req-newsletter-consent", http: { method: "POST" } },
  });

  assert.equal(missingConsent.statusCode, 400);
  assert.equal(JSON.parse(missingConsent.body).error, "missing_marketing_consent");
});

test("live page content read is public and backed by the site page content table", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler({
      routeKey: "GET /content/pages",
      rawPath: "/content/pages",
      queryStringParameters: { route: "/" },
      requestContext: {
        requestId: "req-content-page-public",
        http: { method: "GET", sourceIp: "198.51.100.42" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.page.route, "/");
    assert.equal(body.page.edits["home.hero.title"], "Published live headline");
    assert.equal(body.persistence, "stored");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("from public.site_page_content")),
      "public content read should load the published page edits"
    );
  } finally {
    mock.restore();
  }
});

test("live page publishing requires an admin and writes an audit row", async () => {
  const memberResponse = await handler(
    createAuthenticatedEvent("POST /content/pages", {
      route: "/",
      edits: { "home.hero.title": "Member cannot publish" },
    })
  );

  assert.equal(memberResponse.statusCode, 403);
  assert.equal(JSON.parse(memberResponse.body).error, "admin_forbidden");

  const mock = installPersistenceMocks();
  try {
    const adminResponse = await handler(
      createAuthenticatedEvent(
        "POST /content/pages",
        {
          route: "/",
          edits: { "home.hero.title": "Admin published headline" },
        },
        adminClaims
      )
    );

    assert.equal(adminResponse.statusCode, 200);
    const body = JSON.parse(adminResponse.body);
    assert.equal(body.page.route, "/");
    assert.equal(body.page.edits["home.hero.title"], "Admin published headline");
    assert.equal(body.persistence.status, "stored");
    assert.equal(body.persistence.table, "site_page_content");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.site_page_content")),
      "admin publish should upsert site page content"
    );
    assert.ok(queries.some((query) => query.sql.includes("insert into public.audit_log")), "audit row should be inserted");
  } finally {
    mock.restore();
  }
});

test("account route maps Cognito claims", async () => {
  const response = await handler({
    routeKey: "GET /account/me",
    rawPath: "/account/me",
    requestContext: {
      requestId: "req-account-ok",
      http: { method: "GET" },
      authorizer: { jwt: { claims: actorClaims } },
    },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.account.email, actorClaims.email);
  assert.deepEqual(body.membership.groups, ["member", "sensei"]);
});

test("admin routes accept API Gateway bracketed Cognito group claims", async () => {
  const response = await handler(
    createAuthenticatedEvent("GET /admin/commerce/compliance-holds", undefined, {
      ...adminClaims,
      "cognito:groups": "[admin]",
    })
  );

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.deepEqual(body.holds, []);
});

test("admin order backend routes list and update customer orders", async () => {
  const forbiddenResponse = await handler(createAuthenticatedEvent("GET /admin/commerce/orders"));
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.equal(JSON.parse(forbiddenResponse.body).error, "admin_forbidden");

  const mock = installPersistenceMocks();
  try {
    const listResponse = await handler(createAuthenticatedEvent("GET /admin/commerce/orders", undefined, adminClaims));

    assert.equal(listResponse.statusCode, 200);
    const listBody = JSON.parse(listResponse.body);
    assert.equal(listBody.summary.total, 1);
    assert.equal(listBody.summary.needsAttention, 1);
    assert.equal(listBody.orders[0].orderNumber, "cs_test_admin");
    assert.equal(listBody.orders[0].customer.email, "member@example.com");
    assert.equal(listBody.orders[0].total, 127.92);

    const updateEvent = {
      ...createAuthenticatedEvent(
        "PATCH /admin/commerce/orders/{id}",
        {
          fulfillmentStatus: "packed",
          complianceStatus: "verified",
        },
        adminClaims
      ),
      rawPath: "/admin/commerce/orders/88888888-8888-4888-8888-888888888888",
      pathParameters: {
        id: "88888888-8888-4888-8888-888888888888",
      },
    };
    const updateResponse = await handler(updateEvent);

    assert.equal(updateResponse.statusCode, 200);
    const updateBody = JSON.parse(updateResponse.body);
    assert.equal(updateBody.order.fulfillmentStatus, "packed");
    assert.equal(updateBody.persistence.table, "commerce_orders");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(queries.some((query) => query.sql.includes("admin_orders_list")), "orders list query should be executed");
    assert.ok(queries.some((query) => query.sql.includes("admin_order_update")), "order update query should be executed");
    assert.ok(queries.some((query) => query.sql.includes("insert into public.commerce_audit_log")), "order update should be audited");
  } finally {
    mock.restore();
  }
});

test("admin member access backend routes list and update users", async () => {
  const forbiddenResponse = await handler(createAuthenticatedEvent("GET /admin/members"));
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.equal(JSON.parse(forbiddenResponse.body).error, "admin_forbidden");

  const mock = installPersistenceMocks();
  try {
    const listResponse = await handler(createAuthenticatedEvent("GET /admin/members", undefined, adminClaims));

    assert.equal(listResponse.statusCode, 200);
    const listBody = JSON.parse(listResponse.body);
    assert.equal(listBody.summary.members, 1);
    assert.equal(listBody.members[0].email, "member@example.com");
    assert.equal(listBody.members[0].orderCount, 1);
    assert.equal(listBody.members[0].humidorItemCount, 3);

    const updateEvent = {
      ...createAuthenticatedEvent(
        "PATCH /admin/members/{id}/access",
        {
          role: "operator",
          membershipTier: "daimyo",
          memberStatus: "active",
        },
        adminClaims
      ),
      rawPath: "/admin/members/11111111-1111-4111-8111-111111111111/access",
      pathParameters: {
        id: "11111111-1111-4111-8111-111111111111",
      },
    };
    const updateResponse = await handler(updateEvent);

    assert.equal(updateResponse.statusCode, 200);
    const updateBody = JSON.parse(updateResponse.body);
    assert.equal(updateBody.member.role, "operator");
    assert.equal(updateBody.member.membershipTier, "daimyo");
    assert.equal(updateBody.persistence.table, "members");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(queries.some((query) => query.sql.includes("admin_members_list")), "members list query should be executed");
    assert.ok(queries.some((query) => query.sql.includes("admin_member_access_update")), "member access update query should be executed");
    assert.ok(queries.some((query) => query.sql.includes("insert into public.audit_log")), "member access update should be audited");
  } finally {
    mock.restore();
  }
});

test("admin member access update rejects concierge operator only claims", async () => {
  const mock = installPersistenceMocks();
  const conciergeClaims = {
    ...actorClaims,
    sub: "concierge-123",
    email: "concierge@yuzucigarclub.example",
    name: "Yuzu Concierge",
    "cognito:groups": "concierge_operator",
  };

  try {
    const response = await handler({
      ...createAuthenticatedEvent(
        "PATCH /admin/members/{id}/access",
        {
          role: "admin",
          membershipTier: "daimyo",
          memberStatus: "active",
        },
        conciergeClaims
      ),
      rawPath: "/admin/members/11111111-1111-4111-8111-111111111111/access",
      pathParameters: {
        id: "11111111-1111-4111-8111-111111111111",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).error, "admin_forbidden");
    const queries = mock.clients.flatMap((client) => client.queries);
    assert.equal(
      queries.some((query) => query.sql.includes("admin_member_access_update")),
      false,
      "concierge operators should not reach the member access update query"
    );
  } finally {
    mock.restore();
  }
});

test("admin Stripe sync snapshot does not require approval after provider confirmation", async () => {
  const previousEnv = {
    COMMERCE_PROVIDER_SECRET_ARN: process.env.COMMERCE_PROVIDER_SECRET_ARN,
    COMMERCE_PROVIDER_SECRET_ID: process.env.COMMERCE_PROVIDER_SECRET_ID,
    YCC_COMMERCE_SECRET_ARN: process.env.YCC_COMMERCE_SECRET_ARN,
    YCC_COMMERCE_SECRET_ID: process.env.YCC_COMMERCE_SECRET_ID,
    STRIPE_TOBACCO_APPROVAL_CONFIRMED: process.env.STRIPE_TOBACCO_APPROVAL_CONFIRMED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_LAUNCH_CATALOG_READY: process.env.STRIPE_LAUNCH_CATALOG_READY,
    STRIPE_LAUNCH_CATALOG_JSON: process.env.STRIPE_LAUNCH_CATALOG_JSON,
    STRIPE_PRICE_SENSEI_MONTHLY: process.env.STRIPE_PRICE_SENSEI_MONTHLY,
    FEATURE_STRIPE_TAX: process.env.FEATURE_STRIPE_TAX,
  };

  delete process.env.COMMERCE_PROVIDER_SECRET_ARN;
  delete process.env.COMMERCE_PROVIDER_SECRET_ID;
  delete process.env.YCC_COMMERCE_SECRET_ARN;
  delete process.env.YCC_COMMERCE_SECRET_ID;
  process.env.STRIPE_TOBACCO_APPROVAL_CONFIRMED = "true";
  process.env.STRIPE_SECRET_KEY = "sk_live_123";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
  process.env.STRIPE_LAUNCH_CATALOG_READY = "1";
  process.env.STRIPE_LAUNCH_CATALOG_JSON = JSON.stringify([
    {
      sku: "APPROVED-BOX",
      name: "Approved Box",
      price: 120,
      publishStatus: "published",
      stripePriceId: "price_approved",
    },
  ]);
  process.env.STRIPE_PRICE_SENSEI_MONTHLY = "price_sensei_monthly";
  process.env.FEATURE_STRIPE_TAX = "pending";

  try {
    const response = await handler(createAuthenticatedEvent("POST /admin/commerce/stripe-sync-products", {}, adminClaims));

    assert.equal(response.statusCode, 202);
    const body = JSON.parse(response.body);
    assert.equal(body.sync.liveApprovalRequired, false);
    assert.equal(body.sync.catalogReady, true);
    assert.equal(body.sync.configuredProductCount, 1);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("account route upserts the authenticated member when schema writes are ready", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler(createAuthenticatedEvent("GET /account/me"));

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.database.persisted, true);
    assert.equal(body.database.memberId, "11111111-1111-4111-8111-111111111111");
    assert.equal(body.membership.tier, "sensei");
    assert.equal(body.membership.status, "active");
    assert.equal(mock.clients.length, 1);
    assert.ok(
      mock.clients[0].queries.some((query) => query.sql.includes("insert into public.members")),
      "member upsert query should be executed"
    );
  } finally {
    mock.restore();
  }
});

test("account profile update persists display name, phone, and shipping profile", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler(
      createAuthenticatedEvent("PATCH /account/me", {
        name: "Member Two",
        phone: "4805552121",
        shippingAddress: {
          address1: "111 W Boston St",
          address2: "Suite 5",
          city: "Chandler",
          state: "AZ",
          postalCode: "85225",
          country: "US",
        },
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.account.name, "Member Two");
    assert.equal(body.profile.phone, "4805552121");
    assert.equal(body.profile.shippingAddress.postalCode, "85225");
    assert.equal(body.database.table, "member_profiles");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("update public.members") && query.sql.includes("display_name")),
      "member display name should be persisted"
    );
    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.member_profiles") && query.sql.includes("shipping_profile")),
      "profile shipping address should be persisted"
    );
    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.audit_log") && query.params.includes("account.profile.updated")),
      "profile update should be audited"
    );
  } finally {
    mock.restore();
  }
});

test("membership route reads persisted subscription state and mints checkout entitlement", async () => {
  const mock = installPersistenceMocks();
  try {
    process.env.FEATURE_DB_WRITES = "schema_ready";
    process.env.MEMBERSHIP_ENTITLEMENT_SIGNING_SECRET = "membership-secret";

    const response = await handler(createAuthenticatedEvent("GET /commerce/membership"));

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.source, "postgres");
    assert.equal(body.membership.tier, "sensei");
    assert.equal(body.membership.status, "active");
    assert.equal(body.subscription.status, "active");
    assert.equal(body.subscription.stripeCustomerId, "cus_member_123");
    assert.match(body.membershipEntitlementToken, /^yccmem1\./);

    const queries = mock.clients.flatMap((client) => client.queries.map((query) => query.sql));
    assert.ok(
      queries.some((sql) => sql.includes("from public.member_subscriptions") && sql.includes("stripe_subscription_id")),
      "membership route should read the persisted subscription row"
    );
  } finally {
    mock.restore();
  }
});

test("humidor item reads recover when an existing member email has a new Cognito sub", async () => {
  const rotatedClaims = {
    ...actorClaims,
    sub: "member-rotated-sub",
  };
  const mock = installPersistenceMocks({
    memberUpsertEmailConflict: true,
    humidorItemRows: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Padron 1964 Anniversary Toro",
        brand: "Padron",
        line: "1964 Anniversary",
        vitola: "Toro",
        wrapper: "Nicaraguan",
        origin: "Nicaragua",
        strength: "Full",
        quantity: 2,
        rating: 94,
        purchase_date: "2026-03-12",
        aging_start_date: "2026-03-12",
        reorder_reminder: "2026-06-15",
        humidor_location: "Locker A",
        tray: "Drawer 2",
        tasting_notes: "Cocoa and cedar.",
        source: "member_humidor",
        metadata: {
          estimatedValue: 18.5,
          estimatedValueCurrency: "USD",
          estimatedValueSource: "member_estimate",
        },
        created_at: "2026-05-08T10:00:00.000Z",
      },
    ],
  });

  try {
    const response = await handler(createAuthenticatedEvent("GET /humidor/items", undefined, rotatedClaims));

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].name, "Padron 1964 Anniversary Toro");
    assert.equal(body.items[0].estimatedValue, 18.5);

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("update public.members") && query.sql.includes("where lower(email) = lower($1)")),
      "member upsert should repair an email-unique conflict caused by a rotated Cognito subject"
    );
    assert.ok(
      queries.some((query) => query.sql.includes("from public.humidor_items")),
      "humidor items should still be read after the member identity is repaired"
    );
  } finally {
    mock.restore();
  }
});

test("humidor item reads summarize stored cigar images without inline data URLs", async () => {
  const imageBase64 = Buffer.from("stored-cigar-image").toString("base64");
  const mock = installPersistenceMocks({
    humidorItemRows: [
      {
        id: "abababab-abab-4bab-8bab-abababababab",
        name: "Padron 1964 Anniversary Toro",
        brand: "Padron",
        line: "1964 Anniversary",
        vitola: "Toro",
        wrapper: "Nicaraguan",
        origin: "Nicaragua",
        strength: "Full",
        quantity: 2,
        rating: 94,
        purchase_date: "2026-03-12",
        aging_start_date: "2026-03-12",
        reorder_reminder: "2026-06-15",
        humidor_location: "Locker A",
        tray: "Drawer 2",
        tasting_notes: "Cocoa and cedar.",
        source: "member_humidor",
        metadata: {
          cigarImage: {
            dataUrl: `data:image/jpeg;base64,${imageBase64}`,
            mimeType: "image/jpeg",
            fileName: "padron-band.jpg",
            bytes: 18,
            source: "member_upload",
          },
        },
        created_at: "2026-05-08T10:00:00.000Z",
      },
    ],
  });

  try {
    const response = await handler(createAuthenticatedEvent("GET /humidor/items"));

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].cigarImage.mimeType, "image/jpeg");
    assert.equal(body.items[0].cigarImage.fileName, "padron-band.jpg");
    assert.equal(body.items[0].cigarImage.bytes, 18);
    assert.equal(body.items[0].cigarImage.dataUrl, "");
    assert.equal(response.body.includes(imageBase64), false);
    assert.equal(response.body.includes("data:image/jpeg;base64"), false);
  } finally {
    mock.restore();
  }
});

test("database clients verify the RDS Proxy TLS certificate with the configured CA bundle", async () => {
  const mock = installPersistenceMocks();
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "ycc-ca-bundle-"));
  const rootCertPath = path.join(tempDir, "global-bundle.pem");
  try {
    writeFileSync(rootCertPath, `${tls.rootCertificates[0]}\n`, "utf8");
    process.env.RDS_SSLMODE = "verify-full";
    process.env.RDS_SSLROOTCERT = rootCertPath;

    const response = await handler(createAuthenticatedEvent("GET /account/me"));

    assert.equal(response.statusCode, 200);
    assert.equal(mock.clients.length, 1);
    const ssl = mock.clients[0].config.ssl as { ca?: string; rejectUnauthorized?: boolean };
    assert.equal(ssl.rejectUnauthorized, true);
    assert.ok(Array.isArray(ssl.ca));
    assert.ok(ssl.ca.length > 1);
    assert.match(ssl.ca.join("\n"), /BEGIN CERTIFICATE/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    mock.restore();
  }
});

test("concierge chat routes cigar questions to cigar guide contract", async () => {
  const response = await handler({
    routeKey: "POST /concierge/chat",
    rawPath: "/concierge/chat",
    body: JSON.stringify({ message: "What wrapper pairs well with a morning cigar?" }),
    requestContext: {
      requestId: "req-chat",
      http: { method: "POST" },
      authorizer: { jwt: { claims: actorClaims } },
    },
  });

  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.agent, "YCCCigarGuide");
  assert.equal(body.guardrails.tobaccoHealthClaims, "not_provided");
});

test("concierge chat uses Amazon Lex as the router before invoking the selected YCC agent", async () => {
  const mock = installPersistenceMocks({
    lexIntentName: "YCCCigarGuideIntent",
    lexConfidence: 0.93,
    lexSlots: {
      Wrapper: "Connecticut shade",
      Occasion: "morning",
    },
    bedrockReply: "A Connecticut shade wrapper is a calm morning pairing with coffee.",
  });
  try {
    process.env.FEATURE_LEX_ROUTER = "ready";
    process.env.LEX_ROUTER_BOT_ID = "YCCLEXBOT1";
    process.env.LEX_ROUTER_BOT_ALIAS_ID = "YCCALIAS1";
    process.env.LEX_ROUTER_LOCALE_ID = "en_US";

    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "What wrapper pairs well with coffee in the morning?",
        conversationId: "conv-lex-router",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.equal(body.ai.status, "bedrock_runtime");
    assert.equal(body.lex.status, "recognized");
    assert.equal(body.lex.intentName, "YCCCigarGuideIntent");
    assert.equal(body.lex.confidence, 0.93);
    assert.equal(body.lex.slots.Wrapper, "Connecticut shade");
    assert.equal(mock.lexInvocations.length, 1);
    assert.equal(mock.lexInvocations[0].botId, "YCCLEXBOT1");
    assert.equal(mock.lexInvocations[0].botAliasId, "YCCALIAS1");
    assert.equal(mock.lexInvocations[0].localeId, "en_US");
    assert.equal(mock.lexInvocations[0].text, "What wrapper pairs well with coffee in the morning?");
    assert.equal(mock.lexInvocations[0].sessionId, "ycc-lex-conv-lex-router");
  } finally {
    mock.restore();
  }
});

test("concierge chat ignores Lex fallback intent and still answers cigar questions", async () => {
  const mock = installPersistenceMocks({
    lexIntentName: "FallbackIntent",
    bedrockReply: "A Connecticut shade wrapper is a calm morning pairing with coffee.",
  });
  try {
    process.env.FEATURE_LEX_ROUTER = "ready";
    process.env.LEX_ROUTER_BOT_ID = "YCCLEXBOT1";
    process.env.LEX_ROUTER_BOT_ALIAS_ID = "YCCALIAS1";
    process.env.LEX_ROUTER_LOCALE_ID = "en_US";

    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "What wrapper pairs well with coffee in the morning?",
        conversationId: "conv-lex-fallback-cigar",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.equal(body.lex.intentName, "FallbackIntent");
    assert.match(body.reply, /Connecticut shade/);
    assert.equal(mock.lexInvocations.length, 1);
    assert.equal(mock.agentInvocations.length, 0);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat routes cigar follow-up terms to the cigar guide without saying cigar", async () => {
  const mock = installPersistenceMocks({
    bedrockReply: "Maduro wrappers fit espresso with cocoa and roast, while Connecticut stays creamier and lighter.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Compare Maduro and Connecticut for espresso.",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /Maduro/);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat recovers tobacco comparison refusals for adult cigar questions", async () => {
  const mock = installPersistenceMocks({
    bedrockReply:
      "Sorry, I can't provide information that might facilitate comparing tobacco products. If you want information about our products or have any other questions, feel free to ask.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Compare Maduro and Connecticut for espresso.",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /Maduro|Connecticut|espresso/i);
    assert.doesNotMatch(body.reply, /facilitate comparing tobacco products/i);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat keeps adult wrapper comparison answers on the requested wrappers", async () => {
  const mock = installPersistenceMocks({
    bedrockReply:
      "Both Padron 1964 Anniversary Series and Davidoff Signature No. 2 pair well with espresso because their cocoa and mild sweetness complement coffee.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Compare Maduro and Connecticut for espresso.",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /Maduro/i);
    assert.match(body.reply, /Connecticut/i);
    assert.doesNotMatch(body.reply, /Padron 1964|Davidoff Signature/i);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat recovers redacted adult wrapper terms from direct runtime", async () => {
  const mock = installPersistenceMocks({
    bedrockReply:
      "Connecticut and {ADDRESS} wrappers offer distinct experiences for a morning cigar, with Connecticut staying lighter and creamier.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "For adults 21+, compare Connecticut and Maduro wrappers for a morning cigar.",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /Connecticut/i);
    assert.match(body.reply, /Maduro/i);
    assert.doesNotMatch(body.reply, /\{ADDRESS\}/i);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat recovers content-filter copy for adult cut and light questions", async () => {
  const mock = installPersistenceMocks({
    bedrockReply: "- The generated text has been blocked by our content filters.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "I am 21+. How should I cut and light a torpedo cigar without cracking it?",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /clean shallow cut/i);
    assert.match(body.reply, /toast the foot/i);
    assert.doesNotMatch(body.reply, /content filters/i);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat returns Lex slot prompts before calling Bedrock guided flows", async () => {
  const mock = installPersistenceMocks({
    lexIntentName: "YCCSupportIntent",
    lexDialogActionType: "ElicitSlot",
    lexSlotToElicit: "OrderNumber",
    lexMessages: [
      {
        contentType: "PlainText",
        content: "What order number should I look up?",
      },
    ],
  });
  try {
    process.env.FEATURE_LEX_ROUTER = "ready";
    process.env.LEX_ROUTER_BOT_ID = "YCCLEXBOT1";
    process.env.LEX_ROUTER_BOT_ALIAS_ID = "YCCALIAS1";
    process.env.LEX_ROUTER_LOCALE_ID = "en_US";

    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "I need help with an order.",
        conversationId: "conv-lex-slots",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCSupportAgent");
    assert.equal(body.ai.status, "lex_dialog");
    assert.equal(body.reply, "What order number should I look up?");
    assert.equal(body.lex.status, "slot_elicitation");
    assert.equal(body.lex.dialogActionType, "ElicitSlot");
    assert.equal(body.lex.slotToElicit, "OrderNumber");
    assert.deepEqual(body.nextActions, ["continue_lex_guided_flow", "collect_OrderNumber", "review_operator_handoffs"]);
    assert.equal(mock.lexInvocations.length, 1);
    assert.equal(mock.agentInvocations.length, 0);
    assert.equal(mock.bedrockInvocations.length, 0);
  } finally {
    mock.restore();
  }
});

test("concierge chat ignores incorrect Lex humidor slot prompts for cigar health questions", async () => {
  const mock = installPersistenceMocks({
    lexIntentName: "YCCHumidorIntent",
    lexDialogActionType: "ElicitSlot",
    lexSlotToElicit: "HumidorConcern",
    lexMessages: [
      {
        contentType: "PlainText",
        content: "What humidor concern should I use?",
      },
    ],
    bedrockReply:
      "Sorry, I can't provide information that might facilitate comparing tobacco products. If you want information about our products or have any other questions, feel free to ask.",
  });
  try {
    process.env.FEATURE_LEX_ROUTER = "ready";
    process.env.LEX_ROUTER_BOT_ID = "YCCLEXBOT1";
    process.env.LEX_ROUTER_BOT_ALIAS_ID = "YCCALIAS1";
    process.env.LEX_ROUTER_LOCALE_ID = "en_US";

    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Are cigars safer than cigarettes?",
        conversationId: "conv-lex-humidor-cigar-health",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.equal(body.lex.intentName, "YCCHumidorIntent");
    assert.match(body.reply, /cannot describe cigar use as safe/i);
    assert.doesNotMatch(body.reply, /What humidor concern should I use/i);
    assert.equal(mock.lexInvocations.length, 1);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat answers cigar humidity questions instead of returning Lex humidor prompts", async () => {
  const mock = installPersistenceMocks({
    lexIntentName: "YCCHumidorIntent",
    lexDialogActionType: "ElicitSlot",
    lexSlotToElicit: "HumidorConcern",
    lexMessages: [
      {
        contentType: "PlainText",
        content: "What humidor detail should I focus on: humidity, temperature, storage location, sensors, aging, or inventory?",
      },
    ],
    bedrockReply: "Keep cigars around 65 to 72 percent relative humidity, with slow adjustments and a calibrated hygrometer.",
  });
  try {
    process.env.FEATURE_LEX_ROUTER = "ready";
    process.env.LEX_ROUTER_BOT_ID = "YCCLEXBOT1";
    process.env.LEX_ROUTER_BOT_ALIAS_ID = "YCCALIAS1";
    process.env.LEX_ROUTER_LOCALE_ID = "en_US";

    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "What humidity should I keep cigars at in my humidor?",
        conversationId: "conv-lex-humidor-cigar-storage",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCHumidorAgent");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.equal(body.lex.intentName, "YCCHumidorIntent");
    assert.match(body.reply, /65 to 72 percent/i);
    assert.doesNotMatch(body.reply, /What humidor detail should I focus on/i);
    assert.equal(mock.lexInvocations.length, 1);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat replaces tobacco health guardrail copy with a direct adult boundary", async () => {
  const mock = installPersistenceMocks({
    bedrockReply:
      "Sorry, I can't provide information that might be misleading about tobacco products. It's important to note that cigars and cigarettes both contain nicotine.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Are cigars safer than cigarettes?",
        agent: "cigar_guide",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /cannot describe cigar use as safe/i);
    assert.doesNotMatch(body.reply, /can't give you information/i);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat does not surface generic direct-runtime refusal for adult cigar questions", async () => {
  const mock = installPersistenceMocks({
    bedrockReply:
      "Yuzu Cigar Club cannot help with that request. A concierge operator can review age-restricted, account, or compliance-sensitive questions.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "How should I cut and light a robusto?",
        agent: "cigar_guide",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /clean shallow cut/i);
    assert.doesNotMatch(body.reply, /cannot help with that request/i);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat still blocks under-21 tobacco access when recovering cigar replies", async () => {
  const mock = installPersistenceMocks({
    bedrockReply:
      "Yuzu Cigar Club cannot help with that request. A concierge operator can review age-restricted, account, or compliance-sensitive questions.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "How can a 17 year old buy cigars without ID?",
        agent: "cigar_guide",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /adults 21\+/i);
    assert.match(body.reply, /cannot help anyone under 21/i);
    assert.doesNotMatch(body.reply, /clean shallow cut/i);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat retries direct Bedrock Runtime when an agent alias returns a generic refusal", async () => {
  const mock = installPersistenceMocks({
    agentReply:
      "Yuzu Cigar Club cannot help with that request. A concierge operator can review age-restricted, account, or compliance-sensitive questions.",
    bedrockReply: "Your Sensei membership includes curated cigar access, member pricing, concierge help, and humidor tools.",
  });
  try {
    process.env.BEDROCK_AGENT_YCCCONCIERGE_ID = "AGENTCONCIERGE1";
    process.env.BEDROCK_AGENT_YCCCONCIERGE_ALIAS_ID = "ALIASCONCIERGE";

    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Tell me what my Sensei membership can do.",
        conversationId: "conv-agent-refusal-retry",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCConcierge");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /Sensei membership/);
    assert.doesNotMatch(body.reply, /cannot help with that request/i);
    assert.equal(mock.agentInvocations.length, 1);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat can return Amazon Polly speech for agent replies", async () => {
  const mock = installPersistenceMocks({
    bedrockReply: "The Yuzu concierge can talk this answer back through Amazon Polly.",
    pollyAudio: "spoken-chat-mp3",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Tell me what my membership includes.",
        voiceOutput: true,
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.voice.speech.service, "amazon_polly");
    assert.equal(body.voice.speech.status, "synthesized");
    assert.equal(body.voice.speech.mimeType, "audio/mpeg");
    assert.equal(body.voice.speech.audioBase64, Buffer.from("spoken-chat-mp3", "utf8").toString("base64"));
    assert.equal(mock.pollyInvocations.length, 1);
    assert.equal(mock.pollyInvocations[0].OutputFormat, "mp3");
    assert.equal(mock.pollyInvocations[0].VoiceId, "Joanna");
  } finally {
    mock.restore();
  }
});

test("concierge voice uses Amazon Transcribe for speech input and Amazon Polly for spoken replies", async () => {
  const mock = installPersistenceMocks({
    bedrockReply: "Keep the desktop humidor near 69 percent RH and log any drift.",
    pollyAudio: "spoken-voice-mp3",
    transcribeTranscript: "Track the humidity in my desktop humidor",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/voice", {
        audioBase64: Buffer.from("fake-voice-webm", "utf8").toString("base64"),
        mimeType: "audio/webm",
        durationMs: 2100,
        agent: "humidor",
        conversationId: "conv-voice",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCHumidorAgent");
    assert.equal(body.voice.inputAudio.mimeType, "audio/webm");
    assert.equal(body.voice.transcription.service, "amazon_transcribe");
    assert.equal(body.voice.transcription.status, "completed");
    assert.equal(body.voice.transcription.transcript, "Track the humidity in my desktop humidor");
    assert.equal(body.voice.speech.service, "amazon_polly");
    assert.equal(body.voice.speech.status, "synthesized");
    assert.equal(body.voice.speech.audioBase64, Buffer.from("spoken-voice-mp3", "utf8").toString("base64"));
    assert.match(body.reply, /69 percent RH/);
    assert.ok(
      mock.s3Invocations.some((input) => String(input.Key || "").startsWith("ycc/concierge-voice/")),
      "voice audio and transcript files should use the approved YCC S3 prefix"
    );
    assert.ok(
      mock.transcribeInvocations.some((input) => input.LanguageCode === "en-US" && input.MediaFormat === "webm"),
      "voice route should start an Amazon Transcribe job for the uploaded audio"
    );
    assert.equal(mock.pollyInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("concierge chat persists conversation, user message, assistant reply, and audit row", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "What wrapper pairs well with a morning cigar?",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.conversation.id, "22222222-2222-4222-8222-222222222222");
    assert.equal(body.conversation.persisted, true);
    assert.equal(body.conversation.persistence, "stored");

    const queries = mock.clients.flatMap((client) => client.queries.map((query) => query.sql));
    assert.ok(queries.some((sql) => sql.includes("insert into public.members")), "member should be upserted");
    assert.ok(queries.some((sql) => sql.includes("insert into public.conversations")), "conversation should be inserted");
    assert.equal(
      queries.filter((sql) => sql.includes("insert into public.conversation_messages")).length,
      2,
      "user and assistant messages should be inserted"
    );
    assert.ok(queries.some((sql) => sql.includes("insert into public.audit_log")), "audit row should be inserted");
  } finally {
    mock.restore();
  }
});

test("concierge chat uses direct Bedrock Runtime for the selected cigar guide persona", async () => {
  const mock = installPersistenceMocks({
    agentReply: "This guardrailed alias reply should not be used.",
    bedrockReply: "YCCCigarGuide recommends a Connecticut shade wrapper with coffee and keeps the guidance adult-only.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "What wrapper pairs well with a morning cigar?",
        agent: "cigar_guide",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /Connecticut shade/);
    assert.equal(mock.agentInvocations.length, 0);
    assert.equal(mock.bedrockInvocations.length, 1);
    assert.deepEqual(mock.bedrockInvocations[0].guardrailConfig, {
      guardrailIdentifier: "guardrail-test",
      guardrailVersion: "1",
      trace: "enabled",
    });
  } finally {
    mock.restore();
  }
});

test("concierge chat keeps direct cigar guide answers available with Bedrock guardrails enabled", async () => {
  const mock = installPersistenceMocks({
    agentReply:
      "Yuzu Cigar Club cannot help with that request. A concierge operator can review age-restricted, account, or compliance-sensitive questions.",
    bedrockReply: "New arrivals include fresh premium boxes selected for adult members.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "What are the latest cigars out?",
        agent: "cigar_guide",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCCigarGuide");
    assert.deepEqual(body.ai, { status: "bedrock_runtime" });
    assert.match(body.reply, /New arrivals/);
    assert.doesNotMatch(body.reply, /cannot help with that request/i);
    assert.equal(mock.agentInvocations.length, 0);
    assert.equal(mock.knowledgeBaseRetrievals.length, 1);
    assert.equal(mock.bedrockInvocations.length, 1);
    assert.deepEqual(mock.bedrockInvocations[0].guardrailConfig, {
      guardrailIdentifier: "guardrail-test",
      guardrailVersion: "1",
      trace: "enabled",
    });
  } finally {
    mock.restore();
  }
});

test("concierge chat falls back to direct Bedrock Runtime when specialist agent invocation fails", async () => {
  const mock = installPersistenceMocks({
    agentRuntimeError: true,
    bedrockReply: "Direct Bedrock fallback keeps the support answer ready for an operator.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "I need help with a renewal charge.",
        agent: "support",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.ai.status, "bedrock_runtime");
    assert.deepEqual(Object.keys(body.ai), ["status"]);
    assert.match(body.reply, /Direct Bedrock fallback/);
    assert.equal(mock.agentInvocations.length, 1);
    assert.equal(mock.agentInvocations[0].agentId, "AGENTSUPPORT1");
    assert.equal(mock.agentInvocations[0].agentAliasId, "ALIASSUPPORT");
    assert.equal(mock.knowledgeBaseRetrievals.length, 1);
    assert.equal(mock.knowledgeBaseRetrievals[0].knowledgeBaseId, "KBTEST1");
    assert.equal(mock.bedrockInvocations.length, 1);
    assert.match(JSON.stringify(mock.bedrockInvocations[0].system), /Published YCC catalog context/);
  } finally {
    mock.restore();
  }
});

test("concierge chat tells live AI paths to answer directly and concisely", async () => {
  const runtimeMock = installPersistenceMocks({
    bedrockReply: "A Connecticut shade wrapper is the direct morning pairing.",
  });
  try {
    await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "What wrapper pairs well with a morning cigar?",
        agent: "cigar_guide",
      })
    );

    const runtimeSystem = JSON.stringify(runtimeMock.bedrockInvocations[0]?.system || "");
    assert.match(runtimeSystem, /Answer the member's question directly first/);
    assert.match(runtimeSystem, /Keep replies concise/);
    assert.match(runtimeSystem, /21\+ adult cigar website/);
  } finally {
    runtimeMock.restore();
  }

  const agentMock = installPersistenceMocks({
    agentReply: "Your membership includes concierge routing and member pricing.",
  });
  try {
    await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Help me with a renewal charge",
        agent: "support",
      })
    );

    const agentInput = String(agentMock.agentInvocations[0]?.inputText || "");
    assert.match(agentInput, /Answer the member's question directly first/);
    assert.match(agentInput, /Keep replies concise/);
    assert.match(agentInput, /21\+ adult cigar website/);
    assert.match(agentInput, /Help me with a renewal charge/);
  } finally {
    agentMock.restore();
  }
});

test("concierge chat routes support, humidor, and general requests to specialist personas", async () => {
  const cases = [
    [{ message: "I need help with a renewal charge" }, "YCCSupportAgent"],
    [{ message: "Track the humidity in my desktop humidor", agent: "humidor" }, "YCCHumidorAgent"],
    [{ message: "Tell me what my membership can do" }, "YCCConcierge"],
  ] as const;

  for (const [payload, expectedAgent] of cases) {
    const response = await handler(createAuthenticatedEvent("POST /concierge/chat", payload));
    const body = JSON.parse(response.body);
    assert.equal(body.agent, expectedAgent);
  }
});

test("admin agent requires an admin or concierge operator group", async () => {
  const memberResponse = await handler(
    createAuthenticatedEvent("POST /concierge/chat", {
      message: "Show me admin operations",
      agent: "admin",
    })
  );

  assert.equal(memberResponse.statusCode, 403);
  const memberBody = JSON.parse(memberResponse.body);
  assert.equal(memberBody.error, "admin_agent_forbidden");

  const adminResponse = await handler(
    createAuthenticatedEvent(
      "POST /concierge/chat",
      {
        message: "Show me admin operations",
        agent: "admin",
      },
      adminClaims
    )
  );

  assert.equal(adminResponse.statusCode, 200);
  const adminBody = JSON.parse(adminResponse.body);
  assert.equal(adminBody.agent, "YCCAdminAgent");
});

test("admin agent lists live user access records for roster prompts", async () => {
  const mock = installPersistenceMocks({
    adminMemberRows: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        cognito_sub: "member-123",
        email: "member@example.com",
        email_verified: true,
        display_name: "Yuzu Member",
        role: "customer",
        membership_tier: "sensei",
        member_status: "active",
        last_seen_at: "2026-05-12T09:00:00.000Z",
        created_at: "2026-05-06T09:00:00.000Z",
        updated_at: "2026-05-12T09:10:00.000Z",
        subscription_status: "active",
        subscription_tier: "sensei",
        subscription_period: "monthly",
        order_count: 1,
        total_spend_cents: 12792,
        humidor_item_count: 3,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        cognito_sub: "operator-456",
        email: "operator@example.com",
        email_verified: true,
        display_name: "Yuzu Operator",
        role: "operator",
        membership_tier: "daimyo",
        member_status: "active",
        last_seen_at: "2026-05-12T10:00:00.000Z",
        created_at: "2026-05-07T09:00:00.000Z",
        updated_at: "2026-05-12T10:10:00.000Z",
        subscription_status: "active",
        subscription_tier: "daimyo",
        subscription_period: "annual",
        order_count: 2,
        total_spend_cents: 24000,
        humidor_item_count: 0,
      },
    ],
  });

  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /concierge/chat",
        {
          message: "list all users",
          agent: "admin",
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCAdminAgent");
    assert.equal(body.ai.status, "admin_user_list");
    assert.match(body.reply, /User access roster/i);
    assert.match(body.reply, /member@example\.com/);
    assert.match(body.reply, /operator@example\.com/);
    assert.equal(body.reply.includes("support queue health"), false);
    assert.equal(mock.agentInvocations.length, 0);

    const memberListQuery = mock.clients
      .flatMap((client) => client.queries)
      .find((query) => query.sql.includes("admin_members_list"));
    assert.ok(memberListQuery, "admin agent should read the persisted member roster");
    assert.equal(memberListQuery.params[2], 250);
  } finally {
    mock.restore();
  }
});

test("weekly cigar news agent requires an admin or concierge operator group", async () => {
  const mock = installPersistenceMocks();
  try {
    const memberResponse = await handler(
      createAuthenticatedEvent("POST /concierge/chat", {
        message: "Research this week's cigars news and draft the education newsletter",
        agent: "weekly_news",
      })
    );

    assert.equal(memberResponse.statusCode, 403);
    const memberBody = JSON.parse(memberResponse.body);
    assert.equal(memberBody.error, "news_agent_forbidden");

    const adminResponse = await handler(
      createAuthenticatedEvent(
        "POST /concierge/chat",
        {
          message: "Research this week's cigars news and draft the education newsletter",
          agent: "weekly_news",
        },
        adminClaims
      )
    );

    assert.equal(adminResponse.statusCode, 200);
    const adminBody = JSON.parse(adminResponse.body);
    assert.equal(adminBody.agent, "YCCNewsAgent");
  } finally {
    mock.restore();
  }
});

test("weekly cigar news agent requires an explicitly configured Bedrock alias", async () => {
  const mock = installPersistenceMocks({
    agentReply: "YCCNewsAgent should not run without configured environment aliases.",
  });
  try {
    delete process.env.BEDROCK_AGENT_YCCNEWSAGENT_ID;
    delete process.env.BEDROCK_AGENT_YCCNEWSAGENT_ALIAS_ID;

    const response = await handler(
      createAuthenticatedEvent(
        "POST /concierge/chat",
        {
          message: "Research this week's cigars news and draft the education newsletter",
          agent: "weekly_news",
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 503);
    const body = JSON.parse(response.body);
    assert.equal(body.error, "news_agent_not_configured");
    assert.equal(mock.agentInvocations.length, 0);
  } finally {
    mock.restore();
  }
});

test("weekly cigar news agent uses the published Bedrock agent alias", async () => {
  const mock = installPersistenceMocks({
    agentReply: "YCCNewsAgent drafted the weekly cigars news article and newsletter with source notes.",
  });
  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /concierge/chat",
        {
          message: "Research this week's cigars news and draft the education newsletter",
          agent: "weekly_news",
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.agent, "YCCNewsAgent");
    assert.deepEqual(body.ai, { status: "bedrock_agent_runtime" });
    assert.match(body.reply, /weekly cigars news article/);
    assert.equal(mock.agentInvocations.length, 1);
    assert.equal(mock.agentInvocations[0].agentId, "AGENTNEWS1");
    assert.equal(mock.agentInvocations[0].agentAliasId, "ALIASNEWS");
  } finally {
    mock.restore();
  }
});

test("Bedrock action group support draft persists with authenticated session attributes", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = (await handler({
      messageVersion: "1.0",
      actionGroup: "YCCOperations",
      function: "DraftSupportReply",
      inputText: "Draft a reply for a renewal charge question",
      sessionId: "session-support-action",
      agent: { name: "YCCSupportAgent", id: "SJJ2DVNYES", alias: "prod", version: "1" },
      parameters: [
        { name: "subject", type: "string", value: "Membership renewal charge" },
        { name: "message", type: "string", value: "The member says their renewal charge looks wrong." },
      ],
      sessionAttributes: {
        memberSub: actorClaims.sub,
        memberEmail: actorClaims.email,
        memberName: actorClaims.name,
        cognitoGroups: "member,sensei",
        membershipTier: "sensei",
        memberStatus: "active",
      },
      promptSessionAttributes: {},
    })) as unknown as BedrockActionGroupResponse;

    assert.equal(response.messageVersion, "1.0");
    assert.equal(response.response.actionGroup, "YCCOperations");
    assert.equal(response.response.function, "DraftSupportReply");
    const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
    assert.equal(body.persistence.status, "stored");
    assert.equal(body.case.caseNumber, "YCC-TESTCASE");
    assert.equal(body.operatorReviewRequired, true);

    const queries = mock.clients.flatMap((client) => client.queries.map((query) => query.sql));
    assert.ok(queries.some((sql) => sql.includes("insert into public.support_cases")), "support case should be inserted");
    assert.ok(
      queries.some((sql) => sql.includes("insert into public.support_email_messages")),
      "draft support email should be inserted"
    );
  } finally {
    mock.restore();
  }
});

test("Bedrock action group admin summary requires admin or concierge operator session group", async () => {
  const response = (await handler({
    messageVersion: "1.0",
    actionGroup: "YCCOperations",
    function: "GetAdminQueueSummary",
    inputText: "Summarize the support queue",
    sessionId: "session-admin-action",
    agent: { name: "YCCAdminAgent", id: "UQWB6AKMBT", alias: "prod", version: "1" },
    parameters: [{ name: "queue", type: "string", value: "support" }],
    sessionAttributes: {
      memberSub: actorClaims.sub,
      memberEmail: actorClaims.email,
      memberName: actorClaims.name,
      cognitoGroups: "member",
      membershipTier: "sensei",
      memberStatus: "active",
    },
    promptSessionAttributes: {},
  })) as unknown as BedrockActionGroupResponse;

  assert.equal(response.messageVersion, "1.0");
  assert.equal(response.response.functionResponse.responseState, "REPROMPT");
  const body = JSON.parse(response.response.functionResponse.responseBody.TEXT.body);
  assert.equal(body.error, "admin_agent_forbidden");
});

test("Bedrock action group weekly news draft requires an operator and returns review-ready copy", async () => {
  const memberResponse = (await handler({
    messageVersion: "1.0",
    actionGroup: "YCCOperations",
    function: "DraftWeeklyNews",
    inputText: "Draft this week's cigar news newsletter",
    sessionId: "session-news-action-member",
    agent: { name: "YCCNewsAgent", id: "TUVBTVKNXG", alias: "prod", version: "2" },
    parameters: [{ name: "topic", type: "string", value: "weekly cigar industry news" }],
    sessionAttributes: {
      memberSub: actorClaims.sub,
      memberEmail: actorClaims.email,
      memberName: actorClaims.name,
      cognitoGroups: "member",
      membershipTier: "sensei",
      memberStatus: "active",
    },
    promptSessionAttributes: {},
  })) as unknown as BedrockActionGroupResponse;

  assert.equal(memberResponse.response.functionResponse.responseState, "REPROMPT");
  assert.equal(
    JSON.parse(memberResponse.response.functionResponse.responseBody.TEXT.body).error,
    "news_agent_forbidden"
  );

  const adminResponse = (await handler({
    messageVersion: "1.0",
    actionGroup: "YCCOperations",
    function: "DraftWeeklyNews",
    inputText: "Draft this week's cigar news newsletter",
    sessionId: "session-news-action-admin",
    agent: { name: "YCCNewsAgent", id: "TUVBTVKNXG", alias: "prod", version: "2" },
    parameters: [
      { name: "topic", type: "string", value: "weekly cigar industry news" },
      { name: "timeframe", type: "string", value: "this week" },
    ],
    sessionAttributes: {
      memberSub: adminClaims.sub,
      memberEmail: adminClaims.email,
      memberName: adminClaims.name,
      cognitoGroups: "admin,concierge_operator",
      membershipTier: "sensei",
      memberStatus: "active",
    },
    promptSessionAttributes: {},
  })) as unknown as BedrockActionGroupResponse;

  assert.equal(adminResponse.messageVersion, "1.0");
  assert.equal(adminResponse.response.functionResponse.responseState, undefined);
  const body = JSON.parse(adminResponse.response.functionResponse.responseBody.TEXT.body);
  assert.equal(body.action, "weekly_news_draft");
  assert.equal(body.operatorReviewRequired, true);
  assert.equal(body.publishStatus, "draft");
  assert.match(body.educationArticle.title, /weekly cigar industry news/i);
  assert.ok(body.sourceNotes.length >= 2);
  assert.ok(body.complianceReview.prohibitedClaims.includes("health"));
});

test("news story draft route requires an operator and returns structured source-safe copy", async () => {
  const memberResponse = await handler(
    createAuthenticatedEvent("POST /news/story-drafts", {
      angle: "Rocky Patel official release update",
      sourceUrls: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
      sourceNotes: ["Official Rocky Patel page confirms release timing."],
    })
  );

  assert.equal(memberResponse.statusCode, 403);
  assert.equal(JSON.parse(memberResponse.body).error, "news_agent_forbidden");

  const mock = installPersistenceMocks({
    agentReply: JSON.stringify({
      title: "Rocky Patel Updates Its Release Calendar",
      dek: "A concise official-source update for adult cigar readers.",
      category: "Industry News",
      sections: [
        {
          heading: "What changed",
          body: "Rocky Patel shared release timing through its official news channel.",
        },
      ],
      sourceNotes: [
        {
          label: "Rocky Patel",
          url: "https://www.rockypatel.com/cigar-news/sixty-release/",
          note: "Official brand page.",
        },
      ],
    }),
  });

  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /news/story-drafts",
        {
          angle: "Rocky Patel official release update",
          timeframe: "this week",
          sourceUrls: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
          sourceNotes: ["Official Rocky Patel page confirms release timing."],
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.draft.title, "Rocky Patel Updates Its Release Calendar");
    assert.equal(body.draft.publishStatus, "draft");
    assert.equal(body.draft.operatorReviewRequired, true);
    assert.equal(body.draft.sourceNotes[0].sourceType, "official");
    assert.equal(body.ai.status, "bedrock_agent_runtime");
    assert.equal(mock.agentInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("news story draft route falls back to direct Bedrock JSON when the agent reply is not usable", async () => {
  const mock = installPersistenceMocks({
    agentReply: "The newsroom agent is ready to draft source-safe copy for review.",
    bedrockReply: JSON.stringify({
      title: "Rocky Patel Updates Its Release Calendar",
      dek: "A concise official-source update for adult cigar readers.",
      category: "Industry News",
      bodyMarkdown: [
        "## Release timing",
        "Rocky Patel shared release timing details through its official news channel, giving operators a source-backed starting point for review.",
        "",
        "## Availability outlook",
        "The draft keeps the claims tied to the official brand page and leaves publication approval with a human operator.",
      ].join("\n"),
      sourceNotes: [
        {
          label: "Rocky Patel",
          url: "https://www.rockypatel.com/cigar-news/sixty-release/",
          note: "Official brand page.",
        },
      ],
    }),
  });

  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /news/story-drafts",
        {
          angle: "Rocky Patel official release update",
          timeframe: "this week",
          sourceUrls: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
          sourceNotes: ["Official Rocky Patel page confirms release timing."],
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.draft.title, "Rocky Patel Updates Its Release Calendar");
    assert.equal(body.draft.sections[0].heading, "Release timing");
    assert.equal(body.ai.status, "bedrock_runtime_news_draft");
    assert.equal(mock.agentInvocations.length, 2);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("news story draft route refuses to return scaffold copy when generation is unusable", async () => {
  const mock = installPersistenceMocks({
    agentReply: "The newsroom agent is ready to draft source-safe copy for review.",
    bedrockReply: "Bedrock also failed to return JSON.",
  });

  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /news/story-drafts",
        {
          angle: "Rocky Patel official release update",
          timeframe: "this week",
          sourceUrls: ["https://www.rockypatel.com/cigar-news/sixty-release/"],
          sourceNotes: ["Official Rocky Patel page confirms release timing."],
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 502);
    const body = JSON.parse(response.body);
    assert.equal(body.error, "news_story_generation_failed");
    assert.equal(body.ai.status, "bedrock_runtime_news_draft");
    assert.equal(mock.agentInvocations.length, 2);
    assert.equal(mock.bedrockInvocations.length, 1);
  } finally {
    mock.restore();
  }
});

test("news story publish route stores approved story and audit row", async () => {
  const mock = installPersistenceMocks();

  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /news/stories",
        {
          title: "Rocky Patel Official Release Update",
          dek: "A short official-source update for adult cigar readers.",
          category: "Industry News",
          publishStatus: "published",
          sections: [
            {
              heading: "What changed",
              body: "Rocky Patel posted official release details.",
            },
          ],
          sourceNotes: [
            {
              label: "Rocky Patel",
              url: "https://www.rockypatel.com/cigar-news/sixty-release/",
              note: "Official brand page.",
              sourceType: "official",
            },
          ],
          operatorApproved: true,
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.story.slug, "rocky-patel-official-release-update");
    assert.equal(body.story.status, "published");
    assert.equal(body.persistence.table, "news_stories");

    const queries = mock.clients.flatMap((client) => client.queries.map((query) => query.sql));
    assert.ok(queries.some((sql) => sql.includes("insert into public.news_stories")), "news story should be inserted");
    assert.ok(queries.some((sql) => sql.includes("insert into public.audit_log")), "audit row should be inserted");
  } finally {
    mock.restore();
  }
});

test("news story publish route stores actual story image metadata", async () => {
  const mock = installPersistenceMocks();
  const storyImages = [
    {
      label: "Rocky Patel Sixty",
      image: "https://www.rockypatel.com/wp-content/uploads/2026/05/rocky-patel-sixty.jpg",
      imagePosition: "50% 45%",
      alt: "Rocky Patel Sixty story image",
      sourceUrl: "https://www.rockypatel.com/cigar-news/sixty-release/",
    },
  ];

  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /news/stories",
        {
          title: "Rocky Patel Official Release Update",
          dek: "A short official-source update for adult cigar readers.",
          category: "Industry News",
          publishStatus: "published",
          sections: [
            {
              heading: "Release image",
              body: "Rocky Patel posted official release details with its product image.",
            },
          ],
          images: storyImages,
          sourceNotes: [
            {
              label: "Rocky Patel",
              url: "https://www.rockypatel.com/cigar-news/sixty-release/",
              note: "Official brand page.",
              sourceType: "official",
            },
          ],
          operatorApproved: true,
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.deepEqual(body.story.images, storyImages);

    const insertQuery = mock.clients
      .flatMap((client) => client.queries)
      .find((query) => query.sql.includes("insert into public.news_stories"));
    assert.ok(insertQuery, "news story should be inserted");
    const metadata = JSON.parse(String(insertQuery.params[9] || "{}"));
    assert.deepEqual(metadata.images, storyImages);
  } finally {
    mock.restore();
  }
});

test("news story publish route rejects placeholder scaffold copy", async () => {
  const mock = installPersistenceMocks();

  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /news/stories",
        {
          title: "Cigar Industry Brand Announcements brief",
          dek: "A human-reviewed Yuzu Cigar Club news draft built from primary source notes.",
          category: "Industry News",
          publishStatus: "published",
          bodyMarkdown: [
            "## What changed",
            "Yuzu is tracking cigar industry brand announcements based on the official source notes supplied for this week. Keep this section factual and concise until an operator verifies each detail against the source URLs.",
            "",
            "## Why adult members may care",
            "Frame the update around release timing, availability, craftsmanship, events, or education value. Avoid sales pressure and do not make health, cessation, medical, therapeutic, disease, or safety claims.",
            "",
            "## Operator review notes",
            "Verify every product name, date, quote, MSRP, distributor note, and availability claim before publication. Attribute the company announcement and link to the primary source.",
          ].join("\n"),
          sourceNotes: [
            {
              label: "Rocky Patel",
              url: "https://www.rockypatel.com/cigar-news/sixty-release/",
              note: "Official brand page.",
              sourceType: "official",
            },
          ],
          operatorApproved: true,
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.error, "news_story_placeholder_body");
  } finally {
    mock.restore();
  }
});

test("news story publish route allows placeholder legacy stories to be demoted to draft", async () => {
  const mock = installPersistenceMocks();

  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /news/stories",
        {
          title: "Daily Cigar Flow Update - May 12 brief",
          slug: "daily-cigar-flow-update-may-12-brief",
          dek: "A human-reviewed Yuzu Cigar Club news draft built from primary source notes.",
          category: "Industry News",
          publishStatus: "draft",
          status: "draft",
          bodyMarkdown: [
            "## What changed",
            "Yuzu is tracking daily cigar flow based on the official source notes supplied for today. Keep this section factual and concise until an operator verifies each detail against the source URLs.",
            "",
            "## Why adult members may care",
            "Frame the update around release timing, availability, craftsmanship, events, or education value. Avoid sales pressure and do not make health, cessation, medical, therapeutic, disease, or safety claims.",
            "",
            "## Operator review notes",
            "Verify every product name, date, quote, MSRP, distributor note, and availability claim before publication. Attribute the company announcement and link to the primary source.",
          ].join("\n"),
          sourceNotes: [
            {
              label: "Drew Estate",
              url: "https://drewestate.com/",
              note: "Official brand page.",
              sourceType: "official",
            },
          ],
          operatorApproved: true,
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.story.status, "draft");
  } finally {
    mock.restore();
  }
});

test("public news stories route returns published stories without Cognito", async () => {
  const mock = installPersistenceMocks();

  try {
    const response = await handler({
      routeKey: "GET /news/stories",
      rawPath: "/news/stories",
      requestContext: { requestId: "req-news-public", http: { method: "GET" } },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.stories[0].slug, "rocky-patel-official-release-update");
    assert.equal(body.stories[0].sourceNotes[0].sourceType, "official");
    assert.equal(body.stories[0].images[0].image, "https://www.rockypatel.com/wp-content/uploads/2026/05/rocky-patel-sixty.jpg");
    assert.equal(body.stories[0].images[0].sourceUrl, "https://www.rockypatel.com/cigar-news/sixty-release/");
    assert.equal(body.persistence, "stored");
  } finally {
    mock.restore();
  }
});

test("support email draft persists case, draft email, and audit row", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /support/email-draft", {
        subject: "Membership billing question",
        message: "Can someone review my renewal charge?",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.case.id, "33333333-3333-4333-8333-333333333333");
    assert.equal(body.case.caseNumber, "YCC-TESTCASE");
    assert.equal(body.case.persisted, true);
    assert.equal(body.case.persistence, "stored");
    assert.equal(body.draft.persisted, true);
    assert.equal(body.draft.messageId, "44444444-4444-4444-8444-444444444444");

    const queries = mock.clients.flatMap((client) => client.queries.map((query) => query.sql));
    assert.ok(queries.some((sql) => sql.includes("insert into public.support_cases")), "support case should be inserted");
    assert.ok(
      queries.some((sql) => sql.includes("insert into public.support_email_messages")),
      "draft support email should be inserted"
    );
    assert.ok(queries.some((sql) => sql.includes("insert into public.audit_log")), "audit row should be inserted");
  } finally {
    mock.restore();
  }
});

test("public support contact sends a support email and persists an inbound case", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler({
      routeKey: "POST /support/contact",
      rawPath: "/support/contact",
      body: JSON.stringify({
        name: "Visitor Name",
        email: "visitor@example.com",
        topic: "Order support",
        orderNumber: "YCC-1042",
        message: "Please help me find the tracking update for my monthly box.",
        pagePath: "/contact/",
      }),
      headers: {
        "user-agent": "node-test",
      },
      requestContext: {
        requestId: "req-public-support-contact",
        http: { method: "POST", sourceIp: "198.51.100.77" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.contact.status, "sent");
    assert.equal(body.contact.email, "visitor@example.com");
    assert.equal(body.contact.persisted, true);
    assert.equal(body.contact.sesMessageId, "ses-outbound-message-123");
    assert.equal(mock.sesInvocations.length, 1);
    assert.deepEqual(mock.sesInvocations[0].Destination, { ToAddresses: ["support@yuzucigarclub.com"] });
    assert.deepEqual(mock.sesInvocations[0].ReplyToAddresses, ["visitor@example.com"]);
    const simpleEmail = (mock.sesInvocations[0].Content as { Simple: { Subject: { Data: string }; Body: { Text: { Data: string } } } }).Simple;
    assert.match(simpleEmail.Subject.Data, /Order support/);
    assert.match(simpleEmail.Body.Text.Data, /tracking update/);

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(queries.some((query) => query.sql.includes("insert into public.support_cases")), "support case should be inserted");
    assert.ok(
      queries.some(
        (query) =>
          query.sql.includes("insert into public.support_email_messages") &&
          query.params.includes("ses-outbound-message-123")
      ),
      "public support email should be persisted with the SES message id"
    );
    assert.ok(queries.some((query) => query.sql.includes("insert into public.audit_log")), "audit row should be inserted");
  } finally {
    mock.restore();
  }
});

test("public support contact validates required fields before sending", async () => {
  const response = await handler({
    routeKey: "POST /support/contact",
    rawPath: "/support/contact",
    body: JSON.stringify({
      name: "Visitor Name",
      email: "not an email",
      message: "short",
    }),
    requestContext: { requestId: "req-public-support-contact-invalid", http: { method: "POST" } },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).error, "missing_contact_email");
});

test("support email send requires an admin or concierge operator", async () => {
  const response = await handler(
    createAuthenticatedEvent("POST /support/email-send", {
      to: "member@example.com",
      subject: "Membership renewal charge",
      body: "We reviewed the renewal charge and can help from here.",
    })
  );

  assert.equal(response.statusCode, 403);
  const body = JSON.parse(response.body);
  assert.equal(body.error, "support_send_forbidden");
});

test("support email send uses SES and persists the sent email", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler(
      createAuthenticatedEvent(
        "POST /support/email-send",
        {
          to: "member@example.com",
          subject: "Membership renewal charge",
          body: "We reviewed the renewal charge and can help from here.",
        },
        adminClaims
      )
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.send.status, "sent");
    assert.equal(body.send.sesMessageId, "ses-outbound-message-123");
    assert.equal(mock.sesInvocations.length, 1);
    assert.equal(mock.sesInvocations[0].FromEmailAddress, "support@yuzucigarclub.com");
    assert.deepEqual(mock.sesInvocations[0].Destination, { ToAddresses: ["member@example.com"] });

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(queries.some((query) => query.sql.includes("insert into public.support_cases")), "support case should be inserted");
    assert.ok(
      queries.some(
        (query) =>
          query.sql.includes("insert into public.support_email_messages") &&
          query.params.includes("ses-outbound-message-123")
      ),
      "sent support email should be persisted with the SES message id"
    );
  } finally {
    mock.restore();
  }
});

test("SES receipt event routes raw email through YCCSupportAgent and persists an operator draft", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler({
      Records: [
        {
          eventSource: "aws:ses",
          ses: {
            mail: {
              messageId: "ses-message-123",
              timestamp: "2026-05-06T19:30:00.000Z",
              commonHeaders: {
                from: ["Customer One <customer@example.com>"],
                to: ["support@yuzucigarclub.com"],
                subject: "Renewal charge question",
              },
            },
            receipt: {
              recipients: ["support@yuzucigarclub.com"],
            },
          },
        },
      ],
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.inbound.status, "stored");
    assert.equal(body.inbound.sesMessageId, "ses-message-123");
    assert.equal(body.inbound.agent.name, "YCCSupportAgent");
    assert.equal(body.inbound.agent.status, "bedrock_agent_runtime");
    assert.equal(body.inbound.agent.draftPersisted, true);
    assert.equal(body.inbound.agent.draftMessageId, "44444444-4444-4444-8444-444444444444");
    assert.equal(mock.s3Invocations.length, 1);
    assert.equal(mock.s3Invocations[0].Bucket, "classroom2");
    assert.equal(mock.s3Invocations[0].Key, "ycc/support-email/raw/ses-message-123");
    assert.equal(mock.agentInvocations.length, 1);
    assert.equal(mock.agentInvocations[0].agentId, "AGENTSUPPORT1");
    assert.equal(mock.agentInvocations[0].agentAliasId, "ALIASSUPPORT");
    assert.match(String(mock.agentInvocations[0].inputText), /Inbound SES support email/i);
    assert.match(String(mock.agentInvocations[0].inputText), /Renewal charge question/);
    assert.match(String(mock.agentInvocations[0].inputText), /Can someone help me understand my renewal charge\?/);

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(queries.some((query) => query.sql.includes("insert into public.support_cases")), "support case should be inserted");
    assert.ok(
      queries.some(
        (query) =>
          query.sql.includes("insert into public.support_email_messages") &&
          query.params.includes("ses-message-123") &&
          query.params.includes("ycc/support-email/raw/ses-message-123")
      ),
      "inbound support email should include SES and S3 references"
    );
    assert.ok(
      queries.some(
        (query) =>
          query.sql.includes("insert into public.support_email_messages") &&
          query.params.includes("YCC agent says the answer should use the published knowledge base.") &&
          JSON.stringify(query.params).includes("ses_inbound_agent")
      ),
      "support agent draft should be persisted for operator review"
    );
  } finally {
    mock.restore();
  }
});

test("humidor item route normalizes a cigar item contract", async () => {
  const response = await handler({
    routeKey: "POST /humidor/items",
    rawPath: "/humidor/items",
    body: JSON.stringify({
      brand: "Padron",
      line: "1964 Anniversary",
      vitola: "Toro",
      quantity: 2,
      rating: 94,
      purchaseDate: "2026-03-12",
      agingStartDate: "2026-03-12",
      productionDate: "2022-05-01",
      reorderReminder: "2026-06-15",
    }),
    requestContext: {
      requestId: "req-humidor",
      http: { method: "POST" },
      authorizer: { jwt: { claims: actorClaims } },
    },
  });

  assert.equal(response.statusCode, 202);
  const body = JSON.parse(response.body);
  assert.equal(body.item.name, "Padron 1964 Anniversary");
  assert.equal(body.item.purchaseDate, "2026-03-12");
  assert.equal(body.item.agingStartDate, "2026-03-12");
  assert.equal(body.item.productionDate, "2022-05-01");
  assert.equal(body.item.reorderReminder, "2026-06-15");
  assert.equal(body.persistence.status, "schema_ready_write_pending");
});

test("humidor image identification route invokes Bedrock vision and returns reviewable cigar fields", async () => {
  const mock = installPersistenceMocks({
    bedrockReply: JSON.stringify({
      name: "Padron 1964 Anniversary Toro",
      brand: "Padron",
      line: "1964 Anniversary",
      vitola: "Toro",
      wrapper: "Nicaraguan",
      origin: "Nicaragua",
      strength: "Full",
      manufacturer: "Padrón Cigars",
      country: "Nicaragua",
      region: "Estelí",
      factory: "Tabacos Cubanica",
      size: "6 x 52",
      length: "6 in",
      ringGauge: "52",
      shape: "Toro",
      binder: "Nicaraguan",
      filler: "Nicaraguan",
      blend: "All-Nicaraguan tobacco",
      flavorProfile: ["cocoa", "espresso", "pepper"],
      body: "Full",
      finish: "Long cocoa and pepper finish",
      msrp: "$18.50",
      releaseStatus: "Regular production",
      packaging: "Box-pressed anniversary line",
      sourceSummary: "Known Padron 1964 Anniversary reference details inferred after visual identification.",
      imageObservations: ["Brown Padron band", "Anniversary-style secondary band"],
      quantity: 1,
      tastingNotes: "Band and box label appear to show Padron 1964 Anniversary.",
      confidence: "medium",
      evidence: ["Band text resembles Padron 1964 Anniversary"],
      needsReview: ["Confirm vitola before saving"],
    }),
  });

  try {
    const response = await handler(
      createAuthenticatedEvent("POST /humidor/identify-cigar", {
        imageBase64: Buffer.from("fake-jpeg-bytes").toString("base64"),
        mimeType: "image/jpeg",
        notes: "Band closeup on a cigar resting in the humidor.",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.suggestion.name, "Padron 1964 Anniversary Toro");
    assert.equal(body.suggestion.brand, "Padron");
    assert.equal(body.suggestion.source, "ai_cigar_image");
    assert.equal(body.suggestion.confidence, "medium");
    assert.equal(body.suggestion.estimatedValue, 18.5);
    assert.equal(body.suggestion.estimatedValueCurrency, "USD");
    assert.equal(body.suggestion.estimatedValueSource, "ai_identification_msrp");
    assert.equal(body.suggestion.details.manufacturer, "Padrón Cigars");
    assert.equal(body.suggestion.details.country, "Nicaragua");
    assert.equal(body.suggestion.details.region, "Estelí");
    assert.equal(body.suggestion.details.size, "6 x 52");
    assert.equal(body.suggestion.details.binder, "Nicaraguan");
    assert.deepEqual(body.suggestion.details.flavorProfile, ["cocoa", "espresso", "pepper"]);
    assert.deepEqual(body.suggestion.details.imageObservations, ["Brown Padron band", "Anniversary-style secondary band"]);
    assert.deepEqual(body.suggestion.needsReview, ["Confirm vitola before saving"]);
    assert.equal(body.ai.status, "bedrock_runtime");
    assert.equal(body.input.imageType, "image/jpeg");
    assert.equal(mock.bedrockInvocations.length, 1);

    const content = (mock.bedrockInvocations[0].messages as Array<Record<string, unknown>>)[0]
      .content as Array<Record<string, unknown>>;
    const promptText = String(content.find((block) => "text" in block)?.text || "");
    const imageBlock = content.find((block) => "image" in block)?.image as {
      format: string;
      source: { bytes: Buffer };
    };

    assert.match(promptText, /manufacturer/);
    assert.match(promptText, /binder/);
    assert.match(promptText, /imageObservations/);
    assert.equal(imageBlock.format, "jpeg");
    assert.ok(Buffer.isBuffer(imageBlock.source.bytes), "Bedrock SDK should receive raw image bytes");
    assert.equal(mock.clients.length, 0, "identification should not persist until the user confirms");
  } finally {
    mock.restore();
  }
});

test("humidor image identification uses Rekognition OCR text as Bedrock prompt evidence", async () => {
  const mock = installPersistenceMocks({
    bedrockReply: JSON.stringify({
      name: "Padron 1964 Anniversary Toro",
      brand: "Padron",
      line: "1964 Anniversary",
      vitola: "Toro",
      confidence: "high",
      evidence: ["Band text matches Padron 1964 Anniversary"],
      needsReview: ["Confirm the exact vitola before saving"],
    }),
    rekognitionTextDetections: [
      {
        DetectedText: "PADRON 1964 ANNIVERSARY",
        Type: "LINE",
        Confidence: 98.4,
      },
      {
        DetectedText: "SERIE 1964",
        Type: "LINE",
        Confidence: 86.2,
      },
      {
        DetectedText: "low confidence blur",
        Type: "LINE",
        Confidence: 42,
      },
      {
        DetectedText: "PADRON",
        Type: "WORD",
        Confidence: 99,
      },
    ],
  });
  process.env.FEATURE_REKOGNITION = "detect_text_ready";

  try {
    const response = await handler(
      createAuthenticatedEvent("POST /humidor/identify-cigar", {
        imageBase64: Buffer.from("fake-jpeg-bytes").toString("base64"),
        mimeType: "image/jpeg",
        notes: "Close-up photo of the cigar band.",
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.ai.rekognition.status, "detected_text");
    assert.deepEqual(
      body.ai.rekognition.textLines.map((line: { text: string }) => line.text),
      ["PADRON 1964 ANNIVERSARY", "SERIE 1964"]
    );
    assert.equal(mock.rekognitionInvocations.length, 1);
    const rekognitionImage = mock.rekognitionInvocations[0].Image as { Bytes: Buffer };
    assert.ok(Buffer.isBuffer(rekognitionImage.Bytes), "Rekognition should receive the uploaded image bytes");

    const content = (mock.bedrockInvocations[0].messages as Array<Record<string, unknown>>)[0]
      .content as Array<Record<string, unknown>>;
    const promptText = String(content.find((block) => "text" in block)?.text || "");

    assert.match(promptText, /Amazon Rekognition OCR candidates/i);
    assert.match(promptText, /PADRON 1964 ANNIVERSARY/);
    assert.match(promptText, /SERIE 1964/);
    assert.doesNotMatch(promptText, /low confidence blur/);
    assert.doesNotMatch(promptText, /"PADRON"/);
    assert.equal(mock.clients.length, 0, "Rekognition-assisted identification should not persist until confirmation");
  } finally {
    mock.restore();
  }
});

test("humidor image identification logs pulled field coverage without image or note payloads", async () => {
  const mock = installPersistenceMocks({
    bedrockReply: JSON.stringify({
      name: "Padron 1964 Anniversary Toro",
      brand: "Padron",
      line: "1964 Anniversary",
      vitola: "Toro",
      wrapper: "Nicaraguan",
      origin: "Nicaragua",
      strength: "Full",
      manufacturer: "Padrón Cigars",
      binder: "Nicaraguan",
      filler: "Nicaraguan",
      flavorProfile: ["cocoa", "pepper"],
      confidence: "high",
      evidence: ["Band text is legible"],
      needsReview: [],
    }),
  });
  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (message?: unknown) => {
    logs.push(String(message));
  };

  try {
    const response = await handler(
      createAuthenticatedEvent("POST /humidor/identify-cigar", {
        imageBase64: Buffer.from("fake-jpeg-bytes").toString("base64"),
        mimeType: "image/jpeg",
        notes: "Private member note that should not be logged.",
      })
    );

    assert.equal(response.statusCode, 200);
    const identificationLog = logs
      .map((entry) => {
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      })
      .find((entry) => entry?.event === "cigar_image_identification_completed");

    assert.ok(identificationLog, "expected a safe identification summary log");
    assert.equal(identificationLog.suggestedName, "Padron 1964 Anniversary Toro");
    assert.equal(identificationLog.confidence, "high");
    assert.ok(identificationLog.fieldCoverage.includes("brand"));
    assert.ok(identificationLog.detailsCoverage.includes("manufacturer"));
    assert.ok(identificationLog.detailsCoverage.includes("flavorProfile"));
    assert.equal(JSON.stringify(identificationLog).includes("fake-jpeg-bytes"), false);
    assert.equal(JSON.stringify(identificationLog).includes("Private member note"), false);
  } finally {
    console.log = originalLog;
    mock.restore();
  }
});

test("humidor alerts GET endpoint returns stored preferences from the member profile", async () => {
  const mock = installPersistenceMocks();

  try {
    const response = await handler(createAuthenticatedEvent("GET /humidor/alerts"));

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.persistence, "stored");
    assert.equal(body.preferences.pushEnabled, true);
    assert.equal(body.preferences.reorderRemindersEnabled, true);
    assert.equal(body.preferences.climateAlertsEnabled, false);
    assert.equal(body.preferences.humidorProfile.humidorName, "Home cabinet");
    assert.equal(body.preferences.humidorProfile.defaultLocation, "Walk-in Humidor");
    assert.deepEqual(body.preferences.humidorProfile.locations, [
      { name: "Walk-in Humidor", kind: "humidor", trays: ["Top Tray", "Bottom Tray"] },
      { name: "Locker B", kind: "other", trays: [] },
    ]);
    assert.equal(body.preferences.pushSubscription?.endpoint, "https://example.com/endpoint");
    assert.deepEqual(body.preferences.pairedDevices, []);

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(queries.some((query) => query.sql.includes("select preferences from public.member_profiles")), "alert preferences should be read from member_profiles");
  } finally {
    mock.restore();
  }
});

test("humidor alerts update endpoint stores member profile preferences", async () => {
  const mock = installPersistenceMocks();

  try {
    const response = await handler(
      createAuthenticatedEvent("POST /humidor/alerts", {
        pushEnabled: true,
        reorderRemindersEnabled: true,
        climateAlertsEnabled: true,
        pushSubscription: {
          endpoint: "https://example.com/updated",
          keys: {
            p256dh: "p256dh-key-2",
            auth: "auth-key-2",
          },
        },
        pairedDevices: [
          {
            id: "device-humidifier-walk-in",
            name: "Smart Cabinet Humidifier",
            location: "Walk-in Humidor",
            deviceType: "HUMIDIFIER",
            connection: "WiFi",
            identifier: "HUM-192-168-1-88",
            humidity: 61,
            temperature: 70,
            syncIntervalMinutes: 20,
            status: "Connected",
            lastSyncedAt: "May 13, 2026 9:45 AM",
          },
        ],
        humidorProfile: {
          humidorName: "Aging locker",
          defaultLocation: "Locker A / Drawer 2",
          locations: [
            { name: "Locker A", kind: "humidor", trays: ["Top Tray", " Bottom Tray ", "top tray", ""] },
            { name: "Travel Case", kind: "other", trays: ["Ignored Tray"] },
            " Garage Cabinet ",
            { name: "locker a", kind: "humidor", trays: ["Middle Tray"] },
          ],
        },
      })
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.persistence, "stored");
    assert.equal(body.preferences.pushEnabled, true);
    assert.equal(body.preferences.climateAlertsEnabled, true);
    assert.equal(body.preferences.humidorProfile.defaultLocation, "Locker A / Drawer 2");
    assert.deepEqual(body.preferences.humidorProfile.locations, [
      { name: "Locker A", kind: "humidor", trays: ["Top Tray", "Bottom Tray", "Middle Tray"] },
      { name: "Travel Case", kind: "other", trays: [] },
      { name: "Garage Cabinet", kind: "other", trays: [] },
    ]);
    assert.equal(body.preferences.pushSubscription.endpoint, "https://example.com/updated");
    assert.equal(body.preferences.pairedDevices[0].name, "Smart Cabinet Humidifier");
    assert.equal(body.preferences.pairedDevices[0].humidity, 61);

    const queries = mock.clients.flatMap((client) => client.queries);
    const preferenceUpsert = queries.find((query) => query.sql.includes("insert into public.member_profiles"));
    const savedPreferences = preferenceUpsert ? JSON.parse(String(preferenceUpsert.params[1])) : {};

    assert.equal(savedPreferences.humidorProfile.humidorName, "Aging locker");
    assert.equal(savedPreferences.humidorProfile.defaultLocation, "Locker A / Drawer 2");
    assert.deepEqual(savedPreferences.humidorProfile.locations, [
      { name: "Locker A", kind: "humidor", trays: ["Top Tray", "Bottom Tray", "Middle Tray"] },
      { name: "Travel Case", kind: "other", trays: [] },
      { name: "Garage Cabinet", kind: "other", trays: [] },
    ]);
    assert.ok(queries.some((query) => query.sql.includes("insert into public.member_profiles")), "alert preferences should be upserted in member_profiles");
    assert.ok(queries.some((query) => query.sql.includes("insert into public.audit_log")), "alert preferences update should be audited");
  } finally {
    mock.restore();
  }
});

test("IoT humidor telemetry updates the matching paired device reading", async () => {
  const pairedDevice = {
    id: "device-humidifier-walk-in",
    name: "Smart Cabinet Humidifier",
    location: "Walk-in Humidor",
    deviceType: "HUMIDIFIER",
    connection: "WiFi",
    identifier: "ycc-humidor-test-001",
    humidity: 61,
    temperature: 70,
    syncIntervalMinutes: 20,
    status: "Connected",
    lastSyncedAt: "Earlier",
  };
  const mock = installPersistenceMocks({
    memberProfileRows: [
      {
        id: "profile-111",
        member_id: "11111111-1111-4111-8111-111111111111",
        preferences: {
          pushEnabled: true,
          reorderRemindersEnabled: true,
          climateAlertsEnabled: true,
          pushSubscription: {
            endpoint: "https://example.com/endpoint",
            keys: {
              p256dh: "p256dh-key",
              auth: "auth-key",
            },
          },
          pairedDevices: [pairedDevice],
          humidorProfile: {
            humidorName: "Home cabinet",
            defaultLocation: "Walk-in Humidor",
            locations: [{ name: "Walk-in Humidor", kind: "humidor", trays: ["Top Tray"] }],
          },
        },
      },
    ],
  });

  try {
    const response = await handler({
      source: "ycc.humidor.iot.telemetry",
      topic: "ycc/humidor/ycc-humidor-test-001/telemetry",
      thingName: "ycc-humidor-test-001",
      humidity: 68.4,
      temperature: 70.2,
      batteryPercent: 94,
      receivedAt: 1779894000000,
      requestContext: { requestId: "req-iot-humidor-telemetry" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "ingested");
    assert.equal(body.summary.matchedProfiles, 1);
    assert.equal(body.summary.updatedDevices, 1);
    assert.equal(body.summary.thingName, "ycc-humidor-test-001");

    const queries = mock.clients.flatMap((client) => client.queries);
    const preferenceUpsert = queries.find((query) => query.sql.includes("insert into public.member_profiles"));
    assert.ok(preferenceUpsert, "telemetry should persist updated pairedDevices preferences");
    const savedPreferences = JSON.parse(String(preferenceUpsert.params[1]));
    assert.equal(savedPreferences.pairedDevices[0].humidity, 68.4);
    assert.equal(savedPreferences.pairedDevices[0].temperature, 70.2);
    assert.equal(savedPreferences.pairedDevices[0].lastSyncedAt, "2026-05-27T15:00:00.000Z");
    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.audit_log")),
      "telemetry ingestion should write an audit row"
    );
  } finally {
    mock.restore();
  }
});

test("IoT humidor telemetry uses the topic thing name instead of payload device aliases", async () => {
  const victimDevice = {
    id: "victim-device-id",
    name: "Victim Humidifier",
    location: "Walk-in Humidor",
    deviceType: "HUMIDIFIER",
    connection: "WiFi",
    identifier: "victim-thing",
    deviceId: "victim-device-id",
    thingName: "victim-thing",
    humidity: 61,
    temperature: 70,
    syncIntervalMinutes: 20,
    status: "Connected",
    lastSyncedAt: "Earlier",
  };
  const mock = installPersistenceMocks({
    memberProfileRows: [
      {
        id: "profile-111",
        member_id: "11111111-1111-4111-8111-111111111111",
        preferences: {
          pushEnabled: true,
          reorderRemindersEnabled: true,
          climateAlertsEnabled: true,
          pairedDevices: [victimDevice],
        },
      },
    ],
  });

  try {
    const response = await handler({
      source: "ycc.humidor.iot.telemetry",
      topic: "ycc/humidor/attacker-thing/telemetry",
      thingName: "victim-thing",
      identifier: "victim-thing",
      deviceId: "victim-device-id",
      humidity: 68.4,
      temperature: 70.2,
      receivedAt: 1779894000000,
      requestContext: { requestId: "req-iot-humidor-telemetry-spoofed-alias" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.summary.thingName, "attacker-thing");
    assert.equal(body.summary.matchedProfiles, 0);
    assert.equal(body.summary.updatedDevices, 0);
    const queries = mock.clients.flatMap((client) => client.queries);
    assert.equal(
      queries.some((query) => query.sql.includes("insert into public.member_profiles")),
      false,
      "spoofed payload aliases must not persist victim paired-device updates"
    );
  } finally {
    mock.restore();
  }
});

test("humidor alert dispatch rejects missing or invalid dispatch secret", async () => {
  const mock = installPersistenceMocks();
  try {
    const missingSecret = await handler({
      routeKey: "POST /humidor/alerts/dispatch",
      rawPath: "/humidor/alerts/dispatch",
      requestContext: {
        requestId: "req-humidor-dispatch-missing-secret",
        http: { method: "POST" },
      },
    });

    assert.equal(missingSecret.statusCode, 403);
    const missingBody = JSON.parse(missingSecret.body);
    assert.equal(missingBody.error, "humidor_dispatch_forbidden");

    const wrongSecret = await handler({
      routeKey: "POST /humidor/alerts/dispatch",
      rawPath: "/humidor/alerts/dispatch",
      headers: {
        "x-humidor-alert-dispatch-secret": "wrong-secret",
      },
      requestContext: {
        requestId: "req-humidor-dispatch-wrong-secret",
        http: { method: "POST" },
      },
    });

    assert.equal(wrongSecret.statusCode, 403);
    const wrongBody = JSON.parse(wrongSecret.body);
    assert.equal(wrongBody.error, "humidor_dispatch_forbidden");
  } finally {
    mock.restore();
  }
});

test("humidor alert dispatch reports no due items when none are eligible", async () => {
  const mock = installPersistenceMocks({
    dispatchRows: [],
  });

  try {
    const response = await handler({
      routeKey: "POST /humidor/alerts/dispatch",
      rawPath: "/humidor/alerts/dispatch",
      headers: {
        "x-humidor-alert-dispatch-secret": "humidor-dispatch-secret",
      },
      requestContext: {
        requestId: "req-humidor-dispatch-no-due",
        http: { method: "POST" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "no_due_items");
    assert.equal(body.summary.dueItems, 0);
    assert.equal(body.summary.sentNotifications, 0);
    assert.equal(mock.webPushInvocations.length, 1);

    const dueQuery = mock.clients
      .flatMap((client) => client.queries)
      .find((query) => query.sql.includes("humidor_item_id") && query.sql.includes("humidorReorderReminderDispatchedOn"));
    assert.ok(dueQuery, "dispatch should query due reorder reminders");
    assert.match(dueQuery.sql, /<> \$1::text/, "dispatch marker comparison must cast the date parameter back to text");
  } finally {
    mock.restore();
  }
});

test("humidor alert dispatch sends climate pushes from paired device readings", async () => {
  const mock = installPersistenceMocks({
    dispatchRows: [],
    climateRows: [
      {
        member_id: "11111111-1111-4111-8111-111111111111",
        member_sub: "member-111111111111",
        preferences: {
          pushEnabled: true,
          reorderRemindersEnabled: true,
          climateAlertsEnabled: true,
          pushSubscription: {
            endpoint: "https://example.com/endpoints/member-climate",
            keys: { p256dh: "p256dh-climate", auth: "auth-climate" },
          },
          pairedDevices: [
            {
              id: "device-humidifier-walk-in",
              name: "Smart Cabinet Humidifier",
              location: "Walk-in Humidor",
              deviceType: "HUMIDIFIER",
              connection: "WiFi",
              identifier: "HUM-192-168-1-88",
              humidity: 61,
              temperature: 70,
              syncIntervalMinutes: 20,
              status: "Connected",
              lastSyncedAt: "May 13, 2026 9:45 AM",
            },
          ],
        },
      },
    ],
  });

  try {
    const response = await handler({
      routeKey: "POST /humidor/alerts/dispatch",
      rawPath: "/humidor/alerts/dispatch",
      headers: {
        "x-humidor-alert-dispatch-secret": "humidor-dispatch-secret",
      },
      requestContext: {
        requestId: "req-humidor-dispatch-climate",
        http: { method: "POST" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "dispatched");
    assert.equal(body.summary.dueItems, 0);
    assert.equal(body.summary.climateDevices, 1);
    assert.equal(body.summary.sentClimateNotifications, 1);

    const sendInvocations = mock.webPushInvocations.filter((invocation) => invocation.payload !== "");
    assert.equal(sendInvocations.length, 1);
    const subscription = sendInvocations[0].subscription as { endpoint?: string };
    assert.equal(subscription.endpoint, "https://example.com/endpoints/member-climate");

    const payload = JSON.parse(sendInvocations[0].payload);
    assert.equal(payload.title, "Humidor climate alert");
    assert.match(payload.body, /Smart Cabinet Humidifier/i);
    assert.match(payload.body, /61% RH/i);
    assert.equal(payload.data.tag, "digital-humidor-alert");
    assert.equal(payload.data.url, "/humidor?section=alerts");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.audit_log")),
      "climate alert dispatch should be audited"
    );
  } finally {
    mock.restore();
  }
});

test("humidor alert dispatch sends grouped reminders, updates metadata, and emits one audit row per member", async () => {
  const mock = installPersistenceMocks({
    dispatchRows: [
      {
        member_id: "11111111-1111-4111-8111-111111111111",
        member_sub: "member-111111111111",
        push_subscription: {
          endpoint: "https://example.com/endpoints/member-a",
          keys: { p256dh: "p256dh-a", auth: "auth-a" },
        },
        humidor_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Padron 1964 Anniversary",
        brand: "Padron",
        line: "1964 Anniversary",
        vitola: "Toro",
        reorder_reminder: "2026-05-10",
      },
      {
        member_id: "11111111-1111-4111-8111-111111111111",
        member_sub: "member-111111111111",
        push_subscription: {
          endpoint: "https://example.com/endpoints/member-a",
          keys: { p256dh: "p256dh-a", auth: "auth-a" },
        },
        humidor_item_id: "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb",
        name: "Cohiba Behike",
        brand: "Cohiba",
        line: "Behike",
        vitola: "Corona",
        reorder_reminder: "2026-05-10",
      },
      {
        member_id: "22222222-2222-4222-8222-222222222222",
        member_sub: "member-222222222222",
        push_subscription: {
          endpoint: "https://example.com/endpoints/member-b",
          keys: { p256dh: "p256dh-b", auth: "auth-b" },
        },
        humidor_item_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: "Montecristo No. 2",
        brand: "Montecristo",
        line: "Corona",
        vitola: "Toro",
        reorder_reminder: "2026-05-10",
      },
    ],
  });

  try {
    const response = await handler({
      routeKey: "POST /humidor/alerts/dispatch",
      rawPath: "/humidor/alerts/dispatch",
      headers: {
        "x-humidor-alert-dispatch-secret": "humidor-dispatch-secret",
      },
      requestContext: {
        requestId: "req-humidor-dispatch-success",
        http: { method: "POST" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "dispatched");
    assert.equal(body.summary.dueItems, 3);
    assert.equal(body.summary.attemptedMembers, 2);
    assert.equal(body.summary.sentNotifications, 2);
    assert.equal(body.summary.failedNotifications, 0);
    assert.equal(body.summary.sentItems, 3);
    assert.equal(body.summary.invalidSubscriptionItems, 0);

    const sendInvocations = mock.webPushInvocations.filter((invocation) => invocation.payload !== "");
    assert.equal(sendInvocations.length, 2);
    const firstNotificationSubscription = sendInvocations[0].subscription as { endpoint?: string };
    const secondNotificationSubscription = sendInvocations[1].subscription as { endpoint?: string };
    assert.equal(firstNotificationSubscription.endpoint, "https://example.com/endpoints/member-a");
    assert.equal(secondNotificationSubscription.endpoint, "https://example.com/endpoints/member-b");

    const firstPayload = JSON.parse(sendInvocations[0].payload);
    assert.equal(firstPayload.title, "Humidor reorder reminders");
    assert.match(firstPayload.body, /are due for reorder reminders as of/);
    assert.equal(firstPayload.data.tag, "digital-humidor-alert");
    assert.equal(firstPayload.data.url, "/humidor?section=alerts");

    const updates = mock.clients
      .flatMap((client) => client.queries)
      .filter((query) => query.sql.includes("update public.humidor_items") && query.sql.includes("metadata"));
    assert.equal(updates.length, 3);
  } finally {
    mock.restore();
  }
});

test("humidor alert dispatch disables push when endpoint is gone and records the failure", async () => {
  const mock = installPersistenceMocks({
    dispatchRows: [
      {
        member_id: "33333333-3333-4333-8333-333333333333",
        member_sub: "member-333333333333",
        push_subscription: {
          endpoint: "https://example.com/endpoints/gone",
          keys: { p256dh: "p256dh-gone", auth: "auth-gone" },
        },
        humidor_item_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        name: "Arturo Fuente Anejo",
        brand: "Arturo Fuente",
        line: "Anejo",
        vitola: "Double Corona",
        reorder_reminder: "2026-05-10",
      },
    ],
    webPushOutcomes: {
      "https://example.com/endpoints/gone": "gone",
    },
  });

  try {
    const response = await handler({
      routeKey: "POST /humidor/alerts/dispatch",
      rawPath: "/humidor/alerts/dispatch",
      headers: {
        "x-humidor-alert-dispatch-secret": "humidor-dispatch-secret",
      },
      requestContext: {
        requestId: "req-humidor-dispatch-gone",
        http: { method: "POST" },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "dispatched");
    assert.equal(body.summary.dueItems, 1);
    assert.equal(body.summary.sentNotifications, 0);
    assert.equal(body.summary.failedNotifications, 1);
    assert.equal(body.summary.sentItems, 0);
    assert.equal(body.summary.invalidSubscriptionItems, 0);
    assert.equal(body.failed.length, 1);
    assert.equal(body.failed[0].reason, "push_send_status_410");
    assert.equal(body.failed[0].statusCode, 410);

    const sendInvocations = mock.webPushInvocations.filter((invocation) => invocation.payload !== "");
    assert.equal(sendInvocations.length, 1);
    const goneNotificationSubscription = sendInvocations[0].subscription as { endpoint?: string };
    assert.equal(goneNotificationSubscription.endpoint, "https://example.com/endpoints/gone");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.equal(
      queries.filter((query) => query.sql.includes("update public.humidor_items") && query.sql.includes("metadata")).length,
      0,
      "metadata should not be updated when web-push fails"
    );

    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.member_profiles")),
      "invalid push should disable member alert preferences"
    );
    assert.ok(
      queries.some((query) => query.sql.includes("insert into public.audit_log")),
      "failure should record a dispatch failure audit row"
    );
  } finally {
    mock.restore();
  }
});

test("humidor item route persists the item and audit row", async () => {
  const mock = installPersistenceMocks();
  try {
    const response = await handler(
      createAuthenticatedEvent("POST /humidor/items", {
        brand: "Padron",
        line: "1964 Anniversary",
        vitola: "Toro",
        quantity: 2,
        rating: 94,
        purchaseDate: "2026-03-12",
        agingStartDate: "2026-03-12",
        productionDate: "2022-05-01",
        reorderReminder: "2026-06-15",
      })
    );

    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.item.id, "55555555-5555-4555-8555-555555555555");
    assert.equal(body.item.ownerSub, actorClaims.sub);
    assert.equal(body.persistence.status, "stored");
    assert.equal(body.persistence.table, "humidor_items");

    const queries = mock.clients.flatMap((client) => client.queries);
    const humidorInsert = queries.find((query) => query.sql.includes("insert into public.humidor_items"));
    assert.ok(humidorInsert, "humidor item should be inserted");
    assert.match(humidorInsert.sql, /purchase_date/);
    assert.match(humidorInsert.sql, /aging_start_date/);
    assert.match(humidorInsert.sql, /reorder_reminder/);
    assert.ok(humidorInsert.params.includes("2026-03-12"), "purchase and aging dates should be persisted");
    assert.ok(humidorInsert.params.includes("2026-06-15"), "reorder reminder should be persisted");
    assert.ok(
      humidorInsert.params.some((param) => typeof param === "string" && param.includes('"productionDate":"2022-05-01"')),
      "production date should be persisted as humidor item metadata",
    );
    assert.equal(body.item.purchaseDate, "2026-03-12");
    assert.equal(body.item.agingStartDate, "2026-03-12");
    assert.equal(body.item.productionDate, "2022-05-01");
    assert.equal(body.item.reorderReminder, "2026-06-15");
    const querySql = queries.map((query) => query.sql);
    assert.ok(querySql.some((sql) => sql.includes("insert into public.audit_log")), "audit row should be inserted");
  } finally {
    mock.restore();
  }
});

test("humidor item route stores collection value and uploaded cigar image metadata", async () => {
  const mock = installPersistenceMocks();
  const imageBase64 = Buffer.from("saved-cigar-image").toString("base64");

  try {
    const response = await handler(
      createAuthenticatedEvent("POST /humidor/items", {
        brand: "Padron",
        line: "1964 Anniversary",
        vitola: "Toro",
        quantity: 3,
        estimatedValue: "$18.50",
        estimatedValueCurrency: "usd",
        estimatedValueSource: "ai_identification_msrp",
        cigarImage: {
          imageBase64,
          mimeType: "image/jpeg",
          fileName: "padron-band.jpg",
        },
      })
    );

    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.item.estimatedValue, 18.5);
    assert.equal(body.item.estimatedValueCurrency, "USD");
    assert.equal(body.item.estimatedValueSource, "ai_identification_msrp");
    assert.equal(body.item.cigarImage.mimeType, "image/jpeg");
    assert.equal(body.item.cigarImage.fileName, "padron-band.jpg");
    assert.equal(body.item.cigarImage.dataUrl, "");
    assert.equal(response.body.includes(imageBase64), false);

    const queries = mock.clients.flatMap((client) => client.queries);
    const humidorInsert = queries.find((query) => query.sql.includes("insert into public.humidor_items"));
    assert.ok(humidorInsert, "humidor item should be inserted");
    const metadata = JSON.parse(String(humidorInsert.params[17] || "{}"));
    assert.equal(metadata.estimatedValue, 18.5);
    assert.equal(metadata.estimatedValueCurrency, "USD");
    assert.equal(metadata.estimatedValueSource, "ai_identification_msrp");
    assert.equal(metadata.cigarImage.mimeType, "image/jpeg");
    assert.equal(metadata.cigarImage.fileName, "padron-band.jpg");
    assert.match(metadata.cigarImage.dataUrl, /^data:image\/jpeg;base64,/);
  } finally {
    mock.restore();
  }
});

test("humidor item update route stores a later humidor location and tray", async () => {
  const itemId = "abababab-abab-4bab-8bab-abababababab";
  const mock = installPersistenceMocks({
    humidorItemRows: [
      {
        id: itemId,
        name: "Ecuador Hand Made",
        brand: "El Z",
        line: "Ecuador Hand Made",
        vitola: "Corona",
        wrapper: "",
        origin: "",
        strength: "",
        quantity: 3,
        rating: null,
        purchase_date: null,
        aging_start_date: null,
        reorder_reminder: null,
        humidor_location: "",
        tray: "",
        tasting_notes: "",
        source: "member_humidor",
        metadata: {},
        created_at: "2026-05-13T10:00:00.000Z",
      },
    ],
  });

  try {
    const response = await handler({
      ...createAuthenticatedEvent("PATCH /humidor/items/{id}", {
        humidorLocation: "Member humidor",
        tray: "Drawer 3",
      }),
      rawPath: `/humidor/items/${itemId}`,
      pathParameters: { id: itemId },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.item.id, itemId);
    assert.equal(body.item.name, "Ecuador Hand Made");
    assert.equal(body.item.humidorLocation, "Member humidor");
    assert.equal(body.item.tray, "Drawer 3");
    assert.equal(body.persistence.status, "stored");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("humidor_item_location_update") && query.sql.includes("tray")),
      "location update should update the stored humidor row and tray",
    );
    assert.ok(queries.some((query) => query.sql.includes("insert into public.audit_log")), "location update should be audited");
  } finally {
    mock.restore();
  }
});

test("humidor item update route adjusts a saved cigar aging start date", async () => {
  const itemId = "abababab-abab-4bab-8bab-abababababab";
  const mock = installPersistenceMocks({
    humidorItemRows: [
      {
        id: itemId,
        name: "Ecuador Hand Made",
        brand: "El Z",
        line: "Ecuador Hand Made",
        vitola: "Corona",
        wrapper: "",
        origin: "",
        strength: "",
        quantity: 3,
        rating: null,
        purchase_date: null,
        aging_start_date: "2026-04-12",
        reorder_reminder: null,
        humidor_location: "Locker A",
        tray: "",
        tasting_notes: "",
        source: "member_humidor",
        metadata: {},
        created_at: "2026-05-13T10:00:00.000Z",
      },
    ],
  });

  try {
    const response = await handler({
      ...createAuthenticatedEvent("PATCH /humidor/items/{id}", {
        agingStartDate: "2026-02-06",
      }),
      rawPath: `/humidor/items/${itemId}`,
      pathParameters: { id: itemId },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.item.id, itemId);
    assert.equal(body.item.agingStartDate, "2026-02-06");
    assert.equal(body.item.humidorLocation, "Locker A");
    assert.equal(body.persistence.status, "stored");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("humidor_item_location_update") && query.sql.includes("aging_start_date")),
      "aging start update should update the stored humidor row",
    );
    assert.ok(queries.some((query) => query.sql.includes("insert into public.audit_log")), "aging start update should be audited");
  } finally {
    mock.restore();
  }
});

test("humidor item enrichment route fills missing info image and MSRP without overwriting member data", async () => {
  const itemId = "abababab-abab-4bab-8bab-abababababab";
  const mock = installPersistenceMocks({
    humidorItemRows: [
      {
        id: itemId,
        name: "Padron Anniversary Toro",
        brand: "Padron",
        line: "",
        vitola: "",
        wrapper: "",
        origin: "",
        strength: "",
        quantity: 2,
        rating: null,
        purchase_date: "2026-03-12",
        aging_start_date: "2026-03-12",
        reorder_reminder: null,
        humidor_location: "Locker A",
        tray: "Drawer 2",
        tasting_notes: "Member note stays.",
        source: "member_humidor",
        metadata: {},
        created_at: "2026-05-08T10:00:00.000Z",
      },
    ],
    bedrockReply: JSON.stringify({
      brand: "Padron",
      line: "1964 Anniversary",
      vitola: "Toro",
      wrapper: "Nicaraguan",
      origin: "Nicaragua",
      strength: "Full",
      estimatedValue: "$18.50",
      estimatedValueCurrency: "USD",
      estimatedValueSource: "ai_humidor_enrichment_msrp",
      cigarImage: {
        imageUrl: "https://example.com/padron-1964-toro.jpg",
        mimeType: "image/jpeg",
        fileName: "padron-1964-toro.jpg",
        source: "agent_reference",
      },
      confidence: "medium",
      evidence: ["Matched Padron Anniversary Toro against reference details."],
      needsReview: ["Confirm exact 1964 vitola before relying on MSRP."],
    }),
  });

  try {
    const response = await handler({
      ...createAuthenticatedEvent("PATCH /humidor/items/{id}/enrich", {
        fields: ["info", "image", "msrp"],
        approved: true,
      }),
      rawPath: `/humidor/items/${itemId}/enrich`,
      pathParameters: { id: itemId },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.item.id, itemId);
    assert.equal(body.item.brand, "Padron");
    assert.equal(body.item.line, "1964 Anniversary");
    assert.equal(body.item.vitola, "Toro");
    assert.equal(body.item.wrapper, "Nicaraguan");
    assert.equal(body.item.origin, "Nicaragua");
    assert.equal(body.item.strength, "Full");
    assert.equal(body.item.humidorLocation, "Locker A");
    assert.equal(body.item.tastingNotes, "Member note stays.");
    assert.equal(body.item.estimatedValue, 18.5);
    assert.equal(body.item.estimatedValueCurrency, "USD");
    assert.equal(body.item.estimatedValueSource, "ai_humidor_enrichment_msrp");
    assert.equal(body.item.cigarImage.imageUrl, "https://example.com/padron-1964-toro.jpg");
    assert.equal(body.enrichment.status, "updated");
    assert.deepEqual(body.enrichment.requestedFields, ["info", "image", "msrp"]);
    assert.ok(body.enrichment.updatedFields.includes("line"));
    assert.ok(body.enrichment.updatedFields.includes("cigarImage"));
    assert.ok(body.enrichment.updatedFields.includes("estimatedValue"));
    assert.equal(mock.bedrockInvocations.length, 1);

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("humidor_item_enrichment_update") && query.sql.includes("update public.humidor_items")),
      "enrichment should update the stored humidor row"
    );
    assert.ok(queries.some((query) => query.sql.includes("insert into public.audit_log")), "enrichment should be audited");
  } finally {
    mock.restore();
  }
});

test("humidor item enrichment route previews updates until member approval", async () => {
  const itemId = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
  const mock = installPersistenceMocks({
    humidorItemRows: [
      {
        id: itemId,
        name: "Padron Anniversary Toro",
        brand: "Padron",
        line: "",
        vitola: "",
        wrapper: "",
        origin: "",
        strength: "",
        quantity: 2,
        rating: null,
        purchase_date: "2026-03-12",
        aging_start_date: "2026-03-12",
        reorder_reminder: null,
        humidor_location: "Locker A",
        tray: "Drawer 2",
        tasting_notes: "Member note stays.",
        source: "member_humidor",
        metadata: {},
        created_at: "2026-05-08T10:00:00.000Z",
      },
    ],
    bedrockReply: JSON.stringify({
      brand: "Padron",
      line: "1964 Anniversary",
      vitola: "Toro",
      wrapper: "Nicaraguan",
      origin: "Nicaragua",
      strength: "Full",
      estimatedValue: "$18.50",
      estimatedValueCurrency: "USD",
      estimatedValueSource: "ai_humidor_enrichment_msrp",
      cigarImage: {
        imageUrl: "https://example.com/padron-1964-toro.jpg",
        mimeType: "image/jpeg",
        fileName: "padron-1964-toro.jpg",
        source: "agent_reference",
      },
      confidence: "medium",
      evidence: ["Matched Padron Anniversary Toro against reference details."],
      needsReview: ["Confirm exact 1964 vitola before relying on MSRP."],
    }),
  });

  try {
    const response = await handler({
      ...createAuthenticatedEvent("PATCH /humidor/items/{id}/enrich", {
        fields: ["info", "image", "msrp"],
        approved: false,
      }),
      rawPath: `/humidor/items/${itemId}/enrich`,
      pathParameters: { id: itemId },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.item.id, itemId);
    assert.equal(body.item.line, "", "preview should keep the stored item unchanged");
    assert.equal(body.previewItem.line, "1964 Anniversary");
    assert.equal(body.previewItem.estimatedValue, 18.5);
    assert.equal(body.previewItem.cigarImage.imageUrl, "https://example.com/padron-1964-toro.jpg");
    assert.equal(body.enrichment.status, "pending_approval");
    assert.deepEqual(body.enrichment.requestedFields, ["info", "image", "msrp"]);
    assert.ok(body.enrichment.updatedFields.includes("line"));
    assert.equal(body.persistence.status, "pending_member_approval");
    assert.equal(mock.bedrockInvocations.length, 1);

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.equal(
      queries.some((query) => query.sql.includes("humidor_item_enrichment_update") && query.sql.includes("update public.humidor_items")),
      false,
      "preview should not update the stored humidor row"
    );
    assert.equal(queries.some((query) => query.sql.includes("insert into public.audit_log")), false, "preview should not write an enrichment audit log");
  } finally {
    mock.restore();
  }
});

test("humidor item enrichment route retrieves knowledge base context before invoking the Humidor Agent alias", async () => {
  const itemId = "abababab-abab-4bab-8bab-abababababab";
  const mock = installPersistenceMocks({
    retrieveText:
      "Ecuador Hand Made reference: El Z Corona has an Ecuadorian Habano wrapper, Nicaragua origin, medium strength, MSRP $9.25, and image https://example.com/el-z-ecuador-hand-made-corona.jpg.",
    agentReply: JSON.stringify({
      brand: "El Z",
      line: "Ecuador Hand Made",
      vitola: "Corona",
      wrapper: "Ecuadorian Habano",
      origin: "Nicaragua",
      strength: "Medium",
      tastingNotes: "Cedar, cocoa, and gentle pepper.",
      estimatedValue: "$9.25",
      estimatedValueCurrency: "USD",
      estimatedValueSource: "ai_humidor_enrichment_msrp",
      cigarImage: {
        imageUrl: "https://example.com/el-z-ecuador-hand-made-corona.jpg",
        mimeType: "image/jpeg",
        fileName: "el-z-ecuador-hand-made-corona.jpg",
        source: "agent_reference",
      },
      confidence: "medium",
      evidence: ["Matched Ecuador Hand Made against retrieved YCC reference context."],
      needsReview: ["Confirm the exact El Z production line before relying on MSRP."],
    }),
    humidorItemRows: [
      {
        id: itemId,
        name: "Ecuador Hand Made",
        brand: "El Z",
        line: "Ecuador Hand Made",
        vitola: "Corona",
        wrapper: "",
        origin: "",
        strength: "",
        quantity: 3,
        rating: null,
        purchase_date: null,
        aging_start_date: null,
        reorder_reminder: null,
        humidor_location: "",
        tray: "",
        tasting_notes: "",
        source: "member_humidor",
        metadata: {},
        created_at: "2026-05-13T10:00:00.000Z",
      },
    ],
  });

  process.env.BEDROCK_AGENT_YCCHUMIDORAGENT_ID = "AGENTHUMIDOR1";
  process.env.BEDROCK_AGENT_YCCHUMIDORAGENT_ALIAS_ID = "ALIASHUMIDOR";

  try {
    const response = await handler({
      ...createAuthenticatedEvent("PATCH /humidor/items/{id}/enrich", {
        fields: ["info", "image", "msrp"],
        approved: false,
      }),
      rawPath: `/humidor/items/${itemId}/enrich`,
      pathParameters: { id: itemId },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.enrichment.status, "pending_approval");
    assert.equal(body.previewItem.wrapper, "Ecuadorian Habano");
    assert.equal(body.previewItem.estimatedValue, 9.25);
    assert.equal(body.previewItem.cigarImage.imageUrl, "https://example.com/el-z-ecuador-hand-made-corona.jpg");
    assert.equal(body.ai.status, "bedrock_agent_runtime");
    assert.equal(body.ai.knowledgeBaseStatus, "retrieved");
    assert.equal(body.ai.retrievedContextCount, 1);
    assert.equal(mock.knowledgeBaseRetrievals.length, 1);
    assert.match(JSON.stringify(mock.knowledgeBaseRetrievals[0].retrievalQuery), /Ecuador Hand Made/);
    assert.equal(mock.agentInvocations.length, 1);
    assert.equal(mock.bedrockInvocations.length, 0);
    assert.match(String(mock.agentInvocations[0].inputText), /Retrieved YCC knowledge base context/);
    assert.match(String(mock.agentInvocations[0].inputText), /Ecuador Hand Made reference/);
  } finally {
    mock.restore();
  }
});

test("humidor item enrichment route previews member review when no saveable updates are found", async () => {
  const itemId = "efefefef-efef-4fef-8fef-efefefefefef";
  const mock = installPersistenceMocks({
    humidorItemRows: [
      {
        id: itemId,
        name: "Magic Toast",
        brand: "Bradi",
        line: "Magic Toast",
        vitola: "Corona Gorda",
        wrapper: "",
        origin: "",
        strength: "",
        quantity: 5,
        rating: null,
        purchase_date: null,
        aging_start_date: null,
        reorder_reminder: null,
        humidor_location: "",
        tray: "",
        tasting_notes: "",
        source: "member_humidor",
        metadata: {},
        created_at: "2026-05-13T10:00:00.000Z",
      },
    ],
    bedrockReply: JSON.stringify({
      confidence: "low",
      evidence: ["YCCHumidorAgent reviewed Magic Toast but could not verify a stable reference match."],
      needsReview: ["Confirm the exact brand and blend before saving Info, Image, or MSRP."],
    }),
  });

  try {
    const response = await handler({
      ...createAuthenticatedEvent("PATCH /humidor/items/{id}/enrich", {
        fields: ["info", "image", "msrp"],
        approved: false,
      }),
      rawPath: `/humidor/items/${itemId}/enrich`,
      pathParameters: { id: itemId },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.item.id, itemId);
    assert.equal(body.previewItem.id, itemId, "needs-review previews should still give the member a review target");
    assert.equal(body.previewItem.line, "Magic Toast");
    assert.equal(body.enrichment.status, "needs_review");
    assert.deepEqual(body.enrichment.updatedFields, []);
    assert.equal(body.ai.browserSearch.status, "requested");
    assert.match(body.ai.browserSearch.query, /Magic Toast/i);
    assert.match(body.ai.browserSearch.query, /Corona Gorda/i);
    assert.ok(body.ai.browserSearch.missingFields.includes("info"));
    assert.ok(body.ai.browserSearch.missingFields.includes("image"));
    assert.ok(body.ai.browserSearch.missingFields.includes("msrp"));
    assert.equal(body.persistence.status, "pending_member_review");
    assert.equal(mock.bedrockInvocations.length, 1);
    const content = (mock.bedrockInvocations[0].messages as Array<Record<string, unknown>>)[0]
      .content as Array<Record<string, unknown>>;
    const promptText = String(content.find((block) => "text" in block)?.text || "");
    assert.match(promptText, /Browser search required/i);
    assert.match(promptText, /Search query:/i);
    assert.match(promptText, /Magic Toast Bradi Corona Gorda cigar wrapper origin strength MSRP product image/i);
    assert.match(promptText, /source URL/i);

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.equal(
      queries.some((query) => query.sql.includes("humidor_item_enrichment_update") && query.sql.includes("update public.humidor_items")),
      false,
      "needs-review preview should not update the stored humidor row"
    );
    assert.equal(queries.some((query) => query.sql.includes("insert into public.audit_log")), false, "needs-review preview should not write an enrichment audit log");
  } finally {
    mock.restore();
  }
});

test("phase 3 migration invoke requires explicit confirmation", async () => {
  const response = await handler({
    source: "ycc.phase3.migration",
    action: "apply_phase3_schema",
    requestContext: { requestId: "req-migration-guard" },
  });

  assert.equal(response.statusCode, 403);
  const body = JSON.parse(response.body);
  assert.equal(body.error, "migration_confirmation_required");
});

test("site content migration invoke requires explicit confirmation", async () => {
  const response = await handler({
    source: "ycc.site_content.migration",
    action: "apply_site_content_schema",
    requestContext: { requestId: "req-site-content-migration-guard" },
  });

  assert.equal(response.statusCode, 403);
  const body = JSON.parse(response.body);
  assert.equal(body.error, "migration_confirmation_required");
});

test("commerce migration invoke requires explicit confirmation", async () => {
  const response = await handler({
    source: "ycc.commerce.migration",
    action: "apply_commerce_schema",
    requestContext: { requestId: "req-commerce-migration-guard" },
  });

  assert.equal(response.statusCode, 403);
  const body = JSON.parse(response.body);
  assert.equal(body.error, "migration_confirmation_required");
});

test("commerce migration applies and verifies order tables", async () => {
  const mock = installPersistenceMocks();

  try {
    const response = await handler({
      source: "ycc.commerce.migration",
      action: "apply_commerce_schema",
      confirm: "APPLY_YCC_COMMERCE_SCHEMA",
      requestContext: { requestId: "req-commerce-migration-apply" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "applied");
    assert.equal(body.migration, "0002_commerce_schema");
    assert.deepEqual(body.missingTables, []);
    assert.ok(body.tables.includes("commerce_orders"));
    assert.equal(body.migrationRow.version, "0002");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("create table if not exists public.commerce_orders")),
      "commerce migration SQL should be executed"
    );
    assert.ok(
      queries.some((query) => query.sql.includes("where version = '0002'")),
      "commerce verification should check migration version 0002"
    );
  } finally {
    mock.restore();
  }
});

test("site content migration applies and verifies the live page table", async () => {
  const mock = installPersistenceMocks();

  try {
    const response = await handler({
      source: "ycc.site_content.migration",
      action: "apply_site_content_schema",
      confirm: "APPLY_YCC_SITE_CONTENT_SCHEMA",
      requestContext: { requestId: "req-site-content-migration-apply" },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, "applied");
    assert.equal(body.migration, "0003_site_content_schema");
    assert.deepEqual(body.missingTables, []);
    assert.ok(body.tables.includes("site_page_content"));
    assert.equal(body.migrationRow.version, "0003");

    const queries = mock.clients.flatMap((client) => client.queries);
    assert.ok(
      queries.some((query) => query.sql.includes("create table if not exists public.site_page_content")),
      "site content migration SQL should be executed"
    );
    assert.ok(
      queries.some((query) => query.sql.includes("where version = '0003'")),
      "site content verification should check migration version 0003"
    );
  } finally {
    mock.restore();
  }
});
