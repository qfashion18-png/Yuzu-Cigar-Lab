import type { Metadata } from "next";
import { CalendarDays, Gift, KeyRound, PackageCheck, ShieldCheck, Tag, Warehouse } from "lucide-react";

import { FriendsFamilyPassClaim } from "@/components/friends-family-pass-claim";
import { ReferenceImage } from "@/components/reference-image";
import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Friends & Family Box Pass | Yuzu Cigar Club",
  description:
    "Private Friends & Family invitation for 1 year of Yuzu Box Access Pass access, member-cost cigar boxes, and digital humidor tools.",
  path: "/friends-family",
  image: "/assets/membership-boxes.png",
  imageAlt: "Yuzu Cigar Club membership cigar boxes prepared for Box Access Pass members",
  keywords: ["Yuzu friends and family", "Box Access Pass", "member-cost cigar boxes"],
  noIndex: true,
});

const passBenefits = [
  {
    title: "Member-cost cigar boxes",
    copy: "Shop full boxes through the Box Access Pass catalog without traditional retail markup.",
    icon: Tag,
  },
  {
    title: "Private box drops",
    copy: "Watch for members-only allocations and limited box opportunities before they move wider.",
    icon: PackageCheck,
  },
  {
    title: "Digital humidor access",
    copy: "Track boxes, tasting notes, aging windows, storage, and reorder history in one collector view.",
    icon: Warehouse,
  },
];

const flowSteps = [
  {
    title: "Sign in",
    copy: "Use the Yuzu account that should receive the pass.",
    icon: KeyRound,
  },
  {
    title: "Claim",
    copy: "The invite opens yearly Box Access Pass checkout with the Friends & Family offer attached.",
    icon: Gift,
  },
  {
    title: "Collect",
    copy: "Use the pass for member-cost box access, private drops, and humidor tools.",
    icon: CalendarDays,
  },
];

export default function FriendsFamilyPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-yuzu-line/75 bg-yuzu-night">
        <ReferenceImage
          src="/assets/membership-boxes.png"
          alt="Yuzu cigar boxes arranged for a Friends and Family Box Pass invitation"
          className="absolute inset-y-0 right-0 h-full w-full opacity-80"
          objectPosition="64% center"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#030504_0%,rgba(3,5,4,0.98)_33%,rgba(3,5,4,0.72)_58%,rgba(3,5,4,0.22)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-yuzu-night to-transparent" />

        <div className="relative mx-auto grid min-h-[680px] max-w-[1520px] items-center gap-10 px-5 py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,0.62fr)] lg:px-10">
          <div className="max-w-4xl">
            <h1 className="font-heading text-6xl leading-[0.92] text-yuzu-cream sm:text-7xl lg:text-8xl">
              Friends & Family Box Pass
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-yuzu-cream/86 sm:text-xl">
              Claim 1 year of Box Access Pass access for member-cost cigar boxes, private box drops, and a cleaner way to track what belongs in your humidor.
            </p>
            <div className="mt-8 grid gap-3 border-l border-yuzu-gold/70 pl-5 text-sm leading-6 text-yuzu-muted sm:grid-cols-3 sm:border-l-0 sm:border-t sm:pl-0 sm:pt-5">
              {["1 year access", "Box Access Pass", "21+ members only"].map((detail) => (
                <div key={detail} className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center border border-yuzu-gold/55 text-yuzu-gold">
                    <ShieldCheck className="size-4" />
                  </span>
                  <span className="font-bold uppercase tracking-[0.14em] text-yuzu-cream">{detail}</span>
                </div>
              ))}
            </div>
            <Button className="mt-7 h-12 w-full bg-yuzu-gold px-6 text-yuzu-ink hover:bg-yuzu-gold-light sm:w-fit lg:hidden" render={<Link href="#claim-pass" />}>
              Claim 1-Year Pass
            </Button>
          </div>

          <FriendsFamilyPassClaim />
        </div>
      </section>

      <section className="border-b border-yuzu-line/70 bg-yuzu-forest/75">
        <div className="mx-auto grid max-w-[1520px] gap-6 px-5 py-12 lg:grid-cols-3 lg:px-10">
          {passBenefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <article key={benefit.title} className="border border-yuzu-line/65 bg-yuzu-night/45 p-6">
                <div className="grid size-12 place-items-center border border-yuzu-gold/55 bg-yuzu-gold/10 text-yuzu-gold">
                  <Icon className="size-5" />
                </div>
                <h2 className="mt-5 font-heading text-2xl leading-tight text-yuzu-cream">{benefit.title}</h2>
                <p className="mt-3 text-sm leading-6 text-yuzu-muted">{benefit.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-8 px-5 py-14 lg:grid-cols-[0.72fr_1fr] lg:px-10">
        <div className="max-w-2xl">
          <h2 className="font-heading text-4xl leading-tight text-yuzu-cream sm:text-5xl">A quiet pass into the box room.</h2>
          <p className="mt-5 text-base leading-7 text-yuzu-muted">
            This private invite is not linked from the main site. It is meant for people who already know Yuzu through friends, family, or the founder table.
          </p>
        </div>
        <div className="grid gap-4">
          {flowSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article key={step.title} className="grid gap-4 border border-yuzu-line/70 bg-yuzu-panel/75 p-5 sm:grid-cols-[auto_1fr]">
                <div className="flex items-center gap-4">
                  <span className="font-heading text-3xl text-yuzu-gold">{index + 1}</span>
                  <span className="grid size-11 place-items-center border border-yuzu-gold/55 bg-yuzu-night text-yuzu-gold">
                    <Icon className="size-5" />
                  </span>
                </div>
                <div>
                  <h3 className="font-heading text-2xl text-yuzu-cream">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-yuzu-muted">{step.copy}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1520px] px-5 pb-16 lg:px-10">
        <div className="grid gap-5 border border-yuzu-line/70 bg-yuzu-night/55 p-5 text-sm leading-6 text-yuzu-muted sm:grid-cols-[auto_1fr] sm:p-6">
          <ShieldCheck className="size-6 text-yuzu-gold" />
          <p>
            Yuzu Cigar Club is for adults 21+. Product availability, member-cost box access, shipping eligibility, taxes, and adult-signature requirements can vary by location and inventory.
          </p>
        </div>
      </section>
    </>
  );
}
