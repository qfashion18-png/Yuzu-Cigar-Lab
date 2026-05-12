export type MembershipBillingPeriod = "monthly" | "quarterly" | "yearly";
export type MembershipStripeTierName = "Box Access Pass" | "Kisha" | "Sensei" | "Daimyo";

export const membershipBillingOptions: {
  period: MembershipBillingPeriod;
  label: string;
}[] = [
  { period: "monthly", label: "Monthly" },
  { period: "quarterly", label: "Quarterly" },
  { period: "yearly", label: "Yearly" },
];

type MembershipPricedTier = {
  price: number;
  cadence: string;
  prepaid: {
    quarterly: number;
    quarterlySavings: number;
    quarterlyEffective: string;
    yearly: number;
    yearlySavings: number;
    yearlyEffective: string;
  };
};

export const membershipStripePriceEnvKeys: Record<MembershipStripeTierName, Record<MembershipBillingPeriod, string>> = {
  "Box Access Pass": {
    monthly: "STRIPE_PRICE_BOX_ACCESS_PASS_MONTHLY",
    quarterly: "STRIPE_PRICE_BOX_ACCESS_PASS_QUARTERLY",
    yearly: "STRIPE_PRICE_BOX_ACCESS_PASS_YEARLY",
  },
  Kisha: {
    monthly: "STRIPE_PRICE_KISHA_MONTHLY",
    quarterly: "STRIPE_PRICE_KISHA_QUARTERLY",
    yearly: "STRIPE_PRICE_KISHA_YEARLY",
  },
  Sensei: {
    monthly: "STRIPE_PRICE_SENSEI_MONTHLY",
    quarterly: "STRIPE_PRICE_SENSEI_QUARTERLY",
    yearly: "STRIPE_PRICE_SENSEI_YEARLY",
  },
  Daimyo: {
    monthly: "STRIPE_PRICE_DAIMYO_MONTHLY",
    quarterly: "STRIPE_PRICE_DAIMYO_QUARTERLY",
    yearly: "STRIPE_PRICE_DAIMYO_YEARLY",
  },
};

export function getMembershipStripePriceConfig(tierName: string, period: MembershipBillingPeriod) {
  const normalizedTier = normalizeMembershipStripeTierName(tierName);
  const envKey = normalizedTier ? membershipStripePriceEnvKeys[normalizedTier][period] : null;

  return {
    tierName,
    period,
    envKey,
    stripePriceId: null,
  };
}

export function getMembershipBilling(tier: MembershipPricedTier, period: MembershipBillingPeriod) {
  if (period === "quarterly") {
    return {
      period,
      price: tier.prepaid.quarterly,
      priceCaption: "/ quarter",
      duesLabel: "Quarterly dues",
      effectiveCaption: `$${tier.prepaid.quarterlyEffective}/mo effective`,
      savingsText: `Save $${tier.prepaid.quarterlySavings} each quarter compared with monthly dues.`,
      cartCadence: `${tier.cadence}; quarterly prepaid dues`,
    };
  }

  if (period === "yearly") {
    return {
      period,
      price: tier.prepaid.yearly,
      priceCaption: "/ year",
      duesLabel: "Yearly dues",
      effectiveCaption: `$${tier.prepaid.yearlyEffective}/mo effective`,
      savingsText: `Save $${tier.prepaid.yearlySavings} each year compared with monthly dues.`,
      cartCadence: `${tier.cadence}; yearly prepaid dues`,
    };
  }

  return {
    period,
    price: tier.price,
    priceCaption: "/ month",
    duesLabel: "Monthly dues",
    effectiveCaption: "Billed monthly",
    savingsText: "Prepay quarterly or yearly to unlock dues savings.",
    cartCadence: tier.cadence,
  };
}

function normalizeMembershipStripeTierName(tierName: string): MembershipStripeTierName | null {
  const match = (Object.keys(membershipStripePriceEnvKeys) as MembershipStripeTierName[]).find(
    (candidate) => candidate.toLowerCase() === tierName.trim().toLowerCase()
  );

  return match ?? null;
}
