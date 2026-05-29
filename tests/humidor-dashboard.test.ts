import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { demoHumidorItems } from "../src/lib/humidor-demo";

function getFunctionBlock(source: string, functionName: string, nextFunctionName: string) {
  const start = source.indexOf(`function ${functionName}()`);
  const end = source.indexOf(`function ${nextFunctionName}()`);

  assert.ok(start >= 0, `missing ${functionName}`);
  assert.ok(end > start, `missing ${nextFunctionName} after ${functionName}`);

  return source.slice(start, end);
}

function readPngAssetSize(publicPath: string) {
  const image = readFileSync(new URL(`../public${publicPath}`, import.meta.url));

  assert.equal(image.toString("ascii", 1, 4), "PNG", `${publicPath} should be a PNG asset`);

  return {
    bytes: image.byteLength,
    height: image.readUInt32BE(20),
    width: image.readUInt32BE(16),
  };
}

test("humidor dashboard loads and writes member records through the live API", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");

  assert.ok(source.includes("fetchHumidorDashboardBootstrap"), "missing live humidor bootstrap read path");
  assert.ok(source.includes("createHumidorItem"), "missing live humidor create path");
  assert.ok(source.includes("auth.createApiHeaders()"), "humidor API calls must use Cognito headers");
  assert.ok(source.includes("Loading live humidor data"), "missing live loading state");
  assert.ok(source.includes("Save To Live Humidor"), "missing live save action");
});

test("add cigars tab owns the humidor AI cigar adder and manual add form", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const toolsSection = getFunctionBlock(source, "renderTools", "renderCigars");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");
  const aiAdder = toolsSection.indexOf("AI Cigar Adder");
  const manualAdder = toolsSection.indexOf("Add Live Humidor Item");

  assert.ok(source.includes('{ id: "tools", label: "Add Cigars"'), "humidor nav should expose an Add Cigars tab");
  assert.ok(aiAdder >= 0, "Add Cigars should expose the AI cigar adder");
  assert.ok(aiAdder < manualAdder, "AI adder should appear before the manual add form");
  assert.equal(cigarSection.includes("AI Cigar Adder"), false, "My Cigars should not include the AI add form");
  assert.equal(cigarSection.includes("Add Live Humidor Item"), false, "My Cigars should not include the manual add form");
  assert.ok(source.includes("identifyCigarFromImage"), "AI adder should use the image identification client");
  assert.ok(source.includes("auth.createApiHeaders()"), "AI adder requests must use Cognito headers");
});

test("log a smoke tab lets members rate saved or newly identified cigars with drink pairings", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const smokeSection = getFunctionBlock(source, "renderSmokeLogs", "renderCigars");
  const aiConfirm = source.slice(source.indexOf("async function handleConfirmAiCigar"), source.indexOf("async function handleAddItem"));

  assert.ok(source.includes('type SectionId = "overview" | "tools" | "locations" | "smokes"'), "smoke logging should be a first-class humidor section");
  assert.ok(source.includes('{ id: "smokes", label: "Log a Smoke"'), "humidor nav should expose Log a Smoke");
  assert.ok(source.includes("fetchHumidorSmokeLogs"), "dashboard bootstrap should load member smoke history");
  assert.ok(source.includes("createSmokeLog"), "Log a Smoke should write through the live smoke-log API");
  assert.ok(source.includes("smokeLogs: bootstrap.smokes.logs"), "bootstrap should place smoke logs in live state");
  assert.ok(smokeSection.includes("Log a Smoke"), "smoke section should render the logging form");
  assert.ok(smokeSection.includes("Saved humidor cigar"), "members should be able to choose a saved cigar");
  assert.ok(smokeSection.includes("Drink pairing"), "members should be able to record what they drank");
  assert.ok(smokeSection.includes("Smoke rating"), "members should be able to rate the smoked cigar");
  assert.ok(smokeSection.includes("Use AI Cigar Adder"), "non-humidor smokes should hand off to the AI cigar adder");
  assert.ok(source.includes("setReturnToSmokeLogAfterAi(true)"), "AI handoff should remember to return to the smoke log");
  assert.ok(aiConfirm.includes('setActiveSection("smokes")'), "confirmed AI-added cigars should return members to Log a Smoke");
  assert.ok(aiConfirm.includes("buildSmokeLogFormForItem(response.item)"), "confirmed AI-added cigars should prefill the smoke-log cigar");
});

test("humidor accepts Cigar Flow deep links for smoke-note prep", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");

  assert.ok(source.includes("resolveHumidorDeepLinkSection"), "humidor should normalize section query params");
  assert.ok(source.includes("new URLSearchParams(window.location.search)"), "humidor should read static-export query params on the client");
  assert.ok(source.includes('searchParams.get("intent") === "cigar-flow"'), "humidor should detect the Cigar Flow intent");
  assert.ok(source.includes('setActiveSection("tools")'), "Cigar Flow intent should open the Add Cigars smoke-note prep area");
  assert.ok(source.includes("Cigar Flow smoke note prep"), "humidor should show a concrete Cigar Flow handoff state");
  assert.ok(source.includes("Shareable notes start in your live humidor"), "handoff copy should explain the real member workflow");
});

