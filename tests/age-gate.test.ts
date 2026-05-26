import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AgeGate,
  ageConfirmationMaxAgeMs,
  ageGateBootstrapScript,
  createAgeConfirmationValue,
  getBirthdayStatus,
  isAgeConfirmationCurrent,
  isAtLeast21,
} from "../src/components/age-gate";

test("age gate obscures the static storefront until a client confirmation is read", () => {
  const markup = renderToStaticMarkup(createElement(AgeGate));

  assert.match(markup, /Adults 21\+ Only\./);
  assert.match(markup, /Select your birthday/);
  assert.match(markup, /name="birthMonth"/);
  assert.match(markup, /name="birthDay"/);
  assert.match(markup, /name="birthYear"/);
  assert.doesNotMatch(markup, /I am 21\+/);
});

test("stored age confirmations hide the gate before hydration can flash it", () => {
  const markup = renderToStaticMarkup(createElement(AgeGate));
  const ageGateSource = readFileSync(new URL("../src/components/age-gate.tsx", import.meta.url), "utf8");
  const rootLayout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  const dialog = markup.indexOf('role="dialog"');
  const bootstrapScript = rootLayout.indexOf('id="yuzu-age-gate-bootstrap"');
  const appChrome = rootLayout.indexOf("<BackupAuthProvider>");

  assert.ok(dialog >= 0, "age gate dialog should still render in static HTML for unconfirmed visitors");
  assert.doesNotMatch(markup, /<script/, "client age gate must not render a raw script tag");
  assert.doesNotMatch(ageGateSource, /<script/, "client age gate must not render a raw script tag");
  assert.doesNotMatch(rootLayout, /from "next\/script"/, "age gate bootstrap should run as a synchronous inline script");
  assert.match(rootLayout, /ageGateBootstrapScript/, "root layout should own the pre-hydration age gate bootstrap");
  assert.match(rootLayout, /<script\s+id="yuzu-age-gate-bootstrap"/, "age gate bootstrap should render as a parser-blocking script");
  assert.ok(bootstrapScript >= 0 && appChrome > bootstrapScript, "age gate bootstrap should run before the app chrome can render");
  assert.match(rootLayout, /id="yuzu-age-gate-bootstrap"/, "age gate bootstrap should use a stable script id");
  assert.match(markup, /data-yuzu-age-gate="overlay"/);
  assert.match(ageGateBootstrapScript, /yuzu-age-gate-bootstrap-style/);
  assert.match(ageGateBootstrapScript, /\[data-yuzu-age-gate="overlay"\]/);
  assert.match(ageGateBootstrapScript, /document\.documentElement\.setAttribute/);
  assert.match(ageGateBootstrapScript, /data-yuzu-age-confirmed/);
  assert.match(rootLayout, /<html[^>]+suppressHydrationWarning/);
});

test("age gate renders as a scroll-contained modal dialog", () => {
  const markup = renderToStaticMarkup(createElement(AgeGate));

  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-modal="true"/);
  assert.match(markup, /aria-labelledby="age-gate-title"/);
  assert.match(markup, /id="age-gate-description"/);
  assert.match(markup, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(markup, /overflow-y-auto/);
});

test("age gate verifies the selected birthday is at least 21", () => {
  const today = new Date(2026, 4, 8);

  assert.equal(isAtLeast21(new Date(2005, 4, 8), today), true);
  assert.equal(isAtLeast21(new Date(2005, 4, 9), today), false);
  assert.equal(isAtLeast21(new Date(2005, 3, 30), today), true);
});

test("age gate requires a complete valid birthday before confirming", () => {
  const today = new Date(2026, 4, 8);

  assert.deepEqual(getBirthdayStatus({ month: "", day: "8", year: "2000" }, today), {
    confirmed: false,
    message: "Select your full birthday to continue.",
  });
  assert.deepEqual(getBirthdayStatus({ month: "2", day: "31", year: "2000" }, today), {
    confirmed: false,
    message: "Select a valid birthday to continue.",
  });
  assert.deepEqual(getBirthdayStatus({ month: "5", day: "9", year: "2005" }, today), {
    confirmed: false,
    message: "You must be at least 21 years old to enter Yuzu Cigar Club.",
  });
  assert.deepEqual(getBirthdayStatus({ month: "5", day: "8", year: "2005" }, today), {
    confirmed: true,
    message: "",
  });
});

test("age gate browser confirmation expires instead of staying valid forever", () => {
  const confirmedAt = Date.UTC(2026, 4, 8);
  const storedValue = createAgeConfirmationValue(confirmedAt);

  assert.equal(isAgeConfirmationCurrent(storedValue, confirmedAt + ageConfirmationMaxAgeMs - 1), true);
  assert.equal(isAgeConfirmationCurrent(storedValue, confirmedAt + ageConfirmationMaxAgeMs + 1), false);
  assert.equal(isAgeConfirmationCurrent("yes", confirmedAt), false);
  assert.equal(isAgeConfirmationCurrent(null, confirmedAt), false);
});
