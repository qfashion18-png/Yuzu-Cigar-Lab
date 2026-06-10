"use client";

import { useMemo } from "react";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";

import { useEventClock } from "@/components/event-clock";
import { AmbientPulse, Reveal } from "@/components/motion-primitives";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";
import type { EventExperience } from "@/lib/data";
import { getEventTimingLabel, getEventTimingStatus, getFeaturedEvent } from "@/lib/event-schedule";
import { buildEventImageAlt } from "@/lib/image-seo";

type HomeEventFeatureProps = {
  events: EventExperience[];
  initialNowIso: string;
};

export function HomeEventFeature({ events, initialNowIso }: HomeEventFeatureProps) {
  const now = useEventClock(initialNowIso);
  const featuredEvent = useMemo(() => getFeaturedEvent(events, now), [events, now]);

  if (!featuredEvent) {
    return (
      <Reveal className="border border-yuzu-line bg-yuzu-panel p-6 md:p-8">
        <SectionHeading
          kicker="Upcoming Events"
          title="New Yuzu events are being scheduled."
          copy="Local lounge picks and daily event signals are still available on the events page."
        />
        <Button className="mt-7 h-11 w-fit bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/events" />}>
          Explore Events
          <ArrowRight data-icon="inline-end" />
        </Button>
      </Reveal>
    );
  }

  return (
    <Reveal className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
      <div
        className="relative min-h-[22rem] border border-yuzu-line/80 bg-yuzu-ink lg:min-h-[30rem] lg:border-r-0"
        data-event-status={getEventTimingStatus(featuredEvent, now)}
      >
        <AmbientPulse className="absolute inset-0 border border-yuzu-gold/25" />
        <ReferenceImage
          src={featuredEvent.image}
          alt={buildEventImageAlt(featuredEvent)}
          className="absolute inset-0"
          imageClassName="opacity-92"
          objectPosition={featuredEvent.imagePosition}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,4,0.04)_0%,rgba(3,5,4,0.28)_55%,rgba(3,5,4,0.82)_100%)]" />
        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-cream">
          <span className="border border-yuzu-gold/55 bg-yuzu-night/70 px-3 py-2 text-yuzu-gold backdrop-blur">{featuredEvent.date}</span>
          <span className="border border-yuzu-line bg-yuzu-night/70 px-3 py-2 backdrop-blur">{featuredEvent.access} access</span>
          <span className="border border-yuzu-line bg-yuzu-night/70 px-3 py-2 backdrop-blur">{getEventTimingLabel(featuredEvent, now)}</span>
        </div>
      </div>

      <div className="luxury-card flex flex-col justify-center p-6 md:p-8 lg:p-10">
        <SectionHeading
          kicker="Upcoming Events"
          title={featuredEvent.title}
          copy={featuredEvent.deck}
        />
        <div className="mt-6 grid gap-3 text-sm text-yuzu-muted sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-5 text-yuzu-gold" />
            {featuredEvent.time}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="size-5 text-yuzu-gold" />
            {featuredEvent.location}
          </p>
        </div>
        <Button className="mt-7 h-11 w-fit bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/events" />}>
          Explore Events
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </Reveal>
  );
}
