import { withAgingSnapshot, type CigarReadiness } from "@/lib/humidor-aging";
import type { HumidorItem } from "@/lib/live-api";

export type HumidorTableSortDirection = "asc" | "desc";
export type HumidorTableSortKey =
  | "original"
  | "cigar"
  | "quantity"
  | "collectionValue"
  | "location"
  | "aging"
  | "rating"
  | "needsAttention";
export type HumidorTableColumnSortKey = Exclude<HumidorTableSortKey, "original" | "needsAttention">;
export type HumidorTableSort = {
  direction: HumidorTableSortDirection;
  key: HumidorTableSortKey;
};

export const defaultHumidorTableSort: HumidorTableSort = { direction: "desc", key: "original" };

export const humidorTableSortOptions: Array<{ label: string; sort: HumidorTableSort }> = [
  { label: "Original order", sort: defaultHumidorTableSort },
  { label: "Ready to Smoke", sort: { direction: "desc", key: "aging" } },
  { label: "Youngest First", sort: { direction: "asc", key: "aging" } },
  { label: "Highest Value", sort: { direction: "desc", key: "collectionValue" } },
  { label: "Lowest Value", sort: { direction: "asc", key: "collectionValue" } },
  { label: "Highest Rated", sort: { direction: "desc", key: "rating" } },
  { label: "Lowest Rated", sort: { direction: "asc", key: "rating" } },
  { label: "Highest Quantity", sort: { direction: "desc", key: "quantity" } },
  { label: "Lowest Quantity", sort: { direction: "asc", key: "quantity" } },
  { label: "Location A-Z", sort: { direction: "asc", key: "location" } },
  { label: "Location Z-A", sort: { direction: "desc", key: "location" } },
  { label: "Needs Attention", sort: { direction: "desc", key: "needsAttention" } },
  { label: "Cigar A-Z", sort: { direction: "asc", key: "cigar" } },
  { label: "Cigar Z-A", sort: { direction: "desc", key: "cigar" } },
];

const defaultColumnSortDirections: Record<HumidorTableColumnSortKey, HumidorTableSortDirection> = {
  aging: "desc",
  cigar: "asc",
  collectionValue: "desc",
  location: "asc",
  quantity: "desc",
  rating: "desc",
};

const readinessRanks: Record<CigarReadiness, number> = {
  "Aging Well": 2,
  "Ready Now": 3,
  "Too Young": 1,
};

export function formatHumidorTableSortValue(sort: HumidorTableSort) {
  return `${sort.key}:${sort.direction}`;
}

export function parseHumidorTableSortValue(value: string): HumidorTableSort {
  const [key, direction] = value.split(":");

  if (isHumidorTableSortKey(key) && isHumidorTableSortDirection(direction)) {
    return { direction, key };
  }

  return defaultHumidorTableSort;
}

export function toggleHumidorTableSort(current: HumidorTableSort, key: HumidorTableColumnSortKey): HumidorTableSort {
  if (current.key === key) {
    return { direction: current.direction === "asc" ? "desc" : "asc", key };
  }

  return { direction: defaultColumnSortDirections[key], key };
}

export function sortHumidorItems(items: HumidorItem[], sort: HumidorTableSort, now: Date) {
  if (sort.key === "original") {
    return items;
  }

  return items
    .map((item, index) => ({ index, item }))
    .sort((left, right) => {
      const result = compareHumidorItems(left.item, right.item, sort, now);

      if (result !== 0) {
        return result;
      }

      const nameResult = compareOptionalText(left.item.name, right.item.name, "asc");
      return nameResult || left.index - right.index;
    })
    .map(({ item }) => item);
}

