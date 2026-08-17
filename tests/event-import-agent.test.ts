import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  approveEventImportDraft,
  draftEventImportFromFacebookText,
  rankEventsForLocation,
  readApprovedEventImports,
  serializeApprovedEventImports,
} from "../src/lib/event-import-agent";

const foxFacebookText = [
  "Cigar Night at Fox Cigar Bar -Every 2nd Saturday",
  "Saturday, July 11, 2026 at 7 PM - 12 AM",
  "Fox Cigar Bar",
  "1464 E. Williams Field Rd Suite 104, Gilbert, AZ 85295",
  "Join Brothers of Prometheus 87 for Cigars, drinks, or just some fellowship. Every Second Saturday.",
].join("\n");

test("event import agent drafts a Facebook event for human approval", () => {
  const draft = draftEventImportFromFacebookText({
    sourceUrl: "https://www.facebook.com/events/2502127350222287/",
    sourceText: foxFacebookText,
  });

  assert.match(draft.title, /Fox Cigar Bar/i);
  assert.equal(draft.startsAt, "2026-07-11T19:00:00-07:00");
  assert.equal(draft.endsAt, "2026-07-12T00:00:00-07:00");
  assert.equal(draft.location, "Fox Cigar Bar, 1464 E Williams Field Rd, Gilbert, AZ 85295");
  assert.equal(draft.sourceUrl, "https://www.facebook.com/events/2502127350222287/");
  assert.equal(draft.sourceName, "Facebook Events");
  assert.equal(draft.operatorReviewRequired, true);
  assert.equal(draft.approvalStatus, "draft");
  assert.ok(draft.confidence >= 0.75);
  assert.ok(draft.agentNotes.some((note) => /human approval/i.test(note)));
  assert.ok(draft.complianceReview.prohibitedClaims.includes("health"));

  const approved = approveEventImportDraft(draft, "2026-06-13T22:00:00.000Z");

  assert.equal(approved.approvalStatus, "approved");
  assert.equal(approved.approvedAt, "2026-06-13T22:00:00.000Z");
  assert.equal(approved.approvedBy, "operator");
});

test("approved imported events serialize for the static storefront and sort near the user", () => {
  const approved = approveEventImportDraft(
    draftEventImportFromFacebookText({
      sourceUrl: "https://www.facebook.com/events/2502127350222287/",
      sourceText: foxFacebookText,
    }),
    "2026-06-13T22:00:00.000Z",
  );
  const storedImports = readApprovedEventImports(serializeApprovedEventImports([approved]));

  assert.equal(storedImports.length, 1);
  assert.equal(storedImports[0].approvalStatus, "approved");

  const ranked = rankEventsForLocation(storedImports, {
    latitude: 33.3096,
    longitude: -111.7591,
  });

  assert.equal(ranked[0].slug, approved.slug);
  assert.ok((ranked[0].distanceMiles ?? Number.POSITIVE_INFINITY) < 3);
});

test("event import agent UI is wired into admin and public location feed surfaces", () => {
  const gridSource = readFileSync(new URL("../src/components/auto-updating-event-grid.tsx", import.meta.url), "utf8");
  const panelSource = readFileSync(new URL("../src/components/event-import-agent-panel.tsx", import.meta.url), "utf8");
  const adminEventsPageSource = readFileSync(new URL("../src/app/admin/events/page.tsx", import.meta.url), "utf8");

  assert.match(gridSource, /data-location-aware-event-feed/);
  assert.match(gridSource, /navigator\.geolocation/);
  assert.match(gridSource, /fetchPublishedEvents/);
  assert.doesNotMatch(gridSource, /readApprovedEventImports/);
  assert.match(panelSource, /draftEventImportFromFacebookText/);
  assert.match(panelSource, /operatorApproved/);
  assert.match(panelSource, /createAdminEvent/);
  assert.match(panelSource, /publishAdminEvent/);
  assert.match(panelSource, /createApiHeaders/);
  assert.match(panelSource, /Approve Event/);
  assert.doesNotMatch(panelSource, /localStorage/);
  assert.doesNotMatch(panelSource, /approvedEventImportsStorageKey/);
  assert.match(adminEventsPageSource, /EventImportAgentPanel/);
});

test("location-aware event surfaces distinguish actionable geolocation failures", () => {
  const gridSource = readFileSync(new URL("../src/components/auto-updating-event-grid.tsx", import.meta.url), "utf8");
  const curatedSource = readFileSync(new URL("../src/components/curated-events-explorer.tsx", import.meta.url), "utf8");

  for (const source of [gridSource, curatedSource]) {
    assert.match(source, /case error\.PERMISSION_DENIED:/);
    assert.match(source, /case error\.POSITION_UNAVAILABLE:/);
    assert.match(source, /case error\.TIMEOUT:/);
    assert.match(source, /Allow location for this site in your browser settings, then try again\./);
    assert.match(source, /Your device could not determine its location\./);
    assert.match(source, /Finding your location took too long\./);
  }

  assert.match(curatedSource, /search by city or ZIP/);
  assert.match(gridSource, /Check your signal and try again\./);
});
