import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultHumidorTableSort,
  parseHumidorTableSortValue,
  sortHumidorItems,
  toggleHumidorTableSort,
  type HumidorTableSort,
} from "../src/lib/humidor-table-sort";
import type { HumidorItem } from "../src/lib/live-api";

const now = new Date("2026-05-28T12:00:00-07:00");

function value<T extends keyof HumidorItem>(overrides: Partial<HumidorItem>, key: T, fallback: HumidorItem[T]): HumidorItem[T] {
  return Object.hasOwn(overrides, key) ? (overrides[key] as HumidorItem[T]) : fallback;
}

function humidorItem(overrides: Partial<HumidorItem>): HumidorItem {
  return {
    id: value(overrides, "id", overrides.name ?? "item"),
    name: value(overrides, "name", "Test Cigar"),
    brand: value(overrides, "brand", "Test Brand"),
    line: value(overrides, "line", "Test Line"),
    vitola: value(overrides, "vitola", "Toro"),
    wrapper: value(overrides, "wrapper", "Habano"),
    origin: value(overrides, "origin", "Nicaragua"),
    strength: value(overrides, "strength", "Medium"),
    quantity: value(overrides, "quantity", 1),
    rating: value(overrides, "rating", 90),
    purchaseDate: value(overrides, "purchaseDate", null),
    agingStartDate: value(overrides, "agingStartDate", "2025-11-01"),
    productionDate: value(overrides, "productionDate", null),
    reorderReminder: value(overrides, "reorderReminder", null),
    humidorLocation: value(overrides, "humidorLocation", "Cabinet A"),
    tray: value(overrides, "tray", ""),
    tastingNotes: value(overrides, "tastingNotes", ""),
    source: value(overrides, "source", "test"),
    estimatedValue: value(overrides, "estimatedValue", 25),
    estimatedValueCurrency: value(overrides, "estimatedValueCurrency", "USD"),
    estimatedValueSource: value(overrides, "estimatedValueSource", "test"),
    cigarImage: value(overrides, "cigarImage", {
      bytes: 100,
      fileName: "cigar.png",
      imageUrl: "/assets/product-padron.png",
      mimeType: "image/png",
      source: "test",
    }),
    createdAt: value(overrides, "createdAt", undefined),
  };
}

function names(items: HumidorItem[]) {
  return items.map((item) => item.name);
}

test("humidor table sort keeps original order until a sort is selected", () => {
  const items = [
    humidorItem({ name: "Gamma" }),
    humidorItem({ name: "Alpha" }),
    humidorItem({ name: "Beta" }),
  ];

  assert.deepEqual(names(sortHumidorItems(items, defaultHumidorTableSort, now)), ["Gamma", "Alpha", "Beta"]);
});

test("humidor table sort orders aging by ready-to-smoke status with missing dates last", () => {
  const sort: HumidorTableSort = { direction: "desc", key: "aging" };
  const items = [
    humidorItem({ name: "No Date", agingStartDate: null, purchaseDate: null, createdAt: undefined }),
    humidorItem({ name: "Too Young", agingStartDate: "2026-05-20" }),
    humidorItem({ name: "Ready", agingStartDate: "2025-09-01" }),
    humidorItem({ name: "Aging Well", agingStartDate: "2026-03-01" }),
  ];

  assert.deepEqual(names(sortHumidorItems(items, sort, now)), ["Ready", "Aging Well", "Too Young", "No Date"]);
});

test("humidor table sort uses total collection value and leaves missing values last", () => {
  const sort: HumidorTableSort = { direction: "desc", key: "collectionValue" };
  const items = [
    humidorItem({ name: "Unset Value", estimatedValue: null, quantity: 20 }),
    humidorItem({ name: "Single Expensive", estimatedValue: 140, quantity: 1 }),
    humidorItem({ name: "Box Value", estimatedValue: 70, quantity: 3 }),
  ];

  assert.deepEqual(names(sortHumidorItems(items, sort, now)), ["Box Value", "Single Expensive", "Unset Value"]);
});

test("humidor table sort can surface cigars needing member attention", () => {
  const sort: HumidorTableSort = { direction: "desc", key: "needsAttention" };
  const items = [
    humidorItem({ name: "Complete" }),
    humidorItem({
      name: "Missing Details",
      agingStartDate: null,
      brand: "",
      cigarImage: null,
      estimatedValue: null,
      humidorLocation: "",
      line: "",
      purchaseDate: null,
      rating: null,
      wrapper: "",
    }),
    humidorItem({ name: "Missing Rating", rating: null }),
  ];

  assert.deepEqual(names(sortHumidorItems(items, sort, now)), ["Missing Details", "Missing Rating", "Complete"]);
});

test("humidor table sort parser and header toggles use sensible default directions", () => {
  assert.deepEqual(parseHumidorTableSortValue("collectionValue:desc"), { direction: "desc", key: "collectionValue" });
  assert.deepEqual(parseHumidorTableSortValue("unknown"), defaultHumidorTableSort);
  assert.deepEqual(toggleHumidorTableSort(defaultHumidorTableSort, "cigar"), { direction: "asc", key: "cigar" });
  assert.deepEqual(toggleHumidorTableSort({ direction: "asc", key: "cigar" }, "cigar"), { direction: "desc", key: "cigar" });
});
