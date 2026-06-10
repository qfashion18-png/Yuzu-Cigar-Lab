export type ProductImageSeoInput = {
  name: string;
  image: string;
  category?: string;
  packageLabel?: string;
  brand?: string;
  wrapper?: string;
  vitola?: string;
  strength?: string;
};

export type EventImageSeoInput = {
  title: string;
  location?: string;
  date?: string;
};

export type EditorialImageSeoInput = {
  title: string;
  sourceName?: string;
  label?: string;
};

const maxAltLength = 125;
const fallbackGiftBoxImage = "/assets/gift-box.png";

export function buildProductImageAlt(product: ProductImageSeoInput) {
  const name = normalizeAltText(product.name);
  const details = [
    product.packageLabel,
    product.vitola,
    product.wrapper ? `${product.wrapper} wrapper` : undefined,
    product.strength ? `${product.strength} strength` : undefined,
  ]
    .map((value) => normalizeAltText(value ?? ""))
    .filter(Boolean);

  if (isFallbackGiftBox(product.image)) {
    return fitAltText(`Yuzu premium cigar gift box representing ${name}`, details);
  }

  return fitAltText(`${name} ${getProductImageNoun(product)}`, details);
}

export function buildEventImageAlt(event: EventImageSeoInput) {
  return fitAltText(`${normalizeAltText(event.title)} cigar event setting`, [event.location, event.date].filter(Boolean) as string[]);
}

export function buildEditorialImageAlt(input: EditorialImageSeoInput) {
  const lead = input.label
    ? `${normalizeAltText(input.label)} cigar news visual`
    : `${normalizeAltText(input.title)} cigar news visual`;

  return fitAltText(lead, [input.sourceName, input.label && input.label !== input.title ? input.title : undefined].filter(Boolean) as string[]);
}

function getProductImageNoun(product: ProductImageSeoInput) {
  const category = product.category?.toLowerCase() ?? "";
  const image = product.image.toLowerCase();

  if (category.includes("lighter") || category.includes("torch") || image.includes("single-lighter")) {
    return "cigar lighter";
  }

  if (category.includes("butane") || category.includes("fluid")) {
    return "butane refill accessory";
  }

  if (category.includes("humidor")) {
    return "cigar humidor";
  }

  if (category.includes("sample") || product.vitola?.toLowerCase() === "sampler") {
    return "premium cigar sampler";
  }

  if (image.includes("open-box") || image.includes("open-tin")) {
    return "open premium cigar box";
  }

  return "premium cigar box";
}

function fitAltText(lead: string, details: string[]) {
  const detailParts = [...new Set(details)];

  while (detailParts.length > 0) {
    const candidate = `${lead} with ${detailParts.join(", ")}`;

    if (candidate.length <= maxAltLength) {
      return candidate;
    }

    detailParts.pop();
  }

  return truncateAtWord(lead, maxAltLength);
}

function normalizeAltText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isFallbackGiftBox(image: string) {
  return image.trim() === fallbackGiftBoxImage;
}

function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(" ");

  return `${truncated.slice(0, lastSpace > 60 ? lastSpace : truncated.length).trimEnd()}...`;
}
