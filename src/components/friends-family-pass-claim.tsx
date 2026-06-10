"use client";

import Link from "@/components/static-link";
import { ArrowRight, CheckCircle2, LoaderCircle, LogIn } from "lucide-react";
import { useState } from "react";

import { useBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import { createMembershipCheckoutSession, getCheckoutErrorMessage } from "@/lib/stripe-checkout";

const friendsFamilyMembershipOffer = {
  code: "friends-family-box-pass",
  source: "friends-family-page",
  campaign: "friends-family-1-year-box-pass",
  landingPath: "/friends-family",
  access: "box_access_pass_1_year",
  trialPeriodDays: 365,
} as const;

export function FriendsFamilyPassClaim() {
  const auth = useBackupAuth();
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signedInEmail = auth.session?.email ?? "";

  async function claimPass() {
    if (!signedInEmail) {
      setStatusMessage("Sign in first so the pass can be attached to your Yuzu account.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const session = await createMembershipCheckoutSession({
        tierName: "Box Access Pass",
        billingPeriod: "yearly",
        customer: {
          email: signedInEmail,
          fullName: auth.session?.name ?? "",
        },
        membershipOffer: friendsFamilyMembershipOffer,
      });

      window.location.assign(session.url);
    } catch (error) {
      setStatusMessage(getCheckoutErrorMessage(error));
      setIsSubmitting(false);
    }
  }

  async function signInFirst() {
    setStatusMessage("");

    if (auth.isCognitoConfigured) {
      setIsSubmitting(true);
      try {
        const result = await auth.startCognitoLogin({ redirectPath: "/friends-family" });
        setStatusMessage(result.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    window.location.assign("/account");
  }

  return (
    <div id="claim-pass" className="scroll-mt-24 grid gap-6 border border-yuzu-gold/70 bg-yuzu-panel/90 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.34)] sm:p-6">
      <div className="flex items-start justify-between gap-4 border-b border-yuzu-line/70 pb-5">
        <div className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold">Annual Box Access</p>
          <p className="font-heading text-4xl leading-none text-yuzu-cream">$179</p>
          <p className="text-sm leading-6 text-yuzu-muted">Friends & Family invitation applies 1 year of Box Access Pass access at checkout.</p>
        </div>
        <div className="grid size-14 place-items-center border border-yuzu-gold/60 bg-yuzu-gold/10 text-yuzu-gold" aria-hidden="true">
          <CheckCircle2 className="size-6" />
        </div>
      </div>

      <div className="grid gap-3 text-sm leading-6 text-yuzu-muted">
        <div className="flex items-center justify-between gap-4 border border-yuzu-line/65 bg-yuzu-night/55 p-4">
          <span className="font-bold uppercase tracking-[0.14em] text-yuzu-gold">Account</span>
          <span className="min-w-0 truncate text-right text-yuzu-cream">{signedInEmail || "Not signed in"}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="border border-yuzu-line/65 bg-yuzu-night/45 p-4">
            <p className="font-bold uppercase tracking-[0.14em] text-yuzu-gold">Access</p>
            <p className="mt-2 text-yuzu-cream">Member-cost cigar boxes</p>
          </div>
          <div className="border border-yuzu-line/65 bg-yuzu-night/45 p-4">
            <p className="font-bold uppercase tracking-[0.14em] text-yuzu-gold">Term</p>
            <p className="mt-2 text-yuzu-cream">1 year Box Access Pass</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {signedInEmail ? (
          <Button type="button" className="h-12 bg-yuzu-gold px-6 text-yuzu-ink hover:bg-yuzu-gold-light" onClick={claimPass} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
            {isSubmitting ? "Opening checkout" : "Claim 1-Year Pass"}
            {!isSubmitting ? <ArrowRight data-icon="inline-end" /> : null}
          </Button>
        ) : (
          <Button type="button" className="h-12 border-yuzu-gold px-6 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" onClick={signInFirst} variant="outline" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <LogIn data-icon="inline-start" />}
            Sign in first
          </Button>
        )}
        <p className="min-h-5 text-sm font-semibold text-yuzu-gold" aria-live="polite" role="status">
          {statusMessage}
        </p>
        <p className="text-xs leading-5 text-yuzu-muted">
          Already have an account issue or need help? <Link href="/contact" className="text-yuzu-gold underline-offset-4 hover:underline">Contact concierge support</Link>.
        </p>
      </div>
    </div>
  );
}
