export type HumidorTastingNoteDetail = {
  label: string;
  value: string;
};

export type HumidorTastingNoteFormat = {
  paragraphs: string[];
  details: HumidorTastingNoteDetail[];
};

const pulledDetailsMarker = /(?:^|\s)Pulled cigar details:\s*/i;
const keyedDetailPattern = /(?:^|\s)-\s*([A-Za-z][A-Za-z0-9 /&().-]{1,80}):\s*([\s\S]*?)(?=\s+-\s*[A-Za-z][A-Za-z0-9 /&().-]{1,80}:\s*|$)/g;

export function formatHumidorTastingNote(value: string): HumidorTastingNoteFormat {
  const note = normalizeNoteWhitespace(value);

  if (!note) {
    return {
      paragraphs: [],
      details: [],
    };
  }

  const markerMatch = note.match(pulledDetailsMarker);
  if (!markerMatch?.index && markerMatch?.index !== 0) {
    return {
      paragraphs: splitNoteParagraphs(note),
      details: [],
    };
  }

  const markerStart = markerMatch.index;
  const markerEnd = markerStart + markerMatch[0].length;
  const lead = note.slice(0, markerStart).trim();
  const detailsText = note.slice(markerEnd).trim();

  return {
    paragraphs: splitNoteParagraphs(lead),
    details: parseKeyedDetails(detailsText),
  };
}

function normalizeNoteWhitespace(value: string) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function splitNoteParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseKeyedDetails(value: string): HumidorTastingNoteDetail[] {
  const details: HumidorTastingNoteDetail[] = [];

  for (const match of value.matchAll(keyedDetailPattern)) {
    const label = normalizeDetailLabel(match[1]);
    const detailValue = normalizeDetailValue(match[2]);

    if (label && detailValue) {
      details.push({ label, value: detailValue });
    }
  }

  if (!details.length && value.trim()) {
    details.push({
      label: "Details",
      value: normalizeDetailValue(value),
    });
  }

  return details;
}

function normalizeDetailLabel(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeDetailValue(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s+\./g, ".").trim();
}
