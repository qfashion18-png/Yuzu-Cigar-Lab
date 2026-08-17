import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

const require = createRequire(import.meta.url);
const eventSync = require("../infra/lambda/ycc-api/event-sync.js") as {
  GOOGLE_CALENDAR_READONLY_SCOPE: string;
  GOOGLE_CALENDAR_SYNC_SOURCE: string;
  handleGoogleCalendarScheduledEvent: (
    event: Record<string, unknown>,
    dependencies: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  isGoogleCalendarSyncEvent: (event: Record<string, unknown>) => boolean;
  loadGoogleServiceAccountCredentials: (options: Record<string, unknown>) => Promise<Record<string, string>>;
  normalizeGoogleCalendarEvent: (item: Record<string, unknown>, calendarId: string) => Record<string, unknown> | null;
  syncGoogleCalendar: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const credentials = {
  client_email: "calendar-reader@ycc-test.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const fixedNow = new Date("2026-08-16T12:00:00.000Z");
const calendarId = "events@yuzucigarclub.com";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function decodeJwtPart(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

test("full Google Calendar sync exchanges a readonly JWT, pages, and atomically applies normalized occurrences", async () => {
  const requests: Array<{ url: string; init: Record<string, unknown> }> = [];
  let appliedBatch: Record<string, unknown> | undefined;
  const store = {
    async getSyncToken() {
      return null;
    },
    async applySync(batch: Record<string, unknown>) {
      appliedBatch = batch;
    },
  };
  const fetchImpl = async (urlValue: string | URL, init: Record<string, unknown>) => {
    const url = String(urlValue);
    requests.push({ url, init });
    if (url === "https://oauth2.googleapis.com/token") {
      return jsonResponse({ access_token: "access-token-for-tests" });
    }
    const parsed = new URL(url);
    if (!parsed.searchParams.has("pageToken")) {
      return jsonResponse({
        items: [
          {
            id: "instance_20260820T010000Z",
            recurringEventId: "weekly_cigar_night",
            originalStartTime: { dateTime: "2026-08-20T18:00:00-07:00" },
            summary: "  Cigar <b>Night</b> \u0000 ",
            description: "Meet <script>bad()</script> friends<br>Upstairs",
            htmlLink: "https://calendar.google.com/event?eid=safe",
            start: { dateTime: "2026-08-20T18:00:00-07:00", timeZone: "America/Phoenix" },
            end: { dateTime: "2026-08-20T20:00:00-07:00", timeZone: "America/Phoenix" },
            location: "Yuzu Lounge",
            organizer: { displayName: "Yuzu Cigar Club" },
            updated: "2026-08-15T10:00:00Z",
          },
        ],
        nextPageToken: "page-2",
      });
    }
    return jsonResponse({
      items: [
        {
          id: "all_day_1",
          summary: "Members Day",
          start: { date: "2026-09-01" },
          end: { date: "2026-09-02" },
        },
      ],
      nextSyncToken: "sync-token-2",
    });
  };

  const result = await eventSync.syncGoogleCalendar({
    calendarId,
    credentials,
    fetchImpl,
    store,
    now: fixedNow,
  });

  assert.deepEqual(result, {
    provider: "google_calendar",
    sourceId: calendarId,
    mode: "full",
    received: 2,
    upserted: 2,
    deleted: 0,
    syncedAt: fixedNow.toISOString(),
  });
  assert.equal(requests.length, 3);

  const tokenBody = new URLSearchParams(String(requests[0].init.body));
  assert.equal(tokenBody.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const jwt = String(tokenBody.get("assertion")).split(".");
  assert.equal(jwt.length, 3);
  assert.deepEqual(decodeJwtPart(jwt[0]), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(decodeJwtPart(jwt[1]), {
    iss: credentials.client_email,
    scope: eventSync.GOOGLE_CALENDAR_READONLY_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: 1786881600,
    exp: 1786885200,
  });

  const firstEventsUrl = new URL(requests[1].url);
  assert.equal(firstEventsUrl.pathname, "/calendar/v3/calendars/events%40yuzucigarclub.com/events");
  assert.equal(firstEventsUrl.searchParams.get("singleEvents"), "true");
  assert.equal(firstEventsUrl.searchParams.get("showDeleted"), "true");
  assert.equal(firstEventsUrl.searchParams.get("timeMin"), "2026-07-17T12:00:00.000Z");
  assert.equal(firstEventsUrl.searchParams.get("timeMax"), "2027-08-16T12:00:00.000Z");
  assert.equal(firstEventsUrl.searchParams.has("syncToken"), false);
  assert.equal((requests[1].init.headers as Record<string, string>).authorization, "Bearer access-token-for-tests");
  assert.equal(new URL(requests[2].url).searchParams.get("pageToken"), "page-2");

  assert.ok(appliedBatch);
  assert.equal(appliedBatch.mode, "full");
  assert.equal(appliedBatch.nextSyncToken, "sync-token-2");
  const events = appliedBatch.events as Array<Record<string, unknown>>;
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], {
    provider: "google_calendar",
    sourceId: calendarId,
    externalId: "instance_20260820T010000Z",
    externalOccurrenceId: "weekly_cigar_night::2026-08-21T01:00:00.000Z",
    providerEventId: "weekly_cigar_night",
    providerOccurrenceId: "2026-08-21T01:00:00.000Z",
    title: "Cigar Night",
    summary: "Meet friends Upstairs",
    description: "Meet friends Upstairs",
    host: "Yuzu Cigar Club",
    sourceUrl: "https://calendar.google.com/event?eid=safe",
    startsAt: "2026-08-21T01:00:00.000Z",
    endsAt: "2026-08-21T03:00:00.000Z",
    startDate: null,
    endDate: null,
    allDay: false,
    timezone: "America/Phoenix",
    location: "Yuzu Lounge",
    status: "published",
    visibility: "public",
    verificationStatus: "trusted_source",
    sourceUpdatedAt: "2026-08-15T10:00:00.000Z",
  });
  assert.deepEqual(appliedBatch.deletedExternalIds, []);
});

test("incremental sync uses its cursor and applies cancellations without full-sync filters", async () => {
  let appliedBatch: Record<string, unknown> | undefined;
  const requestedUrls: string[] = [];
  const fetchImpl = async (urlValue: string | URL) => {
    const url = String(urlValue);
    requestedUrls.push(url);
    if (url.includes("oauth2.googleapis.com")) return jsonResponse({ access_token: "token" });
    return jsonResponse({
      items: [{ id: "cancelled_instance", status: "cancelled" }],
      nextSyncToken: "sync-token-new",
    });
  };

  const result = await eventSync.syncGoogleCalendar({
    calendarId,
    credentials,
    fetchImpl,
    now: fixedNow,
    store: {
      async getSyncToken() {
        return "sync-token-old";
      },
      async applySync(batch: Record<string, unknown>) {
        appliedBatch = batch;
      },
    },
  });

  assert.equal(result.mode, "incremental");
  const eventsUrl = new URL(requestedUrls[1]);
  assert.equal(eventsUrl.searchParams.get("syncToken"), "sync-token-old");
  assert.equal(eventsUrl.searchParams.has("timeMin"), false);
  assert.equal(eventsUrl.searchParams.has("timeMax"), false);
  assert.deepEqual(appliedBatch?.events, []);
  assert.deepEqual(appliedBatch?.deletedExternalIds, ["cancelled_instance"]);
});

test("HTTP 410 invalidates an incremental cursor and retries as a full reconciliation", async () => {
  const eventRequestUrls: string[] = [];
  let appliedBatch: Record<string, unknown> | undefined;
  const fetchImpl = async (urlValue: string | URL) => {
    const url = String(urlValue);
    if (url.includes("oauth2.googleapis.com")) return jsonResponse({ access_token: "token" });
    eventRequestUrls.push(url);
    if (eventRequestUrls.length === 1) return jsonResponse({}, 410);
    return jsonResponse({ items: [], nextSyncToken: "replacement-sync-token" });
  };

  const result = await eventSync.syncGoogleCalendar({
    calendarId,
    credentials,
    fetchImpl,
    now: fixedNow,
    store: {
      async getSyncToken() {
        return "expired-sync-token";
      },
      async applySync(batch: Record<string, unknown>) {
        appliedBatch = batch;
      },
    },
  });

  assert.equal(result.mode, "full");
  assert.equal(new URL(eventRequestUrls[0]).searchParams.get("syncToken"), "expired-sync-token");
  assert.equal(new URL(eventRequestUrls[1]).searchParams.has("syncToken"), false);
  assert.equal(appliedBatch?.mode, "full");
  assert.equal(appliedBatch?.nextSyncToken, "replacement-sync-token");
});

test("unsafe or malformed provider values are discarded", () => {
  const normalized = eventSync.normalizeGoogleCalendarEvent(
    {
      id: "safe-id",
      summary: "Safe title",
      htmlLink: "javascript:alert(1)",
      location: "Lobby\u0007",
      start: { dateTime: "2026-08-20T10:00:00Z", timeZone: "../../bad timezone" },
      end: { dateTime: "2026-08-20T11:00:00Z" },
    },
    calendarId
  );

  assert.ok(normalized);
  assert.equal(normalized.sourceUrl, null);
  assert.equal(normalized.location, "Lobby");
  assert.equal(normalized.timezone, null);
  assert.equal(eventSync.normalizeGoogleCalendarEvent({ id: "missing-time", summary: "No time" }, calendarId), null);
});

test("credential loading accepts only client_email/private_key JSON from an injected Secrets Manager client", async () => {
  let commandInput: Record<string, string> | undefined;
  const loaded = await eventSync.loadGoogleServiceAccountCredentials({
    secretId: "ycc/events/google-calendar/prod",
    secretsClient: {
      async send(command: { input: Record<string, string> }) {
        commandInput = command.input;
        return { SecretString: JSON.stringify(credentials) };
      },
    },
  });

  assert.deepEqual(commandInput, { SecretId: "ycc/events/google-calendar/prod" });
  assert.equal(loaded.client_email, credentials.client_email);
  assert.equal(loaded.private_key, credentials.private_key.trim());
});

test("scheduled handler recognizes only the explicit scheduler payload and IaC targets live alias with retry and DLQ", async () => {
  const scheduledEvent = {
    source: eventSync.GOOGLE_CALENDAR_SYNC_SOURCE,
    "detail-type": "YCC Google Calendar Sync",
    action: "sync-google-calendar",
    provider: "google_calendar",
  };
  assert.equal(eventSync.isGoogleCalendarSyncEvent(scheduledEvent), true);
  assert.equal(eventSync.isGoogleCalendarSyncEvent({ ...scheduledEvent, action: "other" }), false);

  await assert.rejects(
    () => eventSync.handleGoogleCalendarScheduledEvent({ ...scheduledEvent, provider: "other" }, {}),
    /Unsupported Google Calendar sync event/
  );

  const template = readFileSync(new URL("../infra/ycc-events-sync.yaml", import.meta.url), "utf8");
  assert.match(template, /ScheduleExpression: rate\(15 minutes\)/);
  assert.match(template, /ScheduleState:\s+[\s\S]*?Default: DISABLED[\s\S]*?AllowedValues:\s+[\s\S]*?- ENABLED\s+[\s\S]*?- DISABLED/);
  assert.match(template, /State: !Ref ScheduleState/);
  assert.match(template, /Arn: !Ref ExistingLambdaLiveAliasArn/);
  assert.match(template, /MaximumRetryAttempts: 3/);
  assert.match(template, /DeadLetterConfig:/);
  assert.match(template, /Type: AWS::Scheduler::ScheduleGroup/);
  assert.match(template, /aws:SourceArn: !GetAtt EventsSyncScheduleGroup\.Arn/);
  assert.match(template, /GroupName: !Ref EventsSyncScheduleGroup/);
  assert.match(template, /Action: lambda:InvokeFunction\s+Resource: !Ref ExistingLambdaLiveAliasArn/);
  assert.match(template, /"source":"ycc\.events\.sync"/);
});
