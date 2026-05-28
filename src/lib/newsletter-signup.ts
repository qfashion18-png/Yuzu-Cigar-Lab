export const newsletterSignupStorageKey = "yuzu-newsletter-signups-v1";

export type NewsletterTier = "box_access_pass" | "kisha" | "sensei" | "daimyo";

export const newsletterBrandOptions = [
  { value: "padron", label: "Padron" },
  { value: "arturo_fuente", label: "Arturo Fuente" },
  { value: "davidoff", label: "Davidoff" },
  { value: "drew_estate", label: "Drew Estate" },
  { value: "my_father", label: "My Father" },
  { value: "oliva", label: "Oliva" },
  { value: "rocky_patel", label: "Rocky Patel" },
  { value: "perdomo", label: "Perdomo" },
] as const;

export type NewsletterBrandPreference = (typeof newsletterBrandOptions)[number]["value"];

export type NewsletterPromotedCigar = {
  slug: string;
  name: string;
  brand: string;
  storeHref: string;
  nonMemberPrice: number;
  memberPrice: number;
  packageLabel?: string;
  image?: string;
};

export type NewsletterPromotionProduct = {
  slug?: string;
  name?: string;
  brand?: string;
  storeHref?: string;
  nonMemberPrice?: number;
  memberPrice?: number;
  packageLabel?: string;
  image?: string;
  availability?: string;
  publishStatus?: string;
};

const defaultNewsletterPromotionProducts: NewsletterPromotionProduct[] = [
  {
    slug: "arturo-fuente-curly-head-natural-4o-bx",
    name: "Arturo Fuente Curly Head Natural",
    brand: "Arturo Fuente",
    storeHref: "/shop/arturo-fuente-curly-head-natural-4o-bx/",
    nonMemberPrice: 255.97,
    memberPrice: 135,
    packageLabel: "Catalog item",
    image: "/assets/product-fuente.png",
    availability: "In stock",
    publishStatus: "published",
  },
  {
    slug: "davidoff-winston-churchill-petit-pantela-5-5-tins",
    name: "Davidoff Winston Churchill Petit Panetela",
    brand: "Davidoff",
    storeHref: "/shop/davidoff-winston-churchill-petit-pantela-5-5-tins/",
    nonMemberPrice: 244.95,
    memberPrice: 157,
    packageLabel: "5 x 5 tins",
    image: "/assets/product-davidoff.png",
    availability: "In stock",
    publishStatus: "published",
  },
  {
    slug: "drew-estate-java-maduro-robusto-24-bx",
    name: "Drew Estate Java Maduro Robusto",
    brand: "Drew Estate",
    storeHref: "/shop/drew-estate-java-maduro-robusto-24-bx/",
    nonMemberPrice: 300.72,
    memberPrice: 169,
    packageLabel: "Box of 24",
    image: "https://swwest.com/Images/SunsetItems/2441/0.jpg",
    availability: "In stock",
    publishStatus: "published",
  },
  {
    slug: "my-father-la-promesa-toro-20-bx",
    name: "My Father La Promesa Toro",
    brand: "My Father",
    storeHref: "/shop/my-father-la-promesa-toro-20-bx/",
    nonMemberPrice: 320,
    memberPrice: 144,
    packageLabel: "Box of 20",
    image: "https://swwest.com/Images/SunsetItems/41451/0.jpg",
    availability: "In stock",
    publishStatus: "published",
  },
  {
    slug: "oliva-serie-g-special-g-natural-48-bx",
    name: "Oliva Serie G Special G Natural",
    brand: "Oliva",
    storeHref: "/shop/oliva-serie-g-special-g-natural-48-bx/",
    nonMemberPrice: 326.62,
    memberPrice: 207,
    packageLabel: "Box of 48",
    image: "https://swwest.com/Images/SunsetItems/2101/0.jpg",
    availability: "In stock",
    publishStatus: "published",
  },
  {
    slug: "rocky-patel-juniors-sungrown-10-5-tins",
    name: "Rocky Patel Juniors Sungrown",
    brand: "Rocky Patel",
    storeHref: "/shop/rocky-patel-juniors-sungrown-10-5-tins/",
    nonMemberPrice: 949.5,
    memberPrice: 137,
    packageLabel: "10 x 5 tins",
    image: "https://swwest.com/Images/SunsetItems/15943/0.jpg",
    availability: "In stock",
    publishStatus: "published",
  },
  {
    slug: "perdomo-10th-ann-champagne-magnum-tubo-12-bx",
    name: "Perdomo 10th Anniversary Champagne Magnum Tubo",
    brand: "Perdomo",
    storeHref: "/shop/perdomo-10th-ann-champagne-magnum-tubo-12-bx/",
    nonMemberPrice: 239.06,
    memberPrice: 80,
    packageLabel: "Box of 12",
    image: "https://swwest.com/Images/SunsetItems/4453/0.jpg",
    availability: "In stock",
    publishStatus: "published",
  },
];

export type NewsletterSignupInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  wantsMonthlyMembership?: boolean;
  preferredTier?: string;
  source?: string;
  consent?: boolean;
  pagePath?: string;
  brandPreferences?: string[];
  promotedCigars?: NewsletterPromotedCigar[];
};

