import assert from "node:assert/strict";
import test from "node:test";

import {
  applySmokeLogToCigars,
  getAgingSnapshot,
  normalizeStoredHumidorItems,
  type AgingTrackedCigar,
} from "../src/lib/humidor-aging";

const reviewDate = new Date("2026-05-06T12:00:00.000Z");

type StoredHumidorFixture = {
  id: string;
  name: string;
  brand: string;
  line: string;
  quantity: number;
  agingStartDate: string;
  readiness: "Too Young";
  ageMonths: number;
};

test("derives aging readiness and progress from the aging start date", () => {
  assert.deepEqual(getAgingSnapshot("Jan 1, 2024", reviewDate), {
    ageMonths: 28,
    progress: 100,
    readiness: "Ready Now",
  });

  assert.deepEqual(getAgingSnapshot("Apr 18, 2026", reviewDate), {
    ageMonths: 0,
    progress: 0,
    readiness: "Too Young",
  });
});

test("derives total cigar age separately from the user humidor aging clock", async () => {
  const agingModule = await import("../src/lib/humidor-aging");
  const getTotalAgeSnapshot = (
    agingModule as typeof agingModule & {
      getTotalAgeSnapshot?: (productionDate: string | null | undefined, now?: Date) => { ageMonths: number } | null;
    }
  ).getTotalAgeSnapshot;

  assert.equal(typeof getTotalAgeSnapshot, "function");
  assert.deepEqual(getAgingSnapshot("May 5, 2026", reviewDate), {
    ageMonths: 0,
    progress: 0,
    readiness: "Too Young",
  });
  assert.deepEqual(getTotalAgeSnapshot?.("May 1, 2022", reviewDate), {
    ageMonths: 48,
  });
  assert.equal(getTotalAgeSnapshot?.("", reviewDate), null);
});

test("normalizes stored humidor items by recalculating aging status", () => {
  const storedItems: StoredHumidorFixture[] = [
    {
      id: "aged-box",
      name: "Aged Box",
      brand: "Audit",
      line: "Vintage",
      quantity: 5,
      agingStartDate: "Jan 1, 2024",
      readiness: "Too Young",
      ageMonths: 0,
    },
  ];
  const [stored] = normalizeStoredHumidorItems<StoredHumidorFixture>(
    storedItems,
    [],
    reviewDate,
  );

  assert.ok(stored);
  assert.equal(stored?.readiness, "Ready Now");
  assert.equal(stored?.ageMonths, 28);
});

test("smoke logs update only the selected humidor item id", () => {
  const duplicateNameCigars: AgingTrackedCigar[] = [
    {
      id: "box-a",
      name: "Padron 1964",
      quantity: 2,
      smokeCount: 0,
      lastSmoked: "Not smoked yet",
      rating: 90,
      tastingNotes: "",
      agingStartDate: "Jan 1, 2024",
    },
    {
      id: "box-b",
      name: "Padron 1964",
      quantity: 4,
      smokeCount: 1,
      lastSmoked: "Yesterday",
      rating: 92,
      tastingNotes: "Cocoa",
      agingStartDate: "Jan 1, 2024",
    },
  ];

  const updated = applySmokeLogToCigars(duplicateNameCigars, {
    cigarId: "box-b",
    date: "Just now",
    rating: 95,
    notes: "Cedar and espresso",
  });

  assert.equal(updated[0].quantity, 2);
  assert.equal(updated[0].smokeCount, 0);
  assert.equal(updated[1].quantity, 3);
  assert.equal(updated[1].smokeCount, 2);
  assert.equal(updated[1].lastSmoked, "Just now");
  assert.equal(updated[1].rating, 95);
  assert.equal(updated[1].tastingNotes, "Cedar and espresso");
});