test("add locations tab saves, displays, and edits member humidor locations", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const addCigarsNav = source.indexOf('{ id: "tools", label: "Add Cigars"');
  const addLocationsNav = source.indexOf('{ id: "locations", label: "Add Locations"');
  const myCigarsNav = source.indexOf('{ id: "cigars", label: "My Cigars"');
  const locationsSection = getFunctionBlock(source, "renderLocations", "renderCigars");
  const settingsSection = getFunctionBlock(source, "renderSettings", "renderHumidorLocationProfile");
  const profileStart = source.indexOf("function renderHumidorLocationProfile()");
  const profileSection = source.slice(profileStart, source.indexOf("\n  return (\n    <main", profileStart));

  assert.ok(addCigarsNav >= 0, "humidor nav should expose Add Cigars");
  assert.ok(addLocationsNav > addCigarsNav, "Add Locations should sit below Add Cigars");
  assert.ok(myCigarsNav > addLocationsNav, "Add Locations should sit above My Cigars");
  assert.ok(source.includes('type SectionId = "overview" | "tools" | "locations"'), "locations should be a first-class humidor section");
  assert.ok(source.includes('if (activeSection === "locations")'), "active section router should handle Add Locations");
  assert.ok(source.includes("return renderLocations();"), "Add Locations should render its own section");
  assert.ok(locationsSection.includes("Add Locations"), "locations section should have an Add Locations title");
  assert.equal(locationsSection.includes("humidor name and default location"), false, "anonymous Add Locations copy should not mention removed profile fields");
  assert.ok(locationsSection.includes("saved locations and trays"), "anonymous Add Locations copy should point members to saved locations");
  assert.ok(locationsSection.includes("renderHumidorLocationProfile()"), "locations section should reuse the saved profile form");
  assert.ok(settingsSection.includes("renderHumidorLocationProfile()"), "settings should reuse the same saved profile form");
  assert.equal(profileSection.includes("Humidor name"), false, "Add Locations should not render a separate humidor name field");
  assert.equal(profileSection.includes("Default location"), false, "Add Locations should derive the default from saved locations");
  assert.ok(source.includes("function getPrimaryHumidorProfileLocationName"), "dashboard should derive the primary location from saved profile rows");
  assert.ok(profileSection.includes("handleSaveHumidorLocationProfile"), "shared profile form should save through the existing profile handler");
  assert.ok(source.includes("locations: []"), "humidor profiles should keep saved member-added locations");
  assert.ok(source.includes('type HumidorProfileLocationKind = "humidor" | "other"'), "saved locations should distinguish humidors from other tracked places");
  assert.ok(source.includes("type HumidorProfileLocation = {"), "saved locations should use structured profile entries");
  assert.ok(source.includes("trays: string[];"), "humidor locations should keep tray names");
  assert.ok(source.includes("function normalizeHumidorProfileLocations"), "saved locations should be normalized before storing");
  assert.ok(source.includes("handleAddHumidorProfileLocation"), "Add Locations should add a saved profile location");
  assert.ok(source.includes("handleEditHumidorProfileLocation"), "saved profile locations should be editable");
  assert.ok(source.includes("handleEditHumidorProfileLocationTrays"), "humidor tray lists should be editable per saved location");
  assert.ok(source.includes("handleRemoveHumidorProfileLocation"), "saved profile locations should be removable");
  assert.ok(profileSection.includes("Saved Locations"), "saved locations should be visible in the Add Locations profile form");
  assert.ok(profileSection.includes("Location type"), "Add Locations should let members mark a row as humidor or other storage");
  assert.ok(profileSection.includes("Tray names"), "Add Locations should capture tray names for humidor rows");
  assert.ok(profileSection.includes('aria-label="New humidor location"'), "Add Locations should expose a new-location input");
  assert.ok(profileSection.includes('aria-label="New humidor tray names"'), "Add Locations should expose a tray input for humidor rows");
  assert.ok(profileSection.includes("humidorLocationProfile.locations.map"), "saved locations should render from persisted profile state");
  assert.ok(profileSection.includes('aria-label={`Edit saved location ${index + 1}`}'), "saved location names should be editable from the list");
  assert.ok(profileSection.includes('aria-label={`Edit type for saved location ${index + 1}`}'), "saved location types should be editable from the list");
  assert.ok(profileSection.includes('aria-label={`Edit trays for saved location ${index + 1}`}'), "saved humidor trays should be editable from the list");
  assert.ok(profileSection.includes('aria-label={`Remove saved location ${index + 1}`}'), "saved locations should have a remove control");
  assert.ok(profileSection.includes("No saved locations yet"), "Add Locations should explain the empty saved-location state");
});

test("add locations save includes the typed draft location and tray names", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const saveHandler = source.slice(source.indexOf("async function handleSaveHumidorLocationProfile"), source.indexOf("async function handleEnableHumidorPushAlerts"));
  const profileSection = source.slice(source.indexOf("function renderHumidorLocationProfile()"), source.indexOf("\n  return (\n    <main", source.indexOf("function renderHumidorLocationProfile()")));

  assert.ok(saveHandler.includes("newHumidorLocationDraft.trim()"), "saving should read the currently typed Add Locations draft");
  assert.ok(saveHandler.includes("newHumidorTrayDraft.trim()"), "saving should read the currently typed tray draft");
  assert.ok(saveHandler.includes("buildHumidorProfileLocationInput()"), "saving should build a structured pending location");
  assert.ok(
    saveHandler.includes("normalizeHumidorProfileLocations([...humidorLocationProfile.locations, pendingLocation].filter(Boolean))"),
    "saving should merge the unsaved structured draft into the profile locations before persistence",
  );
  assert.ok(
    profileSection.includes("const canSaveHumidorProfile = !hasIncompleteNewHumidorLocation && Boolean(savedLocations.length || hasNewHumidorLocationDraft)"),
    "Save Locations should be enabled from saved rows or a valid new-location draft, not a separate default field",
  );
  assert.ok(saveHandler.includes('setNewHumidorLocationDraft("")'), "successful save should clear the consumed draft location");
  assert.ok(saveHandler.includes('setNewHumidorTrayDraft("")'), "successful save should clear the consumed tray draft");
});