export type NewsletterSignupPayload = {
  consent: true;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  pagePath?: string;
  phone?: string;
  preferredTier?: NewsletterTier;
  source: string;
  wantsMonthlyMembership: boolean;
  brandPreferences?: NewsletterBrandPreference[];
  promotedCigars?: NewsletterPromotedCigar[];
};

export type NewsletterSignupRecord = NewsletterSignupPayload & {
  id: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: "local" | "synced" | "sync_pending";
  syncedAt?: string;
};

type NewsletterStorage = Pick<Storage, "getItem" | "setItem">;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tierAliases: Record<string, NewsletterTier> = {
  "box access pass": "box_access_pass",
  box_access_pass: "box_access_pass",
  boxaccesspass: "box_access_pass",
  kisha: "kisha",
  sensei: "sensei",
  daimyo: "daimyo",
};

const brandPreferenceAliases: Record<string, NewsletterBrandPreference> = {
  arturo_fuente: "arturo_fuente",
  arturofuente: "arturo_fuente",
  davidoff: "davidoff",
  drew_estate: "drew_estate",
  drewestate: "drew_estate",
  my_father: "my_father",
  myfather: "my_father",
  oliva: "oliva",
  padron: "padron",
  perdomo: "perdomo",
  rocky_patel: "rocky_patel",
  rockypatel: "rocky_patel",
};

export function buildNewsletterSignupPayload(input: NewsletterSignupInput): NewsletterSignupPayload {
  const email = normalizeEmail(input.email);
  if (!email) {
    throw new Error("Enter a valid email address.");
  }

  if (input.consent !== true) {
    throw new Error("Marketing consent is required.");
  }

  const firstName = compactText(input.firstName, 80);
  const lastName = compactText(input.lastName, 80);
  const explicitFullName = compactText(input.fullName ?? input.name, 160);
  const fullName = explicitFullName || compactText([firstName, lastName].filter(Boolean).join(" "), 160);
  const preferredTier = normalizeNewsletterTier(input.preferredTier);
  const brandPreferences = normalizeNewsletterBrandPreferences(input.brandPreferences);
  const promotedCigars = normalizeNewsletterPromotedCigars(input.promotedCigars);
  const selectedPromotedCigars = promotedCigars.length
    ? promotedCigars
    : buildNewsletterPromotedCigars(brandPreferences);

  return removeUndefined({
    consent: true,
    email,
    firstName,
    lastName,
    fullName,
    pagePath: compactText(input.pagePath, 180),
    phone: compactText(input.phone, 40),
    preferredTier,
    source: compactText(input.source, 80) || "website",
    wantsMonthlyMembership: Boolean(input.wantsMonthlyMembership || preferredTier),
    brandPreferences: brandPreferences.length ? brandPreferences : undefined,
    promotedCigars: selectedPromotedCigars.length ? selectedPromotedCigars : undefined,
  });
}

export function normalizeNewsletterBrandPreferences(value: unknown, maxItems = 5): NewsletterBrandPreference[] {
  const candidates = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n;]/) : [];
  const preferences: NewsletterBrandPreference[] = [];

  for (const candidate of candidates) {
    const normalized = brandPreferenceAliases[normalizeBrandKey(candidate)];
    if (normalized && !preferences.includes(normalized)) {
      preferences.push(normalized);
    }

    if (preferences.length >= maxItems) {
      break;
    }
  }

  return preferences;
}

export function buildNewsletterPromotedCigars(
  brandPreferences: readonly string[],
  products: readonly NewsletterPromotionProduct[] = defaultNewsletterPromotionProducts,
  limit = 3
): NewsletterPromotedCigar[] {
  const selectedBrands = normalizeNewsletterBrandPreferences([...brandPreferences], 5);
  if (!selectedBrands.length || limit <= 0) {
    return [];
  }

  const candidates = products
    .map((product) => ({
      product,
      normalizedBrand: normalizeNewsletterBrandPreferences([product.brand ?? ""])[0],
      score: scoreNewsletterPromotionProduct(product),
    }))
    .filter(({ product, normalizedBrand }) => {
      return Boolean(
        normalizedBrand &&
          selectedBrands.includes(normalizedBrand) &&
          compactText(product.slug, 180) &&
          compactText(product.name, 180) &&
          compactText(product.brand, 80) &&
          normalizeMoney(product.nonMemberPrice) > 0 &&
          normalizeMoney(product.memberPrice) > 0 &&
          compactText(product.publishStatus, 40) !== "draft"
      );
    })
    .sort((a, b) => b.score - a.score);

  const picked: NewsletterPromotedCigar[] = [];
  const usedSlugs = new Set<string>();

  for (const brand of selectedBrands) {
    const match = candidates.find(({ product, normalizedBrand }) => normalizedBrand === brand && !usedSlugs.has(product.slug ?? ""));
    if (match) {
      const promotedCigar = toNewsletterPromotedCigar(match.product);
      picked.push(promotedCigar);
      usedSlugs.add(promotedCigar.slug);
    }

    if (picked.length >= limit) {
      return picked;
    }
  }

  for (const candidate of candidates) {
    const promotedCigar = toNewsletterPromotedCigar(candidate.product);
    if (!usedSlugs.has(promotedCigar.slug)) {
      picked.push(promotedCigar);
      usedSlugs.add(promotedCigar.slug);
    }

    if (picked.length >= limit) {
      break;
    }
  }

  return picked;
}

