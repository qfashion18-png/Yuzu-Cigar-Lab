const structuredSpecMarker = /\s+(?:Country of Origin|Country|Origin|Wrapper|Shape|Profile|Strength|Sold as):\s*/i;
const sentenceBoundary = /[.!?](?=\s|$)/g;
const abbreviationPattern = /(?:\b[A-Z](?:\.[A-Z])+|\b(?:Co|Dr|Inc|Jr|Mr|Mrs|Ms|No|Prof|Sr|St))\.$/i;

export type ProductPageCopy = {
  lead: string;
  story: string;
  narrative: string;
  metaDescription: string;
};

const productPageCopyOverrides: Record<string, Pick<ProductPageCopy, "lead" | "story">> = {
  "11279": {
    lead: "A four-cigar J.C. Newman tasting set pairing Brick House and Perla del Mar selections in one sealed sampler.",
    story:
      "Natural, Maduro, and Connecticut Shade expressions give the assortment genuine range for side-by-side tasting, sharing, or gifting.",
  },
};

export function buildProductPageCopy(description: string, sku?: string): ProductPageCopy {
  const override = sku ? productPageCopyOverrides[sku] : undefined;
  const normalized = description.replace(/\s+/g, " ").trim();
  const importedNarrative = stripStructuredSpecSuffix(normalized);
  const [lead, story] = override ? [override.lead, override.story] : splitLeadFromStory(importedNarrative);
  const narrative = [lead, story].filter(Boolean).join(" ");

  return {
    lead,
    story,
    narrative,
    metaDescription: truncateAtWord(narrative, 158),
  };
}

function stripStructuredSpecSuffix(value: string) {
  const match = structuredSpecMarker.exec(value);

  if (!match || match.index < 80) {
    return value;
  }

  return value.slice(0, match.index).trim();
}

function splitLeadFromStory(value: string): [lead: string, story: string] {
  if (!value) {
    return ["Product details are being prepared.", ""];
  }

  for (const match of value.matchAll(sentenceBoundary)) {
    const boundary = (match.index ?? 0) + match[0].length;
    const candidate = value.slice(0, boundary).trim();

    if (abbreviationPattern.test(candidate) || boundary < 90) {
      continue;
    }

    if (boundary <= 280) {
      return [candidate, value.slice(boundary).trim()];
    }

    break;
  }

  if (value.length <= 220) {
    return [value, ""];
  }

  const splitAt = findWordBoundary(value, 220);
  return [`${value.slice(0, splitAt).trimEnd()}…`, value.slice(splitAt).trimStart()];
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const splitAt = findWordBoundary(value, maxLength - 1);
  return `${value.slice(0, splitAt).trimEnd()}…`;
}

function findWordBoundary(value: string, maxLength: number) {
  const boundary = value.lastIndexOf(" ", maxLength);
  return boundary > maxLength * 0.65 ? boundary : maxLength;
}
