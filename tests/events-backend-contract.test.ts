import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../infra/database/migrations/0006_events_schema.sql", import.meta.url),
  "utf8",
);
const handlerSource = readFileSync(new URL("../infra/lambda/ycc-api/index.js", import.meta.url), "utf8");

test("events migration persists sources, occurrences, idempotency, and sync runs", () => {
  for (const table of ["event_sources", "events", "event_sync_runs"]) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  }

  assert.match(migration, /provider_event_id text/);
  assert.match(migration, /provider_occurrence_id text/);
  assert.match(migration, /recurrence_rule text/);
  assert.match(migration, /events_provider_occurrence_uidx/);
  assert.match(migration, /event_sync_runs_idempotency_uidx/);
  assert.match(migration, /starts_at timestamptz not null/);
  assert.match(migration, /ends_at timestamptz not null/);
  assert.match(migration, /sync_token text/);
});

test("Lambda wires scheduled sync to the atomic PostgreSQL store", () => {
  assert.match(handlerSource, /handleGoogleCalendarScheduledEvent, isGoogleCalendarSyncEvent/);
  assert.match(handlerSource, /handleGoogleCalendarScheduledEvent\(event, \{[\s\S]*store: createEventSyncStore\(requestId\)/);
  assert.match(handlerSource, /async getSyncToken\(\{ provider, sourceId \}\)/);
  assert.match(handlerSource, /async applySync\(batch\)/);
  assert.match(handlerSource, /batch\.mode === "full"/);
  assert.match(handlerSource, /insert into public\.event_sync_runs/);
  assert.match(handlerSource, /update public\.event_sources[\s\S]*sync_token = \$2/);
});

test("public event SQL enforces publication, visibility, cancellation, and active window", () => {
  assert.match(handlerSource, /public_events_feed/);
  assert.match(handlerSource, /e\.status = 'published'/);
  assert.match(handlerSource, /e\.visibility = 'public'/);
  assert.match(handlerSource, /e\.canceled_at is null/);
  assert.match(handlerSource, /e\.archived_at is null/);
  assert.match(handlerSource, /e\.ends_at >= \$1/);
  assert.match(handlerSource, /e\.starts_at <= \$2/);
  assert.match(handlerSource, /public, max-age=300, stale-while-revalidate=900/);
});
