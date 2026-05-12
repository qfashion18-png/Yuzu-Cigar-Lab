import { createRequire } from "node:module";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

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

function createSignedAgeVerificationToken(secret = "age-secret", vendorTransactionId = "age_txn_12345678") {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    txn: vendorTransactionId,
    iat: nowSeconds,
    exp: nowSeconds + 15 * 60,
    verifiedAt: new Date(nowSeconds * 1000).toISOString(),
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

function installPersistenceMocks(
  options: {
    agentReply?: string;
    agentRuntimeError?: boolean;
    bedrockReply?: string;
    pollyAudio?: string;
    retrieveText?: string;
    transcribeTranscript?: string;
  } = {}
) {
  const clients: Array<{
    queries: Array<{ sql: string; params: unknown[] }>;
    config: Record<string, unknown>;
    connected: boolean;
    ended: boolean;
  }> = [];

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
        const version = normalized.includes("'0003'") ? "0003" : "0001";
        return {
          rows: [
            {
              version,
              name: version === "0003" ? "site_content_schema" : "phase3_app_schema",
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

      if (normalized.includes("select stripe_customer_id") && normalized.includes("from public.member_subscriptions")) {
        return {
          rows: [{ stripe_customer_id: "cus_member_123" }],
          rowCount: 1,
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

      if (normalized.includes("insert into public.commerce_audit_log")) {
        return {
          rows: [{ id: "99999999-9999-4999-8999-999999999999" }],
          rowCount: 1,
        };
      }

      if (normalized.includes("insert into public.members")) {
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
  const pollyInvocations: Array<Record<string, unknown>> = [];
  const s3Invocations: Array<Record<string, unknown>> = [];
  const sesInvocations: Array<Record<string, unknown>> = [];
  const transcribeInvocations: Array<Record<string, unknown>> = [];

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

  class SecretsManagerClient {
    async send() {
      return {
        SecretString: JSON.stringify({ username: "postgres", password: "secret" }),
      };
    }
  }

  Module._load = function load(request: string, parent: unknown, isMain: boolean) {
    if (request === "pg") {
      return { Client: RecordingPgClient };
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

    if (request === "@aws-sdk/client-bedrock-agent-runtime") {
      return { BedrockAgentRuntimeClient, InvokeAgentCommand, RetrieveCommand };
    }

    return originalModuleLoad.call(this, request, parent, isMain);
  };

  const previousEnv = {
    DB_PROXY_ENDPOINT: process.env.DB_PROXY_ENDPOINT,
    DB_SECRET_ARN: process.env.DB_SECRET_ARN,
    DB_NAME: process.env.DB_NAME,
    FEATURE_DB_WRITES: process.env.FEATURE_DB_WRITES,
    FEATURE_BEDROCK: process.env.FEATURE_BEDROCK,
    FEATURE_CONCIERGE_VOICE: process.env.FEATURE_CONCIERGE_VOICE,
    FEATURE_SES: process.env.FEATURE_SES,
    SUPPORT_EMAIL_FROM: process.env.SUPPORT_EMAIL_FROM,
    SUPPORT_EMAIL_RAW_BUCKET: process.env.SUPPORT_EMAIL_RAW_BUCKET,
    SUPPORT_EMAIL_RAW_PREFIX: process.env.SUPPORT_EMAIL_RAW_PREFIX,
    CONCIERGE_POLLY_ENGINE: process.env.CONCIERGE_POLLY_ENGINE,
    CONCIERGE_POLLY_VOICE_ID: process.env.CONCIERGE_POLLY_VOICE_ID,
    CONCIERGE_VOICE_BUCKET: process.env.CONCIERGE_VOICE_BUCKET,
    CONCIERGE_VOICE_PREFIX: process.env.CONCIERGE_VOICE_PREFIX,
    CONCIERGE_VOICE_TRANSCRIBE_MAX_WAIT_MS: process.env.CONCIERGE_VOICE_TRANSCRIBE_MAX_WAIT_MS,
    BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,
    BEDROCK_GUARDRAIL_ID: process.env.BEDROCK_GUARDRAIL_ID,
    BEDROCK_GUARDRAIL_VERSION: process.env.BEDROCK_GUARDRAIL_VERSION,
    BEDROCK_KNOWLEDGE_BASE_ID: process.env.BEDROCK_KNOWLEDGE_BASE_ID,
    BEDROCK_AGENT_YCCCIGARGUIDE_ID: process.env.BEDROCK_AGENT_YCCCIGARGUIDE_ID,
    BEDROCK_AGENT_YCCCIGARGUIDE_ALIAS_ID: process.env.BEDROCK_AGENT_YCCCIGARGUIDE_ALIAS_ID,
    BEDROCK_AGENT_YCCSUPPORTAGENT_ID: process.env.BEDROCK_AGENT_YCCSUPPORTAGENT_ID,
    BEDROCK_AGENT_YCCSUPPORTAGENT_ALIAS_ID: process.env.BEDROCK_AGENT_YCCSUPPORTAGENT_ALIAS_ID,
    BEDROCK_AGENT_YCCNEWSAGENT_ID: process.env.BEDROCK_AGENT_YCCNEWSAGENT_ID,
    BEDROCK_AGENT_YCCNEWSAGENT_ALIAS_ID: process.env.BEDROCK_AGENT_YCCNEWSAGENT_ALIAS_ID,
    RDS_SSLMODE: process.env.RDS_SSLMODE,
    RDS_SSLROOTCERT: process.env.RDS_SSLROOTCERT,
  };

  process.env.DB_PROXY_ENDPOINT = "proxy.test.local";
  process.env.DB_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:ycc/test";
  process.env.DB_NAME = "postgresycc";
  process.env.FEATURE_DB_WRITES = "schema_ready";
  process.env.FEATURE_BEDROCK = "runtime_ready";
  process.env.FEATURE_CONCIERGE_VOICE = "ready";
  process.env.FEATURE_SES = "ready";
  process.env.SUPPORT_EMAIL_FROM = "support@yuzucigarclub.com";
  process.env.SUPPORT_EMAIL_RAW_BUCKET = "classroom2";
  process.env.SUPPORT_EMAIL_RAW_PREFIX = "ycc/support-email/raw/";
  process.env.CONCIERGE_POLLY_ENGINE = "neural";
  process.env.CONCIERGE_POLLY_VOICE_ID = "Joanna";
  process.env.CONCIERGE_VOICE_BUCKET = "classroom2";
  process.env.CONCIERGE_VOICE_PREFIX = "ycc/concierge-voice/";
  process.env.CONCIERGE_VOICE_TRANSCRIBE_MAX_WAIT_MS = "2000";
  process.env.BEDROCK_MODEL_ID = "amazon.nova-lite-v1:0";
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
    pollyInvocations,
    s3Invocations,
    sesInvocations,
    transcribeInvocations,
    restore() {
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
    webhookEvent?: Record<string, unknown>;
  } = {}
) {
  const checkoutSessionsCreated: Record<string, unknown>[] = [];
  const checkoutSessionsRetrieved: string[] = [];
  const billingPortalSessionsCreated: Record<string, unknown>[] = [];
  const previousModuleLoad = Module._load;
  const previousEnv = {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_LAUNCH_CATALOG_READY: process.env.STRIPE_LAUNCH_CATALOG_READY,
    STRIPE_LAUNCH_CATALOG_JSON: process.env.STRIPE_LAUNCH_CATALOG_JSON,
    FEATURE_STRIPE_TAX: process.env.FEATURE_STRIPE_TAX,
    STRIPE_PRICE_SENSEI_MONTHLY: process.env.STRIPE_PRICE_SENSEI_MONTHLY,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
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
                shipping_method_id: "adult-signature-ground",
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
      shippingMethodId: "adult-signature-ground",
    }),
    requestContext: { requestId: "req-commerce-checkout", http: { method: "POST" } },
  });

  assert.notEqual(response.statusCode, 401);
  assert.notEqual(response.statusCode, 404);
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
        items: [{ sku: "APPROVED-BOX", quantity: 1 }],
        customer: { email: "member@example.com" },
        shippingAddress: {
          address1: "123 Yuzu Way",
          city: "Chandler",
          country: "US",
          state: "AZ",
          postalCode: "85225",
        },
        shippingMethodId: "adult-signature-ground",
        compliance: { ageVerificationToken: createSignedAgeVerificationToken("age-secret") },
      }),
      requestContext: { requestId: "req-commerce-checkout-ready", http: { method: "POST" } },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).url, "https://checkout.stripe.com/c/pay/cs_test_123");
    assert.deepEqual(mock.checkoutSessionsCreated[0].line_items, [{ price: "price_approved", quantity: 1 }]);
    assert.deepEqual(mock.checkoutSessionsCreated[0].shipping_address_collection, { allowed_countries: ["US"] });
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_state, "AZ");
    assert.equal((mock.checkoutSessionsCreated[0].metadata as Record<string, string>).shipping_postal_code, "85225");
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
        items: [{ sku: "APPROVED-BOX", quantity: 1 }],
        customer: { email: "member@example.com" },
        shippingAddress: {
          address1: "123 Yuzu Way",
          city: "Chandler",
          country: "US",
          state: "AZ",
          postalCode: "85225",
        },
        shippingMethodId: "adult-signature-ground",
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

test("checkout session status reads Stripe before reporting paid orders as recorded", async () => {
  const mock = installStripeMock({
    retrieveSession: {
      id: "cs_paid_123",
      payment_status: "paid",
      status: "complete",
      metadata: { order_id: "order_123" },
    },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    const response = await handler({
      routeKey: "GET /commerce/checkout-session/{id}",
      rawPath: "/commerce/checkout-session/cs_paid_123",
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
      metadata: {},
    },
  });
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.FEATURE_DB_WRITES = "schema_ready";

    const response = await handler({
      routeKey: "GET /commerce/checkout-session/{id}",
      rawPath: "/commerce/checkout-session/cs_paid_without_metadata_order",
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
            shipping_method_id: "adult-signature-ground",
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
    assert.ok(queries.some((sql) => sql.includes("insert into public.commerce_audit_log")), "commerce audit log should be written");
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

test("database clients verify the RDS Proxy TLS certificate with the configured CA bundle", async () => {
  const mock = installPersistenceMocks();
  try {
    process.env.RDS_SSLMODE = "verify-full";
    process.env.RDS_SSLROOTCERT = `${process.cwd()}\\global-bundle.pem`;

    const response = await handler(createAuthenticatedEvent("GET /account/me"));

    assert.equal(response.statusCode, 200);
    assert.equal(mock.clients.length, 1);
    const ssl = mock.clients[0].config.ssl as { ca?: string; rejectUnauthorized?: boolean };
    assert.equal(ssl.rejectUnauthorized, true);
    assert.ok(Array.isArray(ssl.ca));
    assert.ok(ssl.ca.length > 1);
    assert.match(ssl.ca.join("\n"), /BEGIN CERTIFICATE/);
  } finally {
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
    assert.equal("guardrailConfig" in mock.bedrockInvocations[0], false);
  } finally {
    mock.restore();
  }
});

test("concierge chat does not run cigar guide questions through Bedrock guardrails", async () => {
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
    assert.equal("guardrailConfig" in mock.bedrockInvocations[0], false);
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

test("SES receipt event reads raw email from S3 and persists an inbound support case", async () => {
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
    assert.equal(mock.s3Invocations.length, 1);
    assert.equal(mock.s3Invocations[0].Bucket, "classroom2");
    assert.equal(mock.s3Invocations[0].Key, "ycc/support-email/raw/ses-message-123");

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
    assert.equal(body.item.purchaseDate, "2026-03-12");
    assert.equal(body.item.agingStartDate, "2026-03-12");
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
    assert.match(body.item.cigarImage.dataUrl, /^data:image\/jpeg;base64,/);

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
