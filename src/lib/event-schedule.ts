export type ScheduledEvent = {
  startsAt: string;
  endsAt: string;
  title: string;
};

export type EventTimingStatus = "happening-now" | "today" | "upcoming";

const eventDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Phoenix",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getAutoUpdatedEvents<TEvent extends ScheduledEvent>(
  events: readonly TEvent[],
  now: Date = new Date()
) {
  const nowTimestamp = now.getTime();

  return events
    .filter((event) => parseEventTime(event.endsAt) >= nowTimestamp)
    .slice()
    .sort((left, right) => compareScheduledEvents(left, right, now));
}

export function getFeaturedEvent<TEvent extends ScheduledEvent>(
  events: readonly TEvent[],
  now: Date = new Date()
) {
  return getAutoUpdatedEvents(events, now)[0] ?? null;
}

export function getEventTimingStatus(event: ScheduledEvent, now: Date = new Date()): EventTimingStatus {
  const startsAt = parseEventTime(event.startsAt);
  const endsAt = parseEventTime(event.endsAt);
  const currentTime = now.getTime();

  if (startsAt <= currentTime && endsAt >= currentTime) {
    return "happening-now";
  }

  if (toEventDateKey(event.startsAt) === toEventDateKey(now)) {
    return "today";
  }

  return "upcoming";
}

export function getEventTimingLabel(event: ScheduledEvent, now: Date = new Date()) {
  const status = getEventTimingStatus(event, now);

  if (status === "happening-now") {
    return "Happening now";
  }

  if (status === "today") {
    return "Today";
  }

  return "Upcoming";
}

function compareScheduledEvents(left: ScheduledEvent, right: ScheduledEvent, now: Date) {
  const leftActive = getEventTimingStatus(left, now) === "happening-now" ? 0 : 1;
  const rightActive = getEventTimingStatus(right, now) === "happening-now" ? 0 : 1;

  if (leftActive !== rightActive) {
    return leftActive - rightActive;
  }

  const leftStart = parseEventTime(left.startsAt);
  const rightStart = parseEventTime(right.startsAt);

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  return left.title.localeCompare(right.title);
}

function parseEventTime(value: string) {
  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function toEventDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  return eventDateFormatter.format(date);
}
