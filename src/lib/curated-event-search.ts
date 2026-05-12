import type { CuratedCigarEvent, CuratedCigarLounge, CuratedCigarMarket } from "@/lib/data";

export type CuratedAreaSearchResult = {
  query: string;
  hasQuery: boolean;
  areaOptions: string[];
  matchedAreas: string[];
  events: CuratedCigarEvent[];
  lounges: CuratedCigarLounge[];
  totalMatches: number;
};

export function searchCuratedArea(market: CuratedCigarMarket, query: string): CuratedAreaSearchResult {
  const cleanQuery = query.trim();
  const areaOptions = getCuratedAreaOptions(market);

  if (!cleanQuery || normalizeSearchText(cleanQuery) === normalizeSearchText(market.label)) {
    return getAllMarketResults(market, cleanQuery, areaOptions);
  }

  const terms = tokenize(cleanQuery);
  const events = market.cigarEvents.filter((event) => matchesTerms(getEventSearchText(event), terms));
  const lounges = market.cigarLounges.filter((lounge) => matchesTerms(getLoungeSearchText(lounge), terms));
  const matchedAreas = getMatchedAreas(areaOptions, terms, events, lounges);

  return {
    query: cleanQuery,
    hasQuery: true,
    areaOptions,
    matchedAreas,
    events,
    lounges,
    totalMatches: events.length + lounges.length,
  };
}

export function getCuratedAreaOptions(market: CuratedCigarMarket) {
  return uniqueLabels([
    market.label,
    ...splitAreaLabel(market.region),
    ...market.cigarEvents.flatMap((event) => [
      ...splitAreaLabel(event.area),
      ...splitAreaLabel(event.distance),
      ...(event.areaAliases ?? []),
    ]),
    ...market.cigarLounges.flatMap((lounge) => [
      ...splitAreaLabel(lounge.area),
      ...splitAreaLabel(lounge.address),
      ...(lounge.areaAliases ?? []),
    ]),
  ]).slice(0, 12);
}

function getAllMarketResults(market: CuratedCigarMarket, query: string, areaOptions: string[]): CuratedAreaSearchResult {
  return {
    query,
    hasQuery: Boolean(query),
    areaOptions,
    matchedAreas: areaOptions.slice(0, 6),
    events: market.cigarEvents,
    lounges: market.cigarLounges,
    totalMatches: market.cigarEvents.length + market.cigarLounges.length,
  };
}

function getEventSearchText(event: CuratedCigarEvent) {
  return [
    event.title,
    event.date,
    event.venue,
    event.area,
    event.distance,
    event.access,
    event.summary,
    event.sourceUrl,
    ...(event.areaAliases ?? []),
    ...(event.searchTerms ?? []),
  ].join(" ");
}

function getLoungeSearchText(lounge: CuratedCigarLounge) {
  return [
    lounge.name,
    lounge.area,
    lounge.address,
    lounge.bestFor,
    lounge.note,
    lounge.sourceUrl,
    ...(lounge.areaAliases ?? []),
    ...(lounge.searchTerms ?? []),
  ].join(" ");
}

function getMatchedAreas(
  areaOptions: string[],
  terms: string[],
  events: CuratedCigarEvent[],
  lounges: CuratedCigarLounge[]
) {
  const directAreaMatches = areaOptions.filter((area) => terms.some((term) => normalizeSearchText(area).includes(term)));

  return uniqueLabels([
    ...directAreaMatches,
    ...events.flatMap((event) => splitAreaLabel(event.area)),
    ...lounges.flatMap((lounge) => splitAreaLabel(lounge.area)),
  ]).slice(0, 6);
}

function matchesTerms(searchText: string, terms: string[]) {
  const normalizedText = normalizeSearchText(searchText);

  return terms.every((term) => normalizedText.includes(term));
}

function tokenize(value: string) {
  return normalizeSearchText(value)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

function splitAreaLabel(value: string) {
  return value
    .split(/[,/;|]+|\s+-\s+/)
    .map((label) => label.trim())
    .filter((label) => label.length >= 3 && label.length <= 34);
}

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const label of labels) {
    const normalized = normalizeSearchText(label);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(label);
  }

  return unique;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