export function normalizeNewsletterPromotedCigars(value: unknown, maxItems = 4): NewsletterPromotedCigar[] {
  const candidates = Array.isArray(value) ? value : [];
  const promotedCigars: NewsletterPromotedCigar[] = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const promotedCigar = toNewsletterPromotedCigar(candidate as NewsletterPromotionProduct);
    if (promotedCigar.slug && promotedCigar.name && promotedCigar.brand && promotedCigar.nonMemberPrice > 0) {
      promotedCigars.push(promotedCigar);
    }

    if (promotedCigars.length >= maxItems) {
      break;
    }
  }

  return promotedCigars;
}

export function createLocalNewsletterStore(storage: NewsletterStorage) {
  return {
    list() {
      return readNewsletterRecords(storage);
    },
    save(payload: NewsletterSignupPayload, syncStatus: NewsletterSignupRecord["syncStatus"] = "local") {
      const now = new Date().toISOString();
      const records = readNewsletterRecords(storage);
      const existingIndex = records.findIndex((record) => record.email.toLowerCase() === payload.email.toLowerCase());
      const existing = existingIndex >= 0 ? records[existingIndex] : null;
      const record: NewsletterSignupRecord = {
        ...(existing ?? {
          id: `newsletter_${hashString(payload.email)}`,
          createdAt: now,
        }),
        ...payload,
        syncStatus,
        updatedAt: now,
        ...(syncStatus === "synced" ? { syncedAt: now } : {}),
      };
      const nextRecords = existingIndex >= 0 ? [...records] : [...records, record];

      if (existingIndex >= 0) {
        nextRecords[existingIndex] = record;
      }

      storage.setItem(newsletterSignupStorageKey, JSON.stringify(nextRecords));
      return record;
    },
  };
}

export function getNewsletterSignupEndpoint(apiBaseUrl = process.env.NEXT_PUBLIC_YCC_API_BASE_URL ?? "") {
  const trimmed = apiBaseUrl.trim().replace(/\/+$/, "");
  return trimmed ? `${trimmed}/newsletter/subscribe` : null;
}

export async function syncNewsletterSignup(payload: NewsletterSignupPayload, apiBaseUrl?: string) {
  const endpoint = getNewsletterSignupEndpoint(apiBaseUrl);
  if (!endpoint) {
    return { synced: false as const, reason: "missing_endpoint" as const };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { synced: false as const, reason: "request_failed" as const, status: response.status };
  }

  const body = (await response.json().catch(() => null)) as { requestId?: string } | null;
  return { synced: true as const, requestId: body?.requestId ?? null };
}

function readNewsletterRecords(storage: NewsletterStorage): NewsletterSignupRecord[] {
  try {
    const parsed = JSON.parse(storage.getItem(newsletterSignupStorageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isNewsletterSignupRecord) : [];
  } catch {
    return [];
  }
}

function isNewsletterSignupRecord(value: unknown): value is NewsletterSignupRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as NewsletterSignupRecord).email === "string" &&
      typeof (value as NewsletterSignupRecord).id === "string"
  );
}

function normalizeEmail(value: string) {
  const normalized = compactText(value, 254).toLowerCase();
  return emailPattern.test(normalized) ? normalized : "";
}

function normalizeNewsletterTier(value: string | undefined): NewsletterTier | undefined {
  const normalized = compactText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return tierAliases[normalized] ?? tierAliases[normalized.replace(/_/g, " ")];
}

function normalizeBrandKey(value: unknown) {
  return compactText(value, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toNewsletterPromotedCigar(product: NewsletterPromotionProduct): NewsletterPromotedCigar {
  const slug = compactText(product.slug, 180);
  const memberPrice = normalizeMoney(product.memberPrice);
  const nonMemberPrice = normalizeMoney(product.nonMemberPrice);
  const storeHref = compactText(product.storeHref, 240) || `/shop/${slug}/`;

  return removeUndefined({
    slug,
    name: compactText(product.name, 180),
    brand: compactText(product.brand, 80),
    storeHref,
    nonMemberPrice,
    memberPrice: memberPrice || nonMemberPrice,
    packageLabel: compactText(product.packageLabel, 80),
    image: compactText(product.image, 500),
  });
}

function scoreNewsletterPromotionProduct(product: NewsletterPromotionProduct) {
  const availability = compactText(product.availability, 40).toLowerCase();
  const stockScore = availability.includes("in stock") || availability.includes("low stock") ? 1000 : 0;
  const savingsScore = Math.max(0, normalizeMoney(product.nonMemberPrice) - normalizeMoney(product.memberPrice));

  return stockScore + savingsScore;
}

function normalizeMoney(value: unknown) {
  const amount = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
}

function compactText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== "")) as T;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}