test("alerts tab includes an iOS web push setup guide", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const alertsSection = getFunctionBlock(source, "renderAlerts", "renderSettings");

  assert.ok(alertsSection.includes("iPhone setup guide"), "alerts should include an iPhone setup guide");
  assert.ok(alertsSection.includes("iOS 16.4 or later"), "guide should name the minimum iOS version");
  assert.ok(alertsSection.includes("Add to Home Screen"), "guide should tell members to install the web app");
  assert.ok(alertsSection.includes("Open Yuzu from the Home Screen"), "guide should require opening the installed app");
  assert.ok(alertsSection.includes("Enable Push Alerts"), "guide should point members back to the push opt-in button");
  assert.ok(alertsSection.includes("Settings > Notifications"), "guide should include the iOS notification recovery path");
  assert.ok(alertsSection.includes("Safari tab alone cannot receive iPhone push alerts"), "guide should warn that a browser tab cannot receive iPhone push");
});

test("add locations separates the draft composer from saved rows and blocks tray-only drafts", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const profileSection = source.slice(source.indexOf("function renderHumidorLocationProfile()"), source.indexOf("\n  return (\n    <main", source.indexOf("function renderHumidorLocationProfile()")));

  assert.ok(profileSection.includes("Add a location"), "new location draft controls should have their own composer title");
  assert.ok(profileSection.indexOf("Add a location") < profileSection.indexOf("Saved Locations"), "the draft composer should appear before the saved locations list");
  assert.ok(profileSection.includes("const hasIncompleteNewHumidorLocation"), "profile save logic should track tray text without a location name");
  assert.ok(profileSection.includes("const canAddHumidorProfileLocation = Boolean(pendingHumidorProfileLocation)"), "Add Location should be enabled only for a valid structured draft");
  assert.ok(profileSection.includes("!hasIncompleteNewHumidorLocation"), "Save Humidor Profile should be blocked while tray-only draft text is present");
  assert.ok(profileSection.includes("disabled={!canAddHumidorProfileLocation}"), "Add Location should use the shared draft validity check");
  assert.ok(profileSection.includes("setNewHumidorTrayDraft(\"\")"), "changing a draft to non-humidor storage should clear stale tray text");
  assert.ok(profileSection.includes("Location columns"), "saved rows should use one compact column header instead of repeating labels in every row");
});

test("add cigars tab gates bulk import to full membership tiers", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const toolsSection = getFunctionBlock(source, "renderTools", "renderCigars");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");

  assert.ok(source.includes("canUseHumidorBulkImport"), "humidor should check tier eligibility before bulk import");
  assert.ok(source.includes("parseHumidorBulkImport"), "humidor should parse pasted bulk import rows");
  assert.ok(toolsSection.includes("Bulk Import Cigars"), "Add Cigars should expose the bulk import card");
  assert.equal(cigarSection.includes("Bulk Import Cigars"), false, "My Cigars should not include the bulk import card");
  assert.ok(source.includes("Kisha, Sensei, and Daimyo memberships include AI cigar adder and bulk import"), "shared lock copy should name the eligible tiers");
  assert.ok(toolsSection.includes("fullMembershipHumidorToolsCopy"), "bulk import lock copy should use the shared humidor tools gate copy");
  assert.ok(source.includes("member_bulk_import"), "bulk imports should identify their source for the live humidor API");
});

test("AI cigar adder shares the bulk import membership gate", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const toolsSection = getFunctionBlock(source, "renderTools", "renderCigars");
  const aiCard = toolsSection.slice(toolsSection.indexOf("AI Cigar Adder"), toolsSection.indexOf("{renderBulkImport()}"));
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
  const toolsSection = getFunctionBlock(source, "renderTools", "renderCigars");
  const identifyCall = source.indexOf("identifyCigarFromImage");
  const confirmAction = source.indexOf("handleConfirmAiCigar");
  const createCall = source.indexOf("buildHumidorPayload(aiIdentifiedForm");

  assert.ok(identifyCall >= 0, "AI adder should call the live image-identification helper");
  assert.ok(toolsSection.includes('accept="image/*"'), "AI adder should accept cigar image uploads");
  assert.ok(toolsSection.includes('capture="environment"'), "AI adder should allow mobile camera capture");
  assert.ok(toolsSection.includes("Confirm & Add To Humidor"), "AI adder should require user confirmation before saving");
  assert.ok(confirmAction > identifyCall, "confirmation should happen after identification");
  assert.ok(createCall > confirmAction, "confirmed image suggestions should create a live humidor item");
  assert.ok(source.includes("setAiIdentifiedForm"), "AI suggestion should load editable form fields for user review");
  assert.ok(toolsSection.includes("Cigar details"), "AI review should show richer cigar reference details");
  assert.ok(source.includes("formatCigarDetailsForNotes"), "AI details should be loaded into notes before confirmation");
});

test("humidor dashboard shows collection value and saves uploaded cigar photos with confirmed items", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const toolsSection = getFunctionBlock(source, "renderTools", "renderCigars");

  assert.ok(source.includes("Collection Value"), "dashboard should show total collection value");
  assert.ok(source.includes("calculateCollectionValue"), "dashboard should total item values by quantity");
  assert.ok(source.includes("formatHumidorValue"), "dashboard should format item and collection values");
  assert.ok(toolsSection.includes("Entry price snapshot"), "manual and AI forms should show the entry price snapshot");
  assert.ok(source.includes("resolveHumidorEntryPriceSnapshot"), "forms should preview current catalog price matches");
  assert.ok(source.includes("applyHumidorEntryPriceSnapshot"), "humidor payloads should use catalog price snapshots");
  assert.ok(source.includes("estimatedValue"), "humidor payloads should include the snapshot value");
  assert.ok(source.includes("cigarImage"), "confirmed items should carry cigar image data");
  assert.ok(source.includes("buildHumidorImageAttachment"), "AI save path should attach the uploaded cigar image");
  assert.ok(toolsSection.includes("Saved photo"), "review flow should show the photo that will be saved");
});

