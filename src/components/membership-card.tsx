import { Check } from "lucide-react";

import { MembershipJoinButton } from "@/components/membership-join-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { tiers } from "@/lib/data";
import { getMembershipBilling, type MembershipBillingPeriod } from "@/lib/membership-pricing";
import { cn } from "@/lib/utils";

type Tier = (typeof tiers)[number];

export function MembershipCard({
  tier,
  billingPeriod = "monthly",
}: {
  tier: Tier;
  billingPeriod?: MembershipBillingPeriod;
}) {
  const Icon = tier.icon;
  const billing = getMembershipBilling(tier, billingPeriod);

  return (
    <Card
      className={cn(
        "luxury-card relative",
        tier.featured && "border-yuzu-gold/90 bg-[radial-gradient(circle_at_top,rgba(221,170,61,0.15),transparent_38%),var(--color-yuzu-panel)] pt-8"
      )}
    >
      {tier.featured && (
        <Badge className="absolute left-1/2 top-3 -translate-x-1/2 border-yuzu-gold bg-yuzu-gold px-5 py-1 text-yuzu-ink">
          Most Popular
        </Badge>
      )}
      <CardHeader className="gap-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="grid size-14 place-items-center rounded-full border border-yuzu-gold/60 bg-yuzu-night/35 text-yuzu-gold">
            <Icon />
          </div>
          <div className="text-right">
            <p className="font-heading text-4xl text-yuzu-cream">${billing.price}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-yuzu-muted">{billing.priceCaption}</p>
          </div>
        </div>
        <div>
          <CardTitle className="font-heading text-3xl uppercase tracking-[0.14em] text-yuzu-gold">
            {tier.name}
          </CardTitle>
          <p className="mt-1 font-heading text-lg italic text-yuzu-cream/80">{tier.subtitle}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-6">
        <div className="grid gap-3 border-y border-yuzu-line py-5 text-sm text-yuzu-cream">
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-yuzu-line/65 bg-yuzu-night/55 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-yuzu-muted">Monthly cigars</p>
              <p className="mt-1 font-heading text-3xl text-yuzu-gold">{tier.monthlyCigars}</p>
            </div>
            <div className="border border-yuzu-line/65 bg-yuzu-night/55 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-yuzu-muted">{billing.duesLabel}</p>
              <p className="mt-1 font-heading text-3xl text-yuzu-gold">${billing.price}</p>
            </div>
          </div>
          <p>{tier.cadence}</p>
          <p className="text-yuzu-cream">{billing.effectiveCaption}</p>
          <p>{tier.wholesaleBoxAccess}</p>
          <p>{tier.shipping}</p>
          <p className="text-yuzu-gold">{tier.discount}</p>
          <p className="text-xs leading-5 text-yuzu-muted">{billing.savingsText}</p>
        </div>
        <ul className="grid gap-3 text-sm text-yuzu-muted">
          {tier.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <Check className="mt-0.5 text-yuzu-gold" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 border border-yuzu-line/65 bg-yuzu-night/45 p-4 text-xs leading-5 text-yuzu-muted">
          <p>
            <span className="font-bold uppercase tracking-[0.12em] text-yuzu-gold">Shipping</span> {tier.shippingNote}
          </p>
          <p>
            <span className="font-bold uppercase tracking-[0.12em] text-yuzu-gold">Welcome</span> {tier.welcomeKit}
          </p>
        </div>
      </CardContent>
      <CardFooter className="border-0 bg-transparent p-6">
        <MembershipJoinButton
          tier={{ name: tier.name, price: billing.price, cadence: billing.cartCadence, billingPeriod: billing.period }}
          containerClassName="w-full"
          className={cn(
            "h-11 w-full border-yuzu-gold uppercase tracking-[0.16em]",
            tier.featured
              ? "bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light"
              : "bg-transparent text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink"
          )}
          variant={tier.featured ? "default" : "outline"}
        />
      </CardFooter>
    </Card>
  );
}
