import { catalogProducts, type CatalogProduct } from "@/lib/catalog";
import { resolveVisibleProductPrice } from "@/lib/catalog-pricing";
import type { HumidorItemInput } from "@/lib/live-api";

export const humidorEntryPriceSnapshotSource = "entry_catalog_price_snapshot";

export type HumidorEntryPriceSnapshot = {
  boxPrice: number;
  currency: "USD";
  packageCount: number;
  packageLabel: string;
  productName: string;
  productSku: string;
  unitPrice: number;
};

type HumidorPriceLookupInput = Pick<HumidorItemInput, "brand" | "line" | "name" | "vitola">;

const minimumCatalogMatchScore = 72;
const ignoredPriceMatchTokens = new Set([
  "and",
  "box",
  "bx",
  "cigar",
  "cigars",
  "count",
  "ct",
  "fresh",
  "new",
  "of",
  "pack",
  "tin",
  "tins",
  "the",
]);

export function resolveHumidorEntryPriceSnapshot(
  input: HumidorPriceLookupInput,
  isMember: boolean,
): HumidorEntryPriceSnapshot | null {
  const product = findCatalogProductForHumidorItem(input);

  if (!product) {
    return null;
  }

  const boxPrice = resolveVisibleProductPrice(product, isMember);
  const packageCount = Math.max(1, product.packageCount || 1);
  const unitPrice = roundCurrency(boxPrice / packageCount);

  return {
    boxPrice,
    currency: "USD",
    packageCount,
    packageLabel: product.packageLabel,
    productName: product.name,
    productSku: product.sku,
    unitPrice,
  };
}

export function applyHumidorEntryPriceSnapshot<T extends HumidorItemInput>(input: T, isMember: boolean): T {
  const snapshot = resolveHumidorEntryPriceSnapshot(input, isMember);

  return {
    ...input,
    estimatedValue: snapshot?.unitPrice ?? null,
    estimatedValueCurrency: snapshot?.currency ?? "",
    estimatedValueSource: snapshot ? humidorEntryPriceSnapshotSource : "",
  };
}

function findCatalogProductForHumidorItem(input: HumidorPriceLookupInput) {
  const queryTokens = getUsefulTokens([input.brand, input.name, input.line, input.vitola].filter(Boolean).join(" "));

  if (queryTokens.length < 2) {
    return null;
  }

  const brandText = normalizeSearchText(input.brand);
  const brandTokens = getUsefulTokens(input.brand);
  const nameText = normalizeSearchText(input.name);
  const lineText = normalizeSearchText(input.line);
  const vitolaText = normalizeSearchText(input.vitola);
  let best: { product: CatalogProduct; score: number } | null = null;

  for (const product of catalogProducts) {
    const productText = normalizeSearchText(
      [product.brand, product.name, product.vitola, product.wrapper, product.origin].filter(Boolean).join(" "),
    );
    const productTokens = new Set(getUsefulTokens(productText));
    let score = Math.round(getTokenOverlap(queryTokens, productTokens) * 45);

    if (brandText) {
      const productBrandText = normalizeSearchText(product.brand);
      const brandOverlap = getTokenOverlap(brandTokens, productTokens);

      if (productBrandText === brandText) {
        score += 50;
      } else if (brandOverlap >= 0.8) {
        score += 35;
      } else if (!containsNormalized(productText, brandText)) {
        score -= 10;
      }
    }

    if (containsNormalized(productText, nameText)) {
      score += 35;
    }

    if (containsNormalized(productText, lineText)) {
      score += 20;
    }

    if (containsNormalized(productText, vitolaText)) {
      score += 12;
    }

    if (product.availability === "Out of stock") {
      score -= 4;
    }

    if (!best || score > best.score) {
      best = { product, score };
    }
  }

  return best && best.score >= minimumCatalogMatchScore ? best.product : null;
}

function getTokenOverlap(tokens: string[], target: Set<string>) {
  if (!tokens.length) {
    return 0;
  }

  const hits = tokens.filter((token) => target.has(token)).length;
  return hits / tokens.length;
}

function containsNormalized(source: string, value: string) {
  return Boolean(value && source.includes(value));
}

function getUsefulTokens(value: string | null | undefined) {
  return Array.from(
    new Set(
      normalizeSearchText(value)
        .split(" ")
        .filter((token) => token.length > 1 && !ignoredPriceMatchTokens.has(token)),
    ),
  );
}

function normalizeSearchText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
