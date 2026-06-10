import type { Metadata } from "next";
import Link from "@/components/static-link";
import { ArrowRight, CalendarCheck2, CalendarDays, ListChecks, ShieldCheck, Star } from "lucide-react";

import { BenefitStrip } from "@/components/benefit-strip";
import { MembershipJoinButton } from "@/components/membership-join-button";
import { MembershipTierGrid } from "@/components/membership-tier-grid";
import { MemberViewBanner } from "@/components/member-view-banner";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { benefits, membershipPrepaidPricing, tiers, welcomeKitRecommendations, wholesaleCostDefinition } from "@/lib/data";
import { buildPageMetadata } from "@/lib/seo";

const monthlySelectionDetails = [
  {
    title: "Preselected list",
    copy: "The monthly menu is curated before it goes live, so members know the premium cigars they are choosing from.",
    icon: ListChecks,
  },
  {
    title: "Selection day",
    copy: "When the online window opens, choices are claimed from the live list in order of request.",
    icon: CalendarCheck2,
  },
  {
    title: "Always covered",
    copy: "We hold enough monthly cigars for active members; waiting just means the most sought-after options may be gone.",
    icon: ShieldCheck,
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: "Membership | Yuzu Cigar Club",
  description:
    "Compare Yuzu Cigar Club membership tiers for monthly cigar selection windows, member-cost box access, private allocations, and digital humidor tools.",
  path: "/membership",
  image: "/assets/membership-boxes.png",
  imageAlt: "Yuzu Cigar Club membership cigar boxes",
  keywords: ["cigar membership", "member-cost cigar boxes", "monthly cigar selection windows", "monthly cigar selection"],
});

