"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ExternalLink, MapPin } from "lucide-react";

import { useEventClock } from "@/components/event-clock";
import { AmbientPulse, Reveal } from "@/components/motion-primitives";
import { ReferenceImage } from "@/components/reference-image";
import { SectionHeading } from "@/components/section-heading";
import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";
import type { EventExperience } from "@/lib/data";
import { getAutoUpdatedEvents, getEventTimingLabel, getEventTimingStatus, getFeaturedEvent } from "@/lib/event-schedule";
import { buildEventImageAlt } from "@/lib/image-seo";
import {
  fetchPublishedEvents,
  livePublishedEventToExperience,
  type RuntimeEventExperience,
} from "@/lib/live-api";

type HomeEventFeatureProps = {
  events: EventExperience[];
  initialNowIso: string;
};

export function HomeEventFeature({ events, initialNowIso }: HomeEventFeatureProps) {
  const now = useEventClock(initialNowIso);
  const [feedEvents, setFeedEvents] = useState<Array<EventExperience | RuntimeEventExperience>>(() =>
    getAutoUpdatedEvents(events, new Date(initialNowIso)).slice(0, 3),
  );
  const [feedStatus, setFeedStatus] = useState<"loading" | "live" | "fallback">("loading");
  const [feedMessage, setFeedMessage] = useState("Checking the shared event calendar.");
  const featuredEvent = useMemo(() => getFeaturedEvent(feedEvents, now), [feedEvents, now]);

  useEffect(() => {
    let cancelled = false;
    const requestedAt = new Date();
    const through = new Date(requestedAt);
    through.setUTCFullYear(through.getUTCFullYear() + 1);

    void fetchPublishedEvents({ from: requestedAt.toISOString(), to: through.toISOString(), limit: 12 })
      .then((response) => {
        if (cancelled) {
          return;
        }

        if (response.persistence !== "stored" && response.events.length === 0) {
          throw new Error("The shared event feed is not ready yet.");
        }

        if (response.events.length) {
          setFeedEvents(response.events.map(livePublishedEventToExperience));
        }
        setFeedStatus("live");
        setFeedMessage(
          response.feed.lastSuccessfulSyncAt
            ? `Shared calendar refreshed ${formatFreshness(response.feed.lastSuccessfulSyncAt, new Date())}.`
            : response.events.length
              ? "Shared calendar is live."
              : "Shared calendar connected. Showing the latest verified event listing.",
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setFeedStatus("fallback");
        setFeedMessage("Showing the latest verified event listing while the shared calendar refreshes.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!featuredEvent) {
    return (
      <Reveal className="border border-yuzu-line bg-yuzu-panel p-6 md:p-8">
        <SectionHeading
          kicker="Upcoming Events"
          title="New Yuzu events are being scheduled."
          copy="Local lounge picks and daily event signals are still available on the events page."
        />
        <p className="mt-4 text-xs leading-5 text-yuzu-muted" data-home-event-feed-status={feedStatus} role="status">
          {feedMessage}
        </p>
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
        <p className="mt-4 text-xs leading-5 text-yuzu-muted" data-home-event-feed-status={feedStatus} role="status">
          {feedMessage}
        </p>
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
        {isLiveExternalEvent(featuredEvent) ? (
          <Button
            className="mt-7 h-11 w-fit bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light"
            render={<a href={featuredEvent.sourceUrl} rel="noreferrer" target="_blank" />}
          >
            View Event Source
            <ExternalLink data-icon="inline-end" />
          </Button>
        ) : (
          <Button className="mt-7 h-11 w-fit bg-yuzu-gold px-8 text-yuzu-ink hover:bg-yuzu-gold-light" render={<Link href="/events" />}>
            Explore Events
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </Reveal>
  );
}

function isLiveExternalEvent(
  event: EventExperience | RuntimeEventExperience,
): event is RuntimeEventExperience & { sourceUrl: string } {
  return "liveId" in event && event.externalSource && Boolean(event.sourceUrl);
}

function formatFreshness(value: string, now: Date) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "recently";
  }

  const minutes = Math.max(0, Math.round((now.getTime() - timestamp) / 60_000));

  if (minutes < 2) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}
