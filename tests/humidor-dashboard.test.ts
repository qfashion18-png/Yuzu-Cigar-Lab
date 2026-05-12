import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { demoHumidorItems } from "../src/lib/humidor-demo";

test("humidor dashboard loads and writes member records through the live API", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");

  assert.ok(source.includes("fetchHumidorItems"), "missing live humidor read path");
  assert.ok(source.includes("createHumidorItem"), "missing live humidor create path");
  assert.ok(source.includes("auth.createApiHeaders()"), "humidor API calls must use Cognito headers");
  assert.ok(source.includes("Loading live humidor data"), "missing live loading state");
  assert.ok(source.includes("Save To Live Humidor"), "missing live save action");
});

test("my cigars tab includes the humidor AI cigar adder", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = source.slice(source.indexOf("function renderCigars()"), source.indexOf("function renderAging()"));
  const aiAdder = cigarSection.indexOf("AI Cigar Adder");
  const manualAdder = cigarSection.indexOf("Add Live Humidor Item");
  const myCigars = cigarSection.indexOf("My Cigars");

  assert.ok(aiAdder >= 0, "My Cigars should expose the AI cigar adder");
  assert.ok(aiAdder < manualAdder, "AI adder should appear before the manual add form");
  assert.ok(aiAdder < myCigars, "AI adder should be part of the My Cigars workflow before the inventory list");
  assert.ok(source.includes("identifyCigarFromImage"), "AI adder should use the image identification client");
  assert.ok(source.includes("auth.createApiHeaders()"), "AI adder requests must use Cognito headers");
});

test("my cigars tab gates bulk import to full membership tiers", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = source.slice(source.indexOf("function renderCigars()"), source.indexOf("function renderAging()"));

  assert.ok(source.includes("canUseHumidorBulkImport"), "humidor should check tier eligibility before bulk import");
  assert.ok(source.includes("parseHumidorBulkImport"), "humidor should parse pasted bulk import rows");
  assert.ok(cigarSection.includes("Bulk Import Cigars"), "My Cigars should expose the bulk import card");
  assert.ok(source.includes("Kisha, Sensei, and Daimyo memberships include AI cigar adder and bulk import"), "shared lock copy should name the eligible tiers");
  assert.ok(cigarSection.includes("fullMembershipHumidorToolsCopy"), "bulk import lock copy should use the shared humidor tools gate copy");
  assert.ok(source.includes("member_bulk_import"), "bulk imports should identify their source for the live humidor API");
});

test("AI cigar adder shares the bulk import membership gate", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = source.slice(source.indexOf("function renderCigars()"), source.indexOf("function renderAging()"));
  const aiCard = cigarSection.slice(cigarSection.indexOf("AI Cigar Adder"), cigarSection.indexOf("{renderBulkImport()}"));
  const aiSubmit = source.slice(source.indexOf("async function handleAiAdderSubmit"), source.indexOf("async function handleConfirmAiCigar"));
  const aiConfirm = source.slice(source.indexOf("async function handleConfirmAiCigar"), source.indexOf("async function handleAddItem"));

  assert.ok(source.includes("const canUseAiCigarAdder = canBulkImport"), "AI adder should use the same tier entitlement as bulk import");
  assert.ok(aiSubmit.includes("!canUseAiCigarAdder"), "AI identify submissions must reject ineligible tiers");
  assert.ok(aiConfirm.includes("!canUseAiCigarAdder"), "AI confirmations must reject ineligible tiers");
  assert.ok(source.includes("Kisha, Sensei, and Daimyo memberships include AI cigar adder and bulk import"), "shared lock copy should name the eligible tiers");
  assert.ok(aiCard.includes("fullMembershipHumidorToolsCopy"), "AI adder lock copy should mirror bulk import eligibility");
  assert.ok(aiCard.includes("Compare Memberships"), "ineligible AI adder users should get the same upgrade path as bulk import");
  assert.ok(aiCard.includes("!canUseAiCigarAdder"), "AI adder controls should be disabled for ineligible tiers");
});

test("AI cigar adder identifies an uploaded or captured image before saving a confirmed humidor item", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = source.slice(source.indexOf("function renderCigars()"), source.indexOf("function renderAging()"));
  const identifyCall = source.indexOf("identifyCigarFromImage");
  const confirmAction = source.indexOf("handleConfirmAiCigar");
  const createCall = source.indexOf("buildHumidorPayload(aiIdentifiedForm");

  assert.ok(identifyCall >= 0, "AI adder should call the live image-identification helper");
  assert.ok(cigarSection.includes('accept="image/*"'), "AI adder should accept cigar image uploads");
  assert.ok(cigarSection.includes('capture="environment"'), "AI adder should allow mobile camera capture");
  assert.ok(cigarSection.includes("Confirm & Add To Humidor"), "AI adder should require user confirmation before saving");
  assert.ok(confirmAction > identifyCall, "confirmation should happen after identification");
  assert.ok(createCall > confirmAction, "confirmed image suggestions should create a live humidor item");
  assert.ok(source.includes("setAiIdentifiedForm"), "AI suggestion should load editable form fields for user review");
  assert.ok(cigarSection.includes("Cigar details"), "AI review should show richer cigar reference details");
  assert.ok(source.includes("formatCigarDetailsForNotes"), "AI details should be loaded into notes before confirmation");
});

