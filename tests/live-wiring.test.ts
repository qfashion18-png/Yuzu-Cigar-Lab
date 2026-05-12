import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("checkout and cart do not create local production orders", () => {
  const cartProvider = source("../src/components/cart-provider.tsx");
  const shoppingCart = source("../src/lib/shopping-cart.ts");
  const checkoutExperience = source("../src/components/checkout-experience.tsx");

  assert.equal(cartProvider.includes("createLocalOrder"), false);
  assert.equal(cartProvider.includes("createOrder"), false);
  assert.equal(cartProvider.includes("orderStorageKey"), false);
  assert.equal(shoppingCart.includes("createLocalOrder"), false);
  assert.equal(shoppingCart.includes("LocalOrder"), false);
  assert.equal(checkoutExperience.includes("defaultPaymentMethods.map"), false);
  assert.ok(checkoutExperience.includes("checkoutPaymentMethods.map"));
});

test("account experience uses live API data instead of static member fixtures", () => {
  const accountExperience = source("../src/components/account-experience.tsx");

  assert.ok(accountExperience.includes("fetchAccountSummary"));
  assert.ok(accountExperience.includes("fetchAccountOrders"));
  assert.equal(accountExperience.includes('from "@/lib/data"'), false);
  assert.equal(accountExperience.includes("Ships on May 15, 2026"), false);
  assert.equal(accountExperience.includes('["Apr 15", "Mar 15", "Feb 15", "Jan 15"]'), false);
});

test("humidor experience keeps demo data anonymous and live data authenticated", () => {
  const humidorDashboard = source("../src/components/humidor-dashboard.tsx");
  const humidorDevices = source("../src/lib/humidor-devices.ts");
  const humidorAging = source("../src/lib/humidor-aging.ts");

  assert.ok(humidorDashboard.includes("fetchHumidorItems"));
  assert.ok(humidorDashboard.includes("createHumidorItem"));
  assert.ok(humidorDashboard.includes("demoHumidorItems"));
  assert.ok(humidorDashboard.includes("const items = isAnonymousDemo ? demoHumidorItems : liveState.items"));
  assert.equal(humidorDashboard.includes("startingCigars"), false);
  assert.equal(humidorDashboard.includes("startingReadings"), false);
  assert.equal(humidorDashboard.includes("startingLogs"), false);
  assert.equal(humidorDashboard.includes("yuzu-humidor-demo-mode"), false);
  assert.equal(humidorDevices.includes("createStartingHumidorDevices"), false);
  assert.equal(humidorAging.includes("fallbackItems"), false);
});

test("public environment contract points at live services, not dev commerce placeholders", () => {
  const envExample = source("../.env.example");
  const backupAuthPanel = source("../src/components/backup-auth-panel.tsx");
  const backupAuthProvider = source("../src/components/backup-auth-provider.tsx");
  const medusaProjection = source("../src/lib/commerce/medusa.ts");

  assert.match(envExample, /NEXT_PUBLIC_YCC_API_BASE_URL=https:\/\/api\.yuzucigarclub\.com/);
  assert.match(envExample, /NEXT_PUBLIC_REQUIRE_LIVE_AUTH=true/);
  assert.match(envExample, /NEXT_PUBLIC_ADMIN_APP_URL=https:\/\//);
  assert.equal(envExample.includes("dev.medusajs"), false);
  assert.equal(envExample.includes("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"), false);
  assert.equal(envExample.includes("NEXT_PUBLIC_MEDUSA_BACKEND_URL"), false);
  assert.ok(backupAuthPanel.includes("isLiveAuthRequiredForEnvironment"));
  assert.ok(backupAuthPanel.includes("NEXT_PUBLIC_REQUIRE_LIVE_AUTH"));
  assert.ok(backupAuthProvider.includes("includeAdminSeed: !liveAuthRequired"));
  assert.equal(medusaProjection.includes("NEXT_PUBLIC_MEDUSA"), false);
  assert.equal(medusaProjection.includes("medusaSeedProducts"), false);
});
