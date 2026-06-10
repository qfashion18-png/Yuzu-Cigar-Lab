import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

import { membershipPrepaidPricing, tiers, wholesaleCostDefinition } from "../src/lib/data";
import {
  getMembershipBilling,
  getMembershipStripePriceConfig,
  membershipBillingOptions,
  membershipStripePriceEnvKeys,
} from "../src/lib/membership-pricing";

test("membership tiers use wholesale box access with non-box store perks", () => {
  assert.deepEqual(
    tiers.map((tier) => [tier.name, tier.price, tier.monthlyCigars, tier.wholesaleBoxAccess, tier.shipping]),
    [
      ["Box Access Pass", 18, 0, "Wholesale boxes only", "Member pays shipping"],
      ["Kisha", 49, 4, "Wholesale boxes + member store perks", "Member pays shipping"],
      ["Sensei", 99, 8, "Wholesale boxes + stronger store perks", "Monthly cigar shipping included"],
      ["Daimyo", 199, 12, "Wholesale boxes + VIP access", "Monthly cigar shipping included"],
    ]
  );

  assert.equal(tiers.find((tier) => tier.name === "Kisha")?.discount, "5% off eligible non-box store products");
  assert.equal(tiers.find((tier) => tier.name === "Sensei")?.discount, "10% off eligible non-box store products");
  assert.equal(tiers.find((tier) => tier.name === "Daimyo")?.discount, "15% off eligible non-box store products");
  assert.equal(tiers.some((tier) => tier.discount.toLowerCase().includes("off boxes")), false);
});

test("only the three full membership tiers advertise digital humidor bulk import", () => {
  const bulkImportPlans = tiers
    .filter((tier) => tier.benefits.some((benefit) => benefit.toLowerCase().includes("bulk digital humidor import")))
    .map((tier) => tier.name);

  assert.deepEqual(bulkImportPlans, ["Kisha", "Sensei", "Daimyo"]);
  assert.equal(
    tiers.find((tier) => tier.name === "Box Access Pass")?.benefits.some((benefit) => benefit.toLowerCase().includes("bulk digital humidor import")),
    false,
  );
});

test("full monthly membership tiers describe online selection-list access", () => {
  const monthlyPlans = tiers.filter((tier) => tier.monthlyCigars > 0);
  const membershipKnowledge = readFileSync(new URL("../knowledge/ycc-kb/membership.md", import.meta.url), "utf8");

  assert.deepEqual(monthlyPlans.map((tier) => tier.name), ["Kisha", "Sensei", "Daimyo"]);

  for (const tier of monthlyPlans) {
    assert.match(tier.cadence, /curated selection list/i);
  }

  assert.match(membershipKnowledge, /preselected premium cigar list/i);
  assert.match(membershipKnowledge, /first come, first served/i);
  assert.match(membershipKnowledge, /still have monthly cigars available to select/i);
});

test("membership prepaid pricing and cost definition protect wholesale margins", () => {
  assert.deepEqual(
    membershipPrepaidPricing.map((plan) => [
      plan.name,
      plan.monthly,
      plan.quarterly,
      plan.quarterlySavings,
      plan.quarterlyEffective,
      plan.yearly,
      plan.yearlySavings,
      plan.yearlyEffective,
    ]),
    [
      ["Box Access Pass", 18, 49, 5, "16.33", 179, 37, "14.92"],
      ["Kisha", 49, 139, 8, "46.33", 499, 89, "41.58"],
      ["Sensei", 99, 279, 18, "93", 999, 189, "83.25"],
      ["Daimyo", 199, 559, 38, "186.33", 1999, 389, "166.58"],
    ]
  );

  assert.match(wholesaleCostDefinition.formula, /supplier cost/i);
  assert.match(wholesaleCostDefinition.formula, /payment-processing cost/i);
  assert.match(wholesaleCostDefinition.rule, /membership dues only/i);
});

test("membership knowledge base matches launch tier pricing", () => {
  const membershipKnowledge = readFileSync(new URL("../knowledge/ycc-kb/membership.md", import.meta.url), "utf8");

  assert.match(membershipKnowledge, /Box Access Pass: 18 dollars per month/);
  assert.match(membershipKnowledge, /Quarterly dues are 49 dollars/);
  assert.match(membershipKnowledge, /Yearly dues are 179 dollars/);
  assert.doesNotMatch(membershipKnowledge, /Box Access Pass: 10 dollars per month/);
});

test("membership billing selector exposes monthly quarterly and yearly pricing", () => {
  const sensei = tiers.find((tier) => tier.name === "Sensei");

  assert.ok(sensei);
  assert.deepEqual(
    membershipBillingOptions.map((option) => option.label),
    ["Monthly", "Quarterly", "Yearly"]
  );
  assert.deepEqual(
    ["monthly", "quarterly", "yearly"].map((period) => {
      const billing = getMembershipBilling(sensei, period as (typeof membershipBillingOptions)[number]["period"]);

      return [billing.period, billing.price, billing.priceCaption, billing.effectiveCaption];
    }),
    [
      ["monthly", 99, "/ month", "Billed monthly"],
      ["quarterly", 279, "/ quarter", "$93/mo effective"],
      ["yearly", 999, "/ year", "$83.25/mo effective"],
    ]
  );
});

test("membership tiers expose stable Stripe recurring price configuration keys", () => {
  assert.deepEqual(membershipStripePriceEnvKeys["Sensei"], {
    monthly: "STRIPE_PRICE_SENSEI_MONTHLY",
    quarterly: "STRIPE_PRICE_SENSEI_QUARTERLY",
    yearly: "STRIPE_PRICE_SENSEI_YEARLY",
  });
  assert.deepEqual(getMembershipStripePriceConfig("Daimyo", "yearly"), {
    tierName: "Daimyo",
    period: "yearly",
    envKey: "STRIPE_PRICE_DAIMYO_YEARLY",
    stripePriceId: null,
  });
});
