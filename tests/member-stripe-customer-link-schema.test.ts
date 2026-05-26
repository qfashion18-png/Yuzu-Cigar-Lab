import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL("../infra/database/migrations/0005_member_stripe_customer_link.sql", import.meta.url);

function readMigration() {
  assert.equal(existsSync(migrationPath), true, "member Stripe customer link migration should exist");
  return readFileSync(migrationPath, "utf8");
}

test("member Stripe customer link migration adds a durable customer id to members", () => {
  const sql = readMigration();

  assert.match(sql, /alter\s+table\s+public\.members\s+add\s+column\s+if\s+not\s+exists\s+stripe_customer_id\s+text/i);
  assert.match(sql, /create\s+unique\s+index\s+if\s+not\s+exists\s+members_stripe_customer_id_uidx/i);
  assert.match(sql, /where\s+stripe_customer_id\s+is\s+not\s+null/i);
});

test("member Stripe customer link migration backfills from subscriptions and orders", () => {
  const sql = readMigration();

  assert.match(sql, /from\s+public\.member_subscriptions/i);
  assert.match(sql, /from\s+public\.commerce_orders/i);
  assert.match(sql, /update\s+public\.members/i);
  assert.match(sql, /values\s*\(\s*'0005'\s*,\s*'member_stripe_customer_link'/i);
  assert.doesNotMatch(sql, /drop\s+table/i, "link migration must not drop existing data");
});
