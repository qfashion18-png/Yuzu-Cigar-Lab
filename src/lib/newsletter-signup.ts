export const newsletterSignupStorageKey = "yuzu-newsletter-signups-v1";

export type NewsletterTier = "box_access_pass" | "kisha" | "sensei" | "daimyo";

export type NewsletterSignupInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  wantsMonthlyMembership?: boolean;
  preferredTier?: string;
  source?: string;
  consent?: boolean;
  pagePath?: string;
};

export type NewsletterSignupPayload = {
  consent: true;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  pagePath?: string;
  phone?: string;
  preferredTier?: NewsletterTier;
  source: string;
  wantsMonthlyMembership: boolean;
};

export type NewsletterSignupRecord = NewsletterSignupPayload & {
  id: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: "local" | "synced" | "sync_pending";
  syncedAt?: string;
};

type NewsletterStorage = Pick<Storage, "getItem" | "setItem">;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tierAliases: Record<string, NewsletterTier> = {
  "box access pass": "box_access_pass",
  box_access_pass: "box_access_pass",
  boxaccesspass: "box_access_pass",
  kisha: "kisha",
  sensei: "sensei",
  daimyo: "daimyo",
};

export function buildNewsletterSignupPayload(input: NewsletterSignupInput): NewsletterSignupPayload {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Enter a valid email address.");
  }

  if (input.consent !== true) {
    throw new Error("Marketing consent is required.");
  }

  const firstName = compactText(input.firstName, 80);
  const lastName = compactText(input.lastName, 80);
  const explicitFullName = compactText(input.fullName ?? input.name, 160);
  const fullName = explicitFullName || compactText([firstName, lastName].filter(Boolean).join(" "), 160);
  const preferredTier = normalizeNewsletterTier(input.preferredTier);

  return removeUndefined({
    consent: true,
    email,
    firstName,
    lastName,
    fullName,
    pagePath: compactText(input.pagePath, 180),
    phone: compactText(input.phone, 40),
    preferredTier,
    source: compactText(input.source, 80) || "website",
    wantsMonthlyMembership: Boolean(input.wantsMonthlyMembership || preferredTier),
  });
}

export function createLocalNewsletterStore(storage: NewsletterStorage) {
  return {
    list() {
      return readNewsletterRecords(storage);
    },
    save(payload: NewsletterSignupPayload, syncStatus: NewsletterSignupRecord["syncStatus"] = "local") {
      const now = new Date().toISOString();
      const records = readNewsletterRecords(storage);
      const existingIndex = records.findIndex((record) => record.email.toLowerCase() === payload.email.toLowerCase());
      const existing = existingIndex >= 0 ? records[existingIndex] : null;
      const record: NewsletterSignupRecord = {
        ...(existing ?? {
          id: `newsletter_${hashString(payload.email)}`,
          createdAt: now,
        }),
        ...payload,
        syncStatus,
        updatedAt: now,
        ...(syncStatus === "synced" ? { syncedAt: now } : {}),
      };
      const nextRecords = existingIndex >= 0 ? [...records] : [...records, record];

      if (existingIndex >= 0) {
        nextRecords[existingIndex] = record;
      }

      storage.setItem(newsletterSignupStorageKey, JSON.stringify(nextRecords));
      return record;
    },
  };
}

export function getNewsletterSignupEndpoint(apiBaseUrl = process.env.NEXT_PUBLIC_YCC_API_BASE_URL ?? "") {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, "");
  return trimmed ? `${trimmed}/newsletter/subscribe` : null;
}

export async function syncNewsletterSignup(payload: NewsletterSignupPayload, apiBaseUrl?: string) {
  const endpoint = getNewsletterSignupEndpoint(apiBaseUrl);
  if (!endpoint) {
    return { synced: false as const, reason: "missing_endpoint" as const };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { synced: false as const, reason: "request_failed" as const, status: response.status };
  }

  const body = (await response.json().catch(() => null)) as { requestId?: string } | null;
  return { synced: true as const, requestId: body?.requestId ?? null };
}

function readNewsletterRecords(storage: NewsletterStorage): NewsletterSignupRecord[] {
  try {
    const parsed = JSON.parse(storage.getItem(newsletterSignupStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isNewsletterSignupRecord) : [];
  } catch {
    return [];
  }
}

function isNewsletterSignupRecord(value: unknown): value is NewsletterSignupRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as NewsletterSignupRecord).email === "string" &&
      typeof (value as NewsletterSignupRecord).id === "string"
  );
}

function normalizeEmail(value: string) {
  const normalized = compactText(value, 254).toLowerCase();
  return emailPattern.test(normalized) ? normalized : "";
}

function normalizeNewsletterTier(value: string | undefined): NewsletterTier | undefined {
  const normalized = compactText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return tierAliases[normalized] ?? tierAliases[normalized.replace(/_/g, " ")];
}

function compactText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as T;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}
