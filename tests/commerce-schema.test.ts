import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { catalogProducts, storefrontProducts } from "../src/lib/catalog";

const migrationPath = new URL("../infra/database/migrations/0002_commerce_schema.sql", import.meta.url);

function readMigration() {
  assert.equal(existsSync(migrationPath), true, "commerce migration 0002 should exist");
  return readFileSync(migrationPath, "utf8");
}

test("commerce migration adds durable Stripe, order, subscription, and compliance tables", () => {
  const sql = readMigration();
  const requiredTables = [
    "stripe_events",
    "commerce_orders",
    "commerce_order_items",
    "member_subscriptions",
    "commerce_compliance_holds",
    "commerce_audit_log",
  ];

  for (const table of requiredTables) {
    assert.match(
      sql,
      new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${table}\\b`, "i"),
      `${table} should be created idempotently`
    );
  }

  assert.match(sql, /stripe_checkout_session_id\s+text\s+unique/i);
  assert.match(sql, /stripe_event_id\s+text/i);
  assert.match(sql, /payload\s+jsonb\s+not\s+null/i);
  assert.match(sql, /shipping_snapshot\s+jsonb\s+not\s+null/i);
  assert.match(sql, /tax_snapshot\s+jsonb\s+not\s+null/i);
  assert.match(sql, /compliance_status\s+text\s+not\s+null/i);
});

test("commerce migration declares launch indexes and idempotent guards", () => {
  const sql = readMigration();
  const requiredIndexes = [
    "commerce_orders_email",
    "commerce_orders_stripe_checkout_session_id",
    "member_subscriptions_email",
    "commerce_compliance_holds_status",
    "stripe_events_processing_status",
  ];

  for (const index of requiredIndexes) {
    assert.match(
      sql,
      new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+[^;]*${index}`, "i"),
      `${index} should be created idempotently`
    );
  }

  assert.doesNotMatch(sql, /drop\s+table/i, "launch migration must not drop existing data");
  assert.match(sql, /gen_random_uuid\(\)/i, "order tables should use generated UUIDs");
  assert.match(sql, /insert\s+into\s+public\.schema_migrations/i, "commerce migration should record its applied version");
  assert.match(sql, /values\s*\(\s*'0002'\s*,\s*'commerce_schema'/i, "commerce migration should record version 0002");
});

test("catalog products expose launch commerce controls without losing imported catalog scale", () => {
  const catalogItem = catalogProducts.find((product) => product.sku === "39919");
  const storefrontItem = storefrontProducts.find((product) => product.sku === "39919");

  assert.equal(catalogProducts.length, 956);
  assert.ok(catalogItem);
  assert.ok(storefrontItem);

  for (const product of [catalogItem, storefrontItem]) {
    assert.equal(product.publishStatus, "published");
    assert.ok(["track", "manual"].includes(product.inventoryPolicy));
    assert.equal(product.shippable, true);
    assert.equal(product.adultSignatureRequired, true);
    assert.equal("stripeProductId" in product, true);
    assert.equal("stripePriceId" in product, true);
  }
});
