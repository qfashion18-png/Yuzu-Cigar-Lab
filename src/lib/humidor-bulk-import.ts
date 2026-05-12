import type { BackupMembershipTier } from "@/lib/backup-auth";
import type { HumidorItemInput } from "@/lib/live-api";

type HumidorBulkImportColumn =
  | "name"
  | "brand"
  | "line"
  | "vitola"
  | "wrapper"
  | "origin"
  | "strength"
  | "quantity"
  | "purchaseDate"
  | "agingStartDate"
  | "reorderReminder"
  | "humidorLocation"
  | "tray"
  | "rating"
  | "tastingNotes";

export type HumidorBulkImportResult = {
  items: HumidorItemInput[];
  errors: string[];
};

export const humidorBulkImportTemplate =
  "name,brand,line,vitola,wrapper,origin,strength,quantity,purchaseDate,agingStartDate,reorderReminder,humidorLocation,tray,rating,tastingNotes";

const eligibleBulkImportTiers: BackupMembershipTier[] = ["Kisha", "Sensei", "Daimyo"];
const defaultColumns: HumidorBulkImportColumn[] = [
  "name",
  "brand",
  "line",
  "vitola",
  "wrapper",
  "origin",
  "strength",
  "quantity",
  "purchaseDate",
  "agingStartDate",
  "reorderReminder",
  "humidorLocation",
  "tray",
  "rating",
  "tastingNotes",
];

const columnAliases: Record<string, HumidorBulkImportColumn> = {
  "aging start": "agingStartDate",
  agingstart: "agingStartDate",
  agingstartdate: "agingStartDate",
  brand: "brand",
  cigar: "name",
  cigarname: "name",
  "cigar name": "name",
  humidorlocation: "humidorLocation",
  "humidor location": "humidorLocation",
  line: "line",
  location: "humidorLocation",
  name: "name",
  notes: "tastingNotes",
  origin: "origin",
  purchasedate: "purchaseDate",
  "purchase date": "purchaseDate",
  quantity: "quantity",
  qty: "quantity",
  rating: "rating",
  reorder: "reorderReminder",
  reorderreminder: "reorderReminder",
  "reorder reminder": "reorderReminder",
  strength: "strength",
  tastingnotes: "tastingNotes",
  "tasting notes": "tastingNotes",
  tray: "tray",
  vitola: "vitola",
  wrapper: "wrapper",
};

export function canUseHumidorBulkImport(tier: string | null | undefined) {
  const normalizedTier = normalizeTier(tier);

  return eligibleBulkImportTiers.some((candidate) => candidate.toLowerCase() === normalizedTier);
}

export function parseHumidorBulkImport(source: string): HumidorBulkImportResult {
  const rows = parseDelimitedRows(source).filter((row) => row.some((cell) => cell.trim()));

  if (!rows.length) {
    return {
      items: [],
      errors: ["Paste at least one cigar row."],
    };
  }

  const firstRowColumns = rows[0].map(resolveColumn);
  const hasHeader = firstRowColumns.some(Boolean);
  const columns = hasHeader ? firstRowColumns : defaultColumns;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const errors: string[] = [];
  const items: HumidorItemInput[] = [];

  dataRows.forEach((row, index) => {
    const rowNumber = hasHeader ? index + 2 : index + 1;
    const rowValue = mapRowToValues(row, columns);
    const rowErrors: string[] = [];
    const name = cleanText(rowValue.name);
    const quantity = parseQuantity(rowValue.quantity, rowNumber, rowErrors);
    const rating = parseRating(rowValue.rating, rowNumber, rowErrors);

    if (!name) {
      rowErrors.push(`Row ${rowNumber} needs a cigar name.`);
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    items.push({
      name,
      brand: cleanText(rowValue.brand),
      line: cleanText(rowValue.line),
      vitola: cleanText(rowValue.vitola),
      wrapper: cleanText(rowValue.wrapper),
      origin: cleanText(rowValue.origin),
      strength: cleanText(rowValue.strength),
      quantity,
      purchaseDate: cleanNullableText(rowValue.purchaseDate),
      agingStartDate: cleanNullableText(rowValue.agingStartDate),
      reorderReminder: cleanNullableText(rowValue.reorderReminder),
      humidorLocation: cleanText(rowValue.humidorLocation),
      tray: cleanText(rowValue.tray),
      rating,
      tastingNotes: cleanText(rowValue.tastingNotes),
      source: "member_bulk_import",
    });
  });

  return { items, errors };
}

function normalizeTier(tier: string | null | undefined) {
  return tier?.trim().toLowerCase().replace(/[_-]+/g, " ") ?? "";
}

function resolveColumn(value: string): HumidorBulkImportColumn | null {
  return columnAliases[normalizeColumn(value)] ?? null;
}

function normalizeColumn(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function mapRowToValues(row: string[], columns: Array<HumidorBulkImportColumn | null>) {
  const rowValue: Partial<Record<HumidorBulkImportColumn, string>> = {};

  columns.forEach((column, index) => {
    if (column) {
      rowValue[column] = row[index] ?? "";
    }
  });

  return rowValue;
}

function parseQuantity(value: string | undefined, rowNumber: number, errors: string[]) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return 1;
  }

  const quantity = Number(cleaned);

  if (!Number.isFinite(quantity) || quantity < 1) {
    errors.push(`Row ${rowNumber} quantity must be 1 or greater.`);
    return 1;
  }

  return Math.round(quantity);
}

function parseRating(value: string | undefined, rowNumber: number, errors: string[]) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const rating = Number(cleaned);

  if (!Number.isFinite(rating) || rating < 0 || rating > 100) {
    errors.push(`Row ${rowNumber} rating must be between 0 and 100.`);
    return null;
  }

  return Math.round(rating);
}

function cleanText(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function cleanNullableText(value: string | undefined) {
  return cleanText(value) || null;
}

function parseDelimitedRows(input: string) {
  const delimiter = input.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let isQuoted = false;
  const source = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (isQuoted) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        isQuoted = false;
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      isQuoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
