"use strict";

const { createSign } = require("node:crypto");

const GOOGLE_CALENDAR_SYNC_SOURCE = "ycc.events.sync";
const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE_URL = "https://www.googleapis.com/calendar/v3";
const PROVIDER = "google_calendar";
const DAY_MS = 24 * 60 * 60 * 1000;

class GoogleCalendarHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "GoogleCalendarHttpError";
    this.status = status;
  }
}

function isGoogleCalendarSyncEvent(event = {}) {
  return (
    event &&
    event.source === GOOGLE_CALENDAR_SYNC_SOURCE &&
    event.action === "sync-google-calendar" &&
    event.provider === PROVIDER
  );
}

async function handleGoogleCalendarScheduledEvent(event, dependencies = {}) {
  if (!isGoogleCalendarSyncEvent(event)) {
    throw new Error("Unsupported Google Calendar sync event.");
  }

  const env = dependencies.env || process.env;
  return syncGoogleCalendar({
    ...dependencies,
    calendarId: dependencies.calendarId || env.GOOGLE_CALENDAR_ID,
    credentialSecretId:
      dependencies.credentialSecretId || env.GOOGLE_CALENDAR_CREDENTIAL_SECRET_ID,
  });
}

async function syncGoogleCalendar(options = {}) {
  const calendarId = sanitizeCalendarId(options.calendarId);
  const store = validateStore(options.store);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required for Google Calendar sync.");
  }

  const now = normalizeNow(options.now);
  const credentials = options.credentials
    ? validateServiceAccountCredentials(options.credentials)
    : await loadGoogleServiceAccountCredentials({
        secretId: options.credentialSecretId,
        secretsClient: options.secretsClient,
      });
  const accessToken = await exchangeServiceAccountJwt({ credentials, fetchImpl, now });
  const storedSyncToken = sanitizeSyncToken(
    await store.getSyncToken({ provider: PROVIDER, sourceId: calendarId })
  );

  let mode = storedSyncToken ? "incremental" : "full";
  let result;
  try {
    result = await fetchAllEventPages({
      accessToken,
      calendarId,
      fetchImpl,
      syncToken: storedSyncToken,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      now,
    });
  } catch (error) {
    if (!(error instanceof GoogleCalendarHttpError) || error.status !== 410 || !storedSyncToken) {
      throw error;
    }

    mode = "full";
    result = await fetchAllEventPages({
      accessToken,
      calendarId,
      fetchImpl,
      syncToken: null,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      now,
    });
  }

  const eventsByExternalId = new Map();
  const deletedExternalIds = new Set();
  for (const item of result.items) {
    const externalId = sanitizeIdentifier(item && item.id, 1024);
    if (!externalId) continue;

    if (item.status === "cancelled") {
      eventsByExternalId.delete(externalId);
      deletedExternalIds.add(externalId);
      continue;
    }

    const normalized = normalizeGoogleCalendarEvent(item, calendarId);
    if (!normalized) continue;
    deletedExternalIds.delete(externalId);
    eventsByExternalId.set(externalId, normalized);
  }

  const batch = {
    provider: PROVIDER,
    sourceId: calendarId,
    mode,
    events: [...eventsByExternalId.values()],
    deletedExternalIds: [...deletedExternalIds],
    nextSyncToken: result.nextSyncToken,
    syncedAt: now.toISOString(),
  };
  await store.applySync(batch);

  return {
    provider: PROVIDER,
    sourceId: calendarId,
    mode,
    received: result.items.length,
    upserted: batch.events.length,
    deleted: batch.deletedExternalIds.length,
    syncedAt: batch.syncedAt,
  };
}