test("my cigars table exposes sortable headers and smart sort presets", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const table = source.slice(source.indexOf("function HumidorTable"), source.indexOf("function HumidorDetailCard"));

  assert.ok(source.includes("sortHumidorItems"), "My Cigars table should sort items through the shared sorter");
  assert.ok(table.includes("const [sort, setSort] = useState(defaultHumidorTableSort)"), "table should keep a selected sort mode");
  assert.ok(table.includes("const sortedItems = useMemo"), "table should memoize sorted rows");
  assert.ok(table.includes("humidorTableSortOptions.map"), "table should expose smart sort presets");
  assert.ok(table.includes('aria-label="Sort My Cigars"'), "sort preset select should be accessible");
  assert.ok(table.includes("SortableHumidorTableHead"), "headers should be sortable controls");
  assert.ok(table.includes('aria-sort={getHumidorTableAriaSort(sort, sortKey)}'), "active header should announce sort direction");
  assert.ok(table.includes("toggleHumidorTableSort(sort, sortKey)"), "clicking an active header should toggle direction");
  assert.ok(table.includes("sortedItems.map((item)"), "table rows should render from the sorted result");
});

test("overview stat cards show humidity and temperature from the connected device reading", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const dashboardShell = source.slice(source.indexOf("function renderContent()"), source.indexOf("function renderActiveSection()"));

  assert.ok(source.includes("getConnectedHumidorDeviceReading"), "dashboard should select a connected paired device reading");
  assert.ok(source.includes("const connectedHumidorDevice = useMemo"), "dashboard should memoize the connected device reading");
  assert.ok(source.includes("formatDeviceClimateValue"), "dashboard should format device climate readings consistently");
  assert.ok(dashboardShell.includes('label="Humidity"'), "overview stat row should show connected device humidity");
  assert.ok(dashboardShell.includes('label="Temperature"'), "overview stat row should show connected device temperature");
  assert.ok(dashboardShell.includes("connectedHumidorDevice.humidity"), "humidity value should come from the connected device reading");
  assert.ok(dashboardShell.includes("connectedHumidorDevice.temperature"), "temperature value should come from the connected device reading");
  assert.ok(dashboardShell.includes("Pair a device in Settings"), "overview should guide members when no connected device reading exists");
});

test("aging records separate user humidor aging from optional production age", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const agingSection = getFunctionBlock(source, "renderAging", "renderAlerts");
  const trackerItem = source.slice(source.indexOf("function AgingTrackerItem"), source.indexOf("function HumidorTable"));
  const detailCard = source.slice(source.indexOf("function HumidorDetailCard"), source.indexOf("function EmptyLiveState"));
  const agingHelper = source.slice(source.indexOf("function getAgingSnapshotForItem"), source.indexOf("function formatItemDetails"));

  assert.ok(source.includes("productionDate"), "humidor records should carry an optional production date");
  assert.ok(source.includes("Box / production date"), "manual and AI forms should expose the production date field");
  assert.ok(agingHelper.includes("item.agingStartDate || item.purchaseDate || item.createdAt"), "readiness should use the member-controlled aging start before added date fallback");
  assert.ok(source.includes("getTotalAgeSnapshot(item.productionDate"), "production date should calculate total cigar age separately");
  assert.ok(agingSection.includes("AgingTrackerItem"), "aging list should render tracked aging rows");
  assert.ok(trackerItem.includes("months in your humidor"), "aging list should label member-controlled humidor time");
  assert.ok(detailCard.includes("total age"), "detail card should show total cigar age when production date exists");
  assert.ok(detailCard.includes("Box / Production Date"), "detail card should expose production provenance");
});

test("humidor display dates parse date-only API values without UTC backshifting", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const dateHelpers = source.slice(source.indexOf("function formatDate"), source.indexOf("function formatDateInputValue"));

  assert.ok(dateHelpers.includes("parseHumidorDisplayDate(value)"), "display formatting should use the humidor date parser");
  assert.ok(dateHelpers.includes("new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))"), "date-only values should be constructed as local calendar dates");
});

test("add cigar forms offer exact and approximate aging start options", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const toolsSection = getFunctionBlock(source, "renderTools", "renderCigars");

  assert.ok(source.includes("agingStartPresetOptions"), "dashboard should use the shared aging start preset labels");
  assert.ok(source.includes("resolveAgingStartPresetDate"), "dashboard should convert aging start presets into stored dates");
  assert.ok(source.includes('const [itemAgingStartPreset, setItemAgingStartPreset]'), "manual add form should track the selected aging start option");
  assert.ok(source.includes('const [aiAgingStartPreset, setAiAgingStartPreset]'), "AI confirmation form should track the selected aging start option");
  assert.ok(source.includes("function updateItemAgingStartPreset"), "manual add form should update aging start from preset choices");
  assert.ok(source.includes("function updateAiAgingStartPreset"), "AI confirmation form should update aging start from preset choices");
  assert.ok(toolsSection.includes('aria-label="Manual aging start option"'), "manual add form should expose the aging start option menu");
  assert.ok(toolsSection.includes('aria-label="AI aging start option"'), "AI review form should expose the aging start option menu");
  assert.ok(toolsSection.includes("agingStartPresetOptions.map"), "aging start menus should render every shared preset option");
});

