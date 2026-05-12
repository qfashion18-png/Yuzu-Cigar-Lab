import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationSql = readFileSync("infra/database/migrations/0001_phase3_app_schema.sql", "utf8");

const requiredTables = [
  "members",
  "member_profiles",
  "conversations",
  "conversation_messages",
  "support_cases",
  "support_email_messages",
  "newsletter_subscribers",
  "humidor_items",
  "smoke_logs",
  "audit_log",
  "provider_connections",
];

test("phase 3 migration creates the required application tables", () => {
  for (const table of requiredTables) {
    assert.match(migrationSql, new RegExp(`create table if not exists public\\.${table}\\b`));
  }
});

test("phase 3 write tables include actor, request, and created timestamp fields", () => {
  for (const table of requiredTables) {
    const tableStart = migrationSql.indexOf(`create table if not exists public.${table}`);
    assert.notEqual(tableStart, -1, `${table} table is missing`);

    const nextTableStart = migrationSql.indexOf("create table if not exists public.", tableStart + 1);
    const tableSql = migrationSql.slice(tableStart, nextTableStart === -1 ? undefined : nextTableStart);

    assert.match(tableSql, /\bactor_id text not null\b/, `${table} must include actor_id`);
    assert.match(tableSql, /\brequest_id text not null\b/, `${table} must include request_id`);
    assert.match(tableSql, /\bcreated_at timestamptz not null default now\(\)/, `${table} must include created_at`);
  }
});

test("phase 3 migration indexes foreign key access paths", () => {
  const expectedIndexes = [
    "member_profiles_member_id_idx",
    "conversations_member_id_idx",
    "conversation_messages_conversation_idx",
    "conversation_messages_member_id_idx",
    "support_cases_member_id_idx",
    "support_email_case_idx",
    "newsletter_subscribers_email_lower_uidx",
    "newsletter_subscribers_membership_interest_idx",
    "humidor_items_member_active_idx",
    "smoke_logs_member_smoked_at_idx",
    "smoke_logs_humidor_item_id_idx",
    "provider_connections_member_id_idx",
  ];

  for (const indexName of expectedIndexes) {
    assert.match(migrationSql, new RegExp(`create (?:unique )?index if not exists ${indexName}\\b`));
  }
});

test("phase 3 conversation agent constraint includes Phase 4 agents", () => {
  const requiredAgents = [
    "YCCConcierge",
    "YCCCigarGuide",
    "YCCSupportAgent",
    "YCCHumidorAgent",
    "YCCAdminAgent",
    "YCCNewsAgent",
  ];

  for (const agent of requiredAgents) {
    assert.match(migrationSql, new RegExp(`'${agent}'`));
  }
});
