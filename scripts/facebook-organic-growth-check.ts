import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type CalendarRow = Record<string, string>;

const calendarPath = resolve(
  process.cwd(),
  process.argv[2] ?? "docs/facebook-organic-content-calendar-2026-06.csv",
);

const requiredColumns = [
  "publish_date",
  "channel",
  "target_channels",
  "content_type",
  "theme",
  "draft_copy",
  "asset",
  "cta",
  "compliance_notes",
  "status",
];

const blockedCopyPatterns = [
  /\bbuy\b/i,
  /\border\b/i,
  /\bsale\b/i,
  /\bdiscount\b/i,
  /\bcoupon\b/i,
  /\bpromo\b/i,
  /\bfree\b/i,
  /\bfreebie\b/i,
  /\bgiveaway\b/i,
  /\bsample\b/i,
  /\bdeal\b/i,
  /\bclearance\b/i,
  /\bin stock\b/i,
  /\bavailable now\b/i,
  /\bdm to order\b/i,
  /\blowest price\b/i,
  /\bships nationwide\b/i,
  /\bsafer\b/i,
  /\bhealthy\b/i,
  /\blow-risk\b/i,
  /\bmedicinal\b/i,
  /\btherapeutic\b/i,
];

const publicChannels = ["Page", "Group"];

const requiredPublicTargets = ["Facebook Page", "Facebook Group"];

const weakPublicAssetPatterns = [
  /\btext-only\b/i,
  /\bno public asset\b/i,
  /\bno asset\b/i,
];

const visualAssetPattern =
  /\b(photo|image|images|album|carousel|card|visual|video|reel|preview|mp4|screenshot|cover|portrait|still|graphic|infographic)\b/i;

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function toRows(records: string[][]): CalendarRow[] {
  const [headers, ...dataRows] = records;
  if (!headers) {
    throw new Error("Calendar CSV is empty.");
  }

  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`Calendar CSV missing columns: ${missingColumns.join(", ")}`);
  }

  return dataRows.map((dataRow, index) => {
    const row: CalendarRow = {};
    headers.forEach((header, headerIndex) => {
      row[header] = dataRow[headerIndex] ?? "";
    });

    if (dataRow.length !== headers.length) {
      throw new Error(`Row ${index + 2} has ${dataRow.length} fields; expected ${headers.length}.`);
    }

    return row;
  });
}

function assertCalendar(rows: CalendarRow[]) {
  const failures: string[] = [];
  const publicRows = rows.filter((row) => publicChannels.includes(row.channel));

  if (rows.length < 30) {
    failures.push(`Expected at least 30 calendar rows, found ${rows.length}.`);
  }

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;

    for (const column of requiredColumns) {
      if (!row[column]?.trim()) {
        failures.push(`Row ${rowNumber} is missing ${column}.`);
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.publish_date)) {
      failures.push(`Row ${rowNumber} has invalid publish_date: ${row.publish_date}`);
    }

    if (!row.compliance_notes.includes("21+")) {
      failures.push(`Row ${rowNumber} compliance_notes must include 21+.`);
    }

    if (publicChannels.includes(row.channel) && !row.draft_copy.includes("21+")) {
      failures.push(`Row ${rowNumber} public draft_copy must include 21+.`);
    }

    if (publicChannels.includes(row.channel)) {
      for (const target of requiredPublicTargets) {
        if (!row.target_channels.includes(target)) {
          failures.push(`Row ${rowNumber} public target_channels must include ${target}.`);
        }
      }

      for (const pattern of weakPublicAssetPatterns) {
        if (pattern.test(row.asset)) {
          failures.push(`Row ${rowNumber} public asset is not image-enriched: ${row.asset}.`);
        }
      }

      if (!visualAssetPattern.test(row.asset)) {
        failures.push(`Row ${rowNumber} public asset must name a visual, image, video, carousel, card, or album plan.`);
      }
    }

    for (const pattern of blockedCopyPatterns) {
      if (pattern.test(row.draft_copy)) {
        failures.push(`Row ${rowNumber} draft_copy contains blocked language: ${pattern.source}`);
      }
    }
  }

  if (publicRows.length < 20) {
    failures.push(`Expected at least 20 public Page/Group rows, found ${publicRows.length}.`);
  }

  if (failures.length > 0) {
    throw new Error(`Facebook organic calendar failed checks:\n- ${failures.join("\n- ")}`);
  }
}

const csv = readFileSync(calendarPath, "utf8");
const rows = toRows(parseCsv(csv));
assertCalendar(rows);

const channelCounts = rows.reduce<Record<string, number>>((counts, row) => {
  counts[row.channel] = (counts[row.channel] ?? 0) + 1;
  return counts;
}, {});

console.log(`Facebook organic calendar OK: ${rows.length} rows (${calendarPath}).`);
console.log(
  Object.entries(channelCounts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([channel, count]) => `${channel}: ${count}`)
    .join(" | "),
);
