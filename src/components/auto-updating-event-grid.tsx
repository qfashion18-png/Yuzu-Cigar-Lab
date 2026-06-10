"use client";

import { useMemo } from "react";
import { ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";

import { useEventClock } from "@/components/event-clock";
import { ReferenceImage } from "@/components/reference-image";
import Link from "@/components/static-link";
import { Card, CardContent } from "@/components/ui/card";
import type { EventExperience } from "@/lib/data";
import { getAutoUpdatedEvents, getEventTimingLabel, getEventTimingStatus } from "@/lib/event-schedule";
import { buildEventImageAlt } from "@/lib/image-seo";

type AutoUpdatingEventGridProps = {
  events: EventExperience[];
  initialNowIso: string;
};

export function AutoUpdatingEventGrid({ events, initialNowIso }: AutoUpdatingEventGridProps) {
  const now = useEventClock(initialNowIso);
  const currentEvents = useMemo(() => getAutoUpdatedEvents(events, now), [events, now]);

  if (!currentEvents.length) {
    return (
      <div className="border border-yuzu-line bg-yuzu-panel p-6 text-sm leading-6 text-yuzu-muted" data-event-empty-state>
        No scheduled Yuzu events are active right now. The local guide below is still scanning daily lounge signals and nearby cigar spots.
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {currentEvents.map((event) => (
        <Link
          key={event.slug}
          href={`/events/${event.slug}/`}
          data-event-card={event.slug}
          data-event-status={getEventTimingStatus(event, now)}
          className="group block h-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yuzu-gold/60"
        >
          <Card className="luxury-card h-full py-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-yuzu-gold/80 group-hover:shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <ReferenceImage
              src={event.image}
              alt={buildEventImageAlt(event)}
              className="min-h-56 border-b border-yuzu-line"
              imageClassName="transition duration-500 group-hover:scale-105"
              objectPosition={event.imagePosition}
            />
            <CardContent className="flex flex-1 flex-col gap-5 p-6">
              <div className="flex items-center justify-between gap-4">
                <CalendarDays className="text-yuzu-gold" />
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold">{event.access}</span>
                  <span className="text-[0.64rem] font-black uppercase tracking-[0.16em] text-yuzu-muted">
                    {getEventTimingLabel(event, now)}
                  </span>
                </div>
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
  );
}
