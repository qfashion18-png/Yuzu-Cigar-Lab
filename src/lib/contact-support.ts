export type ContactSupportInput = {
  email: string;
  message: string;
  name: string;
  orderNumber?: string;
  pagePath?: string;
  source?: string;
  topic?: string;
};

export type ContactSupportPayload = {
  email: string;
  message: string;
  name: string;
  orderNumber?: string;
  pagePath?: string;
  source: string;
  topic: string;
};

export type ContactSupportSendResult =
  | {
      requestId: string | null;
      sent: true;
    }
  | {
      reason: "missing_endpoint" | "request_failed";
      requestId?: string | null;
      sent: false;
      status?: number;
    };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minimumMessageLength = 10;

export function buildContactSupportPayload(input: ContactSupportInput): ContactSupportPayload {
  const name = compactText(input.name, 160);
  if (!name) {
    throw new Error("Enter your name.");
  }

  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Enter a valid email address.");
  }

  const message = compactMultilineText(input.message, 6000);
  if (message.length < minimumMessageLength) {
    throw new Error("Enter a message with at least 10 characters.");
  }

  return removeUndefined({
    email,
    message,
    name,
    orderNumber: compactText(input.orderNumber, 80),
    pagePath: compactText(input.pagePath, 180),
    source: compactText(input.source, 80) || "contact-page",
    topic: compactText(input.topic, 80) || "General question",
  });
}

export function getContactSupportEndpoint(apiBaseUrl = process.env.NEXT_PUBLIC_YCC_API_BASE_URL ?? "") {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, "");
  return trimmed ? `${trimmed}/support/contact` : null;
}

export async function sendContactSupportMessage(payload: ContactSupportPayload, apiBaseUrl?: string): Promise<ContactSupportSendResult> {
  const endpoint = getContactSupportEndpoint(apiBaseUrl);
  if (!endpoint) {
    return { sent: false, reason: "missing_endpoint" };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as { requestId?: string; contact?: { status?: string } } | null;

  if (!response.ok) {
    return {
      sent: false,
      reason: "request_failed",
      status: response.status,
      requestId: body?.requestId ?? null,
    };
  }

  if (body?.contact?.status !== "sent") {
    return {
      sent: false,
      reason: "request_failed",
      status: response.status,
      requestId: body?.requestId ?? null,
    };
  }

  return {
    sent: true,
    requestId: body.requestId ?? null,
  };
}

function normalizeEmail(value: string) {
  const normalized = compactText(value, 254).toLowerCase();
  return emailPattern.test(normalized) ? normalized : "";
}

function compactText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function compactMultilineText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{4,}/g, "\n\n\n")
        .trim()
        .slice(0, maxLength)
    : "";
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as T;
}
