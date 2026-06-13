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
  approvedEventImportsStorageKey,
  approvedEventImportsUpdatedEvent,
  mergeEventsWithApprovedImports,
  rankEventsForLocation,
  readApprovedEventImports,
  type ApprovedImportedEvent,
  type EventCoordinates,
  type EventFeedExperience,
} from "@/lib/event-import-agent";
import { getAutoUpdatedEvents, getEventTimingLabel, getEventTimingStatus } from "@/lib/event-schedule";
import { buildEventImageAlt } from "@/lib/image-seo";

type AutoUpdatingEventGridProps = {
  events: EventExperience[];
  initialNowIso: string;
};

export function AutoUpdatingEventGrid({ events, initialNowIso }: AutoUpdatingEventGridProps) {
  const now = useEventClock(initialNowIso);
  const [approvedImports, setApprovedImports] = useState<ApprovedImportedEvent[]>([]);
  const [userCoordinates, setUserCoordinates] = useState<EventCoordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [locationMessage, setLocationMessage] = useState("Showing upcoming events by date.");
  const currentEvents = useMemo(() => {
    const mergedEvents = mergeEventsWithApprovedImports(events, approvedImports);
    const activeEvents = getAutoUpdatedEvents(mergedEvents, now);

    if (!userCoordinates) {
      return activeEvents;
    }

    return rankEventsForLocation(activeEvents, userCoordinates);
  }, [approvedImports, events, now, userCoordinates]);

  useEffect(() => {
    function refreshApprovedImports() {
      setApprovedImports(readApprovedEventImports(window.localStorage.getItem(approvedEventImportsStorageKey)));
    }

    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key === approvedEventImportsStorageKey) {
        refreshApprovedImports();
      }
    }

    refreshApprovedImports();
    window.addEventListener(approvedEventImportsUpdatedEvent, refreshApprovedImports);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(approvedEventImportsUpdatedEvent, refreshApprovedImports);
      window.removeEventListener("storage", handleStorage);
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
      () => {
        setLocationStatus("error");
        setLocationMessage("Location permission was not granted.");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10 * 60 * 1000,
        timeout: 8000,
      },
    );
  }

  const importedCount = approvedImports.length;

  return (
    <div className="grid gap-5" data-location-aware-event-feed>
      <div className="flex flex-col gap-4 border border-yuzu-line bg-yuzu-panel/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">Local Event Feed</p>
          <p className="mt-1 text-sm leading-6 text-yuzu-muted">
            {locationMessage} {importedCount ? `${importedCount} approved import${importedCount === 1 ? "" : "s"} available.` : "No approved imports yet."}
          </p>
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

function EventCard({ event, now }: { event: EventFeedExperience & { distanceMiles?: number }; now: Date }) {
  const isExternalImport = Boolean(event.imported && event.sourceUrl);
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
              {event.imported ? "Approved Import" : event.access}
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
            {isExternalImport ? "View Source" : "View Details"}
            {isExternalImport ? <ExternalLink className="size-4" /> : <ArrowRight className="size-4 transition group-hover:translate-x-1" />}
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

function formatAudienceLine(event: EventFeedExperience & { distanceMiles?: number }) {
  if (typeof event.distanceMiles === "number") {
    if (event.distanceMiles < 1) {
      return `${event.distanceMiles.toFixed(1)} mi away`;
    }

    return `${Math.round(event.distanceMiles)} mi away`;
  }

  return event.capacity;
}
