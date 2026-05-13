import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAdminComplianceHolds,
  fetchAdminWebhookEvents,
  syncAdminStripeProducts,
  type AdminComplianceHoldsResponse,
  type AdminStripeSyncProductsResponse,
  type AdminWebhookEventsResponse,
} from "../src/lib/live-api";

test("live API client calls authenticated admin backend endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const previousApiBase = process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  process.env.NEXT_PUBLIC_YCC_API_BASE_URL = "https://api.yuzucigarclub.test/";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });

    const payload =
      calls.length === 1
        ? ({
            holds: [],
            orders: [],
            subscriptions: [],
            audit: [],
            overview: {
              counts: {
                orders: {
                  total: 0,
                  paid: 0,
                  pending: 0,
                  refunded: 0,
                },
                subscriptions: {
                  total: 0,
                  active: 0,
                  canceled: 0,
                  pastDue: 0,
                },
                holds: {
                  total: 0,
                  open: 0,
                  resolved: 0,
                },
                webhooks: {
                  total: 0,
                  processed: 0,
                  pending: 0,
                  failed: 0,
                },
                audit: {
                  last24h: 0,
                  total: 0,
                },
              },
              latest: {
                orderAt: null,
                subscriptionAt: null,
                holdAt: null,
                webhookAt: null,
                auditAt: null,
              },
            },
            summary: {
              total: 0,
              open: 0,
              resolved: 0,
            },
            persistence: "stored",
          } satisfies AdminComplianceHoldsResponse)
        : calls.length === 2
          ? ({
              events: [],
              summary: {
                total: 0,
                processed: 0,
                pending: 0,
                failed: 0,
              },
              persistence: "stored",
            } satisfies AdminWebhookEventsResponse)
          : ({
              sync: {
                status: "queued",
                seedScope: "featured_products_and_memberships",
                liveApprovalRequired: true,
                catalogReady: true,
                stripeConfigured: true,
                webhookConfigured: true,
                catalogSource: "fixture",
                configuredProductCount: 0,
                publishedProductCount: 0,
                membershipPriceKeys: [],
                taxStatus: "unknown",
                apiVersion: null,
                sampleSkus: [],
                catalogPreview: [],
                notes: [],
              },
            } satisfies AdminStripeSyncProductsResponse);

    return new Response(JSON.stringify(payload), {
      status: calls.length === 3 ? 202 : 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const headers = { Authorization: "Bearer admin-token" };
    const holds = await fetchAdminComplianceHolds(headers);
    const events = await fetchAdminWebhookEvents(headers);
    const sync = await syncAdminStripeProducts(headers);

    assert.equal(holds.persistence, "stored");
    assert.equal(events.persistence, "stored");
    assert.equal(sync.sync.status, "queued");
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/admin/commerce/compliance-holds");
    assert.equal(calls[0].init?.method, "GET");
    assert.equal(calls[1].url, "https://api.yuzucigarclub.test/admin/commerce/webhook-events");
    assert.equal(calls[1].init?.method, "GET");
    assert.equal(calls[2].url, "https://api.yuzucigarclub.test/admin/commerce/stripe-sync-products");
    assert.equal(calls[2].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {});
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});
