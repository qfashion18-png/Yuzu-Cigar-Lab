export type CigarReadiness = "Ready Now" | "Aging Well" | "Too Young";

export type AgingSnapshot = {
  ageMonths: number;
  progress: number;
  readiness: CigarReadiness;
};

export type TotalAgeSnapshot = {
  ageMonths: number;
};

export type AgingTrackedCigar = {
  id: string;
  name: string;
  quantity: number;
  smokeCount: number;
  lastSmoked: string;
  rating: number;
  tastingNotes: string;
  agingStartDate: string;
  readiness?: CigarReadiness;
  ageMonths?: number;
};

export type SmokeLogCigarUpdate = {
  cigarId: string;
  date: string;
  rating: number;
  notes: string;
};

const readyAgingMonths = 6;
const restingAgingMonths = 1;

export function getAgingSnapshot(agingStartDate: string, now = new Date()): AgingSnapshot {
  const ageMonths = calculateAgeMonths(agingStartDate, now);

  return {
    ageMonths,
    progress: Math.min(100, Math.max(0, Math.round((ageMonths / readyAgingMonths) * 100))),
    readiness: ageMonths >= readyAgingMonths ? "Ready Now" : ageMonths >= restingAgingMonths ? "Aging Well" : "Too Young",
  };
}

export function getTotalAgeSnapshot(productionDate: string | null | undefined, now = new Date()): TotalAgeSnapshot | null {
  const normalizedProductionDate = typeof productionDate === "string" ? productionDate.trim() : "";

  if (!normalizedProductionDate) {
    return null;
  }

  return {
    ageMonths: calculateAgeMonths(normalizedProductionDate, now),
  };
}

export function withAgingSnapshot<T extends { agingStartDate: string }>(cigar: T, now = new Date()): T & AgingSnapshot {
  return {
    ...cigar,
    ...getAgingSnapshot(cigar.agingStartDate, now),
  };
}

export function normalizeStoredHumidorItems<T extends { id: string; name: string; agingStartDate: string }>(
  value: unknown,
  fallback: T[],
  now = new Date(),
): Array<T & AgingSnapshot> {
  if (!Array.isArray(value)) {
    return fallback.map((item) => withAgingSnapshot(item, now));
  }

  const normalized = value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const id = normalizeText(record.id);
    const name = normalizeText(record.name);
    const agingStartDate = normalizeText(record.agingStartDate);

    if (!id || !name || !agingStartDate) {
      return [];
    }

    return [
      withAgingSnapshot(
        {
          ...record,
          id,
          name,
          agingStartDate,
        } as T,
        now,
      ),
    ];
  });

  return normalized.length ? normalized : fallback.map((item) => withAgingSnapshot(item, now));
}

export function applySmokeLogToCigars<T extends AgingTrackedCigar>(
  cigars: T[],
  update: SmokeLogCigarUpdate,
): T[] {
  return cigars.map((cigar) =>
    cigar.id === update.cigarId
      ? {
          ...cigar,
          quantity: Math.max(0, cigar.quantity - 1),
          smokeCount: cigar.smokeCount + 1,
          lastSmoked: update.date,
          rating: update.rating,
          tastingNotes: update.notes,
        }
      : cigar,
  );
}

function calculateAgeMonths(agingStartDate: string, now: Date) {
  const start = parseHumidorDate(agingStartDate);

  if (!start || Number.isNaN(now.getTime()) || start > now) {
    return 0;
  }

  const monthDifference = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  const completedMonthAdjustment = now.getDate() < start.getDate() ? 1 : 0;

  return Math.max(0, monthDifference - completedMonthAdjustment);
}

function parseHumidorDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