async function fetchAllEventPages(options) {
  const items = [];
  let pageToken = null;
  let nextSyncToken = null;

  do {
    const url = buildEventsUrl({ ...options, pageToken });
    const response = await options.fetchImpl(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${options.accessToken}`,
      },
    });
    if (!response || !response.ok) {
      const status = Number(response && response.status) || 500;
      throw new GoogleCalendarHttpError(status, `Google Calendar request failed with HTTP ${status}.`);
    }

    const body = await response.json();
    if (!body || typeof body !== "object" || !Array.isArray(body.items)) {
      throw new Error("Google Calendar returned an invalid events response.");
    }
    items.push(...body.items);
    pageToken = sanitizePageToken(body.nextPageToken);
    nextSyncToken = sanitizeSyncToken(body.nextSyncToken) || nextSyncToken;
  } while (pageToken);

  if (!nextSyncToken) {
    throw new Error("Google Calendar did not return a nextSyncToken after the final page.");
  }
  return { items, nextSyncToken };
}

function buildEventsUrl(options) {
  const params = new URLSearchParams({
    maxResults: "2500",
    showDeleted: "true",
    singleEvents: "true",
  });
  if (options.syncToken) {
    params.set("syncToken", options.syncToken);
  } else {
    const timeMin = normalizeBoundary(options.timeMin, new Date(options.now.getTime() - 30 * DAY_MS));
    const timeMax = normalizeBoundary(options.timeMax, new Date(options.now.getTime() + 365 * DAY_MS));
    if (timeMin >= timeMax) {
      throw new Error("Google Calendar timeMin must be earlier than timeMax.");
    }
    params.set("timeMin", timeMin.toISOString());
    params.set("timeMax", timeMax.toISOString());
  }
  if (options.pageToken) params.set("pageToken", options.pageToken);

  return `${GOOGLE_CALENDAR_API_BASE_URL}/calendars/${encodeURIComponent(options.calendarId)}/events?${params}`;
}

async function exchangeServiceAccountJwt({ credentials, fetchImpl, now }) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const claims = base64UrlJson({
    iss: credentials.client_email,
    scope: GOOGLE_CALENDAR_READONLY_SCOPE,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const unsignedJwt = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const assertion = `${unsignedJwt}.${signer.sign(credentials.private_key, "base64url")}`;

  const response = await fetchImpl(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!response || !response.ok) {
    const status = Number(response && response.status) || 500;
    throw new GoogleCalendarHttpError(status, `Google OAuth token exchange failed with HTTP ${status}.`);
  }
  const body = await response.json();
  const accessToken = sanitizeAccessToken(body && body.access_token);
  if (!accessToken) throw new Error("Google OAuth token response did not contain an access token.");
  return accessToken;
}

async function loadGoogleServiceAccountCredentials(options = {}) {
  const secretId = sanitizeSecretId(options.secretId);
  let client;
  let command;
  if (options.secretsClient) {
    client = options.secretsClient;
    command = { input: { SecretId: secretId } };
  } else {
    const { GetSecretValueCommand, SecretsManagerClient } = require("@aws-sdk/client-secrets-manager");
    client = new SecretsManagerClient({});
    command = new GetSecretValueCommand({ SecretId: secretId });
  }
  const response = await client.send(command);
  let value = response && response.SecretString;
  if (!value && response && response.SecretBinary) {
    value = Buffer.from(response.SecretBinary).toString("utf8");
  }
  if (!value) throw new Error("Google Calendar credential secret is empty.");

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Google Calendar credential secret is not valid JSON.");
  }
  return validateServiceAccountCredentials(parsed);
}

function normalizeGoogleCalendarEvent(item, calendarId) {
  if (!item || typeof item !== "object" || item.status === "cancelled") return null;
  const externalId = sanitizeIdentifier(item.id, 1024);
  const title = sanitizePlainText(item.summary, 240);
  if (!externalId || !title) return null;

  const start = normalizeGoogleDateValue(item.start);
  const end = normalizeGoogleDateValue(item.end);
  if (!start || !end || start.instant >= end.instant) return null;

  const recurringEventId = sanitizeIdentifier(item.recurringEventId, 1024);
  const originalStart = normalizeGoogleDateValue(item.originalStartTime);
  const occurrenceValue = originalStart ? originalStart.original : recurringEventId ? start.original : null;
  const providerEventId = recurringEventId || externalId;
  const providerOccurrenceId = recurringEventId && occurrenceValue ? occurrenceValue : null;
  const organizer = item.organizer && typeof item.organizer === "object" ? item.organizer : {};
  const creator = item.creator && typeof item.creator === "object" ? item.creator : {};

  return {
    provider: PROVIDER,
    sourceId: calendarId,
    externalId,
    externalOccurrenceId: providerOccurrenceId ? `${providerEventId}::${providerOccurrenceId}` : null,
    providerEventId,
    providerOccurrenceId,
    title,
    summary: sanitizePlainText(item.description, 500),
    description: sanitizePlainText(item.description, 8000),
    host: sanitizePlainText(organizer.displayName || creator.displayName, 240),
    sourceUrl: sanitizeHttpUrl(item.htmlLink, 2048),
    startsAt: start.instant.toISOString(),
    endsAt: end.instant.toISOString(),
    startDate: start.allDay ? start.original : null,
    endDate: end.allDay ? end.original : null,
    allDay: start.allDay,
    timezone: sanitizeTimezone(item.start && item.start.timeZone) || sanitizeTimezone(item.end && item.end.timeZone),
    location: sanitizePlainText(item.location, 1000),
    status: "published",
    visibility: "public",
    verificationStatus: "trusted_source",
    sourceUpdatedAt: normalizeOptionalInstant(item.updated),
  };
}

function normalizeGoogleDateValue(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.dateTime === "string") {
    const instant = new Date(value.dateTime);
    return Number.isNaN(instant.getTime()) ? null : { instant, allDay: false, original: instant.toISOString() };
  }
  if (typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    const instant = new Date(`${value.date}T00:00:00.000Z`);
    return Number.isNaN(instant.getTime()) ? null : { instant, allDay: true, original: value.date };
  }
  return null;
}

function sanitizePlainText(value, maxLength) {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, maxLength) : null;
}

function sanitizeHttpUrl(value, maxLength) {
  if (typeof value !== "string" || value.length > maxLength) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeIdentifier(value, maxLength) {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return clean && clean.length <= maxLength ? clean : null;
}

function sanitizeCalendarId(value) {
  const clean = sanitizeIdentifier(value, 1024);
  if (!clean) throw new Error("GOOGLE_CALENDAR_ID is required and must be at most 1024 characters.");
  return clean;
}

function sanitizeSecretId(value) {
  const clean = sanitizeIdentifier(value, 2048);
  if (!clean) throw new Error("GOOGLE_CALENDAR_CREDENTIAL_SECRET_ID is required.");
  return clean;
}

function sanitizeSyncToken(value) {
  return sanitizeIdentifier(value, 4096);
}

function sanitizePageToken(value) {
  return sanitizeIdentifier(value, 4096);
}

function sanitizeAccessToken(value) {
  return sanitizeIdentifier(value, 8192);
}

function sanitizeTimezone(value) {
  const clean = sanitizeIdentifier(value, 100);
  return clean && /^[A-Za-z0-9_+\-/]+$/.test(clean) ? clean : null;
}

function normalizeOptionalInstant(value) {
  if (typeof value !== "string") return null;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

function normalizeNow(value) {
  const now = value instanceof Date ? new Date(value.getTime()) : value ? new Date(value) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("The sync clock returned an invalid date.");
  return now;
}

function normalizeBoundary(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const instant = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error("Google Calendar sync boundary is invalid.");
  return instant;
}

function validateStore(store) {
  if (!store || typeof store.getSyncToken !== "function" || typeof store.applySync !== "function") {
    throw new Error("Event sync store must implement getSyncToken and applySync.");
  }
  return store;
}

function validateServiceAccountCredentials(value) {
  if (!value || typeof value !== "object") throw new Error("Google service-account credentials are required.");
  const clientEmail = sanitizeIdentifier(value.client_email, 320);
  const privateKey = typeof value.private_key === "string" ? value.private_key.replace(/\\n/g, "\n").trim() : "";
  if (!clientEmail || !/^[^\s@]+@[^\s@]+$/.test(clientEmail)) {
    throw new Error("Google service-account client_email is invalid.");
  }
  if (
    privateKey.length > 32768 ||
    (!privateKey.includes("BEGIN PRIVATE KEY") && !privateKey.includes("BEGIN RSA PRIVATE KEY"))
  ) {
    throw new Error("Google service-account private_key is invalid.");
  }
  return { client_email: clientEmail, private_key: privateKey };
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

module.exports = {
  GOOGLE_CALENDAR_READONLY_SCOPE,
  GOOGLE_CALENDAR_SYNC_SOURCE,
  GoogleCalendarHttpError,
  handleGoogleCalendarScheduledEvent,
  isGoogleCalendarSyncEvent,
  loadGoogleServiceAccountCredentials,
  normalizeGoogleCalendarEvent,
  syncGoogleCalendar,
};
