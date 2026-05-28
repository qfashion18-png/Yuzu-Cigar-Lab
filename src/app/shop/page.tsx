import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "@/components/static-link";
import { Check, Crown, Truck } from "lucide-react";

import { LocalActionButton } from "@/components/local-action-button";
import { MembershipJoinButton } from "@/components/membership-join-button";
import { MemberViewBanner } from "@/components/member-view-banner";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import { ShopCatalog } from "@/components/shop-catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { storefrontCategories, storefrontProductCards } from "@/lib/catalog";
import { tiers } from "@/lib/data";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Shop Premium Cigar Boxes | Yuzu Cigar Club",
  description:
    "Browse Yuzu Cigar Club premium cigar boxes, curated releases, member drops, and catalog inventory with adult-signature checkout.",
  path: "/shop",
  image: "/assets/shop-hero.png",
  imageAlt: "Premium cigar boxes in the Yuzu shop",
  keywords: ["premium cigar boxes", "cigar box catalog", "adult signature cigar delivery"],
});

const limitedDropCountdown = [
  { value: "04", label: "Days" },
  { value: "18", label: "Hrs" },
  { value: "32", label: "Mins" },
  { value: "47", label: "Secs" },
];

const categoryParamKey = "category";

function getShopCategoryHref(category: string) {
  const params = new URLSearchParams({ [categoryParamKey]: category });

  return `/shop/?${params.toString()}#catalog`;
}

function ShopCatalogFallback() {
  return (
    <div className="grid gap-4 border border-yuzu-line/70 bg-yuzu-panel/70 p-4" aria-label="Loading catalog">
      <div className="h-11 max-w-xl animate-pulse rounded-sm bg-yuzu-line/25" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className="h-10 w-32 shrink-0 animate-pulse border border-yuzu-line/60 bg-yuzu-night/65" />
        ))}
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <div className="mx-auto grid max-w-[1520px] gap-7 px-5 py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-10 2xl:grid-cols-[220px_minmax(0,1fr)_260px]">
      <aside className="hidden flex-col gap-7 lg:flex">
        <div>
          <h1 className="border-b border-yuzu-line/70 pb-3 text-sm font-bold uppercase tracking-[0.16em] text-yuzu-gold">Shop Boxes</h1>
        </div>
        <div>
          <h2 className="border-b border-yuzu-line/70 pb-3 text-sm font-bold uppercase tracking-[0.16em] text-yuzu-gold">Categories</h2>
          <div className="mt-3 grid gap-2 text-sm text-yuzu-muted">
            {storefrontCategories.slice(0, 6).map((category) => (
              <Link key={category} href={getShopCategoryHref(category)} className="border border-yuzu-line/65 bg-yuzu-night/70 px-3 py-2 transition hover:border-yuzu-gold hover:text-yuzu-gold">
                {category}
              </Link>
            ))}
          </div>
        </div>
        <Button className="h-11 border-yuzu-gold text-yuzu-gold hover:bg-yuzu-gold hover:text-yuzu-ink" variant="outline" render={<Link href="#catalog" />}>
          Open Catalog Search
        </Button>
      </aside>

      <div className="flex flex-col gap-7">
        <section className="grid overflow-hidden border border-yuzu-line/80 bg-yuzu-panel lg:grid-cols-[1fr_0.9fr]">
          <div className="flex min-w-0 flex-col justify-center gap-6 p-8 lg:p-10">
            <SectionHeading
              kicker="Curated. Exclusive. Delivered monthly."
              title="Exceptional Cigars. Curated for You."
              copy="Join Yuzu Cigar Club and receive hand-selected premium cigar boxes, member pricing, and early access to limited drops."
            />
            <Button className="h-12 w-fit bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
              Explore Membership
            </Button>
          </div>
          <ReferenceImage src="/assets/shop-hero.png" alt="Premium cigar box in shop hero" className="min-h-80" objectPosition="center" priority />
        </section>

        <MemberViewBanner context="shop" />

        <section>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">Choose your membership tier</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => (
              <Card key={tier.name} className="luxury-card">
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="grid gap-1">
                    {tier.featured && <span className="w-fit text-[0.65rem] font-bold uppercase tracking-[0.12em] text-yuzu-gold sm:hidden">Popular</span>}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-heading text-2xl uppercase tracking-[0.12em] text-yuzu-gold">{tier.name}</h2>
                        <p className="text-yuzu-cream">${tier.price} / month</p>
                      </div>
                      {tier.featured && <span className="hidden shrink-0 pt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-yuzu-gold sm:inline">Popular</span>}
                    </div>
                  </div>
                  <ul className="grid gap-2 text-sm text-yuzu-muted">
                    {[tier.discount, tier.cadence, "Digital humidor access"].map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-yuzu-gold" />
                        <span className="leading-5">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <MembershipJoinButton
                    tier={{ name: tier.name, price: tier.price, cadence: tier.cadence }}
                    className={tier.featured ? "bg-yuzu-gold text-yuzu-ink hover:bg-yuzu-gold-light" : "border-yuzu-gold text-yuzu-gold"}
                    variant={tier.featured ? "default" : "outline"}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <Suspense fallback={<ShopCatalogFallback />}>
            <ShopCatalog products={storefrontProductCards} categories={storefrontCategories} />
          </Suspense>
        </section>
      </div>

      <aside className="hidden flex-col gap-5 2xl:flex">
        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.2em] text-yuzu-gold">Membership Benefits</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            {[
              ["Curated Monthly Boxes", "Hand-selected by experts, delivered to your door."],
              ["Member-Cost Boxes", "Every member can access direct member-cost box pricing."],
              ["Early Access", "Be first to shop new releases."],
              ["Store Perks", "5%, 10%, or 15% off eligible non-box products by tier."],
            ].map(([title, text]) => (
              <div key={title} className="flex gap-3">
                <Crown className="text-yuzu-gold" />
                <div>
                  <h3 className="font-heading text-lg text-yuzu-gold">{title}</h3>
                  <p className="text-sm leading-6 text-yuzu-muted">{text}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="luxury-card">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.2em] text-yuzu-gold">Upcoming Limited Drop</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <h3 className="font-heading text-2xl text-yuzu-cream">Opus X Society Reserve 2026</h3>
            <p className="text-sm leading-6 text-yuzu-muted">Extremely limited. Available June 8 at 10 AM local time.</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {limitedDropCountdown.map((item) => (
                <span key={item.label} className="grid h-14 place-items-center border border-yuzu-line px-1 text-yuzu-gold">
                  <span className="flex flex-col items-center justify-center gap-1 text-center font-bold uppercase leading-none tracking-[0.12em]">
                    <span className="text-xs">{item.value}</span>
                    <span className="text-[0.65rem]">{item.label}</span>
                  </span>
                </span>
              ))}
            </div>
            <LocalActionButton
              storageKey="yuzu-reminder-opus-x-society-reserve-2026"
              idleLabel="Set Reminder"
              completedLabel="Reminder Set"
              statusText="Allocation reminder saved on this device."
              className="h-11 border-yuzu-gold text-yuzu-gold"
              variant="outline"
              icon={<Truck data-icon="inline-start" />}
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