test("aging tracker can adjust a saved cigar start date by exact date or month scheme", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const agingSection = getFunctionBlock(source, "renderAging", "renderAlerts");
  const trackerItem = source.slice(source.indexOf("function AgingTrackerItem"), source.indexOf("function HumidorTable"));

  assert.ok(source.includes("function AgingTrackerItem"), "aging tracker should render an editable row component");
  assert.ok(agingSection.includes("AgingTrackerItem"), "aging tracker should use the editable row component");
  assert.ok(agingSection.includes("onUpdate={isAnonymousDemo ? undefined : handleUpdateHumidorItem}"), "aging tracker should save through the existing item update path");
  assert.ok(trackerItem.includes("agingStartPresetOptions.map"), "aging tracker should expose the same month-scheme options as add forms");
  assert.ok(trackerItem.includes("resolveAgingStartPresetDate"), "aging tracker presets should resolve into stored start dates");
  assert.ok(trackerItem.includes('aria-label={`${item.name} aging start option`}'), "aging tracker preset select should be item-specific");
  assert.ok(trackerItem.includes('aria-label={`${item.name} aging start exact date`}'), "aging tracker exact date input should be item-specific");
  assert.ok(trackerItem.includes("Update Start Date"), "aging tracker should expose a start-date update action");
  assert.ok(trackerItem.includes("onUpdate?.(item, { agingStartDate: agingStartDateDraft })"), "aging tracker should save the adjusted aging start date");
});

test("my cigars rows open a detailed cigar info card", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");
  const table = source.slice(source.indexOf("function HumidorTable"), source.indexOf("function EmptyLiveState"));
  const detailCard = source.slice(source.indexOf("function HumidorDetailCard"), source.indexOf("function EmptyLiveState"));

  assert.ok(source.includes("const [selectedHumidorItem, setSelectedHumidorItem]"), "dashboard should track the selected cigar");
  assert.ok(cigarSection.includes("onSelectItem={handleSelectHumidorItem}"), "My Cigars table should select rows into dashboard state");
  assert.ok(source.includes("setSelectedHumidorItem(item)"), "the shared row-selection handler should set the selected cigar");
  assert.ok(cigarSection.includes("selectedHumidorItem ?"), "My Cigars should render a detail card after a cigar is selected");
  assert.ok(table.includes("onSelectItem"), "HumidorTable should expose row selection");
  assert.ok(table.includes('role="button"'), "cigar rows should be interactive for assistive tech");
  assert.ok(table.includes("onKeyDown"), "cigar rows should support keyboard opening");
  assert.ok(detailCard.includes("Detailed Cigar Card"), "detail card should have a clear title");
  assert.ok(detailCard.includes("Tasting Notes"), "detail card should show notes");
  assert.ok(detailCard.includes("formatHumidorTastingNote"), "detail card should format long pulled tasting-note details");
  assert.ok(detailCard.includes("Collection Value"), "detail card should show value details");
  assert.ok(detailCard.includes("Close Details"), "detail card should be dismissible");
});

test("my cigars detail card can delete cigars and log shared inventory", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");
  const detailCard = source.slice(source.indexOf("function HumidorDetailCard"), source.indexOf("function EmptyLiveState"));
  const shareHandler = source.slice(source.indexOf("async function handleShareHumidorItem"), source.indexOf("async function handleDeleteHumidorItem"));
  const deleteHandler = source.slice(source.indexOf("async function handleDeleteHumidorItem"), source.indexOf("async function handleBulkImport"));
  const smokeLogRow = source.slice(source.indexOf("function SmokeLogRow"), source.indexOf("function StatusTile"));

  assert.ok(source.includes("shareHumidorItem"), "dashboard should call the live API helper for shared cigars");
  assert.ok(source.includes("deleteHumidorItem"), "dashboard should call the live API helper for deleted cigars");
  assert.ok(cigarSection.includes("humidorInventoryActionStatus"), "My Cigars should announce share/delete results after the detail card closes");
  assert.ok(detailCard.includes("Shared"), "detail card should expose a Shared inventory action");
  assert.ok(detailCard.includes("Delete"), "detail card should expose a Delete inventory action");
  assert.ok(detailCard.includes("onShare?.(item)"), "Shared should delegate to the dashboard mutation");
  assert.ok(detailCard.includes("onDelete?.(item)"), "Delete should delegate to the dashboard mutation");
  assert.ok(shareHandler.includes("shareHumidorItem(item.id"), "shared action should persist through the live API");
  assert.ok(shareHandler.includes("response.log"), "shared action should add the tracking log returned by the API");
  assert.ok(shareHandler.includes("response.item.quantity > 0"), "shared action should remove the card when the last cigar is given away");
  assert.ok(deleteHandler.includes("deleteHumidorItem(item.id"), "delete action should persist through the live API");
  assert.ok(deleteHandler.includes("current.items.filter"), "delete action should remove the cigar from visible inventory");
  assert.ok(smokeLogRow.includes('log.source === "member_shared_gift"'), "shared logs should be visually tracked in recent activity");
});

