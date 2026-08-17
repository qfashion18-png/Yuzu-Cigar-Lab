"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, LocateFixed, MapPin, Navigation, Search, ShieldCheck, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { searchCuratedArea } from "@/lib/curated-event-search";
import { curatedCigarMarkets } from "@/lib/data";

type LocationStatus =
  | "idle"
  | "locating"
  | "located"
  | "permission-denied"
  | "position-unavailable"
  | "timed-out"
  | "error"
  | "unsupported";

export function CuratedEventsExplorer() {
  const [selectedMarketId, setSelectedMarketId] = useState(curatedCigarMarkets[0]?.id ?? "");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [areaQuery, setAreaQuery] = useState("");

  const selectedMarket = useMemo(
    () => curatedCigarMarkets.find((market) => market.id === selectedMarketId) ?? curatedCigarMarkets[0],
    [selectedMarketId]
  );
  const curatedSearch = useMemo(
    () => (selectedMarket ? searchCuratedArea(selectedMarket, areaQuery) : null),
    [areaQuery, selectedMarket]
  );

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nearestMarket = findNearestMarket(coords.latitude, coords.longitude);
        setSelectedMarketId(nearestMarket.id);
        setAreaQuery("");
        setLocationStatus("located");
      },
      (error) => setLocationStatus(getGeolocationErrorStatus(error)),
      {
        enableHighAccuracy: false,
        maximumAge: 30 * 60 * 1000,
        timeout: 8000,
      }
    );
  }

  if (!selectedMarket || !curatedSearch) {
    return null;
  }

  return (
    <section data-events-section="curated" className="mt-10 border-t border-yuzu-line/70 pt-8">
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
        <div>
          <p className="fine-label">Curated Events</p>
          <h2 className="mt-3 max-w-3xl font-heading text-4xl leading-tight text-yuzu-cream md:text-5xl">
            Cigar events and lounge picks near you.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-yuzu-muted">
            A Yuzu-curated local guide for cigar nights, brand-event signals, and the strongest lounges in your market.
          </p>
        </div>

        <div className="border border-yuzu-line bg-yuzu-panel p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center border border-yuzu-gold/60 bg-yuzu-gold/10 text-yuzu-gold">
                <Navigation className="size-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">Local market</p>
                <p className="mt-1 font-heading text-2xl text-yuzu-cream">{selectedMarket.label}</p>
                <p className="mt-1 text-sm leading-6 text-yuzu-muted">{selectedMarket.region}</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={useCurrentLocation}
              className="h-11 w-full bg-yuzu-gold px-5 text-yuzu-ink hover:bg-yuzu-gold-light sm:w-fit"
            >
              <LocateFixed className="size-4" />
              Use My Location
            </Button>
          </div>

          <form
            role="search"
            aria-label="Search curated cigar events by area"
            className="mt-5"
            onSubmit={(event) => event.preventDefault()}
          >
            <label htmlFor="curated-area-search" className="text-xs font-black uppercase tracking-[0.18em] text-yuzu-gold">
              Search Your Area
            </label>
            <div className="mt-2 flex min-h-12 items-center border border-yuzu-line bg-yuzu-night/65 focus-within:border-yuzu-gold focus-within:ring-3 focus-within:ring-yuzu-gold/20">
              <Search className="ml-3 size-5 shrink-0 text-yuzu-gold" />
              <input
                id="curated-area-search"
                type="search"
                value={areaQuery}
                onChange={(event) => setAreaQuery(event.target.value)}
                placeholder="City, ZIP, lounge, or neighborhood"
                className="min-h-12 flex-1 bg-transparent px-3 text-base text-yuzu-cream outline-none placeholder:text-yuzu-muted/70"
              />
              {areaQuery ? (
                <button
                  type="button"
                  onClick={() => setAreaQuery("")}
                  aria-label="Clear curated area search"
                  className="grid size-12 shrink-0 place-items-center text-yuzu-muted transition hover:text-yuzu-gold"
                >
                  <X className="size-5" />
                </button>
              ) : null}
            </div>
          </form>

          <div className="mt-3 flex flex-wrap gap-2" aria-label="Popular curated area searches">
            {curatedSearch.areaOptions.slice(0, 8).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setAreaQuery(area)}
                className="min-h-10 border border-yuzu-line px-3 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted transition hover:border-yuzu-gold hover:text-yuzu-gold data-[selected=true]:border-yuzu-gold data-[selected=true]:bg-yuzu-gold/10 data-[selected=true]:text-yuzu-gold"
                data-selected={areaQuery.trim().toLowerCase() === area.toLowerCase()}
              >
                {area}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {curatedCigarMarkets.map((market) => (
              <button
                key={market.id}
                type="button"
                onClick={() => {
                  setSelectedMarketId(market.id);
                  setLocationStatus("idle");
                  setAreaQuery("");
                }}
                className="min-h-10 border border-yuzu-line px-3 text-xs font-bold uppercase tracking-[0.16em] text-yuzu-muted transition hover:border-yuzu-gold hover:text-yuzu-gold data-[selected=true]:border-yuzu-gold data-[selected=true]:bg-yuzu-gold/10 data-[selected=true]:text-yuzu-gold"
                data-selected={market.id === selectedMarket.id}
              >
                {market.label}
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm leading-6 text-yuzu-muted" aria-live="polite">
            {getLocationStatusText(locationStatus, selectedMarket.label)}
            {" "}
            {curatedSearch.hasQuery
              ? `${curatedSearch.totalMatches} local match${curatedSearch.totalMatches === 1 ? "" : "es"} for "${curatedSearch.query}".`
              : `${curatedSearch.totalMatches} curated local picks ready to scan.`}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.95fr]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-heading text-3xl text-yuzu-cream">Curated Events</h3>
              <p className="mt-1 text-sm leading-6 text-yuzu-muted">
                {curatedSearch.hasQuery ? `Area search: ${curatedSearch.query}` : selectedMarket.updatedLabel}
              </p>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold">
              Within {selectedMarket.radiusMiles} miles
            </p>
          </div>

          {curatedSearch.matchedAreas.length ? (
            <div className="mb-4 flex flex-wrap gap-2" data-curated-area-matches>
              {curatedSearch.matchedAreas.map((area) => (
                <span
                  key={area}
                  className="border border-yuzu-line/80 bg-yuzu-gold/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-yuzu-gold"
                >
                  {area}
                </span>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            {curatedSearch.events.map((event) => (
              <article key={`${event.title}-${event.venue}`} className="flex min-h-full flex-col border border-yuzu-line bg-yuzu-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <CalendarDays className="size-5 shrink-0 text-yuzu-gold" />
                  <span className="text-right text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">{event.access}</span>
                </div>
                <div className="mt-5">
                  <p className="text-sm font-bold uppercase tracking-[0.16em] text-yuzu-muted">{event.date}</p>
                  <h4 className="mt-2 font-heading text-2xl leading-tight text-yuzu-cream">{event.title}</h4>
                  <p className="mt-2 text-sm text-yuzu-gold">{event.venue}</p>
                </div>
                <p className="mt-4 text-sm leading-6 text-yuzu-muted">{event.summary}</p>
                <div className="mt-auto pt-5">
                  <p className="flex items-center gap-2 text-sm text-yuzu-muted">
                    <MapPin className="size-4 shrink-0 text-yuzu-gold" />
                    {event.area} - {event.distance}
                  </p>
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold transition hover:text-yuzu-gold-light"
                  >
                    Check Venue <ArrowUpRight className="size-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>

          {!curatedSearch.events.length ? (
            <div className="border border-yuzu-line bg-yuzu-panel p-5 text-sm leading-6 text-yuzu-muted">
              No curated event signals matched this area yet. Try a nearby city, ZIP code, venue name, or neighborhood.
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 border border-yuzu-line bg-yuzu-forest/70 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center border border-yuzu-gold/60 bg-yuzu-gold/10 text-yuzu-gold">
              <Star className="size-5" />
            </span>
            <div>
              <h3 className="font-heading text-3xl leading-tight text-yuzu-cream">Best Cigar Lounges Near You</h3>
              <p className="mt-2 text-sm leading-6 text-yuzu-muted">{selectedMarket.region}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {curatedSearch.lounges.map((lounge) => (
              <article key={lounge.name} className="border border-yuzu-line/70 bg-yuzu-night/70 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 size-5 shrink-0 text-yuzu-gold" />
                  <div className="min-w-0">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <h4 className="font-heading text-xl text-yuzu-cream">{lounge.name}</h4>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-yuzu-gold">{lounge.area}</p>
                    </div>
                    <p className="mt-2 text-sm font-bold text-yuzu-cream/90">{lounge.bestFor}</p>
                    <p className="mt-2 text-sm leading-6 text-yuzu-muted">{lounge.note}</p>
                    <p className="mt-3 text-xs leading-5 text-yuzu-muted">{lounge.address}</p>
                    <a
                      href={lounge.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-yuzu-gold transition hover:text-yuzu-gold-light"
                    >
                      View Lounge <ArrowUpRight className="size-4" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!curatedSearch.lounges.length ? (
            <div className="mt-5 border border-yuzu-line/70 bg-yuzu-night/70 p-4 text-sm leading-6 text-yuzu-muted">
              No lounge picks matched this search. Widen the area or search by a nearby city.
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function getLocationStatusText(status: LocationStatus, marketLabel: string) {
  if (status === "locating") {
    return "Finding the closest Yuzu-curated cigar market...";
  }

  if (status === "located") {
    return `Showing the closest Yuzu-curated market: ${marketLabel}.`;
  }

  if (status === "permission-denied") {
    return `Location access is blocked. Allow location for this site in your browser settings, then try again. Showing ${marketLabel}.`;
  }

  if (status === "position-unavailable") {
    return `Your device could not determine its location. Check location services or search by city or ZIP instead. Showing ${marketLabel}.`;
  }

  if (status === "timed-out") {
    return `Finding your location took too long. Check your signal and try again, or search by city or ZIP. Showing ${marketLabel}.`;
  }

  if (status === "error") {
    return `We could not use your location. Try again or search by city or ZIP. Showing ${marketLabel}.`;
  }

  if (status === "unsupported") {
    return `Browser location is unavailable, so we are showing ${marketLabel}.`;
  }

  return `Showing ${marketLabel}.`;
}

function getGeolocationErrorStatus(error: GeolocationPositionError): LocationStatus {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "permission-denied";
    case error.POSITION_UNAVAILABLE:
      return "position-unavailable";
    case error.TIMEOUT:
      return "timed-out";
    default:
      return "error";
  }
}

function findNearestMarket(latitude: number, longitude: number) {
  return curatedCigarMarkets.reduce((nearest, market) => {
    const nearestDistance = getDistanceMiles(latitude, longitude, nearest.coordinates.latitude, nearest.coordinates.longitude);
    const marketDistance = getDistanceMiles(latitude, longitude, market.coordinates.latitude, market.coordinates.longitude);

    return marketDistance < nearestDistance ? market : nearest;
  }, curatedCigarMarkets[0]);
}

function getDistanceMiles(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number) {
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = toRadians(toLatitude - fromLatitude);
  const longitudeDelta = toRadians(toLongitude - fromLongitude);
  const startLatitude = toRadians(fromLatitude);
  const endLatitude = toRadians(toLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}
