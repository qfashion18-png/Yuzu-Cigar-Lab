import type { Metadata } from "next";
import Link from "@/components/static-link";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";

import { CuratedEventsExplorer } from "@/components/curated-events-explorer";
import { ReferenceImage } from "@/components/reference-image";
import { MemberViewBanner } from "@/components/member-view-banner";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        <div className="grid gap-5 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.slug}
              href={`/events/${event.slug}/`}
              data-event-card={event.slug}
              className="group block h-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yuzu-gold/60"
            >
              <Card className="luxury-card h-full py-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-yuzu-gold/80 group-hover:shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
                <ReferenceImage
                  src={event.image}
                  alt={`${event.title} event preview`}
                  className="min-h-56 border-b border-yuzu-line"
                  imageClassName="transition duration-500 group-hover:scale-105"
                  objectPosition={event.imagePosition}
                />
                <CardContent className="flex flex-1 flex-col gap-5 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <CalendarDays className="text-yuzu-gold" />
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold">{event.access}</span>
                  </div>
                  <div>
                    <h2 className="font-heading text-3xl text-yuzu-cream">{event.title}</h2>
                    <p className="mt-2 text-yuzu-gold">{event.date}</p>
                  </div>
                  <p className="text-sm leading-6 text-yuzu-muted">{event.deck}</p>
                  <div className="mt-auto grid gap-3 text-sm text-yuzu-muted">
                    <p className="flex items-center gap-2">
                      <MapPin className="text-yuzu-gold" /> {event.location}
                    </p>
                    <p className="flex items-center gap-2">
                      <Users className="text-yuzu-gold" /> {event.capacity}
                    </p>
                    <p className="inline-flex items-center gap-2 pt-2 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold">
                      View Details <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <CuratedEventsExplorer />
    </div>
  );
}