test("my cigars row selection scrolls to the top of the detailed cigar card", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const overviewSection = getFunctionBlock(source, "renderOverview", "renderTools");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");

  assert.ok(source.includes("useRef"), "dashboard should keep a DOM ref for the detailed card scroll target");
  assert.ok(source.includes("humidorDetailCardRef"), "dashboard should name the detailed card scroll target");
  assert.ok(source.includes("pendingHumidorDetailScrollItemId"), "dashboard should remember when a user-triggered selection needs scrolling");
  assert.ok(source.includes("function handleSelectHumidorItem"), "row selection should go through one shared open-details handler");
  assert.ok(overviewSection.includes("handleSelectHumidorItem(item)"), "overview row selection should request the same detail-card scroll");
  assert.ok(cigarSection.includes("onSelectItem={handleSelectHumidorItem}"), "My Cigars row selection should request the detail-card scroll");
  assert.ok(cigarSection.includes('data-humidor-detail-card="top"'), "the rendered detail card should expose a stable top scroll target");
  assert.ok(cigarSection.includes("ref={humidorDetailCardRef}"), "the top detail-card wrapper should receive the scroll ref");
  assert.ok(cigarSection.includes("scroll-mt-24"), "the detail-card scroll target should remain visible below the fixed site header");
  assert.ok(source.includes("scrollIntoView({ block: \"start\", behavior: \"smooth\" })"), "selection should move the viewport to the top of the detail card");
});

test("my cigars offers humidor agent enrichment for missing info image and MSRP", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");
  const table = source.slice(source.indexOf("function HumidorTable"), source.indexOf("function EmptyLiveState"));
  const detailCard = source.slice(source.indexOf("function HumidorDetailCard"), source.indexOf("function EmptyLiveState"));

  assert.ok(source.includes("enrichHumidorItem"), "dashboard should call the live humidor enrichment API");
  assert.ok(source.includes("getHumidorEnrichmentGaps"), "dashboard should detect missing cigar fields before enrichment");
  assert.ok(source.includes("handleEnrichHumidorItem"), "dashboard should own the My Cigars enrichment mutation");
  assert.ok(cigarSection.includes("handleRequestHumidorEnrichment"), "My Cigars should pass the enrichment preview action to the detail card");
  assert.ok(table.includes("Missing:"), "My Cigars rows should flag missing info, image, or MSRP");
  assert.ok(detailCard.includes("Ask Humidor Agent"), "detail cards should expose a humidor agent update action");
  assert.ok(detailCard.includes("aria-live=\"polite\""), "agent update status should be announced accessibly");
});

test("my cigars requires member approval before saving humidor agent enrichment", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");
  const requestHandler = source.slice(source.indexOf("async function handleRequestHumidorEnrichment"), source.indexOf("async function handleApproveHumidorEnrichment"));
  const approveHandler = source.slice(source.indexOf("async function handleApproveHumidorEnrichment"), source.indexOf("function handleCancelHumidorEnrichmentApproval"));
  const cancelHandler = source.slice(source.indexOf("function handleCancelHumidorEnrichmentApproval"), source.indexOf("function renderContent"));
  const dialog = source.slice(source.indexOf("function HumidorEnrichmentApprovalDialog"), source.indexOf("function HumidorTable"));

  assert.ok(source.includes("pendingHumidorEnrichmentApproval"), "dashboard should track pending humidor agent updates awaiting approval");
  assert.ok(cigarSection.includes("handleRequestHumidorEnrichment"), "Ask Humidor Agent should request a preview instead of saving immediately");
  assert.ok(requestHandler.includes("approved: false"), "agent request should preview updates before persistence");
  assert.ok(requestHandler.includes("setPendingHumidorEnrichmentApproval"), "agent preview should open the approval popup");
  assert.ok(approveHandler.includes("approved: true"), "approval action should explicitly approve persistence");
  assert.ok(approveHandler.includes("setLiveState"), "approval action should update the local humidor only after saving");
  assert.ok(cancelHandler.includes("setPendingHumidorEnrichmentApproval(null)"), "canceling should discard pending agent updates");
  assert.ok(dialog.includes('role="dialog"'), "approval popup should render as a modal dialog");
  assert.ok(dialog.includes('aria-modal="true"'), "approval popup should mark the page background as modal");
  assert.ok(dialog.includes("Approve Updates"), "approval popup should expose an explicit approve button");
  assert.ok(dialog.includes("Cancel"), "approval popup should expose a cancel action");
});

test("my cigars opens member review popup when humidor agent has no saveable changes", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const requestHandler = source.slice(source.indexOf("async function handleRequestHumidorEnrichment"), source.indexOf("async function handleApproveHumidorEnrichment"));
  const dialog = source.slice(source.indexOf("function HumidorEnrichmentApprovalDialog"), source.indexOf("function HumidorTable"));

  assert.ok(source.includes("function shouldOpenHumidorEnrichmentApproval"), "dashboard should centralize preview/review popup routing");
  assert.ok(requestHandler.includes('response.enrichment.status === "needs_review"'), "needs-review agent responses should still open member review");
  assert.ok(requestHandler.includes("response.previewItem ?? response.item"), "legacy needs-review responses without previewItem should still have a review target");
  assert.ok(dialog.includes("No Updates To Approve"), "review popup should make no-change agent results clear");
  assert.ok(dialog.includes("changes.length > 0"), "approval should only be available when the agent found saveable changes");
});

test("my cigars ignores non-renderable placeholder cigar image paths", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const imageSrcHelper = source.slice(source.indexOf("function getHumidorCigarImageSrc"), source.indexOf("type HumidorEnrichmentGap"));

  assert.ok(imageSrcHelper.includes("isRenderableHumidorCigarImageSrc"), "image source helper should validate renderable paths before rendering");
  assert.equal(imageSrcHelper.includes("/^https:\\/\\/[^\\s"), false, "arbitrary HTTPS image URLs should not render when CSP will block them");
  assert.ok(imageSrcHelper.includes("classroom2\\.s3\\.us-east-1\\.amazonaws\\.com"), "signed humidor S3 image URLs should remain renderable");
  assert.ok(imageSrcHelper.includes("data:image"), "uploaded data URLs should remain renderable when present");
  assert.ok(imageSrcHelper.includes("product-[a-z-]+"), "known generated product assets should remain renderable");
  assert.equal(imageSrcHelper.includes("cigar-product.jpg"), false, "agent placeholder filenames should not become rendered image sources");
});