function compareHumidorItems(left: HumidorItem, right: HumidorItem, sort: HumidorTableSort, now: Date) {
  if (sort.key === "aging") {
    return compareOptionalNumbers(getHumidorReadinessRank(left, now), getHumidorReadinessRank(right, now), sort.direction);
  }

  if (sort.key === "cigar") {
    return compareOptionalText(left.name, right.name, sort.direction);
  }

  if (sort.key === "collectionValue") {
    return compareOptionalNumbers(getHumidorItemValue(left), getHumidorItemValue(right), sort.direction);
  }

  if (sort.key === "location") {
    return compareOptionalText(left.humidorLocation, right.humidorLocation, sort.direction);
  }

  if (sort.key === "needsAttention") {
    return compareOptionalNumbers(getHumidorNeedsAttentionScore(left, now), getHumidorNeedsAttentionScore(right, now), sort.direction);
  }

  if (sort.key === "quantity") {
    return compareOptionalNumbers(left.quantity, right.quantity, sort.direction);
  }

  if (sort.key === "rating") {
    return compareOptionalNumbers(left.rating, right.rating, sort.direction);
  }

  return 0;
}

function getHumidorNeedsAttentionScore(item: HumidorItem, now: Date) {
  const missingIdentityCount = [item.brand, item.line, item.vitola, item.wrapper, item.origin, item.strength].filter((value) => !value.trim()).length;
  const missingAgingDate = getAgingStartDateForItem(item) ? 0 : 1;
  const missingImage = item.cigarImage?.imageUrl || item.cigarImage?.dataUrl ? 0 : 1;
  const missingLocation = item.humidorLocation.trim() ? 0 : 1;
  const missingRating = typeof item.rating === "number" ? 0 : 1;
  const missingValue = getHumidorUnitValue(item) === null ? 1 : 0;
  const agingConcern = getHumidorReadinessRank(item, now) === null ? 1 : 0;

  return missingIdentityCount + missingAgingDate + missingImage + missingLocation + missingRating + missingValue + agingConcern;
}

function getHumidorReadinessRank(item: HumidorItem, now: Date) {
  const agingStartDate = getAgingStartDateForItem(item);

  if (!agingStartDate) {
    return null;
  }

  return readinessRanks[withAgingSnapshot({ agingStartDate }, now).readiness];
}

function getAgingStartDateForItem(item: HumidorItem) {
  return item.agingStartDate || item.purchaseDate || item.createdAt || null;
}

function getHumidorItemValue(item: HumidorItem) {
  const unitValue = getHumidorUnitValue(item);

  if (unitValue === null) {
    return null;
  }

  return Math.round(unitValue * Math.max(1, item.quantity) * 100) / 100;
}

function getHumidorUnitValue(item: HumidorItem) {
  return typeof item.estimatedValue === "number" && Number.isFinite(item.estimatedValue) ? item.estimatedValue : null;
}

function compareOptionalNumbers(left: number | null, right: number | null, direction: HumidorTableSortDirection) {
  const presenceResult = comparePresence(left, right);

  if (presenceResult !== 0 || left === null || right === null) {
    return presenceResult;
  }

  return (left - right) * getDirectionFactor(direction);
}

function compareOptionalText(left: string | null | undefined, right: string | null | undefined, direction: HumidorTableSortDirection) {
  const normalizedLeft = normalizeSortText(left);
  const normalizedRight = normalizeSortText(right);
  const presenceResult = comparePresence(normalizedLeft, normalizedRight);

  if (presenceResult !== 0 || normalizedLeft === null || normalizedRight === null) {
    return presenceResult;
  }

  return normalizedLeft.localeCompare(normalizedRight) * getDirectionFactor(direction);
}

function comparePresence(left: unknown | null, right: unknown | null) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return 0;
}

function getDirectionFactor(direction: HumidorTableSortDirection) {
  return direction === "asc" ? 1 : -1;
}

function normalizeSortText(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase();
  return normalized ? normalized : null;
}

function isHumidorTableSortKey(value: string): value is HumidorTableSortKey {
  return humidorTableSortOptions.some((option) => option.sort.key === value);
}

function isHumidorTableSortDirection(value: string): value is HumidorTableSortDirection {
  return value === "asc" || value === "desc";
}