test("humidor dashboard shows collection value and saves uploaded cigar photos with confirmed items", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = source.slice(source.indexOf("function renderCigars()"), source.indexOf("function renderAging()"));

  assert.ok(source.includes("Collection Value"), "dashboard should show total collection value");
  assert.ok(source.includes("calculateCollectionValue"), "dashboard should total item values by quantity");
  assert.ok(source.includes("formatHumidorValue"), "dashboard should format item and collection values");
  assert.ok(cigarSection.includes("Entry price snapshot"), "manual and AI forms should show the entry price snapshot");
  assert.ok(source.includes("resolveHumidorEntryPriceSnapshot"), "forms should preview current catalog price matches");
  assert.ok(source.includes("applyHumidorEntryPriceSnapshot"), "humidor payloads should use catalog price snapshots");
  assert.ok(source.includes("estimatedValue"), "humidor payloads should include the snapshot value");
  assert.ok(source.includes("cigarImage"), "confirmed items should carry cigar image data");
  assert.ok(source.includes("buildHumidorImageAttachment"), "AI save path should attach the uploaded cigar image");
  assert.ok(cigarSection.includes("Saved photo"), "review flow should show the photo that will be saved");
});

test("my cigars rows open a detailed cigar info card", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = source.slice(source.indexOf("function renderCigars()"), source.indexOf("function renderAging()"));
  const table = source.slice(source.indexOf("function HumidorTable"), source.indexOf("function EmptyLiveState"));
  const detailCard = source.slice(source.indexOf("function HumidorDetailCard"), source.indexOf("function EmptyLiveState"));

  assert.ok(source.includes("const [selectedHumidorItem, setSelectedHumidorItem]"), "dashboard should track the selected cigar");
  assert.ok(cigarSection.includes("onSelectItem={setSelectedHumidorItem}"), "My Cigars table should select rows into dashboard state");
  assert.ok(cigarSection.includes("selectedHumidorItem ?"), "My Cigars should render a detail card after a cigar is selected");
  assert.ok(table.includes("onSelectItem"), "HumidorTable should expose row selection");
  assert.ok(table.includes('role="button"'), "cigar rows should be interactive for assistive tech");
  assert.ok(table.includes("onKeyDown"), "cigar rows should support keyboard opening");
  assert.ok(detailCard.includes("Detailed Cigar Card"), "detail card should have a clear title");
  assert.ok(detailCard.includes("Tasting Notes"), "detail card should show notes");
  assert.ok(detailCard.includes("Collection Value"), "detail card should show value details");
  assert.ok(detailCard.includes("Close Details"), "detail card should be dismissible");
});

test("humidor dashboard shows demo data only for anonymous visitors", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");

  assert.ok(source.includes("demoHumidorItems"), "missing anonymous demo humidor items");
  assert.ok(source.includes("isAnonymousDemo"), "missing anonymous demo state guard");
  assert.ok(
    source.includes("const items = isAnonymousDemo ? demoHumidorItems : liveState.items"),
    "signed-in sessions must use live humidor items instead of demo data",
  );
  assert.ok(source.includes("Demo Humidor Preview"), "anonymous users need demo context");
  assert.ok(source.includes("Sign in to replace this preview with your live member humidor."));
  assert.ok(source.includes("Sign in with Cognito before saving live humidor data."));
  assert.equal(source.includes("startingCigars"), false);
  assert.equal(source.includes("startingReadings"), false);
  assert.equal(source.includes("startingLogs"), false);
  assert.equal(source.includes("yuzu-humidor-"), false);
  assert.equal(source.includes("window.localStorage"), false);
  assert.equal(source.includes("HumidorDemoVideo"), false);
});

test("anonymous visitors reach the demo humidor before Cognito access gating", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const renderContent = source.slice(source.indexOf("function renderContent()"), source.indexOf("function renderActiveSection()"));
  const nonCognitoGate = renderContent.indexOf('if (auth.authSource !== "cognito")');
  const dashboardReturn = renderContent.indexOf('<div className="grid gap-6">');

  assert.ok(dashboardReturn >= 0, "missing shared humidor dashboard return");
  assert.ok(
    nonCognitoGate === -1 || dashboardReturn < nonCognitoGate,
    "anonymous demo data must render before non-Cognito sessions are blocked",
  );
});

test("anonymous humidor demo data exercises key dashboard workflows", () => {
  assert.ok(demoHumidorItems.length >= 3, "demo should show a meaningful inventory");
  assert.ok(demoHumidorItems.every((item) => item.source === "demo_humidor"), "demo items must be marked as demo data");
  assert.ok(demoHumidorItems.some((item) => item.agingStartDate), "demo should show aging records");
  assert.ok(demoHumidorItems.some((item) => item.reorderReminder), "demo should show reorder reminders");
  assert.ok(demoHumidorItems.some((item) => typeof item.rating === "number"), "demo should show ratings");
  assert.ok(demoHumidorItems.every((item) => item.humidorLocation), "demo should show humidor locations");
  assert.ok(demoHumidorItems.every((item) => typeof item.estimatedValue === "number"), "demo should show estimated cigar values");
  assert.ok(demoHumidorItems.every((item) => item.estimatedValueSource === "demo_entry_price_snapshot"), "demo values should read as entry snapshots");
  assert.ok(demoHumidorItems.some((item) => item.cigarImage?.dataUrl), "demo should show saved cigar images");
});

test("humidor dashboard blocks non-Cognito and non-member access from live records", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");

  assert.ok(source.includes('auth.isSignedIn && auth.authSource !== "cognito"'), "backup sessions must not call the live humidor API");
  assert.ok(source.includes("Local backup access cannot read or write live humidor records"));
  assert.ok(source.includes("Members Only"));
});

test("humidor dashboard only displays live-supported workflows", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");

  assert.ok(source.includes("Climate telemetry and smoke-log routes are not shown here"));
  assert.equal(source.includes("applySmokeLogToCigars"), false);
  assert.equal(source.includes("addHumidorDevice"), false);
});
