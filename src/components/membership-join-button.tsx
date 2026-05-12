"use client";

import { useState } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import type { MembershipBillingPeriod } from "@/lib/membership-pricing";
import { createMembershipCheckoutSession, getCheckoutErrorMessage } from "@/lib/stripe-checkout";
import { cn } from "@/lib/utils";

export type MembershipCartTier = {
  name: string;
  price: number;
  cadence: string;
  billingPeriod?: MembershipBillingPeriod;
};

type MembershipJoinButtonProps = {
  tier: MembershipCartTier;
  label?: string;
  labelEditableId?: string;
  className?: string;
  containerClassName?: string;
  variant?: "default" | "outline";
  showStatus?: boolean;
};

export function MembershipJoinButton({
  tier,
  label = `Join ${tier.name}`,
  labelEditableId,
  className,
  containerClassName,
  variant = "default",
  showStatus = true,
}: MembershipJoinButtonProps) {
  const auth = useBackupAuth();
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function joinTier() {
    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const session = await createMembershipCheckoutSession({
        tierName: tier.name,
        billingPeriod: tier.billingPeriod ?? "monthly",
        customer: {
          email: auth.session?.email ?? "",
          fullName: auth.session?.name ?? "",
        },
      });

      window.location.assign(session.url);
    } catch (error) {
      setStatusMessage(getCheckoutErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("grid gap-2", containerClassName)}>
      <Button type="button" className={className} variant={variant} onClick={joinTier} disabled={isSubmitting}>
        {isSubmitting ? "Opening checkout" : <span data-yuzu-editable={labelEditableId}>{label}</span>}
      </Button>
      {showStatus && statusMessage && (
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold" aria-live="polite" role="status">
          {statusMessage}
        </p>
      )}
    </div>
  );
}