test("my cigars detail card can update a missing humidor location later", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");
  const detailCard = source.slice(source.indexOf("function HumidorDetailCard"), source.indexOf("function EmptyLiveState"));

  assert.ok(source.includes("updateHumidorItem"), "dashboard should call the live humidor item update API");
  assert.ok(source.includes('const [updatingHumidorItemId, setUpdatingHumidorItemId]'), "dashboard should track the saved cigar being updated");
  assert.ok(source.includes('const [humidorItemUpdateStatus, setHumidorItemUpdateStatus]'), "dashboard should keep item update status separate from enrichment status");
  assert.ok(source.includes("async function handleUpdateHumidorItem"), "dashboard should own the My Cigars item update mutation");
  assert.ok(cigarSection.includes("handleUpdateHumidorItem"), "My Cigars should pass the update action to the detail card");
  assert.ok(detailCard.includes("Update Location"), "detail cards should expose a location update action");
  assert.ok(detailCard.includes('aria-live="polite"'), "location update status should be announced accessibly");
  assert.ok(detailCard.includes("selectedStorageLocationKey"), "detail card should let the member choose a later location/tray option");
});

test("my cigars detail card chooses storage location from entered locations", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const cigarSection = getFunctionBlock(source, "renderCigars", "renderAging");
  const detailCard = source.slice(source.indexOf("function HumidorDetailCard"), source.indexOf("function EmptyLiveState"));

  assert.ok(source.includes("type HumidorStorageLocationOption = {"), "dashboard should derive structured storage choices");
  assert.ok(source.includes("function buildHumidorStorageOptionKey"), "storage choices should key location and tray together");
  assert.ok(source.includes("getHumidorStorageLocationOptions"), "dashboard should derive dropdown choices from entered humidor locations");
  assert.ok(source.includes("for (const location of profile.locations)"), "storage choices should include structured Add Locations entries");
  assert.ok(source.includes("for (const tray of location.trays)"), "humidor locations with trays should produce tray-level choices");
  assert.ok(source.includes("addOption(item.humidorLocation, item.tray)"), "storage choices should include existing item location/tray pairs");
  assert.ok(source.includes("const storageLocationOptions = useMemo"), "dashboard should memoize available humidor locations for detail cards");
  assert.ok(cigarSection.includes("storageLocationOptions={storageLocationOptions}"), "detail cards should receive the available storage locations");
  assert.ok(detailCard.includes("storageLocationOptions"), "detail card should accept storage location options");
  assert.ok(detailCard.includes('aria-label="Humidor location update"'), "location dropdown should keep the existing accessible label");
  assert.ok(detailCard.includes("<select"), "storage location update should be a dropdown");
  assert.ok(detailCard.includes("selectedStorageLocation"), "detail card should resolve the selected storage option");
  assert.ok(detailCard.includes("storageLocationOptions.map((option)"), "storage location dropdown should render entered location/tray choices");
  assert.ok(detailCard.includes("option.label"), "storage location dropdown should show tray-aware labels");
  assert.ok(
    detailCard.includes("onUpdate?.(item, { humidorLocation: selectedStorageLocation.humidorLocation, tray: selectedStorageLocation.tray });"),
    "detail card should update both humidor location and tray from a tray-level choice",
  );
  assert.equal(detailCard.includes('onChange={(event: ChangeEvent<HTMLInputElement>) => setHumidorLocationDraft'), false, "storage location update should not be a free-typed input");
});

test("settings tab saves saved humidor locations that feed add and device flows", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const settingsStart = source.indexOf("function renderSettings()");
  const settingsSection = source.slice(settingsStart, source.indexOf("\n  return (\n    <main", settingsStart));
  const aiSubmit = source.slice(source.indexOf("async function handleAiAdderSubmit"), source.indexOf("async function handleConfirmAiCigar"));
  const addItem = source.slice(source.indexOf("async function handleAddItem"), source.indexOf("async function handleEnrichHumidorItem"));
  const pairDevice = source.slice(source.indexOf("async function handlePairDevice"), source.indexOf("async function handleAiImageChange"));

  assert.ok(source.includes("humidorLocationProfile"), "dashboard should keep a member humidor location profile");
  assert.ok(settingsSection.includes("Add a location"), "settings should expose saved location controls");
  assert.ok(settingsSection.includes("handleSaveHumidorLocationProfile"), "profile form should save member-entered humidor/location info");
  assert.equal(settingsSection.includes("Default location"), false, "settings should not expose a manual default location field");
  assert.ok(settingsSection.includes("Save Locations"), "profile form should have an explicit save action");
  assert.ok(source.includes("humidorProfile: humidorLocationProfile"), "profile saves should persist through humidor preferences");
  assert.ok(source.includes("defaultLocation: getPrimaryHumidorProfileLocationName(nextLocations)"), "profile saves should derive the default location from saved locations");
  assert.ok(source.includes("getFormWithDefaultHumidorLocation"), "dashboard should centralize default location application");
  assert.ok(source.includes("previousDefaultLocation"), "profile changes should refresh fields that still contain the previous default");
  assert.ok(source.includes("currentLocation !== previousDefaultLocation.trim()"), "member-entered item locations should not be overwritten by profile changes");
  assert.ok(aiSubmit.includes("getFormWithDefaultHumidorLocation(buildHumidorFormFromSuggestion(response.suggestion))"), "AI-identified cigars should pull the saved default location");
  assert.ok(addItem.includes("buildHumidorPayload(getFormWithDefaultHumidorLocation(itemForm)"), "manual item saves should pull the saved default location");
  assert.ok(source.includes("getFormWithDefaultHumidorLocation(current, nextProfile, previousProfile.defaultLocation)"), "manual and AI forms should replace the old default after saving a new profile");
  assert.ok(pairDevice.includes("getDeviceFormWithDefaultHumidorLocation(humidorDeviceForm)"), "paired devices should pull the saved default location");
  assert.ok(source.includes("getDeviceFormWithDefaultHumidorLocation(current, nextProfile, previousProfile.defaultLocation)"), "paired devices should replace the old default after saving a new profile");
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
  assert.ok(
    demoHumidorItems.some((item) => item.cigarImage?.imageUrl || item.cigarImage?.dataUrl),
    "demo should show saved cigar images",
  );
});

