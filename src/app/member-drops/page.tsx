import type { Metadata } from "next";
import Link from "@/components/static-link";
import { Bell, LockKeyhole } from "lucide-react";

import { LocalActionButton } from "@/components/local-action-button";
import { MemberViewBanner } from "@/components/member-view-banner";
import { ProductCard } from "@/components/product-card";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { featuredLuxuryProducts } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Member Drops | Yuzu Cigar Club",
  description:
    "Preview rare Yuzu Cigar Club member-only cigar drops, allocation windows, and waitlist releases.",
  path: "/member-drops",
  image: "/assets/shop-hero.png",
  imageAlt: "Rare member-only cigar box drop",
  keywords: ["member cigar drops", "rare cigar boxes", "cigar allocation windows"],
});

export default function MemberDropsPage() {
  const drops = featuredLuxuryProducts;

  return (
    <div className="mx-auto max-w-[1520px] px-5 py-8 lg:px-10">
      <section className="luxury-card grid overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-center gap-6 p-8 lg:p-10">
          <SectionHeading
            kicker="Member-only Drops"
            title="Rare boxes released with allocation rules."
            copy="Drops are tier-aware, quantity-limited, and held behind verified member accounts so allocations stay fair."
          />
          <Button className="h-12 w-fit bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
            <LockKeyhole data-icon="inline-start" />
            Unlock Drops
          </Button>
        </div>
        <ReferenceImage src="/assets/shop-hero.png" alt="Member-only cigar drop" className="min-h-80" objectPosition="center" priority />
      </section>

      <MemberViewBanner context="drops" className="mt-6" />

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {drops.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <Card className="luxury-card">
          <CardContent className="flex flex-col gap-5 p-6">
            <Bell className="text-yuzu-gold" />
            <h2 className="font-heading text-3xl text-yuzu-cream">Next allocation opens June 8.</h2>
            <p className="text-sm leading-6 text-yuzu-muted">
              Sensei and Daimyo members receive early email and SMS reminders before public waitlist release.
            </p>
            <LocalActionButton
              storageKey="yuzu-reminder-member-drops-june-8"
              idleLabel="Set Reminder"
              completedLabel="Reminder Set"
              statusText="Member-drop reminder saved on this device."
              className="h-11 border-yuzu-gold text-yuzu-gold"
              variant="outline"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
