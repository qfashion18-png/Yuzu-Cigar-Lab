import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContactSupportPayload,
  getContactSupportEndpoint,
  sendContactSupportMessage,
} from "../src/lib/contact-support";

test("contact support payload normalizes visitor details for the support API", () => {
  const payload = buildContactSupportPayload({
    name: "  Quon Fash  ",
    email: "  Visitor@Example.COM ",
    topic: "Order support",
    orderNumber: " YCC-1042 ",
    message: "  I need help with my monthly box delivery.  ",
    pagePath: "/contact/",
  });

  assert.deepEqual(payload, {
    email: "visitor@example.com",
    message: "I need help with my monthly box delivery.",
    name: "Quon Fash",
    orderNumber: "YCC-1042",
    pagePath: "/contact/",
    source: "contact-page",
    topic: "Order support",
  });
});

test("contact support payload rejects invalid required fields", () => {
  assert.throws(
    () =>
      buildContactSupportPayload({
        name: "",
        email: "visitor@example.com",
        message: "This message has enough characters.",
      }),
    /name/i
  );

  assert.throws(
    () =>
      buildContactSupportPayload({
        name: "Visitor",
        email: "not an email",
        message: "This message has enough characters.",
      }),
    /valid email/i
  );

  assert.throws(
    () =>
      buildContactSupportPayload({
        name: "Visitor",
        email: "visitor@example.com",
        message: "short",
      }),
    /message/i
  );
});

test("contact support endpoint is derived from the public YCC API base url", () => {
  assert.equal(getContactSupportEndpoint("https://api.yuzucigarclub.com/"), "https://api.yuzucigarclub.com/support/contact");
  assert.equal(getContactSupportEndpoint(""), null);
});

test("contact support sync posts the payload to the public support route", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const payload = buildContactSupportPayload({
    name: "Visitor",
    email: "visitor@example.com",
    topic: "General question",
    message: "Please help me with my membership account.",
  });

  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ requestId: "req-contact", contact: { status: "sent" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const result = await sendContactSupportMessage(payload, "https://api.yuzucigarclub.test/");

    assert.deepEqual(result, { sent: true, requestId: "req-contact" });
    assert.equal(calls[0].url, "https://api.yuzucigarclub.test/support/contact");
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(calls[0].init?.headers, { "content-type": "application/json" });
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), payload);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
