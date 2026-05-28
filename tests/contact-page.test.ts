import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import type { Metadata } from "next";

import sitemap from "../src/app/sitemap";
import { siteUrl } from "../src/lib/site";

const contactPagePath = new URL("../src/app/contact/page.tsx", import.meta.url);
const contactFormPath = new URL("../src/components/contact-us-form.tsx", import.meta.url);
const dataSource = readFileSync(new URL("../src/lib/data.ts", import.meta.url), "utf8");
const footerSource = readFileSync(new URL("../src/components/site-footer.tsx", import.meta.url), "utf8");
const runtimeAuditSource = readFileSync(new URL("../scripts/e2e-runtime-audit.ts", import.meta.url), "utf8");

test("contact page is wired into public discovery and static runtime audit", async () => {
  assert.equal(existsSync(contactPagePath), true, "src/app/contact/page.tsx should exist");

  const { metadata } = await import("../src/app/contact/page");
  const urls = sitemap().map((entry) => entry.url);

  assert.ok(dataSource.includes('{ href: "/contact", label: "Contact" }'), "site navigation should expose Contact");
  assert.ok(footerSource.includes("navItems.map"), "footer should render every public club nav item");
  assert.ok(urls.includes(`${siteUrl}/contact/`), "sitemap should include the static contact route");
  assert.ok(runtimeAuditSource.includes('"/contact/"'), "runtime e2e audit should include /contact/");
  assertCompletePublicMetadata(metadata, "/contact/");
});

test("contact form sends one support email instead of preparing a draft", () => {
  assert.equal(existsSync(contactFormPath), true, "src/components/contact-us-form.tsx should exist");

  const pageSource = readFileSync(contactPagePath, "utf8");
  const source = readFileSync(contactFormPath, "utf8");

  assert.equal(pageSource.includes("email draft"), false, "contact page copy should not promise a draft handoff");
  assert.ok(pageSource.includes("sends your message"), "contact page copy should describe direct sending");
  assert.ok(source.startsWith('"use client";'), "contact form should own client-side form state");
  assert.equal(source.includes("mailto:"), false, "contact form should not prepare a mailto draft");
  assert.equal(source.includes("Prepare Email"), false, "contact form should not show a prepare draft button");
  assert.equal(source.includes("Open Email Draft"), false, "contact form should not show a second draft-opening button");
  assert.ok(source.includes("sendContactSupportMessage"), "contact form should send through the public support API");
  assert.ok(source.includes("Send Email"), "contact form should expose one send email button");
  assert.ok(source.includes('aria-live="polite"'), "submission status should be announced accessibly");
  assert.match(source, /name="name"[\s\S]*required/, "name should be a required field");
  assert.match(source, /name="email"[\s\S]*required/, "email should be a required field");
  assert.match(source, /name="message"[\s\S]*required/, "message should be a required field");
});

function assertCompletePublicMetadata(metadata: Metadata, canonicalPath: string) {
  const openGraph = metadata.openGraph as {
    siteName?: string;
    type?: string;
    url?: string | URL;
    images?: unknown;
  };
  const twitter = metadata.twitter as {
    card?: string;
    images?: unknown;
  };

  assert.equal(metadata.alternates?.canonical, canonicalPath);
  assert.equal(openGraph.siteName, "Yuzu Cigar Club");
  assert.equal(openGraph.type, "website");
  assert.equal(openGraph.url, canonicalPath);
  assert.ok(Array.isArray(openGraph.images), "Open Graph should include image metadata");
  assert.equal(twitter.card, "summary_large_image");
  assert.ok(Array.isArray(twitter.images), "Twitter should include image metadata");
}