test("anonymous humidor demo data uses generated cigar image assets instead of inline placeholders", () => {
  const imagePaths = demoHumidorItems.map((item) => {
    const cigarImage = item.cigarImage as ({ dataUrl?: string; imageUrl?: string } & NonNullable<typeof item.cigarImage>) | null;
    const imagePath = cigarImage?.imageUrl ?? cigarImage?.dataUrl ?? "";

    assert.ok(imagePath, `${item.name} should have a demo image path`);
    assert.match(imagePath, /^\/assets\/product-[a-z-]+\.png$/, `${item.name} should use a generated public cigar image`);
    assert.equal(cigarImage?.dataUrl?.startsWith("data:image") ?? false, false, `${item.name} should not use an inline placeholder data URL`);

    return imagePath;
  });

  assert.equal(new Set(imagePaths).size, demoHumidorItems.length, "each demo cigar should have its own image");

  for (const imagePath of imagePaths) {
    const image = readPngAssetSize(imagePath);

    assert.ok(image.width >= 160, `${imagePath} width should support table thumbnails`);
    assert.ok(image.height >= 160, `${imagePath} height should support table thumbnails`);
    assert.ok(image.bytes >= 50000, `${imagePath} should retain enough generated image detail`);
  }
});

test("humidor dashboard blocks non-Cognito and non-member access from live records", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");

  assert.ok(source.includes('auth.isSignedIn && auth.authSource !== "cognito"'), "backup sessions must not call the live humidor API");
  assert.ok(source.includes("Local backup access cannot read or write live humidor records"));
  assert.ok(source.includes("Members Only"));
});

test("settings tab exposes the member device manager for HUMIDIFIER devices", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const settingsStart = source.indexOf("function renderSettings()");
  const settingsSection = source.slice(settingsStart, source.indexOf("\n  return (\n    <main", settingsStart));

  assert.ok(source.includes("defaultHumidorDeviceForm"), "settings should keep a device form state");
  assert.ok(source.includes("handlePairDevice"), "settings should pair devices through a dedicated pairing flow");
  assert.ok(source.includes("addHumidorDevice"), "settings should validate devices through the humidor device helper");
  assert.ok(source.includes("pairedDevices"), "paired devices should be persisted with humidor alert preferences");
  assert.ok(source.includes("climateAlertsEnabled: true"), "pairing should turn on climate alert preferences");
  assert.ok(source.includes("getOrCreatePushSubscription"), "pairing should connect the signed-in browser to phone push alerts");
  assert.ok(source.includes("Pair HUMIDIFIER"), "settings should expose a humidifier pairing button");
  assert.ok(source.includes("Pair Sensor"), "settings should expose a sensor pairing button");
  assert.ok(settingsSection.includes("HUMIDIFIER"), "settings device type selector should include HUMIDIFIER");
  assert.ok(settingsSection.includes("Paired Devices"), "settings should list paired devices after add");
  assert.equal(source.includes("applySmokeLogToCigars"), false);
});

test("settings tab searches available devices and pulls device details from the reading", () => {
  const source = readFileSync(new URL("../src/components/humidor-dashboard.tsx", import.meta.url), "utf8");
  const settingsStart = source.indexOf("function renderSettings()");
  const settingsSection = source.slice(settingsStart, source.indexOf("\n  return (\n    <main", settingsStart));

  assert.ok(source.includes("applyHumidorDeviceDiscovery"), "dashboard should use the shared discovery-to-form helper");
  assert.ok(source.includes("handleSearchHumidorDevice"), "settings should search available devices before pairing");
  assert.ok(source.includes('const [isSearchingHumidorDevices, setIsSearchingHumidorDevices]'), "settings should track device search state");
  assert.ok(settingsSection.includes("Search Available Devices"), "settings should expose a device search button");
  assert.ok(settingsSection.includes('aria-label="Search available humidor devices"'), "device search button should be accessible");
  assert.ok(settingsSection.includes('aria-label="Discovered device name"'), "device name should render as pulled device data");
  assert.ok(settingsSection.includes('aria-label="Discovered device ID"'), "device ID should render as pulled device data");
  assert.ok(settingsSection.includes('aria-label="Discovered humidity percent"'), "humidity should render as pulled device data");
  assert.ok(settingsSection.includes('aria-label="Discovered temperature"'), "temperature should render as pulled device data");
  assert.ok(settingsSection.includes("readOnly"), "pulled device data fields should not be member-entered");
  assert.equal(settingsSection.includes('updateDeviceForm("name"'), false, "device name should not be manually typed in settings");
  assert.equal(settingsSection.includes('updateDeviceForm("identifier"'), false, "device ID should not be manually typed in settings");
  assert.equal(settingsSection.includes('updateDeviceForm("humidity"'), false, "humidity should not be manually typed in settings");
  assert.equal(settingsSection.includes('updateDeviceForm("temperature"'), false, "temperature should not be manually typed in settings");
});
