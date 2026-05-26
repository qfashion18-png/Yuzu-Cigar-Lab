import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAdminMembers,
  fetchAdminOrders,
  fetchAdminComplianceHolds,
  fetchAdminWebhookEvents,
  syncAdminStripeProducts,
  updateAdminMemberAccess,
  updateAdminOrder,
  type AdminMembersResponse,
  type AdminOrdersResponse,
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
            orders: [
              {
                id: "88888888-8888-4888-8888-888888888888",
                orderNumber: "cs_test_admin",
                email: "member@example.com",
                status: "paid",
                fulfillmentStatus: "not_started",
                complianceStatus: "verified",
                total: 127.92,
                currency: "usd",
                itemCount: 2,
              },
            ],
            summary: {
              total: 1,
              paid: 1,
              pending: 0,
              fulfilled: 0,
              needsAttention: 1,
            },
            persistence: "stored",
          } satisfies AdminOrdersResponse)
        : calls.length === 2
          ? ({
              members: [
                {
                  id: "11111111-1111-4111-8111-111111111111",
                  cognitoSub: "member-123",
                  email: "member@example.com",
                  displayName: "Yuzu Member",
                  role: "customer",
                  membershipTier: "sensei",
                  memberStatus: "active",
                  emailVerified: true,
                  orderCount: 1,
                  totalSpend: 127.92,
                  humidorItemCount: 3,
                },
              ],
              summary: {
                total: 1,
                admins: 0,
                operators: 0,
                members: 1,
                nonMembers: 0,
                banned: 0,
              },
              persistence: "stored",
            } satisfies AdminMembersResponse)
          : calls.length === 3
            ? ({
                order: {
                  id: "88888888-8888-4888-8888-888888888888",
                  orderNumber: "cs_test_admin",
                  email: "member@example.com",
                  status: "paid",
                  fulfillmentStatus: "packed",
                  complianceStatus: "verified",
                  total: 127.92,
                  currency: "usd",
                  itemCount: 2,
                },
                persistence: {
                  status: "stored",
                  table: "commerce_orders",
                },
              })
            : calls.length === 4
              ? ({
                  member: {
                    id: "11111111-1111-4111-8111-111111111111",
                    cognitoSub: "member-123",
                    email: "member@example.com",
                    displayName: "Yuzu Member",
                    role: "operator",
                    membershipTier: "daimyo",
                    memberStatus: "active",
                    emailVerified: true,
                    orderCount: 1,
                    totalSpend: 127.92,
                    humidorItemCount: 3,
                  },
                  persistence: {
                    status: "stored",
                    table: "members",
                  },
                })
              : calls.length === 5
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
        : calls.length === 6
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
    const orders = await fetchAdminOrders(headers);
    const members = await fetchAdminMembers(headers);
    const orderUpdate = await updateAdminOrder(
      "88888888-8888-4888-8888-888888888888",
      { fulfillmentStatus: "packed" },
      headers
    );
    const memberUpdate = await updateAdminMemberAccess(
      "11111111-1111-4111-8111-111111111111",
      { role: "operator", membershipTier: "daimyo", memberStatus: "active" },
      headers
    );
    const holds = await fetchAdminComplianceHolds(headers);
    const events = await fetchAdminWebhookEvents(headers);
    const sync = await syncAdminStripeProducts(headers);

    assert.equal(orders.summary.total, 1);
    assert.equal(members.summary.members, 1);
    assert.equal(orderUpdate.order.fulfillmentStatus, "packed");
    assert.equal(memberUpdate.member.role, "operator");
    assert.equal(holds.persistence, "stored");
    assert.equal(events.persistence, "stored");
    assert.equal(sync.sync.status, "queued");
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/admin/commerce/orders");
    assert.equal(calls[0].init?.method, "GET");
    assert.equal(calls[1].url, "https://api.yuzucigarclub.test/admin/members");
    assert.equal(calls[1].init?.method, "GET");
    assert.equal(calls[2].url, "https://api.yuzucigarclub.test/admin/commerce/orders/88888888-8888-4888-8888-888888888888");
    assert.equal(calls[2].init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { fulfillmentStatus: "packed" });
    assert.equal(calls[3].url, "https://api.yuzucigarclub.test/admin/members/11111111-1111-4111-8111-111111111111/access");
    assert.equal(calls[3].init?.method, "PATCH");
    assert.deepEqual(JSON.parse(String(calls[3].init?.body)), { role: "operator", membershipTier: "daimyo", memberStatus: "active" });
    assert.equal(calls[4].url, "https://api.yuzucigarclub.test/admin/commerce/compliance-holds");
    assert.equal(calls[4].init?.method, "GET");
    assert.equal(calls[5].url, "https://api.yuzucigarclub.test/admin/commerce/webhook-events");
    assert.equal(calls[5].init?.method, "GET");
    assert.equal(calls[6].url, "https://api.yuzucigarclub.test/admin/commerce/stripe-sync-products");
    assert.equal(calls[6].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[6].init?.body)), {});
  } finally {
    globalThis.fetch = originalFetch;
    if (previousApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_YCC_API_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_YCC_API_BASE_URL = previousApiBase;
    }
  }
});