export default function MembershipPage() {
  const featuredTier = tiers.find((tier) => tier.featured) ?? tiers[0];

  return (
    <>
      <section className="relative overflow-hidden border-b border-yuzu-line">
        <ReferenceImage src="/assets/membership-boxes.png" alt="Yuzu membership cigar boxes prepared for club allocations" className="absolute inset-y-0 right-0 w-full opacity-75" objectPosition="center" priority />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#030504_0%,rgba(3,5,4,0.94)_38%,rgba(3,5,4,0.45)_70%,rgba(3,5,4,0.2)_100%)]" />
        <div className="relative mx-auto flex min-h-[520px] max-w-[1520px] items-center px-5 py-16 lg:px-10">
          <div className="max-w-3xl">
            <SectionHeading
              kicker="The Yuzu Cigar Club"
              title="Membership, built around member-cost boxes."
              copy="Every member can buy cigar boxes at direct member cost. Kisha, Sensei, and Daimyo members can select monthly cigars from a preselected online list, while store perks, shipping value, concierge access, and VIP allocations scale by tier."
              editableIds={{
                kicker: "membership.hero.kicker",
                title: "membership.hero.title",
                copy: "membership.hero.copy",
              }}
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <MembershipJoinButton
                tier={{ name: featuredTier.name, price: featuredTier.price, cadence: featuredTier.cadence }}
                label={`Join ${featuredTier.name}`}
                labelEditableId="membership.hero.primaryCta"
                className="h-12 bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light"
              />
              <Button className="h-12 border-yuzu-gold px-8 text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="#tiers" />}>
                <span data-yuzu-editable="membership.hero.secondaryCta">Compare Tiers</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1520px] px-5 pt-6 lg:px-10">
        <MemberViewBanner context="site" />
      </section>

      <section id="tiers" className="mx-auto max-w-[1520px] px-5 py-14 lg:px-10">
        <MembershipTierGrid />
      </section>

      <section className="border-y border-yuzu-line/70 bg-yuzu-night/45">
        <div className="mx-auto grid max-w-[1520px] gap-8 px-5 py-14 lg:grid-cols-[0.78fr_1.22fr] lg:px-10">
          <SectionHeading
            kicker="Monthly Selection Window"
            title="Pick from the curated list before your box ships."
            copy="On the monthly selection day, eligible members see the available premium cigar list online and choose what they want in their shipment."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {monthlySelectionDetails.map((detail) => {
              const Icon = detail.icon;

              return (
                <div key={detail.title} className="border border-yuzu-line/65 bg-yuzu-panel/80 p-5">
                  <Icon className="text-yuzu-gold" />
                  <h3 className="mt-4 font-heading text-2xl leading-tight text-yuzu-cream">{detail.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-yuzu-muted">{detail.copy}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-yuzu-line/70 bg-yuzu-forest/80">
        <div className="mx-auto grid max-w-[1520px] gap-8 px-5 py-14 lg:grid-cols-[0.72fr_1.28fr] lg:px-10">
          <SectionHeading
            kicker="Prepaid Dues"
            title="Clean quarterly and yearly savings."
            copy={wholesaleCostDefinition.rule}
          />
          <div className="overflow-x-auto border border-yuzu-line/70 bg-yuzu-night/70">
            <table className="min-w-[760px] text-left text-sm">
              <thead className="border-b border-yuzu-line text-xs uppercase tracking-[0.16em] text-yuzu-gold">
                <tr>
                  {["Plan", "Monthly", "Quarterly", "Quarterly effective", "Yearly", "Yearly effective"].map((heading) => (
                    <th key={heading} className="px-4 py-4 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-yuzu-line/70 text-yuzu-muted">
                {membershipPrepaidPricing.map((plan) => (
                  <tr key={plan.name}>
                    <td className="px-4 py-4 font-heading text-lg text-yuzu-cream">{plan.name}</td>
                    <td className="px-4 py-4">${plan.monthly}/mo</td>
                    <td className="px-4 py-4">${plan.quarterly}/qtr, save ${plan.quarterlySavings}</td>
                    <td className="px-4 py-4">${plan.quarterlyEffective}/mo</td>
                    <td className="px-4 py-4">${plan.yearly}/yr, save ${plan.yearlySavings}</td>
                    <td className="px-4 py-4">${plan.yearlyEffective}/mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <BenefitStrip />

      <section className="mx-auto grid max-w-[1520px] gap-8 px-5 py-14 lg:grid-cols-[0.8fr_1fr] lg:px-10">
        <SectionHeading
          kicker="The Yuzu Advantage"
          title="More than a membership. A better way to enjoy cigars."
          copy="Every tier includes a collector-grade digital humidor, member-only release windows, and a compliance-first checkout path."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <Card key={benefit.title} className="luxury-card">
                <CardContent className="flex gap-4 p-5">
                  <Icon className="text-yuzu-gold" />
                  <div>
                    <h3 className="font-heading text-xl text-yuzu-gold">{benefit.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-yuzu-muted">{benefit.text}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1520px] px-5 pb-14 lg:px-10">
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.22em] text-yuzu-gold">Welcome Kits</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {welcomeKitRecommendations.map((item) => (
              <div key={item.plan} className="grid gap-1 border border-yuzu-line/65 bg-yuzu-night/45 p-4">
                <p className="font-heading text-xl text-yuzu-cream">{item.plan}</p>
                <p className="text-sm leading-6 text-yuzu-muted">{item.kit}</p>
              </div>
            ))}
            <p className="text-xs leading-5 text-yuzu-muted">
              Bonus welcome cigars are one-time gifts and do not change the recurring monthly cigar count.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-8 px-5 pb-16 lg:grid-cols-[1fr_1fr] lg:px-10">
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.22em] text-yuzu-gold">Your Member Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Current Tier", "Sensei", "Member since May 2026"],
                ["Next Shipment", "June 15, 2026", "8 premium cigars"],
                ["Yuzu Points", "2,450", "Redeem for events and add-ons"],
              ].map(([label, value, note]) => (
                <div key={label} className="border border-yuzu-line/65 bg-yuzu-night/50 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-yuzu-muted">{label}</p>
                  <p className="mt-3 font-heading text-3xl text-yuzu-cream">{value}</p>
                  <p className="mt-2 text-sm text-yuzu-muted">{note}</p>
                </div>
              ))}
            </div>
            <Button className="h-12 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="/account" />}>
              Manage Membership
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>

        <Card className="luxury-card overflow-hidden">
          <ReferenceImage src="/assets/membership-boxes.png" alt="Yuzu club membership cigar box allocation detail" className="h-64" objectPosition="center" />
          <CardContent className="grid gap-4 p-6">
            <div className="flex items-center gap-3">
              <Star className="text-yuzu-gold" />
              <h3 className="font-heading text-2xl text-yuzu-cream">Club allocations stay fair.</h3>
            </div>
            <p className="text-sm leading-6 text-yuzu-muted">
              Member-only drops use allocation rules by tier, tenure, and purchase history. Admins can hold, approve, or release allocations with audit logs.
            </p>
            <div className="flex items-center gap-3 text-sm text-yuzu-muted">
              <CalendarDays className="text-yuzu-gold" />
              Next allocation opens June 8, 2026.
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
