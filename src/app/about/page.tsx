import type { Metadata } from "next";
import Link from "@/components/static-link";
import type { LucideIcon } from "lucide-react";
import { Box, Headphones, Lock, Star, Tag } from "lucide-react";

import { MemberViewBanner } from "@/components/member-view-banner";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildPageMetadata } from "@/lib/seo";

const difference: Array<{ title: string; text: string; icon: LucideIcon }> = [
  { title: "Expert Curation", text: "Our team selects only boxes worth collecting.", icon: Box },
  { title: "Premium Quality", text: "Every cigar is authentic, fresh, and stored with care.", icon: Star },
  { title: "Member Pricing", text: "Better pricing on premium cigar boxes.", icon: Tag },
  { title: "Secure Access", text: "Age verification, protected data, and audit trails.", icon: Lock },
  { title: "Concierge Support", text: "Real people for recommendations and order help.", icon: Headphones },
];

export const metadata: Metadata = buildPageMetadata({
  title: "About | Yuzu Cigar Club",
  description:
    "Learn about Yuzu Cigar Club's premium cigar curation, member pricing, secure access, and concierge support.",
  path: "/about",
  image: "/assets/about-lounge.png",
  imageAlt: "Yuzu Cigar Club lounge and curated cigar boxes",
  keywords: ["cigar club", "premium cigar curation", "cigar concierge"],
});

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-yuzu-line">
        <ReferenceImage src="/assets/about-lounge.png" alt="Yuzu cigar club lounge and cigar boxes" className="absolute inset-y-0 right-0 w-full opacity-80" objectPosition="center" priority />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#030504_0%,rgba(3,5,4,0.92)_36%,rgba(3,5,4,0.42)_76%)]" />
        <div className="relative mx-auto flex min-h-[540px] max-w-[1520px] items-center px-5 py-16 lg:px-10">
          <SectionHeading
            kicker="The Yuzu Story"
            title="About Yuzu Cigar Club."
            copy="Yuzu Cigar Club was founded on a simple belief: enjoying exceptional cigars should be effortless, personal, and elevated."
          />
        </div>
      </section>

      <section className="mx-auto max-w-[1520px] px-5 pt-6 lg:px-10">
        <MemberViewBanner context="site" />
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-5 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <Card className="luxury-card overflow-hidden">
          <ReferenceImage src="/refs/about.png" alt="Aficionado enjoying a cigar" className="h-64" objectPosition="19% 45%" />
          <CardContent className="p-6">
            <p className="fine-label">Our Philosophy</p>
            <h2 className="mt-3 font-heading text-4xl text-yuzu-cream">Quality over quantity. Curation over clutter.</h2>
            <p className="mt-3 text-sm leading-6 text-yuzu-muted">
              We taste every blend, vet every partner, and only offer cigars we would smoke ourselves. No singles. No leftovers. Just full boxes worth your time.
            </p>
          </CardContent>
        </Card>
        <div className="grid gap-5 sm:grid-cols-2">
          {difference.map((item) => {
            const Icon = item.icon;
            return (
            <Card key={item.title} className="luxury-card">
              <CardContent className="flex gap-4 p-5">
                <Icon className="text-yuzu-gold" />
                <div>
                  <h3 className="font-heading text-2xl text-yuzu-gold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-yuzu-muted">{item.text}</p>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </section>

      <section className="border-y border-yuzu-line/70 bg-yuzu-forest/70">
        <div className="mx-auto grid max-w-[1520px] gap-5 px-5 py-10 md:grid-cols-5 lg:px-10">
          {["Sourcing", "Evaluation", "Curation", "Packing", "Delivery"].map((step, index) => (
            <div key={step} className="text-center">
              <div className="mx-auto grid size-12 place-items-center border border-yuzu-gold text-yuzu-gold">{index + 1}</div>
              <h3 className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-yuzu-gold">{step}</h3>
              <p className="mt-2 text-sm leading-6 text-yuzu-muted">
                {[
                  "We find exceptional blends.",
                  "Every box is reviewed.",
                  "The best blends make the cut.",
                  "Packed in premium materials.",
                  "Shipped securely to your door.",
                ][index]}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1520px] gap-8 px-5 py-14 lg:grid-cols-[1fr_0.8fr] lg:px-10">
        <SectionHeading
          kicker="Ready to elevate your humidor?"
          title="Join a community that enjoys cigars the right way."
          copy="Curated boxes, member pricing, concierge support, events, and digital humidor access in one place."
        />
        <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-end">
          <Button className="h-12 bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
            Join Yuzu
          </Button>
          <Button className="h-12 border-yuzu-gold px-8 text-yuzu-gold" variant="outline" render={<Link href="/humidor" />}>
            Explore Humidor
          </Button>
        </div>
      </section>
    </>
  );
}
