import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildNewsletterPromotedCigars,
  buildNewsletterSignupPayload,
  createLocalNewsletterStore,
  getNewsletterSignupEndpoint,
  newsletterSignupStorageKey,
} from "../src/lib/newsletter-signup";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem"> {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("newsletter signup payload normalizes email and monthly membership interest", () => {
  const payload = buildNewsletterSignupPayload({
    email: "  YUZU.FAN@Example.COM ",
    firstName: "Quon",
    lastName: "Fash",
    phone: " 555 0100 ",
    wantsMonthlyMembership: true,
    preferredTier: "Sensei",
    source: "join-now-header",
    consent: true,
    pagePath: "/membership",
  });

  assert.deepEqual(payload, {
    consent: true,
    email: "yuzu.fan@example.com",
    firstName: "Quon",
    lastName: "Fash",
    fullName: "Quon Fash",
    pagePath: "/membership",
    phone: "555 0100",
    preferredTier: "sensei",
    source: "join-now-header",
    wantsMonthlyMembership: true,
  });
});

test("newsletter signup payload stores brand preferences and selected cigar promotions", () => {
  const promotedCigars = buildNewsletterPromotedCigars(
    [" Padron ", "DAVIDOFF", "Padron"],
    [
      {
        slug: "padron-1964-anniversary-toro",
        name: "Padron 1964 Anniversary Toro",
        brand: "Padron",
        storeHref: "/shop/padron-1964-anniversary-toro/",
        nonMemberPrice: 320,
        memberPrice: 260,
        packageLabel: "Box of 20",
        image: "/assets/product-padron.png",
      },
      {
        slug: "davidoff-grand-cru-robusto",
        name: "Davidoff Grand Cru Robusto",
        brand: "Davidoff",
        storeHref: "/shop/davidoff-grand-cru-robusto/",
        nonMemberPrice: 410,
        memberPrice: 335,
        packageLabel: "Box of 25",
        image: "/assets/product-davidoff.png",
      },
      {
        slug: "perdomo-reserve-10th-anniversary",
        name: "Perdomo Reserve 10th Anniversary",
        brand: "Perdomo",
        storeHref: "/shop/perdomo-reserve-10th-anniversary/",
        nonMemberPrice: 188,
        memberPrice: 160,
        packageLabel: "Box of 20",
        image: "/assets/product-plasencia.png",
      },
    ],
    2
  );
  const payload = buildNewsletterSignupPayload({
    email: "reader@example.com",
    consent: true,
    source: "education-newsletter",
    brandPreferences: ["Padron", "Davidoff", "Unknown Brand"],
    promotedCigars,
  });

  assert.deepEqual(payload.brandPreferences, ["padron", "davidoff"]);
  assert.deepEqual(payload.promotedCigars, [
    {
      slug: "padron-1964-anniversary-toro",
      name: "Padron 1964 Anniversary Toro",
      brand: "Padron",
      storeHref: "/shop/padron-1964-anniversary-toro/",
      nonMemberPrice: 320,
      memberPrice: 260,
      packageLabel: "Box of 20",
      image: "/assets/product-padron.png",
    },
    {
      slug: "davidoff-grand-cru-robusto",
      name: "Davidoff Grand Cru Robusto",
      brand: "Davidoff",
      storeHref: "/shop/davidoff-grand-cru-robusto/",
      nonMemberPrice: 410,
      memberPrice: 335,
      packageLabel: "Box of 25",
      image: "/assets/product-davidoff.png",
    },
  ]);
});

test("newsletter signup rejects invalid email and missing marketing consent", () => {
  assert.throws(
    () =>
      buildNewsletterSignupPayload({
        email: "not an email",
        consent: true,
        source: "education-newsletter",
      }),
    /valid email/i
  );

  assert.throws(
    () =>
      buildNewsletterSignupPayload({
        email: "reader@example.com",
        consent: false,
        source: "education-newsletter",
      }),
    /consent/i
  );
});

test("newsletter signup form exposes favorite-brand selection and pricing copy", () => {
  const source = readFileSync(new URL("../src/components/newsletter-signup-form.tsx", import.meta.url), "utf8");

  assert.match(source, /Favorite cigar brands/);
  assert.match(source, /Send cigar picks and pricing/);
});

test("local newsletter store dedupes by email and keeps latest membership intent", () => {
  const storage = new MemoryStorage();
  const store = createLocalNewsletterStore(storage);

  const first = store.save(
    buildNewsletterSignupPayload({
      email: "reader@example.com",
      consent: true,
      source: "education-newsletter",
    })
  );
  const second = store.save(
    buildNewsletterSignupPayload({
      email: "Reader@Example.com",
      firstName: "Rin",
      consent: true,
      source: "join-now-header",
      wantsMonthlyMembership: true,
      preferredTier: "Kisha",
    })
  );

  const stored = JSON.parse(storage.getItem(newsletterSignupStorageKey) ?? "[]");

  assert.equal(first.email, "reader@example.com");
  assert.equal(second.email, "reader@example.com");
  assert.equal(stored.length, 1);
  assert.equal(stored[0].firstName, "Rin");
  assert.equal(stored[0].wantsMonthlyMembership, true);
  assert.equal(stored[0].preferredTier, "kisha");
});

test("newsletter signup endpoint is derived from the public YCC API base url", () => {
  assert.equal(getNewsletterSignupEndpoint("https://api.yuzucigarclub.com/"), "https://api.yuzucigarclub.com/newsletter/subscribe");
  assert.equal(getNewsletterSignupEndpoint(""), null);
});
