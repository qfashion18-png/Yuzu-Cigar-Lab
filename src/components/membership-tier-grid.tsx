"use client";

import { useState } from "react";

import { MembershipCard } from "@/components/membership-card";
import { membershipBillingOptions, type MembershipBillingPeriod } from "@/lib/membership-pricing";
import { tiers } from "@/lib/data";
import { cn } from "@/lib/utils";

export function MembershipTierGrid() {
  const [billingPeriod, setBillingPeriod] = useState<MembershipBillingPeriod>("monthly");

  return (
    <div className="grid gap-5">
      <div className="flex justify-center">
        <div className="grid w-full max-w-md grid-cols-3 gap-1 border border-yuzu-line bg-yuzu-night/70 p-1">
          {membershipBillingOptions.map((option) => {
            const isSelected = billingPeriod === option.period;

            return (
              <button
                key={option.period}
                type="button"
                className={cn(
                  "h-11 px-3 text-xs font-bold uppercase tracking-[0.16em] transition focus-visible:ring-3 focus-visible:ring-yuzu-gold/45 focus-visible:outline-none sm:text-sm",
                  isSelected
                    ? "bg-yuzu-gold text-yuzu-ink shadow-[0_10px_30px_rgba(220,169,58,0.2)]"
                    : "text-yuzu-muted hover:bg-yuzu-forest hover:text-yuzu-gold"
                )}
                aria-pressed={isSelected}
                onClick={() => setBillingPeriod(option.period)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <MembershipCard key={tier.name} tier={tier} billingPeriod={billingPeriod} />
        ))}
      </div>
    </div>
  );
}
