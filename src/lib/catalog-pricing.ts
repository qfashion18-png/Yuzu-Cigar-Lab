export type CatalogPricingInput = {
  currentPrice: number;
  marketPrice?: number | null;
};

export type CatalogPricing = {
  marketPrice: number;
  nonMemberPrice: number;
  memberPrice: number;
};

export type ProductPriceView = {
  price: number;
  nonMemberPrice?: number;
  memberPrice?: number;
};

export function calculateCatalogPricing({ currentPrice, marketPrice }: CatalogPricingInput): CatalogPricing {
  const normalizedCurrentPrice = roundCurrency(currentPrice);
  const normalizedMarketPrice =
    Number.isFinite(Number(marketPrice)) && Number(marketPrice) > 0
      ? roundCurrency(Number(marketPrice))
      : normalizedCurrentPrice;

  return {
    marketPrice: normalizedMarketPrice,
    nonMemberPrice: normalizedMarketPrice,
    memberPrice: normalizedCurrentPrice,
  };
}

export function isCatalogPricingPublishable(input: CatalogPricingInput) {
  const pricing = calculateCatalogPricing(input);

  return pricing.nonMemberPrice >= pricing.memberPrice;
}

export function resolveVisibleProductPrice(product: ProductPriceView, isMember: boolean) {
  if (isMember && Number.isFinite(Number(product.memberPrice)) && Number(product.memberPrice) > 0) {
    return roundCurrency(Number(product.memberPrice));
  }

  if (Number.isFinite(Number(product.nonMemberPrice)) && Number(product.nonMemberPrice) > 0) {
    return roundCurrency(Number(product.nonMemberPrice));
  }

  return roundCurrency(product.price);
}

export function formatCatalogPrice(amount: number) {
  return amount > 0 ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: hasCents(amount) ? 2 : 0, maximumFractionDigits: 2 })}` : "Ask";
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function hasCents(amount: number) {
  return Math.abs(amount - Math.round(amount)) > 0.001;
}
