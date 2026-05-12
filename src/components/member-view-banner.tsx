"use client";

import Link from "@/components/static-link";
import { Crown, LockKeyhole, UserRound } from "lucide-react";

import { useOptionalBackupAuth } from "@/components/backup-auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MemberViewBannerProps = {
  context: "site" | "shop" | "drops" | "humidor" | "checkout";
  className?: string;
};

const copyByContext: Record<MemberViewBannerProps["context"], { member: string; nonMember: string; account: string }> = {
  site: {
    member: "Member view active across the site.",
    nonMember: "Non-member view active. Sign in or join to unlock member-cost boxes and private drops.",
    account: "Social account active. Choose a membership tier to unlock member benefits.",
  },
  shop: {
    member: "Member pricing view active: boxes show the member-cost promise and tier perks apply to eligible non-box products.",
    nonMember: "Public shop view active. Join to access direct member-cost boxes and private drops.",
    account: "Signed in as a non-member account. Choose a tier before using member-cost box access.",
  },
  drops: {
    member: "Member drop view active. Allocation priority follows tier, tenure, and purchase history.",
    nonMember: "Public drop preview active. Sign in and join before requesting member-only allocations.",
    account: "Account view active, but member-only drops require an active membership tier.",
  },
  humidor: {
    member: "Member humidor view active. Tracking, QR labels, and recommendations are unlocked.",
    nonMember: "Humidor preview active. Join to unlock collection tracking and member recommendations.",
    account: "Signed in as a non-member account. Join to unlock the full digital humidor.",
  },
  checkout: {
    member: "Member checkout view active. Tier shipping caps and non-box product perks can apply.",
    nonMember: "Public checkout view active. Sign in or join before using member perks.",
    account: "Signed in as a non-member account. Membership dues are required before member perks apply.",
  },
};

export function MemberViewBanner({ context, className }: MemberViewBannerProps) {
  const auth = useOptionalBackupAuth();

  if (!auth?.isReady) {
    return null;
  }

  const message = auth.isMember
    ? copyByContext[context].member
    : auth.isSignedIn
      ? copyByContext[context].account
      : copyByContext[context].nonMember;
  const Icon = auth.isMember ? Crown : auth.isSignedIn ? UserRound : LockKeyhole;

  return (
    <div className={cn("luxury-card p-4", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <Icon className="mt-0.5 shrink-0 text-yuzu-gold" />
          <div>
            <p className="fine-label">
              {auth.isMember ? `${auth.session?.membership.tier} Member` : auth.isSignedIn ? "Non-member Account" : "Non-member View"}
            </p>
            <p className="mt-1 text-sm leading-6 text-yuzu-muted">{message}</p>
          </div>
        </div>
        {!auth.isMember && (
          <div className="flex shrink-0 gap-2">
            {!auth.isSignedIn && (
              <Button className="h-10 border-yuzu-line text-yuzu-cream" variant="outline" render={<Link href="/account" />}>
                Log In
              </Button>
            )}
            <Button className="h-10 bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
              Join
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
