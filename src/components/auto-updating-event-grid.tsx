"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ExternalLink, LocateFixed, MapPin, Users } from "lucide-react";

import { useEventClock } from "@/components/event-clock";
import { ReferenceImage } from "@/components/reference-image";
import Link from "@/components/static-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EventExperience } from "@/lib/data";
import {
  rankEventsForLocation,
  type EventCoordinates,
  type EventFeedExperience,
} from "@/lib/event-import-agent";
import { getAutoUpdatedEvents, getEventTimingLabel, getEventTimingStatus } from "@/lib/event-schedule";
import { buildEventImageAlt } from "@/lib/image-seo";
import {
  fetchPublishedEvents,
  livePublishedEventToExperience,
  type RuntimeEventExperience,
} from "@/lib/live-api";

type AutoUpdatingEventGridProps = {
  events: EventExperience[];
  initialNowIso: string;
};

type DisplayEvent = EventFeedExperience &
  Partial<Pick<RuntimeEventExperience, "externalSource" | "liveId" | "sourceType">>;

type FeedStatus = "loading" | "live" | "fallback";

export function AutoUpdatingEventGrid({ events, initialNowIso }: AutoUpdatingEventGridProps) {
  const now = useEventClock(initialNowIso);
  const [feedEvents, setFeedEvents] = useState<DisplayEvent[]>(() =>
    getAutoUpdatedEvents(events, new Date(initialNowIso)).slice(0, 3),
  );
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("loading");
  const [feedMessage, setFeedMessage] = useState("Checking the shared event calendar for updates.");
  const [lastSuccessfulSyncAt, setLastSuccessfulSyncAt] = useState<string | null>(null);
  const [userCoordinates, setUserCoordinates] = useState<EventCoordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [locationMessage, setLocationMessage] = useState("Showing upcoming events by date.");
  const currentEvents = useMemo(() => {
    const activeEvents = getAutoUpdatedEvents(feedEvents, now);

    if (!userCoordinates) {
      return activeEvents;
    }

    return rankEventsForLocation(activeEvents, userCoordinates);
  }, [feedEvents, now, userCoordinates]);

  useEffect(() => {
    let cancelled = false;
    const requestedAt = new Date();
    const through = new Date(requestedAt);
    through.setUTCFullYear(through.getUTCFullYear() + 1);

    void fetchPublishedEvents({ from: requestedAt.toISOString(), to: through.toISOString(), limit: 60 })
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
        setLastSuccessfulSyncAt(response.feed.lastSuccessfulSyncAt);
        setFeedStatus("live");
        setFeedMessage(
          response.events.length
            ? `Live calendar loaded with ${response.events.length} upcoming event${response.events.length === 1 ? "" : "s"}.`
            : "Shared calendar connected. Showing the latest verified event listings.",
        );
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setFeedStatus("fallback");
        setFeedMessage("Showing the latest verified event listings while the shared calendar refreshes.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("Browser location is unavailable on this device.");
      return;
    }

    setLocationStatus("loading");
    setLocationMessage("Finding nearby cigar events.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("ready");
        setLocationMessage("Showing nearby events first.");
      },
      (error) => {
        setLocationStatus("error");
        setLocationMessage(getGeolocationErrorMessage(error));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10 * 60 * 1000,
        timeout: 8000,
      },
    );
  }

  return (
    <div className="grid gap-5" data-location-aware-event-feed>
      <div className="flex flex-col gap-4 border border-yuzu-line bg-yuzu-panel/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">Local Event Feed</p>
          <p className="mt-1 text-sm leading-6 text-yuzu-muted" data-event-feed-status={feedStatus} role="status">
            {feedMessage} {locationMessage}
          </p>
          {lastSuccessfulSyncAt ? (
            <p className="mt-1 text-xs text-yuzu-muted/80">Calendar sync {formatFeedFreshness(lastSuccessfulSyncAt, now)}.</p>
          ) : null}
        </div>
        <Button
          className="h-11 shrink-0 rounded-none border-yuzu-line bg-transparent px-5 text-xs font-black uppercase tracking-[0.16em] text-yuzu-cream hover:border-yuzu-gold hover:text-yuzu-gold"
          disabled={locationStatus === "loading"}
          onClick={handleUseLocation}
          type="button"
          variant="outline"
        >
          <LocateFixed data-icon="inline-start" />
          {locationStatus === "loading" ? "Locating" : "Use My Location"}
        </Button>
      </div>

      {currentEvents.length ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {currentEvents.map((event) => (
            <EventCard key={`${event.slug}-${event.imported ? "imported" : "static"}`} event={event} now={now} />
          ))}
        </div>
      ) : (
        <div className="border border-yuzu-line bg-yuzu-panel p-6 text-sm leading-6 text-yuzu-muted" data-event-empty-state>
          No scheduled Yuzu events are active right now. The local guide below is still scanning daily lounge signals and nearby cigar spots.
        </div>
      )}
    </div>
  );
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location access is blocked. Allow location for this site in your browser settings, then try again.";
    case error.POSITION_UNAVAILABLE:
      return "Your device could not determine its location. Check location services or search by city or ZIP below.";
    case error.TIMEOUT:
      return "Finding your location took too long. Check your signal and try again.";
    default:
      return "We could not use your location. Try again or browse upcoming events by date.";
  }
}

function EventCard({ event, now }: { event: DisplayEvent & { distanceMiles?: number }; now: Date }) {
  const isExternalImport = Boolean(event.sourceUrl && (event.imported || event.externalSource));
  const card = (
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
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold">
              {event.imported ? "Verified Import" : event.access}
            </span>
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
            <Users className="text-yuzu-gold" /> {formatAudienceLine(event)}
          </p>
          <p className="inline-flex items-center gap-2 pt-2 text-xs font-bold uppercase tracking-[0.2em] text-yuzu-gold">
            {isExternalImport ? "View Source" : event.liveId ? "Current Event Details" : "View Details"}
            {isExternalImport ? (
              <ExternalLink className="size-4" />
            ) : event.liveId ? null : (
              <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (isExternalImport && event.sourceUrl) {
    return (
      <a
        href={event.sourceUrl}
        rel="noreferrer"
        target="_blank"
        data-event-card={event.slug}
        data-event-status={getEventTimingStatus(event, now)}
        className="group block h-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yuzu-gold/60"
      >
        {card}
      </a>
    );
  }

  if (event.liveId) {
    return (
      <article
        data-event-card={event.slug}
        data-event-status={getEventTimingStatus(event, now)}
        className="group block h-full"
      >
        {card}
      </article>
    );
  }

  return (
    <Link
      href={`/events/${event.slug}/`}
      data-event-card={event.slug}
      data-event-status={getEventTimingStatus(event, now)}
      className="group block h-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yuzu-gold/60"
    >
      {card}
    </Link>
  );
}

function formatAudienceLine(event: DisplayEvent & { distanceMiles?: number }) {
  if (typeof event.distanceMiles === "number") {
    if (event.distanceMiles < 1) {
      return `${event.distanceMiles.toFixed(1)} mi away`;
    }

    return `${Math.round(event.distanceMiles)} mi away`;
  }

  return event.capacity;
}

function formatFeedFreshness(value: string, now: Date) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "recently";
  }

  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - timestamp) / 60_000));

  if (elapsedMinutes < 2) {
    return "just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minutes ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
}
