import type { Metadata } from "next";
import Link from "@/components/static-link";

import { AutoUpdatingEventGrid } from "@/components/auto-updating-event-grid";
import { CuratedEventsExplorer } from "@/components/curated-events-explorer";
import { ReferenceImage } from "@/components/reference-image";
import { MemberViewBanner } from "@/components/member-view-banner";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { events } from "@/lib/data";

export const metadata: Metadata = {
  title: "Events | Yuzu Cigar Club",
  description:
    "Explore Yuzu Cigar Club private tastings, workshops, allocation nights, and member cigar events.",
  alternates: {
    canonical: "/events",
  },
  openGraph: {
    title: "Events | Yuzu Cigar Club",
    description:
      "Explore Yuzu Cigar Club private tastings, workshops, allocation nights, and member cigar events.",
    url: "/events",
  },
};

export default function EventsPage() {
  const initialNowIso = new Date().toISOString();

  return (
    <div className="mx-auto max-w-[1520px] px-5 py-8 lg:px-10">
      <section className="luxury-card grid overflow-hidden lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-center gap-6 p-8 lg:p-10">
          <SectionHeading
            kicker="Events"
            title="Private tastings, workshops, and allocation nights."
            copy="A calendar for lounge events, digital education sessions, and member-only release experiences."
          />
          <Button className="h-12 w-fit bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/membership" />}>
            Join for Invites
          </Button>
        </div>
        <ReferenceImage src="/assets/about-lounge.png" alt="Yuzu lounge event room" className="min-h-80" objectPosition="center" priority />
      </section>

      <MemberViewBanner context="site" className="mt-6" />

      <section data-events-section="yuzu" className="mt-10">
        <div className="mb-6">
          <SectionHeading
            kicker="Yuzu Events"
            title="Hosted tastings, workshops, and allocation nights."
            copy="Private Yuzu tastings, education nights, allocation releases, and member-first gatherings."
          />
        </div>
        <AutoUpdatingEventGrid events={events} initialNowIso={initialNowIso} />
      </section>

      <CuratedEventsExplorer />
    </div>
  );
}
